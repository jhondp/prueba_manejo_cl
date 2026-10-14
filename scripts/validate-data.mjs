import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const isText = (v) => typeof v === 'string' && v.trim().length > 0;

export function validateQuestions(list, { imageExists = () => true, chapterSlugs = null } = {}) {
  if (!Array.isArray(list) || list.length === 0) return ['questions: expected a non-empty array'];
  const errors = [];
  const seen = new Set();
  list.forEach((raw, i) => {
    const q = raw ?? {};
    const fail = (msg) => errors.push(`question[${i}]${q.id ? ` (${q.id})` : ''}: ${msg}`);
    if (!isText(q.id)) fail('missing id');
    else if (seen.has(q.id)) fail('duplicate id');
    else seen.add(q.id);
    if (!isText(q.enunciado)) fail('missing enunciado');
    if (!isText(q.tema)) fail('missing tema');
    const opts = q.opciones;
    const minOptions = q.incompleta === true ? 2 : 3;
    if (!Array.isArray(opts) || opts.length < minOptions || opts.length > 4 || !opts.every(isText)) {
      fail('opciones must be 3-4 non-empty strings');
    } else if (!Number.isInteger(q.correcta) || q.correcta < 0 || q.correcta >= opts.length) {
      fail('correcta must be a valid option index');
    }
    if (q.imagen !== undefined && !(isText(q.imagen) && imageExists(q.imagen))) {
      fail(`image not found: ${q.imagen}`);
    }
    if (chapterSlugs && !chapterSlugs.includes(q.capitulo)) fail(`unknown capitulo: ${q.capitulo}`);
  });
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = new URL('../', import.meta.url);
  const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
  const chapters = read('content/libro/index.json');
  const errors = validateQuestions(read('data/preguntas.json'), {
    imageExists: (p) => existsSync(new URL(p, root)),
    chapterSlugs: chapters.map((c) => c.slug),
  });
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('data OK');
}
