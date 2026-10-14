# Driving Theory Exam Study App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, offline-capable PWA that teaches the Chilean Class B theory exam using the official question bank, a handbook reader and spaced repetition, deployed on GitHub Pages.

**Architecture:** Vanilla ES modules, no build step, no runtime dependencies. Pure logic modules (`scheduler`, `deck`, `streak`, `markdown`, `router.parseRoute`, `store` with injectable backend) are unit-tested with `node --test`; DOM views are thin and verified manually. Content (handbook `.md`, `preguntas.json`) is produced once from the PDFs by sub-agents and committed; the PDFs never are.

**Tech Stack:** HTML/CSS/JS (ES modules), IndexedDB, Service Worker, Node >= 20 (tests/scripts only), `pdftotext`/`pdftoppm`/`pdfimages` (poppler), GitHub Actions + Pages.

**Spec:** `docs/superpowers/specs/2026-10-14-manejo-app-design.md`

## Global Constraints

- No backend, no build step, no runtime dependencies; `package.json` has no `dependencies`.
- Source PDFs (`libro.pdf`, `PREGUNTAS.pdf`) are never committed or published; `*.pdf` stays in `.gitignore`.
- User-facing copy is Spanish; code, identifiers, comments and docs are English.
- Leitner intervals are exactly 1, 3, 7, 14 days (boxes 1–4); wrong answer returns to box 1 due now.
- Quiz length is configurable, default 10.
- UI follows the mockup tokens: background `#F1FAEE`, ink `#1D3557`, accent `#E63946`, soft `#A8DADC`, blue `#457B9D`, font Figtree; desktop = sidebar, phone = bottom tabs.
- Commits: conventional commits only (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). **Never** add `Co-Authored-By`, "Generated with", or any mention of AI/Claude in commit messages, trailers, code, docs or the PR text.
- Paths in the app are relative (the site is served from `/<repo>/`).

## Review Focus

Failure modes the spec implies but a happy-path test would miss, most likely first. Each has a pinning test in the owning task.

1. Quiz size of 0, a negative, a non-integer or larger than the bank → no crash, no duplicates, no out-of-range items (Task 3).
2. A malformed question (2 options, `correcta` out of range, duplicate id, missing image file) reaching production (Task 4).
3. Importing a corrupt or foreign JSON file wipes or corrupts existing progress (Task 5).
4. IndexedDB unavailable (private window, blocked storage) → app must keep working in memory and warn (Task 5).
5. Handbook text containing `<`/`&` or HTML injected into the reader (Task 6); and a deployed update never reaching users because the cache name did not change (Task 11).

## File Structure

```
package.json  .gitignore  README.md
index.html  manifest.webmanifest  sw.js
css/app.css
assets/fonts/figtree.woff2  assets/icons/icon-192.png icon-512.png  assets/img/q-NNNN.png
js/app.js dom.js router.js store.js streak.js scheduler.js deck.js markdown.js
js/views/home.js cards.js quiz.js results.js book.js settings.js
data/preguntas.json  data/revision.md  data/partials/*.json
content/libro/NN-slug.md  content/libro/index.json
scripts/validate-data.mjs merge-questions.mjs check-book.mjs build-book-index.mjs build-precache.mjs
tests/*.test.js
.github/workflows/pages.yml
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Verify tooling**

Run: `node --version && pdftotext -v 2>&1 | head -1 && pdftoppm -v 2>&1 | head -1 && pdfimages -v 2>&1 | head -1`
Expected: Node v20+ and three poppler versions. If Node < 20, stop and ask the user to upgrade.

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "manejo-b",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "validate": "node scripts/validate-data.mjs"
  }
}
```

- [ ] **Step 3: Extend `.gitignore`** (keep the existing `*.pdf` line)

```
*.pdf
scratch/
node_modules/
Examen de Manejo Clase B.html
```

- [ ] **Step 4: Commit**

```bash
git add package.json .gitignore
git commit -m "chore: add package manifest and ignore rules"
```

---

### Task 2: Spaced-repetition scheduler

**Files:**
- Create: `js/scheduler.js`
- Test: `tests/scheduler.test.js`

**Interfaces:**
- Produces: `INTERVALS_DAYS`, `MASTERED_BOX`, `newState(): State`, `review(state, wasCorrect, now): State`, `isNew(s)`, `isDue(s, now)`, `isMastered(s)`. `State = { box: 0..4, due: number(ms), seen: number, correct: number }`; `box 0` = never seen.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { newState, review, isNew, isDue, isMastered, INTERVALS_DAYS } from '../js/scheduler.js';

const NOW = Date.UTC(2026, 9, 14);
const DAY = 24 * 60 * 60 * 1000;

test('intervals are 1, 3, 7, 14 days', () => {
  assert.deepEqual(INTERVALS_DAYS, [1, 3, 7, 14]);
});

test('a new state is new, not due, not mastered', () => {
  const s = newState();
  assert.ok(isNew(s));
  assert.ok(!isDue(s, NOW));
  assert.ok(!isMastered(s));
});

test('correct on a new question goes to box 1, due in 1 day', () => {
  const s = review(newState(), true, NOW);
  assert.deepEqual(s, { box: 1, due: NOW + DAY, seen: 1, correct: 1 });
});

test('correct answers climb one box at a time with growing intervals', () => {
  let s = newState();
  const expected = [[1, 1], [2, 3], [3, 7], [4, 14]];
  for (const [box, days] of expected) {
    s = review(s, true, NOW);
    assert.equal(s.box, box);
    assert.equal(s.due, NOW + days * DAY);
  }
  assert.ok(isMastered(s));
});

test('box 4 stays at box 4 on another correct answer', () => {
  const s = review({ box: 4, due: NOW, seen: 5, correct: 5 }, true, NOW);
  assert.equal(s.box, 4);
  assert.equal(s.due, NOW + 14 * DAY);
});

test('a wrong answer from any box returns to box 1, due now', () => {
  const s = review({ box: 4, due: NOW + DAY, seen: 4, correct: 4 }, false, NOW);
  assert.deepEqual(s, { box: 1, due: NOW, seen: 5, correct: 4 });
  assert.ok(isDue(s, NOW));
  assert.ok(!isMastered(s));
});

test('a seen question is due only once its due time has passed', () => {
  const s = review(newState(), true, NOW);
  assert.ok(!isDue(s, NOW));
  assert.ok(isDue(s, NOW + DAY));
});

test('review does not mutate its input', () => {
  const s = newState();
  review(s, true, NOW);
  assert.deepEqual(s, { box: 0, due: 0, seen: 0, correct: 0 });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/scheduler.test.js`
Expected: FAIL (`Cannot find module '../js/scheduler.js'`).

- [ ] **Step 3: Write the implementation**

```js
export const INTERVALS_DAYS = [1, 3, 7, 14];
export const MASTERED_BOX = INTERVALS_DAYS.length;
const DAY_MS = 24 * 60 * 60 * 1000;

export function newState() {
  return { box: 0, due: 0, seen: 0, correct: 0 };
}

export function review(state, wasCorrect, now) {
  const box = wasCorrect ? Math.min(state.box + 1, MASTERED_BOX) : 1;
  const due = wasCorrect ? now + INTERVALS_DAYS[box - 1] * DAY_MS : now;
  return {
    box,
    due,
    seen: state.seen + 1,
    correct: state.correct + (wasCorrect ? 1 : 0),
  };
}

export const isNew = (state) => state.box === 0;
export const isDue = (state, now) => state.box > 0 && state.due <= now;
export const isMastered = (state) => state.box === MASTERED_BOX;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test tests/scheduler.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add js/scheduler.js tests/scheduler.test.js
git commit -m "feat: add Leitner spaced-repetition scheduler"
```

---

### Task 3: Study queues (deck)

**Files:**
- Create: `js/deck.js`
- Test: `tests/deck.test.js`

**Interfaces:**
- Consumes: `newState, isDue, isNew, isMastered` from `./scheduler.js`.
- Produces: `shuffle(items, rng?)`, `dueQueue(questions, progress, now)`, `newQueue(questions, progress, limit?)`, `cardDeck(questions, progress, now, newLimit = 10)` (due first, then new), `quizSet(questions, progress, size, rng?)` (uniform random, no repeats), `stats(questions, progress, now) -> { total, new, due, mastered }`. `progress` is `Record<id, State>`; a missing id means a new question.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { shuffle, dueQueue, newQueue, cardDeck, quizSet, stats } from '../js/deck.js';

const NOW = Date.UTC(2026, 9, 14);
const DAY = 24 * 60 * 60 * 1000;
const questions = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));
const progress = {
  a: { box: 1, due: NOW - DAY, seen: 1, correct: 0 }, // due
  b: { box: 2, due: NOW + DAY, seen: 2, correct: 2 }, // scheduled
  c: { box: 4, due: NOW + 14 * DAY, seen: 4, correct: 4 }, // mastered
  d: { box: 1, due: NOW - 2 * DAY, seen: 1, correct: 0 }, // due, older
};
const ids = (list) => list.map((q) => q.id);

test('dueQueue returns due questions, oldest due first', () => {
  assert.deepEqual(ids(dueQueue(questions, progress, NOW)), ['d', 'a']);
});

test('newQueue returns unseen questions and respects the limit', () => {
  assert.deepEqual(ids(newQueue(questions, progress)), ['e']);
  assert.deepEqual(ids(newQueue(questions, {}, 2)), ['a', 'b']);
});

test('cardDeck puts due cards before new ones', () => {
  assert.deepEqual(ids(cardDeck(questions, progress, NOW)), ['d', 'a', 'e']);
});

test('shuffle is a permutation and does not mutate the input', () => {
  const input = [1, 2, 3, 4, 5];
  const out = shuffle(input, () => 0.42);
  assert.deepEqual([...out].sort(), [1, 2, 3, 4, 5]);
  assert.deepEqual(input, [1, 2, 3, 4, 5]);
});

test('quizSet returns the requested number of unique questions', () => {
  const set = quizSet(questions, progress, 3);
  assert.equal(set.length, 3);
  assert.equal(new Set(ids(set)).size, 3);
});

test('quizSet clamps size: 0, negative, NaN, fractional and oversized', () => {
  assert.deepEqual(quizSet(questions, progress, 0), []);
  assert.deepEqual(quizSet(questions, progress, -4), []);
  assert.deepEqual(quizSet(questions, progress, NaN), []);
  assert.equal(quizSet(questions, progress, 2.9).length, 2);
  assert.equal(quizSet(questions, progress, 99).length, 5);
  assert.deepEqual(quizSet([], progress, 10), []);
});

test('stats counts new, due and mastered', () => {
  assert.deepEqual(stats(questions, progress, NOW), { total: 5, new: 1, due: 2, mastered: 1 });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/deck.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the implementation**

```js
import { newState, isDue, isNew, isMastered } from './scheduler.js';

const stateOf = (progress, id) => progress[id] ?? newState();

export function shuffle(items, rng = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function dueQueue(questions, progress, now) {
  return questions
    .filter((q) => isDue(stateOf(progress, q.id), now))
    .sort((a, b) => stateOf(progress, a.id).due - stateOf(progress, b.id).due);
}

export function newQueue(questions, progress, limit = Infinity) {
  return questions.filter((q) => isNew(stateOf(progress, q.id))).slice(0, limit);
}

export function cardDeck(questions, progress, now, newLimit = 10) {
  return [...dueQueue(questions, progress, now), ...newQueue(questions, progress, newLimit)];
}

export function quizSet(questions, progress, size, rng = Math.random) {
  const count = Math.max(0, Math.min(Math.floor(size) || 0, questions.length));
  return shuffle(questions, rng).slice(0, count);
}

export function stats(questions, progress, now) {
  let fresh = 0;
  let due = 0;
  let mastered = 0;
  for (const q of questions) {
    const s = stateOf(progress, q.id);
    if (isNew(s)) fresh += 1;
    if (isDue(s, now)) due += 1;
    if (isMastered(s)) mastered += 1;
  }
  return { total: questions.length, new: fresh, due, mastered };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test tests/deck.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add js/deck.js tests/deck.test.js
git commit -m "feat: add study queue and quiz selection logic"
```

---

### Task 4: Data validator

**Files:**
- Create: `scripts/validate-data.mjs`
- Test: `tests/validate-data.test.js`

**Interfaces:**
- Produces: `validateQuestions(list, { imageExists?: (path) => boolean, chapterSlugs?: string[] | null }) -> string[]` (empty array = valid). Question shape: `{ id: string, tema: string, capitulo: string, enunciado: string, opciones: string[3..4], correcta: number, imagen?: string, explicacion?: string }`. CLI `npm run validate` exits 1 and prints errors when invalid.

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/validate-data.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the implementation**

```js
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const isText = (v) => typeof v === 'string' && v.trim().length > 0;

export function validateQuestions(list, { imageExists = () => true, chapterSlugs = null } = {}) {
  if (!Array.isArray(list) || list.length === 0) return ['questions: expected a non-empty array'];
  const errors = [];
  const seen = new Set();
  list.forEach((raw, i) => {
    const q = raw ?? {};
    const fail = (msg) => errors.push(`question[${i}]${q.id ? ` (${q.id})` : ''}: ${msg}`);
    if (!isText(q.id)) fail('missing id');
    else if (seen.has(q.id)) fail('duplicate id');
    else seen.add(q.id);
    if (!isText(q.enunciado)) fail('missing enunciado');
    if (!isText(q.tema)) fail('missing tema');
    const opts = q.opciones;
    if (!Array.isArray(opts) || opts.length < 3 || opts.length > 4 || !opts.every(isText)) {
      fail('opciones must be 3-4 non-empty strings');
    } else if (!Number.isInteger(q.correcta) || q.correcta < 0 || q.correcta >= opts.length) {
      fail('correcta must be a valid option index');
    }
    if (q.imagen !== undefined && !(isText(q.imagen) && imageExists(q.imagen))) {
      fail(`image not found: ${q.imagen}`);
    }
    if (chapterSlugs && !chapterSlugs.includes(q.capitulo)) fail(`unknown capitulo: ${q.capitulo}`);
  });
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = new URL('../', import.meta.url);
  const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
  const chapters = read('content/libro/index.json');
  const errors = validateQuestions(read('data/preguntas.json'), {
    imageExists: (p) => existsSync(new URL(p, root)),
    chapterSlugs: chapters.map((c) => c.slug),
  });
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('data OK');
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test tests/validate-data.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/validate-data.mjs tests/validate-data.test.js
git commit -m "feat: add question bank validator"
```

---

### Task 5: Streak and progress store

**Files:**
- Create: `js/streak.js`, `js/store.js`
- Test: `tests/streak.test.js`, `tests/store.test.js`

**Interfaces:**
- Produces from `streak.js`: `updateStreak(streak, todayIso) -> { last: string|null, count: number }`, `localIsoDate(date?) -> 'YYYY-MM-DD'`.
- Produces from `store.js`: `memoryBackend(initial?)`, `idbBackend(dbName?)`, `safeBackend(primary, fallback)` (adds `.degraded: boolean`), `createStore(backend)` with async methods `getProgress()`, `saveState(id, state)`, `addAttempt({date, score, total, wrong})`, `getAttempts()`, `touchStreak(todayIso)`, `getStreak()`, `exportJson()`, `importJson(text)` (throws `Error('Invalid progress file')`, leaves data untouched), `reset()`. A backend is `{ read(): Promise<data|undefined>, write(data): Promise<void> }`. Data shape: `{ version: 1, progress: {}, attempts: [], streak: { last: null, count: 0 } }`.

- [ ] **Step 1: Write the failing tests**

`tests/streak.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { updateStreak, localIsoDate } from '../js/streak.js';

const fresh = { last: null, count: 0 };

test('first study day starts a streak of 1', () => {
  assert.deepEqual(updateStreak(fresh, '2026-10-14'), { last: '2026-10-14', count: 1 });
});

test('studying twice on the same day does not change the streak', () => {
  const s = { last: '2026-10-14', count: 3 };
  assert.equal(updateStreak(s, '2026-10-14'), s);
});

test('studying on consecutive days extends it, including across month and year', () => {
  assert.equal(updateStreak({ last: '2026-10-14', count: 3 }, '2026-10-15').count, 4);
  assert.equal(updateStreak({ last: '2026-10-31', count: 1 }, '2026-11-01').count, 2);
  assert.equal(updateStreak({ last: '2026-12-31', count: 5 }, '2027-01-01').count, 6);
});

test('a gap of more than one day resets to 1', () => {
  assert.deepEqual(updateStreak({ last: '2026-10-10', count: 9 }, '2026-10-14'), { last: '2026-10-14', count: 1 });
});

test('localIsoDate formats local dates with zero padding', () => {
  assert.equal(localIsoDate(new Date(2026, 0, 5)), '2026-01-05');
});
```

`tests/store.test.js`:

```js
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
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test tests/streak.test.js tests/store.test.js`
Expected: FAIL (modules not found).

- [ ] **Step 3: Write `js/streak.js`**

```js
const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (iso) => Date.parse(`${iso}T00:00:00Z`) / DAY_MS;

export function updateStreak(streak, todayIso) {
  if (streak.last === todayIso) return streak;
  const consecutive = streak.last !== null && dayNumber(todayIso) - dayNumber(streak.last) === 1;
  return { last: todayIso, count: consecutive ? streak.count + 1 : 1 };
}

export function localIsoDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
```

- [ ] **Step 4: Write `js/store.js`**

```js
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
```

- [ ] **Step 5: Run them to verify they pass**

Run: `node --test tests/streak.test.js tests/store.test.js`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add js/streak.js js/store.js tests/streak.test.js tests/store.test.js
git commit -m "feat: add streak tracking and resilient progress store"
```

---

### Task 6: Markdown renderer and route parser

**Files:**
- Create: `js/markdown.js`, `js/router.js`
- Test: `tests/markdown.test.js`, `tests/router.test.js`

**Interfaces:**
- Produces: `renderMarkdown(src) -> html string` (supports `#`..`###`, paragraphs, `-`/`*` and `1.` lists, `**bold**`, `*italic*`; strips leading front matter; escapes all HTML). `parseRoute(hash) -> { name, param }`, `startRouter(onRoute)`, `navigate(path)`.

- [ ] **Step 1: Write the failing tests**

`tests/markdown.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../js/markdown.js';

test('renders headings and joins wrapped paragraph lines', () => {
  assert.equal(renderMarkdown('# Título\n\nlínea uno\nlínea dos'), '<h1>Título</h1>\n<p>línea uno línea dos</p>');
});

test('renders unordered and ordered lists', () => {
  assert.equal(renderMarkdown('- a\n- b\n\n1. x\n2. y'), '<ul><li>a</li><li>b</li></ul>\n<ol><li>x</li><li>y</li></ol>');
});

test('renders bold and italic', () => {
  assert.equal(renderMarkdown('**uno** y *dos*'), '<p><strong>uno</strong> y <em>dos</em></p>');
});

test('strips front matter', () => {
  assert.equal(renderMarkdown('---\ntitle: X\n---\n# H'), '<h1>H</h1>');
});

test('escapes raw HTML so it can never execute', () => {
  const html = renderMarkdown('<script>alert(1)</script> & <img src=x onerror=1>');
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('<img'));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&amp;/);
});
```

`tests/router.test.js`:

```js
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
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test tests/markdown.test.js tests/router.test.js`
Expected: FAIL (modules not found).

- [ ] **Step 3: Write `js/markdown.js`**

```js
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) =>
  escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');

export function renderMarkdown(src) {
  const lines = src.replace(/^---\n[\s\S]*?\n---\n/, '').split('\n');
  const out = [];
  let para = [];
  let list = null;
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };
  const addItem = (tag, text) => {
    flushPara();
    if (list?.tag !== tag) { flushList(); list = { tag, items: [] }; }
    list.items.push(text);
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { flushPara(); flushList(); }
    else if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      flushPara(); flushList();
      out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
    }
    else if ((m = line.match(/^[-*]\s+(.*)$/))) addItem('ul', m[1]);
    else if ((m = line.match(/^\d+[.)]\s+(.*)$/))) addItem('ol', m[1]);
    else { flushList(); para.push(line.trim()); }
  }
  flushPara();
  flushList();
  return out.join('\n');
}
```

- [ ] **Step 4: Write `js/router.js`**

```js
export function parseRoute(hash) {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { name: parts[0] ?? 'inicio', param: parts[1] ?? null };
}

export function startRouter(onRoute) {
  const run = () => onRoute(parseRoute(location.hash));
  addEventListener('hashchange', run);
  run();
}

export const navigate = (path) => { location.hash = `#/${path}`; };
```

- [ ] **Step 5: Run them to verify they pass, then the full suite**

Run: `node --test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add js/markdown.js js/router.js tests/markdown.test.js tests/router.test.js
git commit -m "feat: add markdown renderer and hash router"
```

---

### Task 7: Handbook extraction to Markdown

**Files:**
- Create: `scripts/check-book.mjs`, `scripts/build-book-index.mjs`, `content/libro/NN-<slug>.md` (one per chapter), `content/libro/index.json`
- Test: `tests/book-scripts.test.js`

**Interfaces:**
- Produces: chapter files with front matter `title`, `slug`, `order`; `content/libro/index.json` = `[{ slug, title, file }]` sorted by `order`; `coverage(sourceText, markdownTexts) -> number` (ratio of words) and `buildIndex(files: {name, text}[]) -> [{slug,title,file}]`.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { coverage } from '../scripts/check-book.mjs';
import { buildIndex } from '../scripts/build-book-index.mjs';

test('coverage ignores markdown symbols and front matter', () => {
  const source = 'Hola mundo uno dos tres';
  const md = ['---\ntitle: X\nslug: x\norder: 1\n---\n# Hola mundo\n\n- uno\n- **dos** tres'];
  assert.equal(coverage(source, md), 1);
});

test('coverage detects missing text', () => {
  assert.ok(coverage('a b c d e f g h i j', ['a b c d e']) < 0.9);
});

test('buildIndex sorts by order and reads title and slug from front matter', () => {
  const files = [
    { name: '02-b.md', text: '---\ntitle: Segundo\nslug: b\norder: 2\n---\nx' },
    { name: '01-a.md', text: '---\ntitle: Primero\nslug: a\norder: 1\n---\nx' },
  ];
  assert.deepEqual(buildIndex(files), [
    { slug: 'a', title: 'Primero', file: '01-a.md' },
    { slug: 'b', title: 'Segundo', file: '02-b.md' },
  ]);
});

test('buildIndex rejects a file without front matter fields', () => {
  assert.throws(() => buildIndex([{ name: 'x.md', text: '# no front matter' }]), /front matter/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/book-scripts.test.js`
Expected: FAIL (modules not found).

- [ ] **Step 3: Write `scripts/check-book.mjs`**

```js
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const words = (text) => (text.replace(/^---\n[\s\S]*?\n---\n/, '').match(/\S+/g) ?? []).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

export function coverage(sourceText, markdownTexts) {
  return markdownTexts.reduce((n, t) => n + words(t), 0) / words(sourceText);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = new URL('../content/libro/', import.meta.url);
  const texts = readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => readFileSync(new URL(f, dir), 'utf8'));
  const ratio = coverage(readFileSync(process.argv[2], 'utf8'), texts);
  console.log(`coverage: ${(ratio * 100).toFixed(1)}%`);
  if (ratio < 0.9 || ratio > 1.1) process.exit(1);
}
```

- [ ] **Step 4: Write `scripts/build-book-index.mjs`**

```js
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const field = (front, key) => front.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1].trim();

export function buildIndex(files) {
  return files
    .map(({ name, text }) => {
      const front = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
      const title = field(front, 'title');
      const slug = field(front, 'slug');
      const order = Number(field(front, 'order'));
      if (!title || !slug || !Number.isFinite(order)) throw new Error(`${name}: missing front matter (title, slug, order)`);
      return { slug, title, file: name, order };
    })
    .sort((a, b) => a.order - b.order)
    .map(({ slug, title, file }) => ({ slug, title, file }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = new URL('../content/libro/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.md')).map((name) => ({ name, text: readFileSync(new URL(name, dir), 'utf8') }));
  writeFileSync(new URL('index.json', dir), `${JSON.stringify(buildIndex(files), null, 2)}\n`);
  console.log(`indexed ${files.length} chapters`);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/book-scripts.test.js`
Expected: all PASS.

- [ ] **Step 6: Extract the text**

Run: `mkdir -p scratch content/libro && pdftotext libro.pdf scratch/libro.txt`
Then read the table of contents in `scratch/libro.txt` (first ~5 pages, split on form-feed `\f` = page break) and write `scratch/chapters.md`: each chapter with its title, kebab-case slug (ASCII, no accents) and page range. Show it to the user only if the TOC is ambiguous.

- [ ] **Step 7: Dispatch conversion agents (parallel, one message, one agent per ~3-4 chapters)**

Each agent prompt (fill in the chapter list and page ranges from `scratch/chapters.md`):

```
Convert these chapters of a Chilean driver's handbook from the raw text in
scratch/libro.txt (pages X-Y, pages separated by form feed) into Markdown files
in content/libro/. Rules:
- One file per chapter named NN-<slug>.md (NN = two-digit order). Front matter:
  ---
  title: <chapter title in Spanish>
  slug: <slug>
  order: <number>
  ---
- Keep ALL the text, in Spanish, faithfully. Do not summarize, translate or invent.
  Only fix hyphenation across line breaks, running headers/footers and page numbers.
- Use only: #, ##, ### headings, paragraphs, "- " lists, "1. " lists, **bold**, *italic*.
  No tables (turn them into lists), no HTML, no images.
- Write only to content/libro/. Do not touch other files. Do not run git.
Return the list of files written and any passages you were unsure about.
```

- [ ] **Step 8: Build index and check coverage**

Run: `node scripts/build-book-index.mjs && node scripts/check-book.mjs scratch/libro.txt`
Expected: `indexed N chapters` and `coverage` between 90% and 110%. If outside, send the specific chapters back to an agent; do not hand-edit around the check.

- [ ] **Step 9: Commit**

```bash
git add scripts/check-book.mjs scripts/build-book-index.mjs tests/book-scripts.test.js content/libro
git commit -m "feat: add handbook content as markdown chapters"
```

---

### Task 8: Question bank extraction

**Files:**
- Create: `scripts/merge-questions.mjs`, `data/partials/preguntas-<from>-<to>.json`, `data/preguntas.json`, `data/revision.md`, `assets/img/q-NNNN.png`, `tests/data.test.js`
- Test: `tests/merge-questions.test.js`, `tests/data.test.js`

**Interfaces:**
- Consumes: `validateQuestions` from `scripts/validate-data.mjs`; `content/libro/index.json` (chapter slugs, from Task 7).
- Produces: `mergePartials(partials: Item[][]) -> { questions, revision: {id,page,duda}[], imageCopies: {id,page,index,to}[] }`. Partial item = `{ page, tema, capitulo, enunciado, opciones, correcta, explicacion?, imageRef?: { page, index }, duda? }`; `index` is the 0-based position of the image among that page's extracted images.

- [ ] **Step 1: Write the failing merge test**

```js
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/merge-questions.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `scripts/merge-questions.mjs`**

```js
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function mergePartials(partials) {
  const questions = [];
  const revision = [];
  const imageCopies = [];
  let n = 0;
  for (const partial of partials) {
    for (const item of partial) {
      n += 1;
      const id = `q-${String(n).padStart(4, '0')}`;
      const { imageRef, duda, page, ...rest } = item;
      const q = { id, ...rest };
      if (imageRef) {
        q.imagen = `assets/img/${id}.png`;
        imageCopies.push({ id, page: imageRef.page, index: imageRef.index, to: q.imagen });
      }
      questions.push(q);
      if (duda) revision.push({ id, page, duda });
    }
  }
  return { questions, revision, imageCopies };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = new URL('../', import.meta.url);
  const at = (p) => fileURLToPath(new URL(p, root));
  const names = readdirSync(at('data/partials')).filter((f) => f.endsWith('.json')).sort();
  const partials = names.map((f) => JSON.parse(readFileSync(at(`data/partials/${f}`), 'utf8')));
  const { questions, revision, imageCopies } = mergePartials(partials);

  // pdfimages -png -p names files im-<page>-<n>.png; group them by page, ordered by <n>.
  const byPage = {};
  for (const f of readdirSync(at('scratch/img')).sort()) {
    const m = f.match(/^im-(\d+)-(\d+)\.png$/);
    if (m) (byPage[Number(m[1])] ??= []).push(f);
  }
  mkdirSync(at('assets/img'), { recursive: true });
  for (const { page, index, to, id } of imageCopies) {
    const file = byPage[page]?.[index];
    if (!file) throw new Error(`${id}: no image #${index} on page ${page}`);
    copyFileSync(at(`scratch/img/${file}`), at(to));
  }

  writeFileSync(at('data/preguntas.json'), `${JSON.stringify(questions, null, 2)}\n`);
  const lines = revision.map((r) => `- ${r.id} (PDF page ${r.page}): ${r.duda}`);
  writeFileSync(at('data/revision.md'), `# Questions to confirm against PREGUNTAS.pdf\n\n${lines.join('\n') || 'None.'}\n`);
  console.log(`${questions.length} questions, ${revision.length} to review, ${imageCopies.length} images`);
  if (!existsSync(at('data/preguntas.json'))) process.exit(1);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test tests/merge-questions.test.js`
Expected: all PASS.

- [ ] **Step 5: Render pages and extract images (scratch only, never committed)**

```bash
mkdir -p scratch/pages scratch/img data/partials
pdftoppm -r 110 -jpeg PREGUNTAS.pdf scratch/pages/p
pdfimages -png -p PREGUNTAS.pdf scratch/img/im
```

Check the page file naming (`scratch/pages/p-001.jpg` or `p-1.jpg`; zero-padding depends on the page count).

- [ ] **Step 6: Learn the page layout before fanning out**

Read pages 1–3 as images (Read tool on `scratch/pages/p-001.jpg` etc.). Write down in `scratch/format-notes.md`: how a question is laid out, how options are labeled, **how the correct answer is marked** and where images appear. If the correct answer is NOT identifiable on the page, stop and ask the user one question about it before continuing.

- [ ] **Step 7: Dispatch reading agents (parallel, one message, ~15 pages each, 8 agents)**

Each agent prompt (fill in the page range and paste `scratch/format-notes.md` and the chapter slugs from `content/libro/index.json`):

```
Read pages <A>-<B> of the Chilean Class B driving theory question bank. The page images
are scratch/pages/p-NNN.jpg. Transcribe EVERY question on those pages into
data/partials/preguntas-<A>-<B>.json as a JSON array. Item shape:
{ "page": <pdf page number>, "tema": "<topic in Spanish>", "capitulo": "<one slug from the list below>",
  "enunciado": "<question text, verbatim>", "opciones": ["<text>", ...],
  "correcta": <0-based index of the correct option>,
  "explicacion": "<only if the page prints one>",
  "imageRef": { "page": <pdf page>, "index": <0-based position among that page's pictures> },
  "duda": "<why you are unsure, only if you are>" }
Rules: transcribe verbatim in Spanish, never correct or paraphrase; keep option order as printed
without the letter prefix; include imageRef only when the picture is part of the question
(road sign, diagram), not logos; if the correct answer is unclear or you doubt a word, still give
your best answer AND fill "duda". Chapter slugs: <list>. Layout notes: <format-notes>.
Write only that one file. Do not run git. Return the question count and number of doubts.
```

- [ ] **Step 8: Merge and validate**

Run: `node scripts/merge-questions.mjs && npm run validate`
Expected: counts printed, then `data OK`. On validation errors, send the offending page ranges back to an agent with the exact error lines.

- [ ] **Step 9: Add the data gate test**

`tests/data.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { validateQuestions } from '../scripts/validate-data.mjs';

const root = new URL('../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));

test('the shipped question bank is valid and links to real chapters', () => {
  const errors = validateQuestions(read('data/preguntas.json'), {
    imageExists: (p) => existsSync(new URL(p, root)),
    chapterSlugs: read('content/libro/index.json').map((c) => c.slug),
  });
  assert.deepEqual(errors, []);
});
```

Run: `node --test`
Expected: all PASS.

- [ ] **Step 10: Sanity-check a sample against the PDF**

Pick 10 random questions from `data/preguntas.json`; read their PDF pages again and confirm text, options and correct answer. Report the result to the user together with the count in `data/revision.md`.

- [ ] **Step 11: Commit**

```bash
git add scripts/merge-questions.mjs tests/merge-questions.test.js tests/data.test.js data assets/img
git commit -m "feat: add official question bank data"
```

---

### Task 9: App shell and design system

**Files:**
- Create: `index.html`, `css/app.css`, `js/dom.js`, `js/app.js`, `assets/fonts/figtree.woff2`
- Modify: none

**Interfaces:**
- Consumes: `startRouter`, `navigate` (router), `createStore`, `idbBackend`, `memoryBackend`, `safeBackend` (store), views `homeView`, `cardsView`, `quizView`, `resultsView`, `bookView`, `settingsView` (Task 10, each `(ctx) => Node | Promise<Node>`).
- Produces: `h(tag, attrs, ...children) -> HTMLElement` (`class`, `html`, `onclick`-style listeners, boolean attrs). View context `ctx = { questions, chapters, store, now(): number, degraded(): boolean, route: {name, param} }`.

- [ ] **Step 1: Extract the font from the mockup into scratch, then copy it**

Run:

```bash
python3 -I - <<'PY'
import re, json, base64, gzip, os
src = open('Examen de Manejo Clase B.html', encoding='utf8').read()
blk = lambda s, t: re.search(r'<script type="__bundler/%s">([\s\S]*?)</script>' % t, s).group(1)
os.makedirs('scratch/mock', exist_ok=True)
for k, v in json.loads(blk(src, 'manifest')).items():
    d = base64.b64decode(v['data'])
    d = gzip.decompress(d) if v.get('compressed') else d
    inner = d.decode('utf8')
    m = re.search(r'<script type="__bundler/manifest">([\s\S]*?)</script>', inner)
    for k2, v2 in json.loads(m.group(1)).items():
        if v2['mime'] == 'font/woff2':
            d2 = base64.b64decode(v2['data'])
            d2 = gzip.decompress(d2) if v2.get('compressed') else d2
            open(f'scratch/mock/{k[:6]}-{k2[:6]}.woff2', 'wb').write(d2)
PY
mkdir -p assets/fonts && cp "$(ls scratch/mock/*.woff2 | head -1)" assets/fonts/figtree.woff2
```

Expected: `assets/fonts/figtree.woff2` exists and is non-empty. If the nested bundle layout differs, locate any `font/woff2` entry in the unpacked bundles by hand; if none, skip the font (the CSS falls back to `system-ui`).

- [ ] **Step 2: Create `index.html`**

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Examen de Manejo Clase B</title>
  <meta name="theme-color" content="#1D3557">
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="icon" href="assets/icons/icon-192.png">
  <link rel="stylesheet" href="css/app.css">
</head>
<body>
  <noscript>Esta aplicación necesita JavaScript.</noscript>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create `js/dom.js`**

```js
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === false || value == null) continue;
    if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'class') el.className = value;
    else if (key === 'html') el.innerHTML = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  el.append(...children.flat().filter((c) => c != null && c !== false));
  return el;
}
```

- [ ] **Step 4: Create `css/app.css`**

```css
@font-face {
  font-family: 'Figtree';
  src: url('../assets/fonts/figtree.woff2') format('woff2');
  font-weight: 300 900;
  font-display: swap;
}
:root {
  --bg: #F1FAEE; --ink: #1D3557; --accent: #E63946; --soft: #A8DADC; --blue: #457B9D; --surface: #FFFFFF;
  --ok: #2a9d8f; --radius: 14px;
}
* { box-sizing: border-box; }
html { background: var(--bg); color: var(--ink); font: 16px/1.5 'Figtree', system-ui, sans-serif; }
body { margin: 0; min-height: 100vh; display: flex; }
a { color: var(--blue); }
h1 { font-size: 1.9rem; line-height: 1.2; margin: .2rem 0 .6rem; }
h2 { font-size: 1.3rem; line-height: 1.3; }
.lead { color: var(--blue); max-width: 46ch; }
.eyebrow { text-transform: uppercase; letter-spacing: .08em; font-size: .75rem; font-weight: 700; color: var(--accent); margin: 0; }

.nav { background: var(--ink); color: var(--bg); display: flex; }
.nav .brand { display: flex; flex-direction: column; padding: 0 0 1.5rem; }
.nav .brand span { font-size: .8rem; color: var(--soft); }
.nav a { color: var(--bg); text-decoration: none; padding: .7rem 1rem; border-radius: 10px; font-weight: 600; }
.nav a[aria-current] { background: var(--blue); }
main { flex: 1; min-width: 0; padding: 1.5rem 1.25rem 6rem; }
.view { max-width: 720px; margin: 0 auto; }

.stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: .75rem; margin: 1.25rem 0; }
.stat { background: var(--surface); border-radius: var(--radius); padding: 1rem; }
.stat b { display: block; font-size: 1.6rem; }
.stat span { color: var(--blue); font-size: .85rem; }
.actions { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; }

.btn { display: inline-block; border: 0; cursor: pointer; font: inherit; font-weight: 700; text-decoration: none;
  background: var(--accent); color: #fff; padding: .8rem 1.3rem; border-radius: 999px; }
.btn.ghost { background: transparent; color: var(--ink); box-shadow: inset 0 0 0 2px var(--soft); }
.btn:focus-visible, .option:focus-visible, .card:focus-visible, .nav a:focus-visible { outline: 3px solid var(--blue); outline-offset: 2px; }

.progress { color: var(--blue); font-weight: 600; }
.card { width: 100%; min-height: 240px; text-align: left; cursor: pointer; font: inherit; color: var(--ink);
  background: var(--surface); border: 0; border-radius: 20px; padding: 1.5rem; display: flex; flex-direction: column; gap: .75rem;
  box-shadow: 0 2px 10px rgba(29, 53, 87, .08); }
.card.is-flipped { background: var(--ink); color: var(--bg); }
.card .tag { font-size: .75rem; font-weight: 700; text-transform: uppercase; color: var(--accent); }
.card-text { font-size: 1.2rem; font-weight: 600; }
.card-hint { margin-top: auto; font-size: .85rem; opacity: .7; }
.grade { display: flex; gap: .75rem; margin-top: 1rem; }
.grade .btn { flex: 1; }
.qimg { max-width: 100%; max-height: 220px; display: block; margin: .5rem 0; }

.options { display: grid; gap: .6rem; margin: 1rem 0; }
.option { display: flex; gap: .75rem; align-items: flex-start; text-align: left; font: inherit; color: var(--ink); cursor: pointer;
  background: var(--surface); border: 2px solid transparent; border-radius: 12px; padding: .8rem 1rem; }
.option .letter { font-weight: 800; color: var(--blue); }
.option.is-correct { border-color: var(--ok); background: #e6f6f3; }
.option.is-wrong { border-color: var(--accent); background: #fdecee; }
.option:disabled { cursor: default; }
.feedback { background: var(--surface); border-radius: var(--radius); padding: 1rem; display: grid; gap: .6rem; }

.list { list-style: none; padding: 0; display: grid; gap: .6rem; }
.list li { background: var(--surface); border-radius: 12px; padding: .8rem 1rem; }
.prose { max-width: 68ch; }
.prose h1, .prose h2, .prose h3 { margin-top: 1.6rem; }
.note { background: #fff3cd; border-radius: 10px; padding: .6rem .9rem; margin-bottom: 1rem; }

/* Desktop: sidebar */
@media (min-width: 900px) {
  .nav { position: sticky; top: 0; height: 100vh; width: 240px; flex-direction: column; padding: 1.5rem 1rem; }
  main { padding-bottom: 3rem; }
  .stats { grid-template-columns: repeat(4, 1fr); }
}
/* Phone: bottom tabs */
@media (max-width: 899px) {
  body { flex-direction: column; }
  .nav { position: fixed; inset: auto 0 0 0; z-index: 10; justify-content: space-around; padding: .4rem .5rem calc(.4rem + env(safe-area-inset-bottom)); }
  .nav .brand { display: none; }
  .nav a { padding: .6rem .5rem; font-size: .8rem; text-align: center; flex: 1; }
}
@media (prefers-reduced-motion: no-preference) { .btn, .option, .card { transition: background .15s, border-color .15s; } }
```

- [ ] **Step 5: Create `js/app.js`**

```js
import { h } from './dom.js';
import { startRouter } from './router.js';
import { createStore, idbBackend, memoryBackend, safeBackend } from './store.js';
import { homeView } from './views/home.js';
import { cardsView } from './views/cards.js';
import { quizView } from './views/quiz.js';
import { resultsView } from './views/results.js';
import { bookView } from './views/book.js';
import { settingsView } from './views/settings.js';

const NAV = [['inicio', 'Inicio'], ['tarjetas', 'Tarjetas'], ['quiz', 'Quiz'], ['resultados', 'Resultados'], ['libro', 'Libro']];
const VIEWS = { inicio: homeView, tarjetas: cardsView, quiz: quizView, resultados: resultsView, libro: bookView, ajustes: settingsView };

async function boot() {
  const [questions, chapters] = await Promise.all([
    fetch('data/preguntas.json').then((r) => r.json()),
    fetch('content/libro/index.json').then((r) => r.json()),
  ]);
  const backend = safeBackend(idbBackend(), memoryBackend());
  const ctx = { questions, chapters, store: createStore(backend), now: () => Date.now(), degraded: () => backend.degraded };

  const main = h('main', { id: 'main', tabindex: '-1' });
  const nav = h('nav', { class: 'nav', 'aria-label': 'Principal' },
    h('div', { class: 'brand' }, h('strong', {}, 'Manejo B'), h('span', {}, 'Examen teórico · Chile')),
    NAV.map(([key, label]) => h('a', { href: `#/${key}`, 'data-key': key }, label)));
  document.body.replaceChildren(nav, main);

  let seq = 0;
  startRouter(async (route) => {
    const mine = ++seq;
    const view = VIEWS[route.name] ?? homeView;
    nav.querySelectorAll('a').forEach((a) => a.toggleAttribute('aria-current', a.dataset.key === route.name));
    const node = await view({ ...ctx, route });
    if (mine !== seq) return;
    main.replaceChildren(node);
    window.scrollTo(0, 0);
  });
}

boot().catch((err) => {
  document.body.replaceChildren(h('main', {}, h('h1', {}, 'No se pudo cargar la aplicación'), h('p', {}, String(err.message ?? err))));
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
```

- [ ] **Step 6: Commit** (the app is not runnable until Task 10 adds the views)

```bash
git add index.html css js/dom.js js/app.js assets/fonts
git commit -m "feat: add app shell, design tokens and DOM helper"
```

---

### Task 10: Views

**Files:**
- Create: `js/views/home.js`, `js/views/cards.js`, `js/views/quiz.js`, `js/views/results.js`, `js/views/book.js`, `js/views/settings.js`

**Interfaces:**
- Consumes: `ctx` from Task 9; `stats`, `cardDeck`, `quizSet` (deck); `review`, `newState` (scheduler); `localIsoDate` (streak); `renderMarkdown`; `navigate` (router); store methods from Task 5.
- Produces: each file exports one `xxxView(ctx) => Promise<Node>`.

- [ ] **Step 1: `js/views/home.js`**

```js
import { h } from '../dom.js';
import { stats } from '../deck.js';

const stat = (label, value) => h('div', { class: 'stat' }, h('b', {}, String(value)), h('span', {}, label));

export async function homeView(ctx) {
  const progress = await ctx.store.getProgress();
  const s = stats(ctx.questions, progress, ctx.now());
  const streak = await ctx.store.getStreak();
  return h('section', { class: 'view' },
    ctx.degraded() && h('p', { class: 'note' }, 'El almacenamiento del navegador no está disponible: tu progreso no se guardará al cerrar la página.'),
    h('p', { class: 'eyebrow' }, 'Clase B'),
    h('h1', {}, 'Prepárate para tu examen teórico'),
    h('p', { class: 'lead' }, 'Repasa con tarjetas y ponte a prueba con un quiz. Pocos minutos al día bastan.'),
    h('div', { class: 'stats' },
      stat('Para repasar hoy', s.due), stat('Nuevas', s.new),
      stat('Dominadas', `${s.mastered}/${s.total}`), stat('Racha', `${streak.count} d`)),
    h('div', { class: 'actions' },
      h('a', { class: 'btn', href: '#/tarjetas' }, s.due ? `Repasar ${s.due} pendientes` : 'Estudiar tarjetas'),
      h('a', { class: 'btn ghost', href: '#/quiz' }, 'Hacer un quiz'),
      h('a', { href: '#/ajustes' }, 'Ajustes')),
    h('p', { class: 'lead' }, 'Confirma siempre con la edición vigente del libro oficial.'));
}
```

- [ ] **Step 2: `js/views/cards.js`**

```js
import { h } from '../dom.js';
import { cardDeck } from '../deck.js';
import { review, newState } from '../scheduler.js';
import { localIsoDate } from '../streak.js';

export async function cardsView(ctx) {
  const progress = await ctx.store.getProgress();
  const deck = cardDeck(ctx.questions, progress, ctx.now());
  const root = h('section', { class: 'view' });
  let index = 0;
  let flipped = false;

  const grade = async (known) => {
    const q = deck[index];
    const current = (await ctx.store.getProgress())[q.id] ?? newState();
    await ctx.store.saveState(q.id, review(current, known, ctx.now()));
    await ctx.store.touchStreak(localIsoDate());
    index += 1;
    flipped = false;
    draw();
  };

  const draw = () => {
    if (index >= deck.length) {
      root.replaceChildren(
        h('h1', {}, deck.length ? 'Sesión completa' : 'Todo al día'),
        h('p', { class: 'lead' }, deck.length ? 'Las que fallaste volverán hoy mismo.' : 'No tienes tarjetas pendientes. Vuelve mañana o haz un quiz.'),
        h('a', { class: 'btn', href: '#/quiz' }, 'Hacer un quiz'));
      return;
    }
    const q = deck[index];
    root.replaceChildren(
      h('p', { class: 'progress' }, `${index + 1} de ${deck.length}`),
      h('button', { class: `card${flipped ? ' is-flipped' : ''}`, onclick: () => { flipped = !flipped; draw(); } },
        h('span', { class: 'tag' }, q.tema),
        q.imagen && h('img', { class: 'qimg', src: q.imagen, alt: 'Imagen de la pregunta' }),
        h('span', { class: 'card-text' }, flipped ? q.opciones[q.correcta] : q.enunciado),
        flipped && q.explicacion && h('span', {}, q.explicacion),
        h('span', { class: 'card-hint' }, flipped ? 'Toca para volver a la pregunta' : 'Toca para ver la respuesta')),
      flipped && h('div', { class: 'grade' },
        h('button', { class: 'btn ghost', onclick: () => grade(false) }, 'No la sabía'),
        h('button', { class: 'btn', onclick: () => grade(true) }, 'La sabía')));
  };
  draw();
  return root;
}
```

- [ ] **Step 3: `js/views/quiz.js`**

```js
import { h } from '../dom.js';
import { quizSet } from '../deck.js';
import { review, newState } from '../scheduler.js';
import { localIsoDate } from '../streak.js';
import { navigate } from '../router.js';

const SIZES = [10, 20, 35];
const LETTERS = 'ABCD';

export async function quizView(ctx) {
  const root = h('section', { class: 'view' });

  const intro = () => root.replaceChildren(
    h('h1', {}, 'Quiz'),
    h('p', { class: 'lead' }, ctx.questions.length ? 'Elige cuántas preguntas al azar quieres responder.' : 'No hay preguntas disponibles.'),
    h('div', { class: 'actions' }, ctx.questions.length ? SIZES.map((n) => h('button', { class: 'btn', onclick: () => run(quizSet(ctx.questions, {}, n)) }, `${n} preguntas`)) : []));

  const run = (set) => {
    let i = 0;
    let score = 0;
    let answered = null;
    const wrong = [];

    const finish = async () => {
      await ctx.store.addAttempt({ date: new Date(ctx.now()).toISOString(), score, total: set.length, wrong });
      navigate('resultados');
    };

    const next = () => {
      if (i + 1 < set.length) { i += 1; answered = null; draw(); } else finish();
    };

    const pick = async (k) => {
      if (answered !== null) return;
      answered = k;
      const q = set[i];
      const ok = k === q.correcta;
      if (ok) score += 1; else wrong.push(q.id);
      const current = (await ctx.store.getProgress())[q.id] ?? newState();
      await ctx.store.saveState(q.id, review(current, ok, ctx.now()));
      await ctx.store.touchStreak(localIsoDate());
      draw();
    };

    const draw = () => {
      const q = set[i];
      const done = answered !== null;
      root.replaceChildren(
        h('p', { class: 'progress' }, `Pregunta ${i + 1} de ${set.length} · ${score} correctas`),
        h('h2', {}, q.enunciado),
        q.imagen && h('img', { class: 'qimg', src: q.imagen, alt: 'Imagen de la pregunta' }),
        h('div', { class: 'options' }, q.opciones.map((text, k) => h('button', {
          class: `option${done && k === q.correcta ? ' is-correct' : ''}${done && answered === k && k !== q.correcta ? ' is-wrong' : ''}`,
          disabled: done,
          onclick: () => pick(k),
        }, h('span', { class: 'letter' }, LETTERS[k]), text))),
        done && h('div', { class: 'feedback' },
          h('strong', {}, answered === q.correcta ? '¡Correcto!' : `Incorrecto. La correcta es la ${LETTERS[q.correcta]}.`),
          q.explicacion && h('p', {}, q.explicacion),
          q.capitulo && h('a', { href: `#/libro/${q.capitulo}` }, 'Ver en el libro'),
          h('button', { class: 'btn', onclick: next }, i + 1 < set.length ? 'Siguiente' : 'Ver resultado')));
    };
    draw();
  };

  intro();
  return root;
}
```

- [ ] **Step 4: `js/views/results.js`**

```js
import { h } from '../dom.js';

const pct = (a) => Math.round((a.score / a.total) * 100);

export async function resultsView(ctx) {
  const attempts = await ctx.store.getAttempts();
  if (!attempts.length) {
    return h('section', { class: 'view' },
      h('h1', {}, 'Aún no tienes resultados'),
      h('p', { class: 'lead' }, 'Termina un quiz y aquí verás tu puntaje y las preguntas que conviene repasar.'),
      h('a', { class: 'btn', href: '#/quiz' }, 'Hacer un quiz'));
  }
  const last = attempts[attempts.length - 1];
  const best = attempts.reduce((b, a) => (a.score / a.total > b.score / b.total ? a : b));
  const byId = new Map(ctx.questions.map((q) => [q.id, q]));
  const wrong = last.wrong.map((id) => byId.get(id)).filter(Boolean);
  return h('section', { class: 'view' },
    h('p', { class: 'eyebrow' }, 'Tu último resultado'),
    h('h1', {}, `${last.score}/${last.total} · ${pct(last)}%`),
    h('p', { class: 'lead' }, `Mejor puntaje: ${best.score}/${best.total} (${pct(best)}%)`),
    h('h2', {}, 'Para repasar'),
    wrong.length
      ? h('ul', { class: 'list' }, wrong.map((q) => h('li', {}, h('strong', {}, q.enunciado), h('br'), `Correcta: ${q.opciones[q.correcta]}`)))
      : h('p', {}, 'Respondiste todo bien. Haz otro quiz para practicar con preguntas distintas.'),
    h('div', { class: 'actions' },
      h('a', { class: 'btn', href: '#/quiz' }, 'Nuevo quiz'),
      h('a', { class: 'btn ghost', href: '#/tarjetas' }, 'Repasar con tarjetas')),
    h('h2', {}, 'Historial'),
    h('ul', { class: 'list' }, attempts.slice(-10).reverse().map((a) =>
      h('li', {}, `${new Date(a.date).toLocaleDateString('es-CL')} — ${a.score}/${a.total} (${pct(a)}%)`))));
}
```

- [ ] **Step 5: `js/views/book.js`**

```js
import { h } from '../dom.js';
import { renderMarkdown } from '../markdown.js';

export async function bookView(ctx) {
  const slug = ctx.route.param;
  if (!slug) {
    return h('section', { class: 'view' },
      h('h1', {}, 'Libro del conductor'),
      h('ul', { class: 'list' }, ctx.chapters.map((c) => h('li', {}, h('a', { href: `#/libro/${c.slug}` }, c.title)))));
  }
  const chapter = ctx.chapters.find((c) => c.slug === slug);
  if (!chapter) {
    return h('section', { class: 'view' }, h('p', {}, 'Capítulo no encontrado.'), h('a', { href: '#/libro' }, 'Volver al índice'));
  }
  const text = await fetch(`content/libro/${chapter.file}`).then((r) => r.text());
  return h('article', { class: 'view prose' }, h('a', { href: '#/libro' }, '← Índice'), h('div', { html: renderMarkdown(text) }));
}
```

- [ ] **Step 6: `js/views/settings.js`**

```js
import { h } from '../dom.js';

export async function settingsView(ctx) {
  const message = h('p', { role: 'status' });
  const say = (text) => { message.textContent = text; };

  const exportProgress = async () => {
    const blob = new Blob([await ctx.store.exportJson()], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'progreso-manejo.json' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const importProgress = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      await ctx.store.importJson(await file.text());
      say('Progreso importado.');
    } catch {
      say('El archivo no es un progreso válido. No se cambió nada.');
    }
  };

  const resetProgress = async () => {
    if (!confirm('¿Borrar todo tu progreso? Esta acción no se puede deshacer.')) return;
    await ctx.store.reset();
    say('Progreso borrado.');
  };

  return h('section', { class: 'view' },
    h('h1', {}, 'Ajustes'),
    h('p', { class: 'lead' }, 'Tu progreso vive solo en este navegador. Exporta una copia para llevarla a otro dispositivo.'),
    h('div', { class: 'actions' },
      h('button', { class: 'btn', onclick: exportProgress }, 'Exportar progreso'),
      h('label', { class: 'btn ghost' }, 'Importar progreso', h('input', { type: 'file', accept: 'application/json', hidden: true, onchange: importProgress })),
      h('button', { class: 'btn ghost', onclick: resetProgress }, 'Borrar progreso')),
    message);
}
```

- [ ] **Step 7: Run it and verify manually**

Run: `python3 -m http.server 8080` (separate terminal), open `http://localhost:8080` at desktop width (≥900px) and phone width (≤420px, devtools).
Verify: sidebar on desktop and bottom tabs on phone; Home shows counts; Cards flip and grading moves to the next card; failing a card makes it due again immediately; Quiz of 10 shows feedback, "Ver en el libro" opens the chapter, the last question lands on Results; Results lists failed questions; Book index and a chapter render; Settings export downloads JSON, importing a random text file shows the error message and keeps progress; reload keeps progress. Fix anything that fails before committing.

- [ ] **Step 8: Commit**

```bash
git add js/views
git commit -m "feat: add home, cards, quiz, results, book and settings views"
```

---

### Task 11: PWA — manifest, icons, service worker, precache build

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `assets/icons/icon-192.png`, `assets/icons/icon-512.png`, `scripts/build-precache.mjs`
- Test: `tests/build-precache.test.js`

**Interfaces:**
- Produces: `buildPrecache(siteDir) -> { version, count }`. It rewrites, inside `siteDir`, the two marker lines of `sw.js` (`// build:version`, `// build:urls`) with a content hash and the file list, so every content change changes the cache name and the browser installs the new service worker.

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/build-precache.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `scripts/build-precache.mjs`**

```js
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

export function buildPrecache(siteDir) {
  const files = walk(siteDir)
    .map((p) => relative(siteDir, p).split('\\').join('/'))
    .filter((f) => f !== 'sw.js')
    .sort();
  const hash = createHash('sha256');
  for (const f of files) hash.update(f).update(readFileSync(join(siteDir, f)));
  const version = hash.digest('hex').slice(0, 12);
  const urls = ['./', ...files.map((f) => `./${f}`)];
  const swPath = join(siteDir, 'sw.js');
  const sw = readFileSync(swPath, 'utf8')
    .replace(/^const VERSION = .*; \/\/ build:version$/m, `const VERSION = '${version}'; // build:version`)
    .replace(/^const URLS = .*; \/\/ build:urls$/m, `const URLS = ${JSON.stringify(urls)}; // build:urls`);
  writeFileSync(swPath, sw);
  return { version, count: urls.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(buildPrecache(process.argv[2] ?? '_site'));
}
```

- [ ] **Step 4: Write `sw.js`**

```js
const VERSION = 'dev'; // build:version
const URLS = []; // build:urls
const CACHE = `manejo-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(URLS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('manejo-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then((hit) => hit ?? fetch(event.request)));
});
```

- [ ] **Step 5: Write `manifest.webmanifest`**

```json
{
  "name": "Examen de Manejo Clase B",
  "short_name": "Manejo B",
  "lang": "es",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#F1FAEE",
  "theme_color": "#1D3557",
  "icons": [
    { "src": "assets/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "assets/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 6: Generate minimal geometric icons (navy square, red inner square)**

```bash
mkdir -p assets/icons && python3 -I - <<'PY'
import zlib, struct
def chunk(t, d):
    c = struct.pack('>I', len(d)) + t + d
    return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
def png(size):
    navy, red = bytes((29, 53, 87)), bytes((230, 57, 70))
    lo, hi = int(size * .3), int(size * .7)
    rows = b''.join(
        b'\x00' + (navy * lo + red * (hi - lo) + navy * (size - hi) if lo <= y < hi else navy * size)
        for y in range(size))
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b''))
for s in (192, 512):
    open(f'assets/icons/icon-{s}.png', 'wb').write(png(s))
PY
```

Expected: two PNG files; `file assets/icons/*.png` reports PNG image data.

- [ ] **Step 7: Run the tests**

Run: `node --test`
Expected: all PASS.

- [ ] **Step 8: Verify offline behavior manually**

Assemble a local site: `rm -rf scratch/site && mkdir scratch/site && cp -r index.html manifest.webmanifest sw.js css js data content assets scratch/site/ && node scripts/build-precache.mjs scratch/site && python3 -m http.server 8081 -d scratch/site`. Open `http://localhost:8081`, wait for the service worker, stop the server, reload: the app, chapters and question images must still load, and answering a question must still save progress.

- [ ] **Step 9: Commit**

```bash
git add manifest.webmanifest sw.js assets/icons scripts/build-precache.mjs tests/build-precache.test.js
git commit -m "feat: make the app installable and available offline"
```

---

### Task 12: Deployment and README

**Files:**
- Create: `.github/workflows/pages.yml`, `README.md`

- [ ] **Step 1: Create `.github/workflows/pages.yml`**

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm test
      - run: npm run validate
      - name: Assemble site
        run: |
          mkdir _site
          cp -r index.html manifest.webmanifest sw.js css js data content assets _site/
          rm -rf _site/data/partials
          node scripts/build-precache.mjs _site
          if find _site -iname '*.pdf' | grep -q .; then echo 'PDF found in site output'; exit 1; fi
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Create `README.md`**

````markdown
# Examen de Manejo Clase B

Static study app for the Chilean Class B driving theory exam: flashcards, quizzes,
a handbook reader and spaced repetition. Progress is stored in the browser (IndexedDB)
and the app works offline.

## Run locally

```bash
python3 -m http.server 8080   # then open http://localhost:8080
npm test                      # unit tests (Node >= 20, no dependencies)
npm run validate              # validates data/preguntas.json
```

## Content

`content/libro/*.md` and `data/preguntas.json` were produced from the source PDFs, which are
intentionally not part of this repository. Questions that need manual confirmation are listed
in `data/revision.md`.

## Deploy

Pushing to `main` runs tests, validates the data and publishes the site to GitHub Pages
(Settings → Pages → Source: GitHub Actions).
````

- [ ] **Step 3: Final checks (local)**

Run: `npm test && npm run validate`
Expected: all PASS, `data OK`.
Run: `git log --all --name-only --pretty=format: -- '*.pdf'`
Expected: empty output (no PDF was ever committed).
Run: `git log --format=%B | python3 -I -c "import sys,re; t=sys.stdin.read(); print('CLEAN' if not re.search(r'co-authored|claude|anthropic|generated with', t, re.I) else 'ATTRIBUTION FOUND')"`
Expected: `CLEAN`.

- [ ] **Step 4: Commit**

```bash
git add .github README.md
git commit -m "chore: add GitHub Pages deployment and README"
```

- [ ] **Step 5: Publish (needs explicit user confirmation first — it is outward-facing)**

Ask the user for the repository name and visibility. Then, only after they confirm:

```bash
gh repo create <name> --<public|private> --source=. --remote=origin --push
gh api -X POST repos/{owner}/<name>/pages -f build_type=workflow
```

Expected: the Actions run succeeds and the site is served at `https://<user>.github.io/<name>/`. Open it, confirm the app loads under the subpath and works offline after the first visit.
