import test from 'node:test';
import assert from 'node:assert/strict';
import { mergePartials } from '../scripts/merge-questions.mjs';

const item = (over = {}) => ({
  page: 1, tema: 'T', capitulo: 'c', enunciado: 'E', opciones: ['a', 'b', 'c'], correcta: 0, ...over,
});

test('assigns sequential ids across partials in order', () => {
  const { questions } = mergePartials([[item({ enunciado: 'E1' }), item({ enunciado: 'E2' })], [item({ enunciado: 'E3' })]]);
  assert.deepEqual(questions.map((q) => q.id), ['q-0001', 'q-0002', 'q-0003']);
});

test('strips internal fields from questions', () => {
  const { questions } = mergePartials([[item({ duda: 'x', imageRef: { page: 1, bbox: [10, 20, 110, 220] } })]]);
  assert.equal('page' in questions[0], false);
  assert.equal('duda' in questions[0], false);
  assert.equal('imageRef' in questions[0], false);
});

test('collects doubts for the review file', () => {
  const { revision } = mergePartials([[item({ enunciado: 'E1' }), item({ page: 7, enunciado: 'E2', duda: 'respuesta ilegible' })]]);
  assert.deepEqual(revision, [{ id: 'q-0002', page: 7, duda: 'respuesta ilegible' }]);
});

test('marks questions that had a source picture and crops it to scratch only', () => {
  const { questions, imageCopies } = mergePartials([[item({ imageRef: { page: 4, bbox: [10, 20, 110, 220] } })]]);
  assert.equal(questions[0].conImagen, true);
  assert.equal('imagen' in questions[0], false);
  assert.deepEqual(imageCopies, [{ id: 'q-0001', page: 4, bbox: [10, 20, 110, 220], to: 'scratch/ext-img/q-0001.png' }]);
});

test('drops exact repeats of the same question across exams', () => {
  const { questions, dropped } = mergePartials([[item(), item({ page: 9, numero: 4 })]]);
  assert.equal(questions.length, 1);
  assert.equal(dropped.length, 1);
});

test('treats a cut-off card as a repeat and keeps the complete one', () => {
  const cut = item({ opciones: ['a', 'b'], duda: 'cut off' });
  const full = item({ page: 3, opciones: ['a', 'b', 'c'] });
  const { questions, revision } = mergePartials([[cut, full]]);
  assert.equal(questions.length, 1);
  assert.deepEqual(questions[0].opciones, ['a', 'b', 'c']);
  assert.deepEqual(revision, []);
});

test('ignores case, accents and punctuation when comparing', () => {
  const a = item({ enunciado: '¿Qué significa?' });
  const b = item({ enunciado: 'que significa', opciones: ['A', 'B', 'C'] });
  assert.equal(mergePartials([[a, b]]).questions.length, 1);
});

test('keeps same-text questions that point at different pictures or answers', () => {
  const x = item({ enunciado: '¿Qué significa esta señal?', correcta: 0, imageRef: { page: 1, bbox: [1, 1, 9, 9] } });
  const y = item({ enunciado: '¿Qué significa esta señal?', correcta: 1, imageRef: { page: 2, bbox: [1, 1, 9, 9] } });
  assert.equal(mergePartials([[x, y]]).questions.length, 2);
});

test('flags a conflicting answer for identical text without pictures', () => {
  const x = item({ correcta: 0 });
  const y = item({ page: 5, correcta: 1 });
  const { questions, revision } = mergePartials([[x, y]]);
  assert.equal(questions.length, 1);
  assert.match(revision[0].duda, /conflicting/);
});

test('flags questions with fewer than 3 options as incompleta and lists them for review', () => {
  const { questions, revision } = mergePartials([[item({ page: 6, opciones: ['a', 'b'], correcta: 1 })]]);
  assert.equal(questions[0].incompleta, true);
  assert.match(revision[0].duda, /incomplete/);
});
