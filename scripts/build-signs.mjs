import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function buildSigns(partials, textIds = []) {
  const signs = [];
  const imageCopies = [];
  const revision = [];
  partials.flat().forEach((item, i) => {
    const id = `s-${String(i + 1).padStart(3, '0')}`;
    const imagen = `assets/signs/${id}.png`;
    signs.push({ id, categoria: item.categoria, nombre: item.nombre, imagen, ...(textIds.includes(id) && { conTexto: true }) });
    imageCopies.push({ id, page: item.page, bbox: item.bbox, to: imagen });
    if (item.duda) revision.push({ id, page: item.page, duda: item.duda });
  });
  return { signs, imageCopies, revision };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = new URL('../', import.meta.url);
  const at = (p) => fileURLToPath(new URL(p, root));
  const names = readdirSync(at('data/partials-senales')).filter((f) => f.endsWith('.json')).sort();
  const partials = names.map((f) => JSON.parse(readFileSync(at(`data/partials-senales/${f}`), 'utf8')));
  const textFile = at('data/senales-con-texto.json');
  const textIds = existsSync(textFile) ? JSON.parse(readFileSync(textFile, 'utf8')) : [];
  const { signs, imageCopies, revision } = buildSigns(partials, textIds);

  mkdirSync(at('assets/signs'), { recursive: true });
  for (const { id, page, bbox, to } of imageCopies) {
    const [x0, y0, x1, y1] = bbox;
    if (!(x1 > x0 && y1 > y0)) throw new Error(`${id}: invalid bbox ${JSON.stringify(bbox)}`);
    const src = at(`scratch/libro-pages/l-${String(page).padStart(3, '0')}.jpg`);
    if (!existsSync(src)) throw new Error(`${id}: missing page image ${src}`);
    execFileSync('magick', [src, '-crop', `${x1 - x0}x${y1 - y0}+${x0}+${y0}`, '+repage', at(to)]);
  }

  writeFileSync(at('data/senales.json'), `${JSON.stringify(signs, null, 2)}\n`);
  const lines = revision.map((r) => `- ${r.id} (handbook page ${r.page}): ${r.duda}`);
  writeFileSync(at('data/revision-senales.md'), `# Signs to confirm against libro.pdf\n\n${lines.join('\n') || 'None.'}\n`);
  console.log(`${signs.length} signs, ${revision.length} to review`);
}
