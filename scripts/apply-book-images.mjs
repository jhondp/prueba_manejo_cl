import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Every question picture must come from the official handbook. Decisions come from
// data/imagenes-libro.json: a handbook sign (or several, for A/B/C questions), a handbook
// figure, or none. Questions that need a picture the handbook does not have are excluded.
export function applyBookImages(questions, decisions) {
  const byId = new Map(decisions.map((d) => [d.id, d]));
  const jobs = [];
  const excluded = [];
  const out = questions.map((question) => {
    if (!question.conImagen) return question;
    const { conImagen, ...q } = question;
    const d = byId.get(q.id);
    if (!d) throw new Error(`${q.id}: no handbook image decision`);
    const to = `assets/img/${q.id}.png`;
    if (d.fuente === 'senal') {
      if (!Array.isArray(d.senales) || d.senales.length === 0) throw new Error(`${q.id}: senales must list at least one sign id`);
      const from = d.senales.map((id) => `assets/signs/${id}.png`);
      jobs.push(from.length === 1
        ? { kind: 'copy', from: from[0], to }
        : { kind: 'montage', from, labels: d.etiquetas ?? [...'ABCD'].slice(0, from.length), to });
      return { ...q, imagen: to };
    }
    if (d.fuente === 'libro') {
      const { page, bbox, bboxes, etiquetas } = d.libro;
      jobs.push(bboxes
        ? { kind: 'cropmontage', page, bboxes, labels: etiquetas ?? [...'ABCD'].slice(0, bboxes.length), to }
        : { kind: 'crop', page, bbox, to });
      return { ...q, imagen: to };
    }
    if (d.fuente === 'ninguna') {
      if (!d.dependeDeImagen) return q;
      excluded.push({ id: q.id, nota: d.nota ?? '' });
      return { ...q, excluida: true };
    }
    throw new Error(`${q.id}: unknown fuente ${d.fuente}`);
  });
  return { questions: out, jobs, excluded };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = new URL('../', import.meta.url);
  const at = (p) => fileURLToPath(new URL(p, root));
  const questions = JSON.parse(readFileSync(at('data/preguntas.json'), 'utf8'));
  const decisions = JSON.parse(readFileSync(at('data/imagenes-libro.json'), 'utf8'));
  const { questions: out, jobs, excluded } = applyBookImages(questions, decisions);

  rmSync(at('assets/img'), { recursive: true, force: true });
  mkdirSync(at('assets/img'), { recursive: true });
  for (const job of jobs) {
    if (job.kind === 'copy') {
      copyFileSync(at(job.from), at(job.to));
    } else if (job.kind === 'montage') {
      const args = ['montage'];
      job.from.forEach((f, i) => args.push('-label', job.labels[i], at(f)));
      execFileSync('magick', [...args, '-tile', `${job.from.length}x1`, '-geometry', '170x170+10+6', '-pointsize', '16', '-background', 'white', at(job.to)]);
    } else if (job.kind === 'cropmontage') {
      const src = at(`scratch/libro-pages/l-${String(job.page).padStart(3, '0')}.jpg`);
      const args = ['montage'];
      job.bboxes.forEach(([x0, y0, x1, y1], i) => args.push('-label', job.labels[i], `${src}[${x1 - x0}x${y1 - y0}+${x0}+${y0}]`));
      execFileSync('magick', [...args, '-tile', `${job.bboxes.length}x1`, '-geometry', '+10+6', '-pointsize', '16', '-background', 'white', at(job.to)]);
    } else {
      const [x0, y0, x1, y1] = job.bbox;
      const src = at(`scratch/libro-pages/l-${String(job.page).padStart(3, '0')}.jpg`);
      if (!existsSync(src)) throw new Error(`missing page image ${src}`);
      execFileSync('magick', [src, '-crop', `${x1 - x0}x${y1 - y0}+${x0}+${y0}`, '+repage', at(job.to)]);
    }
  }
  writeFileSync(at('data/preguntas.json'), `${JSON.stringify(out, null, 2)}\n`);
  const lines = excluded.map((e) => `- ${e.id}: ${e.nota}`);
  writeFileSync(at('data/excluidas.md'), `# Questions left out of study mode (their picture is not in the handbook)\n\n${lines.join('\n') || 'None.'}\n`);
  console.log(`${jobs.length} handbook images, ${excluded.length} questions excluded`);
}
