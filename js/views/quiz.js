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
