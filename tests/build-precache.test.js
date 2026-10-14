import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPrecache } from '../scripts/build-precache.mjs';

const SW = "const VERSION = 'dev'; // build:version\nconst URLS = []; // build:urls\nconsole.log(VERSION, URLS);\n";

function site(files) {
  const dir = mkdtempSync(join(tmpdir(), 'site-'));
  mkdirSync(join(dir, 'js'));
  writeFileSync(join(dir, 'sw.js'), SW);
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

test('embeds the version and every file except sw.js into sw.js', () => {
  const dir = site({ 'index.html': 'a', 'js/app.js': 'b' });
  const { version, count } = buildPrecache(dir);
  const sw = readFileSync(join(dir, 'sw.js'), 'utf8');
  assert.match(sw, new RegExp(`const VERSION = '${version}'; // build:version`));
  assert.ok(sw.includes('"./index.html"') && sw.includes('"./js/app.js"') && sw.includes('"./"'));
  assert.ok(!sw.includes('"./sw.js"'));
  assert.equal(count, 3);
});

test('the version is stable for identical content and changes when any file changes', () => {
  const a = buildPrecache(site({ 'index.html': 'same' })).version;
  const b = buildPrecache(site({ 'index.html': 'same' })).version;
  const c = buildPrecache(site({ 'index.html': 'different' })).version;
  assert.equal(a, b);
  assert.notEqual(a, c);
});
