// Prints the lesson the lesson room would make from a PDF plan. Usage: npx tsx scripts/plan-preview.mts <file.pdf>
import { pdfText } from './pdf-text.mts';
import { adaptPlan } from '../src/lib/platform/lessonAdapt';
const p = adaptPlan(await pdfText(process.argv[2]));
console.log(`TITLE: ${p.title}\nPARTS: ${p.blocks.length}, need answers: ${p.needAnswers}\n`);
p.blocks.forEach((b, i) => console.log(`${i + 1}. [${b.type}] ${b.title}\n   ${b.type === 'vocab' ? (b.pairs ?? []).map((x) => `${x.es} = ${x.en}`).join(' | ') : b.body.replace(/\n/g, '\n   ')}${b.options ? `\n   options: ${b.options.join(' / ')}` : ''}${b.answer !== undefined ? `\n   answer: ${b.answer || '(MISSING)'}` : ''}\n`));
console.log('ADAPTED:\n' + p.adapted.map((a) => ' - ' + a).join('\n') + '\n\nNOTES:\n' + p.notes);
