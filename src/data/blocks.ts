import { CEFR_LEVELS, type Cefr } from '../types';
import { VERBS } from './verbs';
import { VOCAB_PACKS } from './vocabPacks';

// ───────────────────────────────────────────────────────────────
// Content blocks: the units a teacher releases to a student one step
// at a time. A verb block is twelve verbs of one level, most frequent
// first; a word block is one ten-word pack. With gradual release on,
// a student's app only offers the verbs and packs in released blocks.
// ───────────────────────────────────────────────────────────────

export type BlockKind = 'verbs' | 'words';
export interface ContentBlock { id: string; kind: BlockKind; level: Cefr; title: string; items: string[] }

export const VERB_BLOCK_SIZE = 12;

export const VERB_BLOCKS: ContentBlock[] = CEFR_LEVELS.flatMap((level) => {
  const verbs = VERBS.filter((v) => v.level === level).sort((a, b) => a.frequencyRank - b.frequencyRank).map((v) => v.inf);
  const out: ContentBlock[] = [];
  for (let i = 0; i < verbs.length; i += VERB_BLOCK_SIZE) out.push({ id: `verbs-${level}-${i / VERB_BLOCK_SIZE + 1}`, kind: 'verbs', level, title: `${level} verbs ${i / VERB_BLOCK_SIZE + 1}`, items: verbs.slice(i, i + VERB_BLOCK_SIZE) });
  return out;
});

export const WORD_BLOCKS: ContentBlock[] = VOCAB_PACKS.map((p) => ({ id: p.id, kind: 'words', level: p.level, title: p.title, items: p.ids }));

/** Every block in teaching order: level by level, verbs then words. */
export const CONTENT_BLOCKS: ContentBlock[] = CEFR_LEVELS.flatMap((l) => [...VERB_BLOCKS.filter((b) => b.level === l), ...WORD_BLOCKS.filter((b) => b.level === l)]);
export const BLOCK_BY_ID: Record<string, ContentBlock> = Object.fromEntries(CONTENT_BLOCKS.map((b) => [b.id, b]));

/** What a student starts with when gradual release is switched on. */
export const STARTER_BLOCKS: string[] = [VERB_BLOCKS[0].id, WORD_BLOCKS[0].id];

/** The first block of a kind that has not been released yet, in teaching order. */
export function nextBlock(unlocked: readonly string[], kind: BlockKind): ContentBlock | null {
  return (kind === 'verbs' ? VERB_BLOCKS : WORD_BLOCKS).find((b) => !unlocked.includes(b.id)) ?? null;
}
