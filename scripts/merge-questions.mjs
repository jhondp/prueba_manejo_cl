import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const norm = (s) =>
  String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const subset = (a, b) => a.every((x) => b.includes(x));

// The source PDF repeats questions across exams and has cards cut off at the page edge:
// the same question (same text, options included in one another, same answer) is kept once,
// preferring the copy with more options and no doubt.
function dedupe(items) {
  const kept = [];
  const dropped = [];
  for (const item of items) {
    const key = norm(item.enunciado);
    const opts = item.opciones.map(norm);
    const correct = opts[item.correcta];
    const twin = kept.find((k) => k.key === key && (subset(opts, k.opts) || subset(k.opts, opts)));
    if (!twin) {
      kept.push({ key, opts, item, notes: [] });
      continue;
    }
    const sameAnswer = correct === undefined || twin.opts[twin.item.correcta] === undefined || correct === twin.opts[twin.item.correcta];
    if (!sameAnswer && (item.imageRef || twin.item.imageRef)) {
      kept.push({ key, opts, item, notes: [] });
      continue;
    }
    if (!sameAnswer) twin.notes.push(`conflicting correct answer between copies (PDF pages ${twin.item.page} and ${item.page})`);
    const better = item.opciones.length > twin.item.opciones.length ||
      (item.opciones.length === twin.item.opciones.length && twin.item.duda && !item.duda);
    if (better) {
      dropped.push(twin.item);
      Object.assign(twin, { opts, item });
    } else {
      dropped.push(item);
    }
  }
  return { kept, dropped };
}

export function mergePartials(partials) {
  const questions = [];
  const revision = [];
  const imageCopies = [];
  const { kept, dropped } = dedupe(partials.flat());
  kept.forEach(({ item, notes }, i) => {
    const id = `q-${String(i + 1).padStart(4, '0')}`;
    const { imageRef, duda, page, ...rest } = item;
    const q = { id, ...rest };
    if (imageRef) {
      // The source picture is not published: it is only a reference for matching a handbook image.
      q.conImagen = true;
      imageCopies.push({ id, page: imageRef.page, bbox: imageRef.bbox, to: `scratch/ext-img/${id}.png` });
    }
    questions.push(q);
    if (q.opciones.length < 3) {
      q.incompleta = true;
      notes.push(`incomplete: only ${q.opciones.length} options visible in the PDF`);
    }
    const doubt = [duda, ...notes].filter(Boolean).join('; ');
    if (doubt) revision.push({ id, page, duda: doubt });
  });
  return { questions, revision, imageCopies, dropped };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = new URL('../', import.meta.url);
  const at = (p) => fileURLToPath(new URL(p, root));
  const names = readdirSync(at('data/partials')).filter((f) => f.endsWith('.json')).sort();
  const partials = names.map((f) => JSON.parse(readFileSync(at(`data/partials/${f}`), 'utf8')));
  const { questions, revision, imageCopies, dropped } = mergePartials(partials);

  // The embedded PDF images are whole card screenshots (they show the marked answer), so the
  // question picture is cropped from the rendered page: bbox = [x0, y0, x1, y1] in page pixels.
  mkdirSync(at('scratch/ext-img'), { recursive: true });
  for (const { id, page, bbox, to } of imageCopies) {
    const [x0, y0, x1, y1] = bbox;
    if (!(x1 > x0 && y1 > y0)) throw new Error(`${id}: invalid bbox ${JSON.stringify(bbox)}`);
    const src = at(`scratch/pages/p-${String(page).padStart(3, '0')}.jpg`);
    if (!existsSync(src)) throw new Error(`${id}: missing page image ${src}`);
    execFileSync('magick', [src, '-crop', `${x1 - x0}x${y1 - y0}+${x0}+${y0}`, '+repage', at(to)]);
  }

  writeFileSync(at('data/preguntas.json'), `${JSON.stringify(questions, null, 2)}\n`);
  const lines = revision.map((r) => `- ${r.id} (PDF page ${r.page}): ${r.duda}`);
  writeFileSync(at('data/revision.md'), `# Questions to confirm against PREGUNTAS.pdf\n\n${lines.join('\n') || 'None.'}\n`);
  console.log(`${questions.length} questions (${dropped.length} repeats dropped), ${revision.length} to review, ${imageCopies.length} images`);
  if (!existsSync(at('data/preguntas.json'))) process.exit(1);
}
