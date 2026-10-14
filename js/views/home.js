import { h } from '../dom.js';
import { stats } from '../deck.js';

const stat = (label, value) => h('div', { class: 'stat' }, h('b', {}, String(value)), h('span', {}, label));

export async function homeView(ctx) {
  const progress = await ctx.store.getProgress();
  const s = stats(ctx.questions, progress, ctx.now());
  const streak = await ctx.store.getStreak();
  return h('section', { class: 'view' },
    ctx.degraded() && h('p', { class: 'note' }, 'El almacenamiento del navegador no está disponible: tu progreso no se guardará al cerrar la página.'),
    h('p', { class: 'eyebrow' }, 'Clase B'),
    h('h1', {}, 'Prepárate para tu examen teórico'),
    h('p', { class: 'lead' }, 'Repasa con tarjetas y ponte a prueba con un quiz. Pocos minutos al día bastan.'),
    h('div', { class: 'stats' },
      stat('Para repasar hoy', s.due), stat('Nuevas', s.new),
      stat('Dominadas', `${s.mastered}/${s.total}`), stat('Racha', `${streak.count} d`)),
    h('div', { class: 'actions' },
      h('a', { class: 'btn', href: '#/tarjetas' }, s.due ? `Repasar ${s.due} pendientes` : 'Estudiar tarjetas'),
      h('a', { class: 'btn ghost', href: '#/quiz' }, 'Hacer un quiz'),
      h('a', { href: '#/ajustes' }, 'Ajustes')),
    h('p', { class: 'lead' }, 'Confirma siempre con la edición vigente del libro oficial.'));
}
