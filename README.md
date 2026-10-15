# Examen de Manejo Clase B

Static study app for the Chilean Class B driving theory exam: flashcards (questions and road signs), quizzes,
a handbook reader and spaced repetition. Progress is stored in the browser (IndexedDB)
and the app works offline.

## Run locally

```bash
python3 -m http.server 8080   # then open http://localhost:8080
npm test                      # unit tests (Node >= 20, no dependencies)
npm run validate              # validates data/preguntas.json
```

## Content

- `content/libro/*.md`: handbook chapters, converted from the official CONASET
  "Libro para la Conducción en Chile" (https://mejoresconductores.conaset.cl).
- `data/preguntas.json`: the exam question bank (308 unique questions), with the pictures
  cropped into `assets/img/`. Questions flagged in `data/revision.md` should be confirmed
  against the source PDF; cards cut off in the source are marked `incompleta`.
- `data/senales.json`: 196 road signs from the handbook annex, used by the signs flashcards
  (`assets/signs/`). Doubts are in `data/revision-senales.md`.

The source PDFs are intentionally not part of this repository.

Rebuild the data from the partials with `node scripts/merge-questions.mjs` and
`node scripts/build-signs.mjs` (they need the rendered page images in `scratch/`).

## Deploy

Pushing to `main` runs tests, validates the data and publishes the site to GitHub Pages
(Settings → Pages → Source: GitHub Actions).
