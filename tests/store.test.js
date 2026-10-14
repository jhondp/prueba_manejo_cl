import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, memoryBackend, safeBackend } from '../js/store.js';

const state = { box: 2, due: 1000, seen: 2, correct: 2 };

test('progress persists across store instances sharing a backend', async () => {
  const backend = memoryBackend();
  await createStore(backend).saveState('q-1', state);
  assert.deepEqual(await createStore(backend).getProgress(), { 'q-1': state });
});

test('attempts and streak are stored', async () => {
  const store = createStore(memoryBackend());
  await store.addAttempt({ date: '2026-10-14T10:00:00.000Z', score: 8, total: 10, wrong: ['q-2'] });
  assert.equal((await store.getAttempts()).length, 1);
  assert.deepEqual(await store.touchStreak('2026-10-14'), { last: '2026-10-14', count: 1 });
  assert.deepEqual(await store.getStreak(), { last: '2026-10-14', count: 1 });
});

test('export then import round-trips', async () => {
  const a = createStore(memoryBackend());
  await a.saveState('q-1', state);
  const b = createStore(memoryBackend());
  await b.importJson(await a.exportJson());
  assert.deepEqual(await b.getProgress(), { 'q-1': state });
});

test('importing corrupt or foreign data throws and keeps existing progress', async () => {
  const store = createStore(memoryBackend());
  await store.saveState('q-1', state);
  const bad = [
    'not json',
    '[]',
    'null',
    JSON.stringify({ version: 2, progress: {}, attempts: [] }),
    JSON.stringify({ version: 1, progress: [], attempts: [] }),
    JSON.stringify({ version: 1, progress: { 'q-9': { box: 9, due: 0, seen: 0, correct: 0 } }, attempts: [] }),
    JSON.stringify({ version: 1, progress: {}, attempts: 'x' }),
  ];
  for (const text of bad) {
    await assert.rejects(() => store.importJson(text), /Invalid progress file/, text);
  }
  assert.deepEqual(await store.getProgress(), { 'q-1': state });
});

test('reset clears everything', async () => {
  const store = createStore(memoryBackend());
  await store.saveState('q-1', state);
  await store.reset();
  assert.deepEqual(await store.getProgress(), {});
});

test('safeBackend falls back to memory when the primary throws, and flags it', async () => {
  const broken = { read: async () => { throw new Error('blocked'); }, write: async () => { throw new Error('blocked'); } };
  const backend = safeBackend(broken, memoryBackend());
  const store = createStore(backend);
  await store.saveState('q-1', state);
  assert.deepEqual(await store.getProgress(), { 'q-1': state });
  assert.equal(backend.degraded, true);
});
