import { h, icon } from './dom.js';
import { startRouter } from './router.js';
import { createStore, idbBackend, memoryBackend, safeBackend } from './store.js';
import { homeView } from './views/home.js';
import { cardsView, signsView } from './views/cards.js';
import { quizView } from './views/quiz.js';
import { resultsView } from './views/results.js';
import { bookView } from './views/book.js';
import { settingsView } from './views/settings.js';

const ICONS = {
  inicio: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  tarjetas: 'M10.5 3h8A2.5 2.5 0 0 1 21 5.5v8a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 8 13.5v-8A2.5 2.5 0 0 1 10.5 3z|M16 19.5v.5a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 18.5V10a1 1 0 0 1 1-1h.5',
  senales: 'M12 2.5 21.5 12 12 21.5 2.5 12z|M12 8v5|M12 16v.5',
  quiz: 'M7 3.5h10A3.5 3.5 0 0 1 20.5 7v10a3.5 3.5 0 0 1-3.5 3.5H7A3.5 3.5 0 0 1 3.5 17V7A3.5 3.5 0 0 1 7 3.5z|m8 12.5 3 3 5-6',
  resultados: 'M5 20v-7|M12 20V5|M19 20v-10',
  libro: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z|M5 17a3 3 0 0 1 3-3h11',
};
const NAV = [['inicio', 'Inicio'], ['tarjetas', 'Tarjetas'], ['senales', 'Señales'], ['quiz', 'Quiz'], ['resultados', 'Resultados'], ['libro', 'Libro']];
const VIEWS = { inicio: homeView, tarjetas: cardsView, senales: signsView, quiz: quizView, resultados: resultsView, libro: bookView, ajustes: settingsView };

async function boot() {
  const [questions, allSigns, chapters] = await Promise.all([
    fetch('data/preguntas.json').then((r) => r.json()),
    fetch('data/senales.json').then((r) => r.json()),
    fetch('content/libro/index.json').then((r) => r.json()),
  ]);
  // Signs whose picture already prints their name would give the answer away.
  const signs = allSigns.filter((sign) => !sign.conTexto);
  const backend = safeBackend(idbBackend(), memoryBackend());
  const ctx = { questions, signs, chapters, store: createStore(backend), now: () => Date.now(), degraded: () => backend.degraded };

  const main = h('main', { id: 'main', tabindex: '-1' });
  const nav = h('nav', { class: 'nav', 'aria-label': 'Principal' },
    h('div', { class: 'brand' }, h('strong', {}, 'Manejo B'), h('span', {}, 'Examen teórico · Chile')),
    NAV.map(([key, label]) => h('a', { href: `#/${key}`, 'data-key': key },
      h('span', { class: 'pill' }, icon(ICONS[key])),
      h('span', { class: 'label' }, label))));
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
