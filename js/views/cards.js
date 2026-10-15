import { h, fill } from '../dom.js';
import { cardDeck } from '../deck.js';
import { review, newState } from '../scheduler.js';
import { localIsoDate } from '../streak.js';

async function studySession(ctx, items, toCard, { newLimit, emptyHref, emptyLabel }) {
  const progress = await ctx.store.getProgress();
  const deck = cardDeck(items, progress, ctx.now(), newLimit);
  const root = h('section', { class: 'view' });
  let index = 0;
  let flipped = false;

  const grade = async (known) => {
    const item = deck[index];
    const current = (await ctx.store.getProgress())[item.id] ?? newState();
    await ctx.store.saveState(item.id, review(current, known, ctx.now()));
    await ctx.store.touchStreak(localIsoDate());
    index += 1;
    flipped = false;
    draw();
  };

  const draw = () => {
    if (index >= deck.length) {
      fill(root, 
        h('h1', {}, deck.length ? 'Sesión completa' : 'Todo al día'),
        h('p', { class: 'lead' }, deck.length ? 'Las que fallaste volverán hoy mismo.' : 'No tienes tarjetas pendientes. Vuelve mañana o haz un quiz.'),
        h('a', { class: 'btn', href: emptyHref }, emptyLabel));
      return;
    }
    const card = toCard(deck[index]);
    fill(root, 
      h('p', { class: 'progress' }, `${index + 1} de ${deck.length}`),
      h('button', { class: `card${flipped ? ' is-flipped' : ''}`, onclick: () => { flipped = !flipped; draw(); } },
        h('span', { class: 'tag' }, card.tag),
        card.image && h('img', { class: 'qimg', src: card.image, alt: card.imageAlt }),
        h('span', { class: 'card-text' }, flipped && card.back ? card.back : card.front),
        card.options && h('ol', { class: 'card-options' }, card.options.map((o, k) =>
          h('li', { class: flipped ? (o.correct ? 'is-correct' : 'is-dim') : '' }, h('span', { class: 'letter' }, 'ABCD'[k]), o.text))),
        flipped && card.extra && h('span', {}, card.extra),
        h('span', { class: 'card-hint' }, flipped ? 'Toca para volver a la pregunta' : 'Toca para ver la respuesta')),
      flipped && h('div', { class: 'grade' },
        h('button', { class: 'btn ghost', onclick: () => grade(false) }, 'No la sabía'),
        h('button', { class: 'btn', onclick: () => grade(true) }, 'La sabía')));
  };
  draw();
  return root;
}

export const cardsView = (ctx) => studySession(ctx, ctx.questions, (q) => ({
  tag: q.tema,
  image: q.imagen,
  imageAlt: 'Imagen de la pregunta',
  front: q.enunciado,
  options: q.opciones.map((text, k) => ({ text, correct: k === q.correcta })),
  extra: q.explicacion,
}), { newLimit: 10, emptyHref: '#/quiz', emptyLabel: 'Hacer un quiz' });

export const signsView = (ctx) => studySession(ctx, ctx.signs, (s) => ({
  tag: s.categoria,
  image: s.imagen,
  imageAlt: 'Señal de tránsito',
  front: '¿Qué significa esta señal?',
  back: s.nombre,
}), { newLimit: 15, emptyHref: '#/tarjetas', emptyLabel: 'Estudiar tarjetas' });
