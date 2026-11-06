import type { AppState } from '../../types';
import { ApiError, platformApi, type PlatformKind, type Session } from '../cloud';
import { migrate } from '../state';
import { PlatformError, findOverlap, uid, validateBooking, type PlatformBackend } from './backend';
import type { ActivityEvent, ActivityType, Booking, BookingInput, Feedback, FeedbackKind, Homework, HomeworkActivity, HomeworkResult, Person } from './types';

// ───────────────────────────────────────────────────────────────
// The teaching platform for real accounts: every record lives in the
// account backend (Supabase, `lwd_platform`) and is scoped server-side —
// a student only ever receives their own rows, the teacher her students'.
// Reads are coalesced per backend instance (the provider makes a fresh
// instance after every mutation), so one dashboard render is a handful
// of small requests. Offline, reads fail with a clear message; learning
// progress itself keeps syncing through the account provider as before.
// ───────────────────────────────────────────────────────────────

function toPlatformError(e: unknown): PlatformError {
  if (e instanceof PlatformError) return e;
  const err = e as ApiError;
  if (err instanceof ApiError) {
    if (err.status === 0) return new PlatformError('offline', 'You appear to be offline — lessons and homework need a connection.');
    if (err.code === 'overlap') return new PlatformError('overlap', err.message, { clash: err.data.clash });
    if (err.status === 403) return new PlatformError('forbidden', err.message);
    if (err.status === 404) return new PlatformError('not_found', err.message);
    if (err.status === 401) return new PlatformError('forbidden', 'Your session has ended. Please log in again.');
    return new PlatformError('invalid', err.message);
  }
  return new PlatformError('invalid', (e as Error)?.message || 'Something went wrong.');
}

class CloudBackend implements PlatformBackend {
  readonly kind = 'cloud' as const;
  private cache = new Map<string, Promise<unknown>>();
  constructor(private session: Session, readonly actor: Person) {}

  private get token() {
    return this.session.token;
  }
  private iso() {
    return new Date().toISOString();
  }
  private isTeacher() {
    return this.actor.role === 'teacher';
  }
  private assertTeacher() {
    if (!this.isTeacher()) throw new PlatformError('forbidden', 'Only the teacher can do that.');
  }
  private async wrap<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      throw toPlatformError(e);
    }
  }
  private records<T>(kind: PlatformKind, studentId?: string): Promise<T[]> {
    const key = `${kind}|${studentId ?? ''}`;
    let p = this.cache.get(key) as Promise<T[]> | undefined;
    if (!p) {
      p = this.wrap(async () => (await platformApi.records<T>(this.token, kind, studentId)).records);
      this.cache.set(key, p);
      p.catch(() => this.cache.delete(key));
    }
    return p;
  }
  private async put<T>(kind: PlatformKind, id: string, studentId: string, data: T): Promise<T> {
    const r = await this.wrap(() => platformApi.put<T>(this.token, kind, id, studentId, data));
    this.cache.clear();
    return r.record;
  }

  async people(): Promise<Person[]> {
    const key = 'people';
    let p = this.cache.get(key) as Promise<Person[]> | undefined;
    if (!p) {
      p = this.wrap(async () => (await platformApi.people(this.token)).people);
      this.cache.set(key, p);
      p.catch(() => this.cache.delete(key));
    }
    return p;
  }

  async studentProgress(studentId: string): Promise<AppState | null> {
    if (!this.isTeacher() && studentId !== this.actor.id) throw new PlatformError('forbidden', 'You can only see your own records.');
    const r = await this.wrap(() => platformApi.progress(this.token, studentId));
    return r.data ? migrate(r.data as AppState) : null;
  }

  async bookings(opts: { studentId?: string; from?: string; to?: string; includeCancelled?: boolean } = {}) {
    let list = await this.records<Booking>('booking', opts.studentId);
    if (!opts.includeCancelled) list = list.filter((b) => b.status !== 'cancelled');
    if (opts.from) list = list.filter((b) => b.startsAt >= opts.from!);
    if (opts.to) list = list.filter((b) => b.startsAt < opts.to!);
    return [...list].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  async createBooking(input: BookingInput) {
    this.assertTeacher();
    const err = validateBooking(input);
    if (err) throw new PlatformError('invalid', err);
    const clash = findOverlap(await this.records<Booking>('booking'), this.actor.id, input.startsAt, input.durationMin);
    if (clash) throw new PlatformError('overlap', 'That time overlaps another lesson.', { clash });
    const b: Booking = { ...input, id: uid(), teacherId: this.actor.id, status: 'scheduled', createdAt: this.iso(), updatedAt: this.iso() };
    const saved = await this.put('booking', b.id, b.studentId, b);
    await this.logActivity('lesson', `Lesson booked: ${b.topic}`, b.studentId);
    return saved;
  }

  async updateBooking(id: string, patch: Partial<BookingInput> & { status?: Booking['status'] }) {
    this.assertTeacher();
    const all = await this.records<Booking>('booking');
    const cur = all.find((b) => b.id === id);
    if (!cur) throw new PlatformError('not_found', 'Lesson not found.');
    const next: Booking = { ...cur, ...patch, updatedAt: this.iso() };
    const err = validateBooking(next);
    if (err) throw new PlatformError('invalid', err);
    if (next.status === 'scheduled') {
      const clash = findOverlap(all, this.actor.id, next.startsAt, next.durationMin, id);
      if (clash) throw new PlatformError('overlap', 'That time overlaps another lesson.', { clash });
    }
    const saved = await this.put('booking', id, next.studentId, next);
    if (patch.startsAt && patch.startsAt !== cur.startsAt) await this.logActivity('lesson', `Lesson rescheduled: ${next.topic}`, next.studentId);
    return saved;
  }

  async cancelBooking(id: string) {
    const b = await this.updateBooking(id, { status: 'cancelled' });
    await this.logActivity('lesson', `Lesson cancelled: ${b.topic}`, b.studentId);
    return b;
  }

  async homework(opts: { studentId?: string } = {}) {
    const list = await this.records<Homework>('homework', opts.studentId);
    return [...list].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  }

  async assignHomework(input: { studentIds: string[]; activity: HomeworkActivity; instructions: string; dueAt: string }) {
    this.assertTeacher();
    if (!input.studentIds.length) throw new PlatformError('invalid', 'Choose at least one student.');
    if (!input.activity?.title?.trim()) throw new PlatformError('invalid', 'Give the homework a title.');
    if (!input.dueAt || Number.isNaN(new Date(input.dueAt).getTime())) throw new PlatformError('invalid', 'Choose a deadline.');
    const items: Homework[] = [];
    for (const studentId of input.studentIds) {
      const h: Homework = { id: uid(), teacherId: this.actor.id, studentId, activity: input.activity, instructions: input.instructions, assignedAt: this.iso(), dueAt: input.dueAt, status: 'assigned' };
      items.push(await this.put('homework', h.id, studentId, h));
      await this.logActivity('homework', `Homework assigned: ${h.activity.title}`, studentId);
    }
    return items;
  }

  async updateHomework(id: string, patch: { instructions?: string; dueAt?: string; activity?: HomeworkActivity }) {
    this.assertTeacher();
    const cur = (await this.records<Homework>('homework')).find((h) => h.id === id);
    if (!cur) throw new PlatformError('not_found', 'Homework not found.');
    const next = { ...cur, ...patch };
    return this.put('homework', id, next.studentId, next);
  }

  async deleteHomework(id: string) {
    this.assertTeacher();
    await this.wrap(() => platformApi.remove(this.token, id));
    this.cache.clear();
  }

  async submitHomework(id: string, result: HomeworkResult) {
    const r = await this.wrap(() => platformApi.submitHomework<Homework>(this.token, id, { ...result, completedAt: result.completedAt || this.iso() }));
    this.cache.clear();
    await this.logActivity('homework', `Homework completed: ${r.record.activity.title}${result.summary ? ` — ${result.summary}` : ''}`, r.record.studentId);
    return r.record;
  }

  async reviewHomework(id: string, feedback: string) {
    this.assertTeacher();
    const cur = (await this.records<Homework>('homework')).find((h) => h.id === id);
    if (!cur) throw new PlatformError('not_found', 'Homework not found.');
    const next: Homework = { ...cur, status: 'reviewed', feedback: { body: feedback, at: this.iso() } };
    return this.put('homework', id, next.studentId, next);
  }

  async feedback(studentId?: string) {
    const list = await this.records<Feedback>('feedback', studentId);
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async addFeedback(input: { studentId: string; kind: FeedbackKind; body: string }) {
    this.assertTeacher();
    if (!input.body.trim()) throw new PlatformError('invalid', 'Write something first.');
    const f: Feedback = { id: uid(), teacherId: this.actor.id, studentId: input.studentId, kind: input.kind, body: input.body.trim(), createdAt: this.iso() };
    return this.put('feedback', f.id, f.studentId, f);
  }

  async deleteFeedback(id: string) {
    this.assertTeacher();
    await this.wrap(() => platformApi.remove(this.token, id));
    this.cache.clear();
  }

  async activity(opts: { studentId?: string; limit?: number } = {}) {
    const list = await this.records<ActivityEvent>('activity', opts.studentId);
    return [...list].sort((a, b) => b.at.localeCompare(a.at)).slice(0, opts.limit ?? 50);
  }

  async logActivity(type: ActivityType, label: string, studentId = this.actor.id) {
    const ev: ActivityEvent = { id: uid(), studentId, at: this.iso(), type, label };
    try {
      await this.put('activity', ev.id, studentId, ev);
    } catch {
      /* an activity line is never worth failing the action it describes */
    }
  }

  async addStudent(input: { username: string; firstName: string; password?: string }) {
    this.assertTeacher();
    const r = await this.wrap(() => platformApi.addStudent(this.token, input));
    this.cache.clear();
    return { user: r.user as Person, recoveryCode: r.recoveryCode, password: r.password };
  }
}

export function createCloudBackend(session: Session, me: Person): PlatformBackend {
  return new CloudBackend(session, me);
}
