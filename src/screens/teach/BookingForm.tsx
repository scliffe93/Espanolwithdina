import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Icon } from '../../components/Icon';
import { Segmented, Sheet } from '../../components/ui';
import { validateBooking } from '../../lib/platform/backend';
import { usePlatform } from '../../lib/platform/context';
import { addMinutes, fmtDateTime, fmtTime, utcIsoToZoned, zoneLabel, zonedToUtcIso } from '../../lib/platform/time';
import type { Booking, BookingFormat, BookingInput, Person } from '../../lib/platform/types';
import { useStore } from '../../lib/store';
import { ConfirmButton, ErrorText, Field, StatusChip, ZoneSelect, isUrl, nameOf, useAction } from './shared';

const DURATIONS = [30, 45, 60, 90];

export interface BookingPrefill {
  studentId?: string;
  date?: string;
  time?: string;
  zone?: string;
}

/**
 * Book, edit, reschedule, cancel or complete a lesson. Date and time are typed in the
 * selected zone and stored as a UTC instant together with that zone.
 */
export function BookingForm({ open, onClose, people, booking, prefill, viewZone, onSaved }: {
  open: boolean;
  onClose: () => void;
  people: Person[];
  /** Edit mode when set. */
  booking?: Booking | null;
  prefill?: BookingPrefill;
  viewZone: string;
  onSaved?: (b: Booking) => void;
}) {
  const { backend } = usePlatform();
  const { notify } = useStore();
  const { run, busy, error, setError } = useAction();
  const [studentId, setStudentId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('18:00');
  const [zone, setZone] = useState(viewZone);
  const [duration, setDuration] = useState(60);
  const [custom, setCustom] = useState(false);
  const [format, setFormat] = useState<BookingFormat>('online');
  const [location, setLocation] = useState('');
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (booking) {
      const z = booking.tz || viewZone;
      const local = utcIsoToZoned(booking.startsAt, z);
      setStudentId(booking.studentId);
      setDate(local.date);
      setTime(local.time);
      setZone(z);
      setDuration(booking.durationMin);
      setCustom(!DURATIONS.includes(booking.durationMin));
      setFormat(booking.format);
      setLocation(booking.location);
      setTopic(booking.topic);
      setNotes(booking.prepNotes);
    } else {
      const z = prefill?.zone ?? viewZone;
      setStudentId(prefill?.studentId ?? people[0]?.id ?? '');
      setDate(prefill?.date ?? utcIsoToZoned(new Date().toISOString(), z).date);
      setTime(prefill?.time ?? '18:00');
      setZone(z);
      setDuration(60);
      setCustom(false);
      setFormat('online');
      setLocation('');
      setTopic('');
      setNotes('');
    }
    // Reset only when the sheet opens or switches to another lesson.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, booking?.id]);

  const startsAt = useMemo(() => {
    if (!date || !time) return '';
    try {
      return zonedToUtcIso(date, time, zone);
    } catch {
      return '';
    }
  }, [date, time, zone]);

  const input: BookingInput = { studentId, startsAt, durationMin: duration, tz: zone, format, location: location.trim(), topic: topic.trim(), prepNotes: notes.trim() };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!backend) return;
    const v = validateBooking(input);
    if (v) return setError(v);
    if (format === 'online' && input.location && !isUrl(input.location)) return setError('The meeting link should be a full web address starting with https://');
    const saved = await run(() => (booking ? backend.updateBooking(booking.id, input) : backend.createBooking(input)), people, zone);
    if (saved) {
      notify(booking ? 'Lesson updated' : 'Lesson booked', `${nameOf(people, saved.studentId)} · ${fmtDateTime(saved.startsAt, viewZone)}`);
      onSaved?.(saved);
      onClose();
    }
  };

  const setStatus = async (status: Booking['status'], title: string) => {
    if (!backend || !booking) return;
    const saved = await run(() => (status === 'cancelled' ? backend.cancelBooking(booking.id) : backend.updateBooking(booking.id, { status })), people, zone);
    if (saved) {
      notify(title, saved.topic);
      onSaved?.(saved);
      onClose();
    }
  };

  const moved = booking && startsAt && startsAt !== booking.startsAt;

  return (
    <Sheet open={open} onClose={onClose} title={booking ? 'Lesson' : 'Book a lesson'}>
      <form className="grid gap-4" onSubmit={submit} noValidate>
        {booking && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
            <StatusChip status={booking.status} />
            <span>Booked {fmtDateTime(booking.createdAt, viewZone)}</span>
          </div>
        )}
        <Field id="bk-student" label="Student">
          <select id="bk-student" className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {people.map((p) => <option key={p.id} value={p.id}>{p.firstName}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="bk-date" label="Date"><input id="bk-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
          <Field id="bk-time" label="Start time"><input id="bk-time" type="time" step={300} className="input" value={time} onChange={(e) => setTime(e.target.value)} required /></Field>
        </div>
        <ZoneSelect id="bk-zone" value={zone} onChange={setZone} label="Time zone of that date and time" />
        <div className="grid gap-1 text-sm font-medium">
          <span id="bk-duration-label">Duration</span>
          <div role="radiogroup" aria-labelledby="bk-duration-label" className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <button key={d} type="button" role="radio" aria-checked={!custom && duration === d} className="chip" onClick={() => { setCustom(false); setDuration(d); }}>{d} min</button>
            ))}
            <button type="button" role="radio" aria-checked={custom} className="chip" onClick={() => setCustom(true)}>Custom</button>
          </div>
          {custom && (
            <Field id="bk-duration" label="Minutes (15–240)">
              <input id="bk-duration" type="number" min={15} max={240} step={5} className="input" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </Field>
          )}
        </div>
        <div className="grid gap-1 text-sm font-medium">
          <span>Format</span>
          <Segmented label="Lesson format" value={format} onChange={setFormat} options={[{ value: 'online', label: 'Online' }, { value: 'in-person', label: 'Face to face' }]} />
        </div>
        <Field id="bk-location" label={format === 'online' ? 'Meeting link' : 'Address or meeting place'} hint={format === 'online' ? 'Optional — a full https:// link to your video room.' : 'Optional — where you’ll meet.'}>
          <input id="bk-location" aria-describedby="bk-location-hint" className="input" type={format === 'online' ? 'url' : 'text'} inputMode={format === 'online' ? 'url' : 'text'} placeholder={format === 'online' ? 'https://meet.jit.si/…' : 'Café del Centro, Calle Mayor 12'} value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
        <Field id="bk-topic" label="Lesson topic"><input id="bk-topic" className="input" placeholder="e.g. Ordering at the café" value={topic} onChange={(e) => setTopic(e.target.value)} required maxLength={120} /></Field>
        <Field id="bk-notes" label="Preparation notes" hint="For you — what to prepare or watch for.">
          <textarea id="bk-notes" aria-describedby="bk-notes-hint" className="input min-h-[84px]" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={800} />
        </Field>

        {startsAt && (
          <p className="rounded-2xl bg-cream-100 px-3 py-2 text-sm text-ink-soft" aria-live="polite">
            <Icon name="clock" size={14} className="mr-1 inline" />
            <b>{fmtDateTime(startsAt, zone)}–{fmtTime(addMinutes(startsAt, duration), zone)}</b> · {zoneLabel(zone)}
            {zone !== viewZone && <span className="block">= {fmtDateTime(startsAt, viewZone)} in {zoneLabel(viewZone)}</span>}
            {moved && <span className="block text-terracotta-dark">Rescheduled from {fmtDateTime(booking.startsAt, booking.tz)} ({zoneLabel(booking.tz)}).</span>}
          </p>
        )}
        <ErrorText error={error} />
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : booking ? (moved ? 'Reschedule lesson' : 'Save changes') : 'Book lesson'}</button>
          {booking?.status === 'scheduled' && <button type="button" className="btn-ghost" disabled={busy} onClick={() => setStatus('completed', 'Lesson marked as completed')}><Icon name="check" size={16} /> Mark completed</button>}
          {booking?.status === 'scheduled' && <ConfirmButton confirmLabel="Yes, cancel lesson" disabled={busy} onConfirm={() => setStatus('cancelled', 'Lesson cancelled')}><Icon name="x" size={14} /> Cancel lesson</ConfirmButton>}
          {booking?.status === 'cancelled' && <button type="button" className="btn-ghost" disabled={busy} onClick={() => setStatus('scheduled', 'Lesson restored')}><Icon name="refresh" size={16} /> Restore lesson</button>}
          {booking?.status === 'completed' && <button type="button" className="ctrl" disabled={busy} onClick={() => setStatus('scheduled', 'Lesson reopened')}><Icon name="refresh" size={14} /> Reopen as scheduled</button>}
        </div>
      </form>
    </Sheet>
  );
}
