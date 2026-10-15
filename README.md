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
- `data/preguntas.json`: the exam question bank (308 unique questions). Every picture comes from
  the handbook (`data/imagenes-libro.json` maps each question to a handbook sign or figure).
  Questions whose picture the handbook does not have and that cannot be answered without it are
  flagged `excluida` and left out of study mode (`data/excluidas.md`). Questions to confirm
  against the source PDF are listed in `data/revision.md`; cards cut off in the source are
  marked `incompleta`.
- `data/senales.json`: 196 road signs from the handbook annex, used by the signs flashcards
  (`assets/signs/`). Doubts are in `data/revision-senales.md`.

The source PDFs are intentionally not part of this repository.

Rebuild the data from the partials with `npm run data` (it needs the rendered page images in
`scratch/`).

## Deploy

Pushing to `main` runs tests, validates the data and publishes the site to GitHub Pages
(Settings → Pages → Source: GitHub Actions).
