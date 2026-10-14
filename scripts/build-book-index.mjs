import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const field = (front, key) => front.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1].trim();

export function buildIndex(files) {
  return files
    .map(({ name, text }) => {
      const front = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
      const title = field(front, 'title');
      const slug = field(front, 'slug');
      const order = Number(field(front, 'order'));
      if (!title || !slug || !Number.isFinite(order)) throw new Error(`${name}: missing front matter (title, slug, order)`);
      return { slug, title, file: name, order };
    })
    .sort((a, b) => a.order - b.order)
    .map(({ slug, title, file }) => ({ slug, title, file }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = new URL('../content/libro/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.md')).map((name) => ({ name, text: readFileSync(new URL(name, dir), 'utf8') }));
  writeFileSync(new URL('index.json', dir), `${JSON.stringify(buildIndex(files), null, 2)}\n`);
  console.log(`indexed ${files.length} chapters`);
}
