import { ASSESSMENT } from '../data/assessment';
import { CEFR_LEVELS, type Cefr, type Skill } from '../types';

/**
 * Per-skill level = the highest level answered correctly, as long as the
 * learner hasn't missed more than one easier question in that skill.
 */
export function scoreAssessment(answers: Record<string, number>): { levels: Record<Skill, Cefr>; overall: Cefr; correct: number; total: number } {
  const skills: Exclude<Skill, 'speaking'>[] = ['vocabulary', 'grammar', 'reading', 'listening', 'verbs'];
  const levels = {} as Record<Skill, Cefr>;
  let correct = 0;
  for (const skill of skills) {
    const qs = ASSESSMENT.filter((q) => q.skill === skill).sort((a, b) => CEFR_LEVELS.indexOf(a.level) - CEFR_LEVELS.indexOf(b.level));
    let level: Cefr = 'A1';
    let misses = 0;
    for (const q of qs) {
      const ok = answers[q.id] === q.answer;
      if (ok) {
        correct++;
        if (misses <= 1) level = q.level;
      } else misses++;
    }
    levels[skill] = level;
  }
  const idx = skills.map((s) => CEFR_LEVELS.indexOf(levels[s])).sort((a, b) => a - b);
  const median = idx[Math.floor(idx.length / 2)];
  // Speaking can't be assessed reliably in-browser; estimate one level below listening, minimum A1.
  levels.speaking = CEFR_LEVELS[Math.max(0, Math.min(CEFR_LEVELS.indexOf(levels.listening), median) - 1)];
  return { levels, overall: CEFR_LEVELS[median], correct, total: ASSESSMENT.length };
}

export function uniformLevels(level: Cefr): Record<Skill, Cefr> {
  return { vocabulary: level, grammar: level, reading: level, listening: level, speaking: level, verbs: level };
}

export function levelIndex(l: Cefr): number {
  return CEFR_LEVELS.indexOf(l);
}
