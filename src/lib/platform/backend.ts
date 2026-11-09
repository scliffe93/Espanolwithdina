import type { AppState } from '../../types';
import type { ActivityEvent, ActivityType, Booking, BookingInput, Feedback, FeedbackKind, Homework, HomeworkActivity, HomeworkResult, PlatformData, Person } from './types';
import { overlaps } from './time';
import { followUpFor, type AdaptHomework } from '../../../supabase/functions/_shared/adapt';

// ───────────────────────────────────────────────────────────────
// The teaching platform API, as seen by the UI. Two implementations:
//  • DemoBackend  — the prototype: everything in this browser's IndexedDB
//                   (Dina, Sam and Anneka), no server, persists across reloads.
//  • CloudBackend — real accounts via the Supabase Edge Function (cloud.ts).
// Every method is scoped to `actor` (who is signed in / being demonstrated):
// a student only ever sees their own records; a teacher sees her students'.
// ───────────────────────────────────────────────────────────────

export class PlatformError extends Error {
  constructor(public code: 'forbidden' | 'not_found' | 'overlap' | 'invalid' | 'offline', message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

export interface PlatformBackend {
  readonly kind: 'demo' | 'cloud';
  readonly actor: Person;
  /** The teacher's students (teacher) or just yourself (student). */
  people(): Promise<Person[]>;
  /** A learner's full saved progress (teacher: any of her students; student: self). */
  studentProgress(studentId: string): Promise<AppState | null>;
  bookings(opts?: { studentId?: string; from?: string; to?: string; includeCancelled?: boolean }): Promise<Booking[]>;
  createBooking(input: BookingInput): Promise<Booking>;
  updateBooking(id: string, patch: Partial<BookingInput> & { status?: Booking['status'] }): Promise<Booking>;
  cancelBooking(id: string): Promise<Booking>;
  homework(opts?: { studentId?: string }): Promise<Homework[]>;
  assignHomework(input: { studentIds: string[]; activity: HomeworkActivity; instructions: string; dueAt: string; plan?: Homework['plan'] }): Promise<Homework[]>;
  updateHomework(id: string, patch: { instructions?: string; dueAt?: string; activity?: HomeworkActivity }): Promise<Homework>;
  deleteHomework(id: string): Promise<void>;
  submitHomework(id: string, result: HomeworkResult): Promise<Homework>;
  reviewHomework(id: string, feedback: string): Promise<Homework>;
  feedback(studentId?: string): Promise<Feedback[]>;
  addFeedback(input: { studentId: string; kind: FeedbackKind; body: string; debrief?: Feedback['debrief'] }): Promise<Feedback>;
  deleteFeedback(id: string): Promise<void>;
  activity(opts?: { studentId?: string; limit?: number }): Promise<ActivityEvent[]>;
  logActivity(type: ActivityType, label: string, studentId?: string): Promise<void>;
  /** Real accounts only: the teacher creates a student's account and gets the login details to pass on. */
  addStudent?(input: { username: string; firstName: string; password?: string }): Promise<{ user: Person; recoveryCode: string; password?: string }>;
}

export const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

/** Finds a scheduled booking for the same teacher that overlaps the proposed slot. */
export function findOverlap(all: Booking[], teacherId: string, startsAt: string, durationMin: number, ignoreId?: string): Booking | undefined {
  return all.find((b) => b.id !== ignoreId && b.teacherId === teacherId && b.status === 'scheduled' && overlaps(b.startsAt, b.durationMin, startsAt, durationMin));
}

export function validateBooking(input: Partial<BookingInput>): string | null {
  if (!input.studentId) return 'Choose a student.';
  if (!input.startsAt || Number.isNaN(new Date(input.startsAt).getTime())) return 'Choose a date and time.';
  if (!input.durationMin || input.durationMin < 15 || input.durationMin > 240) return 'Duration must be between 15 minutes and 4 hours.';
  if (input.format !== 'online' && input.format !== 'in-person') return 'Choose online or face-to-face.';
  if (!input.topic?.trim()) return 'Add a lesson topic.';
  if (!input.tz) return 'Choose a time zone.';
  return null;
}

// ── Demo backend ────────────────────────────────────────────────

/** Persistence for the demo workspace (injected so it can be tested without a browser). */
export interface DemoStorage {
  loadData(): Promise<PlatformData | null>;
  saveData(d: PlatformData): Promise<void>;
  loadStudentState(studentId: string): Promise<AppState | null>;
}

export class DemoBackend implements PlatformBackend {
  readonly kind = 'demo' as const;
  private data: PlatformData;
  constructor(readonly actor: Person, data: PlatformData, private storage: DemoStorage, private now: () => number = Date.now) {
    this.data = data;
  }

  get snapshot(): PlatformData {
    return this.data;
  }

  private iso() {
    return new Date(this.now()).toISOString();
  }
  private isTeacher() {
    return this.actor.role === 'teacher';
  }
  private assertStudentAccess(studentId: string) {
    if (this.isTeacher()) {
      if (!this.data.people.some((p) => p.id === studentId && p.role === 'student')) throw new PlatformError('not_found', 'Unknown student.');
    } else if (studentId !== this.actor.id) throw new PlatformError('forbidden', 'You can only see your own records.');
  }
  private assertTeacher() {
    if (!this.isTeacher()) throw new PlatformError('forbidden', 'Only the teacher can do that.');
  }
  private async commit(mutate: (d: PlatformData) => void) {
    const next: PlatformData = { ...this.data, bookings: [...this.data.bookings], homework: [...this.data.homework], feedback: [...this.data.feedback], activity: [...this.data.activity] };
    mutate(next);
    this.data = next;
    await this.storage.saveData(next);
  }

  async people() {
    return this.isTeacher() ? this.data.people.filter((p) => p.role === 'student') : this.data.people.filter((p) => p.id === this.actor.id);
  }

  async studentProgress(studentId: string) {
    this.assertStudentAccess(studentId);
    return this.storage.loadStudentState(studentId);
  }

  async bookings(opts: { studentId?: string; from?: string; to?: string; includeCancelled?: boolean } = {}) {
    let list = this.data.bookings.filter((b) => (this.isTeacher() ? b.teacherId === this.actor.id : b.studentId === this.actor.id));
    if (opts.studentId) list = list.filter((b) => b.studentId === opts.studentId);
    if (!opts.includeCancelled) list = list.filter((b) => b.status !== 'cancelled');
    if (opts.from) list = list.filter((b) => b.startsAt >= opts.from!);
    if (opts.to) list = list.filter((b) => b.startsAt < opts.to!);
    return list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  async createBooking(input: BookingInput) {
    this.assertTeacher();
    const err = validateBooking(input);
    if (err) throw new PlatformError('invalid', err);
    this.assertStudentAccess(input.studentId);
    const clash = findOverlap(this.data.bookings, this.actor.id, input.startsAt, input.durationMin);
    if (clash) throw new PlatformError('overlap', 'That time overlaps another lesson.', { clash });
    const b: Booking = { ...input, id: uid(), teacherId: this.actor.id, status: 'scheduled', createdAt: this.iso(), updatedAt: this.iso() };
    await this.commit((d) => { d.bookings.push(b); });
    await this.logActivity('lesson', `Lesson booked: ${b.topic}`, b.studentId);
    return b;
  }

  async updateBooking(id: string, patch: Partial<BookingInput> & { status?: Booking['status'] }) {
    this.assertTeacher();
    const cur = this.data.bookings.find((b) => b.id === id && b.teacherId === this.actor.id);
    if (!cur) throw new PlatformError('not_found', 'Lesson not found.');
    const next: Booking = { ...cur, ...patch, updatedAt: this.iso() };
    const err = validateBooking(next);
    if (err) throw new PlatformError('invalid', err);
    if (next.status === 'scheduled') {
      const clash = findOverlap(this.data.bookings, this.actor.id, next.startsAt, next.durationMin, id);
      if (clash) throw new PlatformError('overlap', 'That time overlaps another lesson.', { clash });
    }
    await this.commit((d) => { d.bookings = d.bookings.map((b) => (b.id === id ? next : b)); });
    if (patch.startsAt && patch.startsAt !== cur.startsAt) await this.logActivity('lesson', `Lesson rescheduled: ${next.topic}`, next.studentId);
    return next;
  }

  async cancelBooking(id: string) {
    const b = await this.updateBooking(id, { status: 'cancelled' });
    await this.logActivity('lesson', `Lesson cancelled: ${b.topic}`, b.studentId);
    return b;
  }

  async homework(opts: { studentId?: string } = {}) {
    let list = this.data.homework.filter((h) => (this.isTeacher() ? h.teacherId === this.actor.id : h.studentId === this.actor.id));
    if (opts.studentId) list = list.filter((h) => h.studentId === opts.studentId);
    return list.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  }

  async assignHomework(input: { studentIds: string[]; activity: HomeworkActivity; instructions: string; dueAt: string; plan?: Homework['plan'] }) {
    this.assertTeacher();
    if (!input.studentIds.length) throw new PlatformError('invalid', 'Choose at least one student.');
    if (!input.activity?.title?.trim()) throw new PlatformError('invalid', 'Give the homework a title.');
    if (!input.dueAt || Number.isNaN(new Date(input.dueAt).getTime())) throw new PlatformError('invalid', 'Choose a deadline.');
    for (const s of input.studentIds) this.assertStudentAccess(s);
    const items = input.studentIds.map<Homework>((studentId) => ({ id: uid(), teacherId: this.actor.id, studentId, activity: input.activity, instructions: input.instructions, assignedAt: this.iso(), dueAt: input.dueAt, status: 'assigned', ...(input.plan ? { plan: input.plan } : {}) }));
    await this.commit((d) => { d.homework.push(...items); });
    for (const h of items) await this.logActivity('homework', `Homework assigned: ${h.activity.title}`, h.studentId);
    return items;
  }

  async updateHomework(id: string, patch: { instructions?: string; dueAt?: string; activity?: HomeworkActivity }) {
    this.assertTeacher();
    const cur = this.data.homework.find((h) => h.id === id && h.teacherId === this.actor.id);
    if (!cur) throw new PlatformError('not_found', 'Homework not found.');
    const next = { ...cur, ...patch };
    await this.commit((d) => { d.homework = d.homework.map((h) => (h.id === id ? next : h)); });
    return next;
  }

  async deleteHomework(id: string) {
    this.assertTeacher();
    await this.commit((d) => { d.homework = d.homework.filter((h) => !(h.id === id && h.teacherId === this.actor.id)); });
  }

  async submitHomework(id: string, result: HomeworkResult) {
    const cur = this.data.homework.find((h) => h.id === id);
    if (!cur) throw new PlatformError('not_found', 'Homework not found.');
    if (!this.isTeacher() && cur.studentId !== this.actor.id) throw new PlatformError('forbidden', 'This homework belongs to someone else.');
    const next: Homework = { ...cur, status: cur.status === 'reviewed' ? 'reviewed' : 'submitted', result: { ...result, completedAt: result.completedAt || this.iso() } };
    const fid = `${id}-fu`;
    const followUp = this.data.homework.some((h) => h.id === fid) ? null : (followUpFor(next as unknown as AdaptHomework, this.iso(), fid) as unknown as Homework | null);
    await this.commit((d) => { d.homework = d.homework.map((h) => (h.id === id ? next : h)); if (followUp) d.homework.push(followUp); });
    if (followUp) await this.logActivity('homework', `${followUp.plan?.adaptive === 'retry' ? 'Re-try added' : 'Stretch task added'}: ${followUp.activity.title}`, next.studentId);
    await this.logActivity('homework', `Homework completed: ${next.activity.title}${result.summary ? ` — ${result.summary}` : ''}`, next.studentId);
    return next;
  }

  async reviewHomework(id: string, feedback: string) {
    this.assertTeacher();
    const cur = this.data.homework.find((h) => h.id === id && h.teacherId === this.actor.id);
    if (!cur) throw new PlatformError('not_found', 'Homework not found.');
    const next: Homework = { ...cur, status: 'reviewed', feedback: { body: feedback, at: this.iso() } };
    await this.commit((d) => { d.homework = d.homework.map((h) => (h.id === id ? next : h)); });
    return next;
  }

  async feedback(studentId?: string) {
    const list = this.data.feedback.filter((f) => (this.isTeacher() ? f.teacherId === this.actor.id : f.studentId === this.actor.id));
    return (studentId ? list.filter((f) => f.studentId === studentId) : list).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async addFeedback(input: { studentId: string; kind: FeedbackKind; body: string; debrief?: Feedback['debrief'] }) {
    this.assertTeacher();
    this.assertStudentAccess(input.studentId);
    if (!input.body.trim()) throw new PlatformError('invalid', 'Write something first.');
    const f: Feedback = { id: uid(), teacherId: this.actor.id, studentId: input.studentId, kind: input.kind, body: input.body.trim(), createdAt: this.iso(), ...(input.debrief ? { debrief: input.debrief } : {}) };
    await this.commit((d) => { d.feedback.unshift(f); });
    return f;
  }

  async deleteFeedback(id: string) {
    this.assertTeacher();
    await this.commit((d) => { d.feedback = d.feedback.filter((f) => !(f.id === id && f.teacherId === this.actor.id)); });
  }

  async activity(opts: { studentId?: string; limit?: number } = {}) {
    let list = this.data.activity.filter((a) => (this.isTeacher() ? true : a.studentId === this.actor.id));
    if (opts.studentId) list = list.filter((a) => a.studentId === opts.studentId);
    return list.sort((a, b) => b.at.localeCompare(a.at)).slice(0, opts.limit ?? 50);
  }

  async logActivity(type: ActivityType, label: string, studentId = this.actor.id) {
    const ev: ActivityEvent = { id: uid(), studentId, at: this.iso(), type, label };
    await this.commit((d) => { d.activity = [ev, ...d.activity].slice(0, 300); });
  }
}
