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

The handbook content comes from the official CONASET "Libro para la Conducción en Chile"
(https://mejoresconductores.conaset.cl).

## Deploy

Pushing to `main` runs tests, validates the data and publishes the site to GitHub Pages
(Settings → Pages → Source: GitHub Actions).
