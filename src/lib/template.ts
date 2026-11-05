export type GramGender = 'm' | 'f' | 'x';

export interface TemplateCtx {
  name: string;
  homeTown?: string;
  gender: GramGender;
}

function both(m: string, f: string): string {
  let i = 0;
  while (i < m.length && i < f.length && m[i] === f[i]) i++;
  if (i === 0) return `${m} / ${f}`;
  return `${m}/${f.slice(i)}`;
}

/**
 * Renders {name}, {homeTown} and {g:masc|fem}. For learners who prefer
 * not to choose, both forms are shown (e.g. "cansado/a") on screen and the
 * masculine form is spoken.
 */
export function render(text: string, ctx: TemplateCtx, mode: 'display' | 'speech' = 'display'): string {
  return text
    .replace(/\{name\}/g, ctx.name || 'amigo')
    .replace(/\{homeTown\}/g, ctx.homeTown || 'tu ciudad')
    .replace(/\{g:([^|}]*)\|([^}]*)\}/g, (_, m: string, f: string) => {
      if (ctx.gender === 'f') return f;
      if (ctx.gender === 'm' || mode === 'speech') return m;
      return both(m, f);
    });
}
