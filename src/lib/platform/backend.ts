import { DEMO_TEACHER_ID } from './types';
import type { AppState } from '../../types';
import type { ActivityEvent, ActivityType, Booking, BookingInput, Credit, Feedback, FeedbackKind, Homework, HomeworkActivity, HomeworkResult, Invoice, Marking, PlatformData, Person, StudentSettings, TeacherConfig, LibraryPlan, LessonGroup, StudentGroup, FileRef, Resource } from './types';
import { FILE_MAX_BYTES, fileMime } from './types';
import { settingsId } from './level';
import { DEFAULT_TEACHER_CONFIG } from './types';
import { overlaps } from './time';
import { followUpFor, type AdaptHomework } from '../../../supabase/functions/_shared/adapt';
import { checkBlock, cleanPlan, emptyWork, studentView, type LessonBlock, type LessonPlan, type LessonWork } from '../../../supabase/functions/_shared/lesson';

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
  /** Teacher: store a PDF or a photo so it can be attached to homework or put in a learning bank. */
  uploadFile(file: File): Promise<FileRef>;
  /** The file itself, to show in the page. */
  fileBlob(id: string): Promise<Blob>;
  /** The learning bank: explanations the teacher has shared, newest first (student: their own). */
  resources(opts?: { studentId?: string }): Promise<Resource[]>;
  shareResources(input: { studentIds: string[]; files: FileRef[] }): Promise<Resource[]>;
  deleteResource(id: string): Promise<void>;
  assignHomework(input: { studentIds: string[]; activity: HomeworkActivity; instructions: string; dueAt: string; plan?: Homework['plan'] }): Promise<Homework[]>;
  updateHomework(id: string, patch: { instructions?: string; dueAt?: string; activity?: HomeworkActivity }): Promise<Homework>;
  deleteHomework(id: string): Promise<void>;
  submitHomework(id: string, result: HomeworkResult): Promise<Homework>;
  /** A student sends the teacher a piece of writing done on their own (exam practice). It arrives as handed-in written homework. */
  sendWriting(input: { title: string; prompt: string; text: string; minWords?: number }): Promise<Homework>;
  /** Teacher: feedback plus, optionally, the marking (mark, per-answer notes, corrections). Marks the homework reviewed. */
  reviewHomework(id: string, feedback: string, marking?: Omit<Marking, 'at'>): Promise<Homework>;
  feedback(studentId?: string): Promise<Feedback[]>;
  addFeedback(input: { studentId: string; kind: FeedbackKind; body: string; debrief?: Feedback['debrief'] }): Promise<Feedback>;
  deleteFeedback(id: string): Promise<void>;
  activity(opts?: { studentId?: string; limit?: number }): Promise<ActivityEvent[]>;
  logActivity(type: ActivityType, label: string, studentId?: string): Promise<void>;
  /** Real accounts only: the teacher creates a student's account and gets the login details to pass on. */
  addStudent?(input: { username: string; firstName: string; password?: string }): Promise<{ user: Person; recoveryCode: string; password?: string }>;
  // ── Invoicing ──
  /** Teacher: all her invoices (optionally one student's). Student: their own. */
  invoices(opts?: { studentId?: string }): Promise<Invoice[]>;
  /** Teacher: create or update an invoice (the whole record). */
  saveInvoice(inv: Invoice): Promise<Invoice>;
  /** Student: tell the teacher an invoice has been paid. The teacher still confirms it; this only flags it and notifies her. */
  reportInvoicePaid(id: string, info?: { method?: string; note?: string }): Promise<Invoice>;
  /** Teacher: delete a draft. Sent invoices are voided instead. */
  deleteInvoice(id: string): Promise<void>;
  /** Teacher: her invoicing settings (defaults until saved). Students get the defaults (for currency display). */
  teacherConfig(): Promise<TeacherConfig>;
  saveTeacherConfig(cfg: TeacherConfig): Promise<TeacherConfig>;
  /** Packages bought (teacher: all or one student's; student: own). */
  credits(opts?: { studentId?: string }): Promise<Credit[]>;
  saveCredit(c: Credit): Promise<Credit>;
  deleteCredit(id: string): Promise<void>;
  // ── Per-student settings (level access) ──
  /** Teacher: any of her students; student: their own. Null until the teacher has set something. */
  studentSettings(studentId: string): Promise<StudentSettings | null>;
  /** Teacher only. */
  saveStudentSettings(input: StudentSettingsInput): Promise<StudentSettings>;
  // ── the lesson room ──
  /** The teacher's library of lesson plans, filed by level. */
  libraryPlans(): Promise<LibraryPlan[]>;
  saveLibraryPlan(input: LibraryInput): Promise<LibraryPlan>;
  deleteLibraryPlan(id: string): Promise<void>;
  /** Lessons taught to a group: which copies belong together. */
  lessonGroups(): Promise<LessonGroup[]>;
  saveLessonGroup(members: LessonGroup['members']): Promise<LessonGroup>;
  deleteLessonGroup(id: string): Promise<void>;
  /** Named groups of students, to choose a whole class at once. */
  studentGroups(): Promise<StudentGroup[]>;
  saveStudentGroup(input: { id?: string; name: string; studentIds: string[] }): Promise<StudentGroup>;
  deleteStudentGroup(id: string): Promise<void>;
  /** The teacher's plans (all, or one student's); for a student, their own lessons as far as they have been opened. */
  lessons(studentId?: string): Promise<LessonPlan[]>;
  saveLesson(input: LessonInput): Promise<LessonPlan>;
  deleteLesson(id: string): Promise<void>;
  /** What a device asks for every couple of seconds during a lesson. For the student it also says "I am here" and can carry an answer. */
  syncLesson(id: string, answer?: { blockId: string; value: string }): Promise<{ plan: LessonPlan; work: LessonWork | null; now: string }>;
}

export type LibraryInput = Omit<LibraryPlan, 'id' | 'teacherId' | 'createdAt' | 'updatedAt'> & { id?: string };
export interface LessonInput { id?: string; studentId: string; title: string; date?: string; notes?: string; blocks: LessonBlock[]; live: LessonPlan['live'] }

/** What the teacher saves for a student. The whole row is replaced, so pass every field you want to keep. */
export interface StudentSettingsInput { studentId: string; maxLevel: StudentSettings['maxLevel']; note?: string; stepped?: boolean; unlocked?: string[]; verified?: StudentSettings['verified']; notYet?: StudentSettings['notYet']; sentence?: number; verbs?: string[]; topics?: string[] }

/** A tidy payment notice: short method and note, nothing else. */
export function paymentReport(at: string, info: { method?: string; note?: string } = {}): NonNullable<Invoice['paymentReported']> {
  const method = info.method?.trim().slice(0, 40);
  const note = info.note?.trim().slice(0, 200);
  return { at, ...(method ? { method } : {}), ...(note ? { note } : {}) };
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
  /** Uploaded files, kept on this device in the demo. */
  saveFile?(id: string, file: Blob): Promise<void>;
  loadFile?(id: string): Promise<Blob | null>;
}

/** Why a file can't be uploaded, or null when it can. */
export function fileProblem(file: { name: string; type: string; size: number }): string | null {
  if (!fileMime(file)) return `“${file.name}” can’t be used. Upload a PDF, a photo, or a Word, PowerPoint or Excel file.`;
  if (file.size > FILE_MAX_BYTES) return `“${file.name}” is too big. The limit is 20 MB for each file.`;
  if (!file.size) return `“${file.name}” is empty.`;
  return null;
}
/** A file's name without its ending, as a title. */
export const fileTitle = (name: string) => name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim() || name;

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
    return this.actor.role === 'teacher' || this.actor.role === 'admin';
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
    const next: PlatformData = { ...this.data, bookings: [...this.data.bookings], homework: [...this.data.homework], feedback: [...this.data.feedback], activity: [...this.data.activity], invoices: [...(this.data.invoices ?? [])], credits: [...(this.data.credits ?? [])], students: [...(this.data.students ?? [])] };
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

  async uploadFile(file: File): Promise<FileRef> {
    this.assertTeacher();
    const problem = fileProblem(file);
    if (problem) throw new PlatformError('invalid', problem);
    if (!this.storage.saveFile) throw new PlatformError('invalid', 'Files can’t be stored here.');
    const ref: FileRef = { id: `f-${uid()}`, name: file.name.slice(0, 120), mime: fileMime(file), size: file.size };
    await this.storage.saveFile(ref.id, file);
    return ref;
  }
  async fileBlob(id: string) {
    const blob = await this.storage.loadFile?.(id);
    if (!blob) throw new PlatformError('not_found', 'That file is no longer here.');
    return blob;
  }
  async resources(opts: { studentId?: string } = {}) {
    let list = (this.data.resources ?? []).filter((r) => (this.isTeacher() ? r.teacherId === this.actor.id : r.studentId === this.actor.id));
    if (opts.studentId) list = list.filter((r) => r.studentId === opts.studentId);
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async shareResources(input: { studentIds: string[]; files: FileRef[] }) {
    this.assertTeacher();
    if (!input.studentIds.length) throw new PlatformError('invalid', 'Choose at least one student.');
    const items = input.studentIds.flatMap((studentId) => input.files.map<Resource>((file) => ({ id: `res-${uid()}`, teacherId: this.actor.id, studentId, title: fileTitle(file.name), file: { id: file.id, name: file.name, mime: file.mime, size: file.size }, createdAt: this.iso() })));
    await this.commit((d) => { d.resources = [...(d.resources ?? []), ...items]; });
    return items;
  }
  async deleteResource(id: string) {
    this.assertTeacher();
    await this.commit((d) => { d.resources = (d.resources ?? []).filter((r) => !(r.id === id && r.teacherId === this.actor.id)); });
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
    const maxLevel = (this.data.students ?? []).find((s) => s.studentId === cur.studentId)?.maxLevel ?? null;
    const followUp = this.data.homework.some((h) => h.id === fid) ? null : (followUpFor(next as unknown as AdaptHomework, this.iso(), fid, { maxLevel }) as unknown as Homework | null);
    await this.commit((d) => { d.homework = d.homework.map((h) => (h.id === id ? next : h)); if (followUp) d.homework.push(followUp); });
    if (followUp) await this.logActivity('homework', `${followUp.plan?.adaptive === 'retry' ? 'Re-try added' : 'Stretch task added'}: ${followUp.activity.title}`, next.studentId);
    await this.logActivity('homework', `Homework completed: ${next.activity.title}${result.summary ? ` — ${result.summary}` : ''}`, next.studentId);
    return next;
  }

  async sendWriting(input: { title: string; prompt: string; text: string; minWords?: number }) {
    if (this.isTeacher()) throw new PlatformError('forbidden', 'Only a student can send writing in.');
    const text = input.text.trim();
    if (text.split(/\s+/).filter(Boolean).length < 5) throw new PlatformError('invalid', 'Write a little more before sending it.');
    const teacherId = this.data.homework.find((h) => h.studentId === this.actor.id)?.teacherId ?? this.data.bookings.find((b) => b.studentId === this.actor.id)?.teacherId ?? DEMO_TEACHER_ID;
    const h = { id: `self-${uid()}`, studentId: this.actor.id, teacherId, activity: { kind: 'written', title: input.title, prompt: input.prompt, ...(input.minWords ? { minWords: input.minWords } : {}) }, instructions: '', assignedAt: this.iso(), dueAt: this.iso(), status: 'submitted', selfSet: true, result: { completedAt: this.iso(), text, summary: `${text.split(/\s+/).filter(Boolean).length} words` } } as Homework;
    await this.commit((d) => { d.homework.push(h); });
    await this.logActivity('homework', `Sent writing to mark: ${h.activity.title}`, this.actor.id);
    return h;
  }

  async reviewHomework(id: string, feedback: string, marking?: Omit<Marking, 'at'>) {
    this.assertTeacher();
    const cur = this.data.homework.find((h) => h.id === id && h.teacherId === this.actor.id);
    if (!cur) throw new PlatformError('not_found', 'Homework not found.');
    const next: Homework = { ...cur, status: 'reviewed', feedback: { body: feedback, at: this.iso() }, ...(marking ? { marking: { ...marking, at: this.iso() } } : {}) };
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

  // ── Invoicing ──
  async invoices(opts: { studentId?: string } = {}) {
    let list = (this.data.invoices ?? []).filter((i) => (this.isTeacher() ? i.teacherId === this.actor.id : i.studentId === this.actor.id && i.status !== 'draft'));
    if (opts.studentId) list = list.filter((i) => i.studentId === opts.studentId);
    return list.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt) || b.number.localeCompare(a.number));
  }
  async saveInvoice(inv: Invoice) {
    this.assertTeacher();
    this.assertStudentAccess(inv.studentId);
    if (!inv.lines.length) throw new PlatformError('invalid', 'Add at least one line.');
    const next: Invoice = { ...inv, teacherId: this.actor.id, updatedAt: this.iso() };
    await this.commit((d) => { d.invoices = d.invoices!.some((i) => i.id === inv.id) ? d.invoices!.map((i) => (i.id === inv.id ? next : i)) : [next, ...d.invoices!]; });
    return next;
  }
  async reportInvoicePaid(id: string, info: { method?: string; note?: string } = {}) {
    const cur = (this.data.invoices ?? []).find((i) => i.id === id);
    if (!cur || (!this.isTeacher() && cur.studentId !== this.actor.id)) throw new PlatformError('not_found', 'Invoice not found.');
    if (this.isTeacher()) throw new PlatformError('forbidden', 'Only the student can report a payment. Use Mark paid.');
    if (cur.status !== 'sent') throw new PlatformError('invalid', cur.status === 'paid' ? 'This invoice is already marked as paid.' : 'This invoice cannot be paid.');
    const next: Invoice = { ...cur, paymentReported: paymentReport(this.iso(), info), updatedAt: this.iso() };
    await this.commit((d) => { d.invoices = d.invoices!.map((i) => (i.id === id ? next : i)); });
    return next;
  }
  async deleteInvoice(id: string) {
    this.assertTeacher();
    await this.commit((d) => { d.invoices = d.invoices!.filter((i) => !(i.id === id && i.teacherId === this.actor.id)); });
  }
  async teacherConfig() {
    return { ...DEFAULT_TEACHER_CONFIG, ...(this.data.config ?? {}) };
  }
  async saveTeacherConfig(cfg: TeacherConfig) {
    this.assertTeacher();
    await this.commit((d) => { d.config = cfg; });
    return cfg;
  }
  async credits(opts: { studentId?: string } = {}) {
    let list = (this.data.credits ?? []).filter((c) => (this.isTeacher() ? c.teacherId === this.actor.id : c.studentId === this.actor.id));
    if (opts.studentId) list = list.filter((c) => c.studentId === opts.studentId);
    return list.sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt));
  }
  async saveCredit(c: Credit) {
    this.assertTeacher();
    this.assertStudentAccess(c.studentId);
    const next = { ...c, teacherId: this.actor.id };
    await this.commit((d) => { d.credits = d.credits!.some((x) => x.id === c.id) ? d.credits!.map((x) => (x.id === c.id ? next : x)) : [...d.credits!, next]; });
    return next;
  }
  async deleteCredit(id: string) {
    this.assertTeacher();
    await this.commit((d) => { d.credits = d.credits!.filter((x) => !(x.id === id && x.teacherId === this.actor.id)); });
  }

  // ── Per-student settings ──
  // The demo keeps everything in this browser. Two tabs (the teacher's and the student's) share it, so the lesson
  // room reads the stored copy afresh before every step: that is what makes the two tabs see each other.
  private async refresh() { const fresh = await this.storage.loadData().catch(() => null); if (fresh) this.data = fresh; }
  async lessons(studentId?: string) {
    await this.refresh();
    const all = this.data.lessons ?? [];
    if (this.isTeacher()) return all.filter((l) => l.teacherId === this.actor.id && (!studentId || l.studentId === studentId)).sort((a, b) => (b.date ?? b.createdAt).localeCompare(a.date ?? a.createdAt));
    return all.filter((l) => l.studentId === this.actor.id).map((l) => studentView(l, (this.data.lessonWork ?? []).find((w) => w.lessonId === l.id) ?? null)).sort((a, b) => (b.date ?? b.createdAt).localeCompare(a.date ?? a.createdAt));
  }
  async libraryPlans() {
    await this.refresh();
    return (this.data.library ?? []).filter((p) => p.teacherId === this.actor.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async saveLibraryPlan(input: LibraryInput) {
    this.assertTeacher();
    await this.refresh();
    const prev = (this.data.library ?? []).find((p) => p.id === input.id);
    const plan: LibraryPlan = { ...input, id: input.id ?? `lib-${uid()}`, teacherId: this.actor.id, blocks: cleanPlan(input as unknown as Record<string, unknown>).blocks, createdAt: prev?.createdAt ?? this.iso(), updatedAt: this.iso() };
    await this.commit((d) => { d.library = [...(d.library ?? []).filter((p) => p.id !== plan.id), plan]; });
    return plan;
  }
  async deleteLibraryPlan(id: string) {
    this.assertTeacher();
    await this.commit((d) => { d.library = (d.library ?? []).filter((p) => p.id !== id); });
  }
  async studentGroups() {
    await this.refresh();
    return (this.data.classes ?? []).filter((g) => g.teacherId === this.actor.id).sort((a, b) => a.name.localeCompare(b.name));
  }
  async saveStudentGroup(input: { id?: string; name: string; studentIds: string[] }) {
    this.assertTeacher();
    const g: StudentGroup = { id: input.id ?? `cls-${uid()}`, teacherId: this.actor.id, name: input.name.trim().slice(0, 40) || 'Group', studentIds: [...new Set(input.studentIds)], createdAt: this.iso() };
    await this.commit((d) => { d.classes = [...(d.classes ?? []).filter((x) => x.id !== g.id), g]; });
    return g;
  }
  async deleteStudentGroup(id: string) {
    this.assertTeacher();
    await this.commit((d) => { d.classes = (d.classes ?? []).filter((g) => g.id !== id); });
  }
  async lessonGroups() {
    await this.refresh();
    return (this.data.groups ?? []).filter((g) => g.teacherId === this.actor.id);
  }
  async saveLessonGroup(members: LessonGroup['members']) {
    this.assertTeacher();
    const g: LessonGroup = { id: `grp-${uid()}`, teacherId: this.actor.id, members, createdAt: this.iso() };
    await this.commit((d) => { d.groups = [...(d.groups ?? []), g]; });
    return g;
  }
  async deleteLessonGroup(id: string) {
    this.assertTeacher();
    await this.commit((d) => { d.groups = (d.groups ?? []).filter((g) => g.id !== id); });
  }
  async saveLesson(input: LessonInput) {
    this.assertTeacher();
    this.assertStudentAccess(input.studentId);
    await this.refresh();
    const prev = (this.data.lessons ?? []).find((l) => l.id === input.id);
    const id = input.id ?? `lesson-${uid()}`;
    const plan: LessonPlan = { id, studentId: input.studentId, teacherId: this.actor.id, ...cleanPlan(input as unknown as Record<string, unknown>), createdAt: prev?.createdAt ?? this.iso(), updatedAt: this.iso() };
    await this.commit((d) => { d.lessons = [...(d.lessons ?? []).filter((l) => l.id !== id), plan]; });
    return plan;
  }
  async deleteLesson(id: string) {
    this.assertTeacher();
    await this.refresh();
    await this.commit((d) => { d.lessons = (d.lessons ?? []).filter((l) => l.id !== id); d.lessonWork = (d.lessonWork ?? []).filter((w) => w.lessonId !== id); });
  }
  async syncLesson(id: string, answer?: { blockId: string; value: string }) {
    await this.refresh();
    const plan = (this.data.lessons ?? []).find((l) => l.id === id);
    if (!plan || (!this.isTeacher() && plan.studentId !== this.actor.id)) throw new PlatformError('not_found', 'Lesson not found.');
    let work = (this.data.lessonWork ?? []).find((w) => w.lessonId === id) ?? null;
    if (this.isTeacher()) return { plan, work, now: this.iso() };
    work = { ...(work ?? emptyWork(id, this.actor.id, this.iso())), seenAt: this.iso() };
    if (answer) {
      const block = plan.blocks.find((b) => b.id === answer.blockId);
      if (!block || !block.open) throw new PlatformError('forbidden', 'That part of the lesson is not open yet.');
      const correct = checkBlock(block, answer.value);
      work = { ...work, answers: { ...work.answers, [answer.blockId]: { value: answer.value.slice(0, 2000), at: this.iso(), ...(correct === undefined ? {} : { correct }) } }, updatedAt: this.iso() };
    }
    const saved = work;
    await this.commit((d) => { d.lessonWork = [...(d.lessonWork ?? []).filter((w) => w.lessonId !== id), saved]; });
    return { plan: studentView(plan, saved), work: saved, now: this.iso() };
  }

  async studentSettings(studentId: string) {
    this.assertStudentAccess(studentId);
    return (this.data.students ?? []).find((s) => s.studentId === studentId) ?? null;
  }
  async saveStudentSettings(input: StudentSettingsInput) {
    this.assertTeacher();
    this.assertStudentAccess(input.studentId);
    // Topics are set on their own; a save that does not mention them keeps the ones the student has.
    const kept = input.topics ?? (await this.studentSettings(input.studentId).catch(() => null))?.topics;
    const topics = [...new Set(kept ?? [])].slice(0, 6);
    const s: StudentSettings = { id: settingsId(input.studentId), studentId: input.studentId, teacherId: this.actor.id, maxLevel: input.maxLevel, ...(input.note?.trim() ? { note: input.note.trim() } : {}), ...(input.stepped ? { stepped: true } : {}), ...(input.unlocked?.length ? { unlocked: [...new Set(input.unlocked)] } : {}), ...(input.verified ? { verified: input.verified } : {}), ...(input.notYet ? { notYet: input.notYet } : {}), ...(input.sentence ? { sentence: Math.max(1, Math.min(5, Math.round(input.sentence))) } : {}), ...(input.verbs?.length ? { verbs: [...new Set(input.verbs)].slice(0, 600) } : {}), updatedAt: this.iso(), ...(topics.length ? { topics } : {}) };
    await this.commit((d) => { d.students = [...(d.students ?? []).filter((x) => x.studentId !== s.studentId), s]; });
    return s;
  }
}
