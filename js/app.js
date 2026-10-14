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
