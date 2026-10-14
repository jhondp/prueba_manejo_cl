import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { validateQuestions, validateSigns } from '../scripts/validate-data.mjs';

const root = new URL('../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));

test('the shipped question bank is valid and links to real chapters', () => {
  const errors = validateQuestions(read('data/preguntas.json'), {
    imageExists: (p) => existsSync(new URL(p, root)),
    chapterSlugs: read('content/libro/index.json').map((c) => c.slug),
  });
  assert.deepEqual(errors, []);
});

test('the shipped sign deck is valid', () => {
  const errors = validateSigns(read('data/senales.json'), { imageExists: (p) => existsSync(new URL(p, root)) });
  assert.deepEqual(errors, []);
});
