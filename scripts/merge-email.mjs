// Merge the outreach email for each prospect in a CSV: one HTML and one plain-text file per row, ready to send.
//
//   node scripts/merge-email.mjs prospects.csv out/ [--sender "Your name"] [--base https://scliffe93.github.io/Espanolwithdina/]
//
// CSV columns (header row, any order; extra columns are ignored):
//   email, first_name, school, city, city_id
// city    = how the city reads in the email ("Valencia"); blank → "Madrid"
// city_id = one of madrid valencia barcelona sevilla cdmx buenosaires medellin; blank → madrid
// school  = the business name, or the tutor's own first name for a sole tutor ("This week with Laura")
// first_name blank → the email opens "Hello," and the page is addressed to the school only
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const csvPath = args.find((a, i) => !a.startsWith('--') && (i === 0 || !args[i - 1].startsWith('--')));
const outDir = args.filter((a, i) => !a.startsWith('--') && (i === 0 || !args[i - 1].startsWith('--')))[1] ?? 'out';
if (!csvPath) { console.error('usage: node scripts/merge-email.mjs prospects.csv out/ [--sender "Your name"] [--base <site url>]'); process.exit(1); }
const sender = flag('--sender', '[Your name]');
const base = flag('--base', 'https://scliffe93.github.io/Espanolwithdina/').replace(/\/?$/, '/');
const CITIES = ['madrid', 'valencia', 'barcelona', 'sevilla', 'cdmx', 'buenosaires', 'medellin'];

/** A small CSV reader: quoted fields, doubled quotes, CRLF. */
function parseCsv(text) {
  const rows = []; let row = []; let field = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; continue; }
    if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((v) => v.trim()));
  const keys = head.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

const html = readFileSync(join(here, '..', 'marketing', 'email', 'pitch-email.html'), 'utf8');
const text = readFileSync(join(here, '..', 'marketing', 'email', 'pitch-email.txt'), 'utf8');
const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

mkdirSync(outDir, { recursive: true });
const rows = parseCsv(readFileSync(csvPath, 'utf8'));
let n = 0;
for (const r of rows) {
  if (!r.email) continue;
  const first = r.first_name;
  const school = r.school || first || 'your school';
  const greeting = first ? `Hi ${first},` : 'Hello,';
  // The page falls back to Madrid when no city is given, so the email says the same.
  const cityId = CITIES.includes((r.city_id || '').toLowerCase()) ? r.city_id.toLowerCase() : 'madrid';
  const city = r.city || 'Madrid';
  const url = `${base}#/pitch?${first ? `to=${encodeURIComponent(first)}&` : ''}school=${encodeURIComponent(school)}&city=${cityId}`;
  const fill = (tpl, esc) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = { greeting, first_name: first || '', school, city, sender_name: sender, pitch_url: url }[k];
    if (v === undefined) throw new Error(`unknown field {{${k}}}`);
    return k === 'pitch_url' ? v : esc(v);
  });
  const slug = `${String(++n).padStart(3, '0')}-${r.email.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  writeFileSync(join(outDir, `${slug}.html`), fill(html, escapeHtml));
  writeFileSync(join(outDir, `${slug}.txt`), fill(text, (s) => s));
}
console.log(`${n} email(s) written to ${outDir}/ (from ${basename(csvPath)})`);
