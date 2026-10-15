import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSigns } from '../scripts/build-signs.mjs';
import { validateSigns } from '../scripts/validate-data.mjs';

const item = (over = {}) => ({ page: 150, categoria: 'Señales Reglamentarias', nombre: 'Pare', bbox: [1, 2, 31, 32], ...over });

test('assigns sequential ids and image paths in order', () => {
  const { signs, imageCopies } = buildSigns([[item(), item({ nombre: 'Cede el paso' })], [item({ nombre: 'No entrar' })]]);
  assert.deepEqual(signs.map((s) => s.id), ['s-001', 's-002', 's-003']);
  assert.equal(signs[0].imagen, 'assets/signs/s-001.png');
  assert.deepEqual(imageCopies[0], { id: 's-001', page: 150, bbox: [1, 2, 31, 32], to: 'assets/signs/s-001.png' });
});

test('keeps identical captions that point at different pictures', () => {
  const { signs } = buildSigns([[item(), item({ bbox: [40, 2, 70, 32] })]]);
  assert.equal(signs.length, 2);
});

test('exposes only the public fields and lists doubts for review', () => {
  const { signs, revision } = buildSigns([[item({ duda: 'caption blurry' })]]);
  assert.deepEqual(Object.keys(signs[0]).sort(), ['categoria', 'id', 'imagen', 'nombre']);
  assert.deepEqual(revision, [{ id: 's-001', page: 150, duda: 'caption blurry' }]);
});

const sign = (over = {}) => ({ id: 's-001', categoria: 'Reglamentarias', nombre: 'Pare', imagen: 'assets/signs/s-001.png', ...over });

test('validateSigns accepts a valid list', () => {
  assert.deepEqual(validateSigns([sign(), sign({ id: 's-002' })]), []);
});

test('validateSigns rejects empty, duplicate ids, blank fields and missing images', () => {
  assert.equal(validateSigns([]).length, 1);
  assert.match(validateSigns([sign(), sign()]).join('\n'), /duplicate id/);
  assert.match(validateSigns([sign({ nombre: ' ' })]).join('\n'), /nombre/);
  assert.match(validateSigns([sign({ categoria: '' })]).join('\n'), /categoria/);
  assert.match(validateSigns([sign()], { imageExists: () => false }).join('\n'), /image not found/);
  assert.ok(validateSigns([null]).length > 0);
});

test('flags signs whose picture already prints their name', () => {
  const { signs } = buildSigns([[item(), item({ nombre: 'Cede el paso' })]], ['s-002']);
  assert.equal(signs[0].conTexto, undefined);
  assert.equal(signs[1].conTexto, true);
});
