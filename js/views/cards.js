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
