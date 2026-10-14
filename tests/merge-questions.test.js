import test from 'node:test';
import assert from 'node:assert/strict';
import { mergePartials } from '../scripts/merge-questions.mjs';

const item = (over = {}) => ({
  page: 1, tema: 'T', capitulo: 'c', enunciado: 'E', opciones: ['a', 'b', 'c'], correcta: 0, ...over,
});

test('assigns sequential ids across partials in order', () => {
  const { questions } = mergePartials([[item(), item()], [item()]]);
  assert.deepEqual(questions.map((q) => q.id), ['q-0001', 'q-0002', 'q-0003']);
});

test('strips internal fields from questions', () => {
  const { questions } = mergePartials([[item({ duda: 'x', imageRef: { page: 1, index: 0 } })]]);
  assert.equal('page' in questions[0], false);
  assert.equal('duda' in questions[0], false);
  assert.equal('imageRef' in questions[0], false);
});

test('collects doubts for the review file', () => {
  const { revision } = mergePartials([[item(), item({ page: 7, duda: 'respuesta ilegible' })]]);
  assert.deepEqual(revision, [{ id: 'q-0002', page: 7, duda: 'respuesta ilegible' }]);
});

test('maps image references to asset paths', () => {
  const { questions, imageCopies } = mergePartials([[item({ imageRef: { page: 4, index: 1 } })]]);
  assert.equal(questions[0].imagen, 'assets/img/q-0001.png');
  assert.deepEqual(imageCopies, [{ id: 'q-0001', page: 4, index: 1, to: 'assets/img/q-0001.png' }]);
});
