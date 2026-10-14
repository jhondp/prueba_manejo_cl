import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

export function buildPrecache(siteDir) {
  const files = walk(siteDir)
    .map((p) => relative(siteDir, p).split('\\').join('/'))
    .filter((f) => f !== 'sw.js')
    .sort();
  const hash = createHash('sha256');
  for (const f of files) hash.update(f).update(readFileSync(join(siteDir, f)));
  const version = hash.digest('hex').slice(0, 12);
  const urls = ['./', ...files.map((f) => `./${f}`)];
  const swPath = join(siteDir, 'sw.js');
  const sw = readFileSync(swPath, 'utf8')
    .replace(/^const VERSION = .*; \/\/ build:version$/m, `const VERSION = '${version}'; // build:version`)
    .replace(/^const URLS = .*; \/\/ build:urls$/m, `const URLS = ${JSON.stringify(urls)}; // build:urls`);
  writeFileSync(swPath, sw);
  return { version, count: urls.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(buildPrecache(process.argv[2] ?? '_site'));
}
