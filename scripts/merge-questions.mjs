import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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
        imageCopies.push({ id, page: imageRef.page, index: imageRef.index, to: q.imagen });
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

  // pdfimages -png -p names files im-<page>-<n>.png; group them by page, ordered by <n>.
  const byPage = {};
  for (const f of readdirSync(at('scratch/img')).sort()) {
    const m = f.match(/^im-(\d+)-(\d+)\.png$/);
    if (m) (byPage[Number(m[1])] ??= []).push(f);
  }
  mkdirSync(at('assets/img'), { recursive: true });
  for (const { page, index, to, id } of imageCopies) {
    const file = byPage[page]?.[index];
    if (!file) throw new Error(`${id}: no image #${index} on page ${page}`);
    copyFileSync(at(`scratch/img/${file}`), at(to));
  }

  writeFileSync(at('data/preguntas.json'), `${JSON.stringify(questions, null, 2)}\n`);
  const lines = revision.map((r) => `- ${r.id} (PDF page ${r.page}): ${r.duda}`);
  writeFileSync(at('data/revision.md'), `# Questions to confirm against PREGUNTAS.pdf\n\n${lines.join('\n') || 'None.'}\n`);
  console.log(`${questions.length} questions, ${revision.length} to review, ${imageCopies.length} images`);
  if (!existsSync(at('data/preguntas.json'))) process.exit(1);
}
