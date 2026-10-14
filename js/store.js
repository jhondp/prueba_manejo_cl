import { updateStreak } from './streak.js';

const VERSION = 1;
const MAX_BOX = 4;
const emptyData = () => ({ version: VERSION, progress: {}, attempts: [], streak: { last: null, count: 0 } });

const isState = (s) =>
  s && typeof s === 'object' &&
  Number.isInteger(s.box) && s.box >= 0 && s.box <= MAX_BOX &&
  Number.isFinite(s.due) && Number.isFinite(s.seen) && Number.isFinite(s.correct);

function parseExport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid progress file');
  }
  const valid =
    data && typeof data === 'object' && !Array.isArray(data) &&
    data.version === VERSION &&
    data.progress && typeof data.progress === 'object' && !Array.isArray(data.progress) &&
    Object.values(data.progress).every(isState) &&
    Array.isArray(data.attempts);
  if (!valid) throw new Error('Invalid progress file');
  return { ...emptyData(), ...data };
}

export function memoryBackend(initial) {
  let data = initial;
  return {
    read: async () => (data === undefined ? undefined : structuredClone(data)),
    write: async (next) => { data = structuredClone(next); },
  };
}

export function idbBackend(dbName = 'manejo-b') {
  const open = () => new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('kv', mode);
      const req = fn(tx.objectStore('kv'));
      tx.oncomplete = () => { db.close(); resolve(req.result); };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  };
  return {
    read: () => run('readonly', (s) => s.get('data')),
    write: (data) => run('readwrite', (s) => s.put(data, 'data')).then(() => undefined),
  };
}

export function safeBackend(primary, fallback) {
  const wrapper = {
    degraded: false,
    async read() {
      try { if (!wrapper.degraded) return await primary.read(); } catch { wrapper.degraded = true; }
      return fallback.read();
    },
    async write(data) {
      try { if (!wrapper.degraded) return await primary.write(data); } catch { wrapper.degraded = true; }
      return fallback.write(data);
    },
  };
  return wrapper;
}

export function createStore(backend) {
  let cache = null;
  const load = async () => {
    if (!cache) cache = { ...emptyData(), ...((await backend.read()) ?? {}) };
    return cache;
  };
  const commit = () => backend.write(cache);
  return {
    async getProgress() { return (await load()).progress; },
    async saveState(id, state) { (await load()).progress[id] = state; await commit(); },
    async addAttempt(attempt) { (await load()).attempts.push(attempt); await commit(); },
    async getAttempts() { return (await load()).attempts; },
    async getStreak() { return (await load()).streak; },
    async touchStreak(todayIso) {
      const data = await load();
      data.streak = updateStreak(data.streak, todayIso);
      await commit();
      return data.streak;
    },
    async exportJson() { return JSON.stringify(await load(), null, 2); },
    async importJson(text) {
      const next = parseExport(text);
      await load();
      cache = next;
      await commit();
    },
    async reset() { cache = emptyData(); await commit(); },
  };
}
