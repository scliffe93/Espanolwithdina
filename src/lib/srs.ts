import type { SrsCard } from '../types';
import { DAY_MS } from './dates';

// A compact SM-2-style scheduler.
// grade: 0 = forgot, 1 = hard (needed a hint / accent slip), 2 = good, 3 = easy

export type Grade = 0 | 1 | 2 | 3;

export function newCard(key: string, now = Date.now()): SrsCard {
  return { key, ease: 2.5, intervalDays: 0, due: now, reps: 0, lapses: 0, attempts: 0, correct: 0, lastSeen: 0, introducedAt: now };
}

export function review(card: SrsCard, grade: Grade, now = Date.now()): SrsCard {
  const c = { ...card, attempts: card.attempts + 1, lastSeen: now };
  if (grade === 0) {
    c.lapses += 1;
    c.reps = 0;
    c.intervalDays = 0;
    c.ease = Math.max(1.3, c.ease - 0.2);
    c.due = now + 10 * 60_000; // see it again in ~10 minutes
    return c;
  }
  c.correct += 1;
  c.reps += 1;
  if (c.reps === 1) c.intervalDays = grade === 3 ? 2 : 1;
  else if (c.reps === 2) c.intervalDays = grade === 1 ? 2 : 3;
  else c.intervalDays = Math.round(c.intervalDays * (grade === 1 ? 1.2 : grade === 3 ? c.ease * 1.3 : c.ease));
  c.ease = Math.max(1.3, c.ease + (grade === 3 ? 0.15 : grade === 1 ? -0.15 : 0));
  c.intervalDays = Math.min(c.intervalDays, 180);
  c.due = now + c.intervalDays * DAY_MS;
  return c;
}

export function isDue(card: SrsCard, now = Date.now()): boolean {
  return card.due <= now;
}

/** True if this review tests memory after a real delay (≥ 12 h since last seen). */
export function isDelayedReview(card: SrsCard, now = Date.now()): boolean {
  return card.lastSeen > 0 && now - card.lastSeen >= 12 * 3_600_000;
}

export type MasteryLevel = 'new' | 'learning' | 'familiar' | 'mastered';

export function mastery(card?: SrsCard): MasteryLevel {
  if (!card || card.attempts === 0) return 'new';
  const acc = card.correct / card.attempts;
  if (card.intervalDays >= 7 && card.reps >= 3 && acc >= 0.75) return 'mastered';
  if (card.intervalDays >= 2 && acc >= 0.6) return 'familiar';
  return 'learning';
}

/** 0..1 strength used for mastery visualisations. */
export function strength(card?: SrsCard): number {
  if (!card || card.attempts === 0) return 0;
  const acc = card.correct / card.attempts;
  return Math.min(1, (Math.min(card.intervalDays, 14) / 14) * 0.6 + acc * 0.4);
}
