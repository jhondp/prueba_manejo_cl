import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function mergePartials(partials) {
  const questions = [];
  const revision = [];
  const imageCopies = [];
  let n = 0;
  for (const partial of partials) {
    for (const item of partial) {
      n += 1;
      const id = `q-${String(n).padStart(4, '0')}`;
      const { imageRef, duda, page, ...rest } = item;
      const q = { id, ...rest };
      if (imageRef) {
        q.imagen = `assets/img/${id}.png`;
        imageCopies.push({ id, page: imageRef.page, bbox: imageRef.bbox, to: q.imagen });
      }
      questions.push(q);
      if (duda) revision.push({ id, page, duda });
    }
  }
  return { questions, revision, imageCopies };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = new URL('../', import.meta.url);
  const at = (p) => fileURLToPath(new URL(p, root));
  const names = readdirSync(at('data/partials')).filter((f) => f.endsWith('.json')).sort();
  const partials = names.map((f) => JSON.parse(readFileSync(at(`data/partials/${f}`), 'utf8')));
  const { questions, revision, imageCopies } = mergePartials(partials);

  // The embedded PDF images are whole card screenshots (they show the marked answer), so the
  // question picture is cropped from the rendered page: bbox = [x0, y0, x1, y1] in page pixels.
  mkdirSync(at('assets/img'), { recursive: true });
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
  console.log(`${questions.length} questions, ${revision.length} to review, ${imageCopies.length} images`);
  if (!existsSync(at('data/preguntas.json'))) process.exit(1);
}
