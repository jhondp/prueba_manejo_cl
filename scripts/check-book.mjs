import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const words = (text) => (text.replace(/^---\n[\s\S]*?\n---\n/, '').match(/\S+/g) ?? []).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

export function coverage(sourceText, markdownTexts) {
  return markdownTexts.reduce((n, t) => n + words(t), 0) / words(sourceText);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = new URL('../content/libro/', import.meta.url);
  const texts = readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => readFileSync(new URL(f, dir), 'utf8'));
  const ratio = coverage(readFileSync(process.argv[2], 'utf8'), texts);
  console.log(`coverage: ${(ratio * 100).toFixed(1)}%`);
  if (ratio < 0.9 || ratio > 1.1) process.exit(1);
}
