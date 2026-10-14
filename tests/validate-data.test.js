import test from 'node:test';
import assert from 'node:assert/strict';
import { validateQuestions } from '../scripts/validate-data.mjs';

const ok = (over = {}) => ({
  id: 'q-0001', tema: 'Señales', capitulo: 'senales', enunciado: '¿Qué significa?',
  opciones: ['A', 'B', 'C'], correcta: 1, ...over,
});

test('a valid bank has no errors', () => {
  assert.deepEqual(validateQuestions([ok(), ok({ id: 'q-0002', opciones: ['A', 'B', 'C', 'D'], correcta: 3 })]), []);
});

test('rejects an empty or non-array bank', () => {
  assert.equal(validateQuestions([]).length, 1);
  assert.equal(validateQuestions(null).length, 1);
});

test('rejects duplicate ids', () => {
  assert.match(validateQuestions([ok(), ok()]).join('\n'), /duplicate id/);
});

test('rejects fewer than 3 or more than 4 options', () => {
  assert.match(validateQuestions([ok({ opciones: ['A', 'B'] })]).join('\n'), /opciones/);
  assert.match(validateQuestions([ok({ opciones: ['A', 'B', 'C', 'D', 'E'] })]).join('\n'), /opciones/);
});

test('rejects blank options', () => {
  assert.match(validateQuestions([ok({ opciones: ['A', ' ', 'C'] })]).join('\n'), /opciones/);
});

test('rejects correcta that is out of range, negative or not an integer', () => {
  for (const correcta of [3, -1, 1.5, '1', undefined]) {
    assert.match(validateQuestions([ok({ correcta })]).join('\n'), /correcta/, String(correcta));
  }
});

test('rejects blank enunciado/tema and null entries without throwing', () => {
  assert.match(validateQuestions([ok({ enunciado: '  ' })]).join('\n'), /enunciado/);
  assert.match(validateQuestions([ok({ tema: '' })]).join('\n'), /tema/);
  assert.ok(validateQuestions([null]).length > 0);
});

test('rejects images that do not exist', () => {
  const errors = validateQuestions([ok({ imagen: 'assets/img/missing.png' })], { imageExists: () => false });
  assert.match(errors.join('\n'), /image not found/);
});

test('rejects unknown chapter slugs when a list is given', () => {
  const errors = validateQuestions([ok({ capitulo: 'nope' })], { chapterSlugs: ['senales'] });
  assert.match(errors.join('\n'), /unknown capitulo/);
});

test('allows 2 options only when the question is flagged incompleta', () => {
  assert.deepEqual(validateQuestions([ok({ opciones: ['A', 'B'], correcta: 1, incompleta: true })]), []);
  assert.match(validateQuestions([ok({ opciones: ['A', 'B'], correcta: 1 })]).join('\n'), /opciones/);
  assert.match(validateQuestions([ok({ opciones: ['A'], correcta: 0, incompleta: true })]).join('\n'), /opciones/);
});
