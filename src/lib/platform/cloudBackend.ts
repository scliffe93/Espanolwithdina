import type { AppState } from '../../types';
import { ApiError, platformApi, type PlatformKind, type Session } from '../cloud';
import { migrate } from '../state';
import { PlatformError, fileProblem, fileTitle, findOverlap, uid, validateBooking, type LessonInput, type LibraryInput, type PlatformBackend, type StudentSettingsInput } from './backend';
import type { ActivityEvent, ActivityType, Booking, BookingInput, Credit, Feedback, FeedbackKind, Homework, HomeworkActivity, HomeworkResult, Invoice, Marking, Person, StudentSettings, TeacherConfig, FileRef, Resource } from './types';
import { settingsId } from './level';
import type { LessonGroup, LessonPlan, LessonWork, LibraryPlan, StudentGroup } from './types';
import { cleanPlan } from '../../../supabase/functions/_shared/lesson';
import { DEFAULT_TEACHER_CONFIG, fileMime } from './types';

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
    return this.actor.role === 'teacher' || this.actor.role === 'admin';
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

  async uploadFile(file: File): Promise<FileRef> {
    this.assertTeacher();
    const problem = fileProblem(file);
    if (problem) throw new PlatformError('invalid', problem);
    const mime = fileMime(file);
    const made = await this.wrap(() => platformApi.newFile(this.token, { name: file.name.slice(0, 120), mime, size: file.size })).catch((e: PlatformError) => { throw e.code === 'not_found' ? new PlatformError('invalid', 'File uploads are not switched on yet for real accounts. The server needs its update first.') : e; });
    // Straight to the file store with the one-time link the server signed: the file never passes through the function.
    const form = new FormData();
    form.append('cacheControl', '3600');
    form.append('', file.type === mime ? file : new File([file], file.name, { type: mime })); // the store checks the type, and some devices give none
    const res = await fetch(made.uploadUrl, { method: 'PUT', body: form }).catch(() => null);
    if (!res) throw new PlatformError('offline', 'The upload didn’t get through. Check your connection and try again.');
    if (!res.ok) throw new PlatformError('invalid', `“${file.name}” couldn’t be uploaded. Please try again.`);
    return made.file;
  }
  async fileBlob(id: string) {
    // The server checks who is asking and signs a short-lived link; the file is then read straight from the store.
    const { url } = await this.wrap(() => platformApi.fileUrl(this.token, id));
    const res = await fetch(url).catch(() => null);
    if (!res) throw new PlatformError('offline', 'You appear to be offline. The file needs a connection.');
    if (!res.ok) throw new PlatformError('not_found', 'That file could not be opened.');
    return res.blob();
  }
  async resources(opts: { studentId?: string } = {}) {
    const list = await this.records<Resource>('resource', opts.studentId);
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async shareResources(input: { studentIds: string[]; files: FileRef[] }) {
    this.assertTeacher();
    if (!input.studentIds.length) throw new PlatformError('invalid', 'Choose at least one student.');
    const items: Resource[] = [];
    for (const studentId of input.studentIds) for (const file of input.files) {
      const r: Resource = { id: `res-${uid()}`, teacherId: this.actor.id, studentId, title: fileTitle(file.name), file: { id: file.id, name: file.name, mime: file.mime, size: file.size }, createdAt: this.iso() };
      items.push(await this.put('resource', r.id, studentId, r));
    }
    return items;
  }
  async deleteResource(id: string) {
    this.assertTeacher();
    await this.wrap(() => platformApi.remove(this.token, id));
    this.cache.clear();
  }

  async assignHomework(input: { studentIds: string[]; activity: HomeworkActivity; instructions: string; dueAt: string; plan?: Homework['plan'] }) {
    this.assertTeacher();
    if (!input.studentIds.length) throw new PlatformError('invalid', 'Choose at least one student.');
    if (!input.activity?.title?.trim()) throw new PlatformError('invalid', 'Give the homework a title.');
    if (!input.dueAt || Number.isNaN(new Date(input.dueAt).getTime())) throw new PlatformError('invalid', 'Choose a deadline.');
    const items: Homework[] = [];
    for (const studentId of input.studentIds) {
      const h: Homework = { id: uid(), teacherId: this.actor.id, studentId, activity: input.activity, instructions: input.instructions, assignedAt: this.iso(), dueAt: input.dueAt, status: 'assigned', ...(input.plan ? { plan: input.plan } : {}) };
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

  async sendWriting(input: { title: string; prompt: string; text: string; minWords?: number }) {
    const r = await this.wrap(() => platformApi.sendWriting<Homework>(this.token, input));
    this.cache.clear();
    await this.logActivity('homework', `Sent writing to mark: ${r.record.activity.title}`, r.record.studentId);
    return r.record;
  }

  async reviewHomework(id: string, feedback: string, marking?: Omit<Marking, 'at'>) {
    this.assertTeacher();
    const cur = (await this.records<Homework>('homework')).find((h) => h.id === id);
    if (!cur) throw new PlatformError('not_found', 'Homework not found.');
    const next: Homework = { ...cur, status: 'reviewed', feedback: { body: feedback, at: this.iso() }, ...(marking ? { marking: { ...marking, at: this.iso() } } : {}) };
    return this.put('homework', id, next.studentId, next);
  }

  async feedback(studentId?: string) {
    const list = await this.records<Feedback>('feedback', studentId);
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async addFeedback(input: { studentId: string; kind: FeedbackKind; body: string; debrief?: Feedback['debrief'] }) {
    this.assertTeacher();
    if (!input.body.trim()) throw new PlatformError('invalid', 'Write something first.');
    const f: Feedback = { id: uid(), teacherId: this.actor.id, studentId: input.studentId, kind: input.kind, body: input.body.trim(), createdAt: this.iso(), ...(input.debrief ? { debrief: input.debrief } : {}) };
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

  // ── Invoicing ──
  async invoices(opts: { studentId?: string } = {}) {
    const list = await this.records<Invoice>('invoice', opts.studentId);
    return list.filter((i) => this.isTeacher() || i.status !== 'draft').sort((a, b) => b.issuedAt.localeCompare(a.issuedAt) || b.number.localeCompare(a.number));
  }
  async saveInvoice(inv: Invoice) {
    this.assertTeacher();
    if (!inv.lines.length) throw new PlatformError('invalid', 'Add at least one line.');
    const next: Invoice = { ...inv, teacherId: this.actor.id, updatedAt: this.iso() };
    return this.put('invoice', next.id, next.studentId, next);
  }
  async reportInvoicePaid(id: string, info: { method?: string; note?: string } = {}) {
    const r = await this.wrap(() => platformApi.reportInvoicePaid<Invoice>(this.token, id, info));
    this.cache.clear();
    return r.record;
  }
  async deleteInvoice(id: string) {
    this.assertTeacher();
    await this.wrap(() => platformApi.remove(this.token, id));
    this.cache.clear();
  }
  async teacherConfig() {
    if (!this.isTeacher()) return DEFAULT_TEACHER_CONFIG;
    const rows = await this.records<TeacherConfig & { id: string }>('config');
    const mine = rows.find((r) => r.id === `config-${this.actor.id}`);
    return { ...DEFAULT_TEACHER_CONFIG, ...(mine ?? {}) };
  }
  async saveTeacherConfig(cfg: TeacherConfig) {
    this.assertTeacher();
    const saved = await this.put('config', `config-${this.actor.id}`, this.actor.id, { ...cfg, id: `config-${this.actor.id}` });
    return { ...DEFAULT_TEACHER_CONFIG, ...saved };
  }

  async credits(opts: { studentId?: string } = {}) {
    const list = await this.records<Credit>('credit', opts.studentId);
    return [...list].sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt));
  }
  async saveCredit(c: Credit) {
    this.assertTeacher();
    return this.put('credit', c.id, c.studentId, { ...c, teacherId: this.actor.id });
  }
  async deleteCredit(id: string) {
    this.assertTeacher();
    await this.wrap(() => platformApi.remove(this.token, id));
    this.cache.clear();
  }

  // ── Per-student settings ──
  async lessons(studentId?: string) {
    this.cache.delete(`lesson|${this.isTeacher() ? studentId ?? '' : ''}`);
    const rows = await this.records<LessonPlan>('lesson', this.isTeacher() ? studentId : undefined);
    return [...rows].sort((a, b) => (b.date ?? b.createdAt).localeCompare(a.date ?? a.createdAt));
  }
  // The library lives in the teacher's own settings rows (one row a plan), which the server stores as given.
  async libraryPlans() {
    if (!this.isTeacher()) return [];
    this.cache.delete('config|');
    const rows = await this.records<LibraryPlan & { library?: boolean; deleted?: boolean }>('config');
    return rows.filter((r) => r.library === true && !r.deleted && Array.isArray(r.blocks)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async saveLibraryPlan(input: LibraryInput) {
    this.assertTeacher();
    const id = input.id ?? `lib-${uid()}`;
    const now = new Date().toISOString();
    const prev = input.id ? (await this.libraryPlans()).find((p) => p.id === input.id) : undefined;
    const plan = { ...input, id, library: true, blocks: cleanPlan(input as unknown as Record<string, unknown>).blocks, createdAt: prev?.createdAt ?? now, updatedAt: now };
    return this.put('config', id, this.actor.id, plan as unknown as LibraryPlan);
  }
  async deleteLibraryPlan(id: string) {
    this.assertTeacher();
    // Settings rows cannot be removed, so the plan is emptied and hidden.
    const now = new Date().toISOString();
    await this.put('config', id, this.actor.id, { id, library: true, deleted: true, title: '', blocks: [], notes: '', updatedAt: now, createdAt: now });
  }
  async studentGroups() {
    if (!this.isTeacher()) return [];
    const rows = await this.records<StudentGroup & { klass?: boolean; deleted?: boolean }>('config');
    return rows.filter((r) => r.klass === true && !r.deleted && Array.isArray(r.studentIds)).sort((a, b) => a.name.localeCompare(b.name));
  }
  async saveStudentGroup(input: { id?: string; name: string; studentIds: string[] }) {
    this.assertTeacher();
    const id = input.id ?? `cls-${uid()}`;
    return this.put('config', id, this.actor.id, { id, klass: true, teacherId: this.actor.id, name: input.name.trim().slice(0, 40) || 'Group', studentIds: [...new Set(input.studentIds)], createdAt: new Date().toISOString() } as unknown as StudentGroup);
  }
  async deleteStudentGroup(id: string) {
    this.assertTeacher();
    await this.put('config', id, this.actor.id, { id, klass: true, deleted: true, name: '', studentIds: [] });
  }
  async lessonGroups() {
    if (!this.isTeacher()) return [];
    const rows = await this.records<LessonGroup & { group?: boolean; deleted?: boolean }>('config');
    return rows.filter((r) => r.group === true && !r.deleted && Array.isArray(r.members));
  }
  async saveLessonGroup(members: LessonGroup['members']) {
    this.assertTeacher();
    const id = `grp-${uid()}`;
    return this.put('config', id, this.actor.id, { id, group: true, teacherId: this.actor.id, members, createdAt: new Date().toISOString() } as unknown as LessonGroup);
  }
  async deleteLessonGroup(id: string) {
    this.assertTeacher();
    await this.put('config', id, this.actor.id, { id, group: true, deleted: true, members: [] });
  }
  async saveLesson(input: LessonInput) {
    this.assertTeacher();
    const id = input.id ?? `lesson-${uid()}`;
    return this.put<LessonPlan>('lesson', id, input.studentId, { ...input, id } as unknown as LessonPlan);
  }
  async deleteLesson(id: string) {
    this.assertTeacher();
    await this.wrap(() => platformApi.remove(this.token, id));
    this.cache.clear();
  }
  async syncLesson(id: string, answer?: { blockId: string; value: string }) {
    return this.wrap(() => platformApi.syncLesson<LessonPlan, LessonWork>(this.token, id, answer));
  }

  async studentSettings(studentId: string) {
    if (!this.isTeacher() && studentId !== this.actor.id) throw new PlatformError('forbidden', 'You can only see your own settings.');
    const rows = await this.records<StudentSettings>('student', this.isTeacher() ? studentId : undefined);
    return rows.find((r) => r.studentId === studentId) ?? null;
  }
  async saveStudentSettings(input: StudentSettingsInput) {
    this.assertTeacher();
    // Topics are set on their own; a save that does not mention them keeps the ones the student has.
    const kept = input.topics ?? (await this.studentSettings(input.studentId).catch(() => null))?.topics;
    const topics = [...new Set(kept ?? [])].slice(0, 6);
    const s: StudentSettings = { id: settingsId(input.studentId), studentId: input.studentId, teacherId: this.actor.id, maxLevel: input.maxLevel, ...(input.note?.trim() ? { note: input.note.trim() } : {}), ...(input.stepped ? { stepped: true } : {}), ...(input.unlocked?.length ? { unlocked: [...new Set(input.unlocked)] } : {}), ...(input.verified ? { verified: input.verified } : {}), ...(input.notYet ? { notYet: input.notYet } : {}), ...(input.sentence ? { sentence: Math.max(1, Math.min(5, Math.round(input.sentence))) } : {}), ...(input.verbs?.length ? { verbs: [...new Set(input.verbs)].slice(0, 600) } : {}), updatedAt: this.iso(), ...(topics.length ? { topics } : {}) };
    return this.put('student', s.id, s.studentId, s);
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
