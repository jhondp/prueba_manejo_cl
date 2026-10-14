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
