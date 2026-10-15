import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBookImages } from '../scripts/apply-book-images.mjs';

const q = (id, over = {}) => ({ id, enunciado: 'E', opciones: ['a', 'b', 'c'], correcta: 0, conImagen: true, ...over });

test('a single matching sign becomes a copy job', () => {
  const { questions, jobs } = applyBookImages([q('q-0001')], [{ id: 'q-0001', fuente: 'senal', senales: ['s-002'] }]);
  assert.equal(questions[0].imagen, 'assets/img/q-0001.png');
  assert.equal('conImagen' in questions[0], false);
  assert.deepEqual(jobs, [{ kind: 'copy', from: 'assets/signs/s-002.png', to: 'assets/img/q-0001.png' }]);
});

test('several signs become a labeled montage job', () => {
  const { jobs } = applyBookImages([q('q-0002')], [{ id: 'q-0002', fuente: 'senal', senales: ['s-001', 's-002', 's-003'] }]);
  assert.deepEqual(jobs, [{ kind: 'montage', from: ['assets/signs/s-001.png', 'assets/signs/s-002.png', 'assets/signs/s-003.png'], labels: ['A', 'B', 'C'], to: 'assets/img/q-0002.png' }]);
});

test('a handbook figure becomes a crop job', () => {
  const { questions, jobs } = applyBookImages([q('q-0003')], [{ id: 'q-0003', fuente: 'libro', libro: { page: 90, bbox: [1, 2, 30, 40] } }]);
  assert.equal(questions[0].imagen, 'assets/img/q-0003.png');
  assert.deepEqual(jobs, [{ kind: 'crop', page: 90, bbox: [1, 2, 30, 40], to: 'assets/img/q-0003.png' }]);
});

test('no handbook image: decorative pictures are dropped, essential ones exclude the question', () => {
  const decisions = [
    { id: 'q-0004', fuente: 'ninguna', dependeDeImagen: false },
    { id: 'q-0005', fuente: 'ninguna', dependeDeImagen: true, nota: 'refers to the photo' },
  ];
  const { questions, jobs, excluded } = applyBookImages([q('q-0004'), q('q-0005')], decisions);
  assert.equal('imagen' in questions[0], false);
  assert.equal(questions[0].excluida, undefined);
  assert.equal(questions[1].excluida, true);
  assert.deepEqual(jobs, []);
  assert.deepEqual(excluded.map((e) => e.id), ['q-0005']);
});

test('questions without a source picture are untouched', () => {
  const plain = { id: 'q-0006', enunciado: 'E', opciones: ['a', 'b', 'c'], correcta: 1 };
  assert.deepEqual(applyBookImages([plain], []).questions, [plain]);
});

test('throws when a picture question has no decision or an unknown source', () => {
  assert.throws(() => applyBookImages([q('q-0007')], []), /no handbook image decision/);
  assert.throws(() => applyBookImages([q('q-0008')], [{ id: 'q-0008', fuente: 'otra' }]), /unknown fuente/);
  assert.throws(() => applyBookImages([q('q-0009')], [{ id: 'q-0009', fuente: 'senal', senales: [] }]), /senales/);
});

test('montage labels follow the question (Señal 1/2/3) and default to A, B, C', () => {
  const custom = applyBookImages([q('q-0010')], [{ id: 'q-0010', fuente: 'senal', senales: ['s-001', 's-002'], etiquetas: ['1', '2'] }]);
  assert.deepEqual(custom.jobs[0].labels, ['1', '2']);
  const plain = applyBookImages([q('q-0011')], [{ id: 'q-0011', fuente: 'senal', senales: ['s-001', 's-002'] }]);
  assert.deepEqual(plain.jobs[0].labels, ['A', 'B']);
});

test('several handbook figure panels become a labeled crop montage', () => {
  const decision = { id: 'q-0012', fuente: 'libro', libro: { page: 86, bboxes: [[1, 2, 11, 12], [21, 2, 31, 12]], etiquetas: ['A', 'B'] } };
  const { jobs } = applyBookImages([q('q-0012')], [decision]);
  assert.deepEqual(jobs, [{ kind: 'cropmontage', page: 86, bboxes: [[1, 2, 11, 12], [21, 2, 31, 12]], labels: ['A', 'B'], to: 'assets/img/q-0012.png' }]);
});
