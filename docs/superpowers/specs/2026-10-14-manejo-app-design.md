# Driving Theory Exam Study App (Chile, Class B) — Design

Date: 2026-10-14

## 1. Goal

A static, offline-capable web app that lets one person study for the Chilean Class B
driving theory exam. The exam question bank (`PREGUNTAS.pdf`) is the exact set of
questions that appear on the test; the handbook (`libro.pdf`) is the study material.
Progress is tracked locally with spaced repetition.

### Success criteria

- Every question from `PREGUNTAS.pdf` is available in the app with its correct answer.
- The learner can study with flashcards, take quiz simulations, and read the handbook.
- A daily "review" queue surfaces due and failed questions (spaced repetition).
- Works offline after first load; progress persists in the browser.
- Deployed on GitHub Pages. Source PDFs are never published or committed.

### Constraints

- Static hosting only: no backend, no build step, no runtime dependencies.
- UI follows the supplied mockup (`Examen de Manejo Clase B.html`): Home, Cards, Quiz,
  Results; desktop sidebar layout and phone bottom-tab layout.
- User-facing copy is Spanish (the learner's language); code, identifiers and docs are English.
- `*.pdf` stays in `.gitignore` from the first commit.

## 2. Content pipeline (offline, run once, not shipped)

| Source | Method | Output |
|---|---|---|
| `libro.pdf` (170 pp, ~52k words, text layer) | `pdftotext` + structuring by sub-agents | `content/libro/NN-<slug>.md` |
| `PREGUNTAS.pdf` (109 pp, scanned, no text layer) | Sub-agents read page images in batches of ~15 (no tesseract available) | `data/preguntas.json` |

`preguntas.json` item: `id`, `tema`, `capitulo`, `enunciado`, `opciones[]` (3–4),
`correcta` (index), optional `imagen` (extracted road-sign image), optional `explicacion`.

Question images referenced by items are extracted with `pdfimages` into `assets/img/`.

### Validation

A Node script (`scripts/validate-data.mjs`) checks: unique ids, 3–4 options, exactly one
valid `correcta`, non-empty text, image files exist. Items the reader flagged as uncertain
(illegible, ambiguous answer mark) are listed in `data/revision.md` for manual confirmation
against the PDF. The app ships only after this list is resolved or accepted.

## 3. App architecture

Vanilla JS with ES modules, served as plain static files.

```
index.html  manifest.webmanifest  sw.js
css/        design tokens from the mockup
js/
  store.js        IndexedDB wrapper (progress, attempts, settings)
  scheduler.js    spaced repetition (Leitner), pure functions
  deck.js         builds study queues (due, failed, random quiz)
  router.js       hash routing
  views/          home, cards, quiz, results, book
data/preguntas.json
content/libro/*.md
```

Boundaries: `scheduler.js` is pure (state in, state out) and knows nothing about the DOM
or storage, so it can be swapped for SM-2/FSRS without touching other modules.
`store.js` is the only module touching IndexedDB.

### Spaced repetition

Leitner boxes with fixed intervals: box 1 = 1 day, 2 = 3, 3 = 7, 4 = 14.
Correct answer: promote one box. Wrong answer: back to box 1, due today.
Unseen questions are "new". A question is "mastered" at box 4 answered correctly.

## 4. Screens

- **Home**: today's review count, new/mastered counters, streak, entry points.
- **Cards**: flip card, self-grade "knew it / didn't"; feeds the scheduler.
- **Quiz**: simulation with random questions (length configurable, default 10),
  per-question feedback, link to the related handbook chapter; feeds the scheduler.
- **Results**: best score, history, failed questions to review.
- **Book**: chapter reader rendering the `.md` files.
- **Settings**: export / import progress as JSON; reset.

## 5. Offline and deployment

- `sw.js` precaches the app shell, data, content and images (cache-first, versioned cache name).
- GitHub Pages serves from `main`. Paths are relative so it works under `/<repo>/`.
- Progress lives per browser/device; no sync. Export/import is the transfer mechanism.

## 6. Testing

`node --test`, zero dependencies:

- `scheduler`: promotion, demotion, due-date computation, edge cases (new, overdue).
- `deck`: queue composition, no duplicates, quiz length bounds.
- `validate-data`: runs against `preguntas.json` as a gate.

UI is verified manually in a browser (desktop and phone widths) and offline mode.

## 7. Risks

- **OCR/reading accuracy** of question and answer: mitigated by validation script,
  `revision.md`, and manual confirmation against the PDF.
- **Copyright** of handbook and question text: only processed content is published;
  the user accepted this. PDFs are never committed.
- **Storage eviction** by the browser: mitigated by export/import.

## 8. Out of scope

Accounts, sync, backend, analytics, multi-user, other license classes.
