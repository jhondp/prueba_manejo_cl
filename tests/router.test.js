import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute } from '../js/router.js';

test('empty hash is the home route', () => {
  assert.deepEqual(parseRoute(''), { name: 'inicio', param: null });
  assert.deepEqual(parseRoute('#/'), { name: 'inicio', param: null });
});

test('parses name and param', () => {
  assert.deepEqual(parseRoute('#/libro/senales'), { name: 'libro', param: 'senales' });
  assert.deepEqual(parseRoute('#/quiz'), { name: 'quiz', param: null });
});
