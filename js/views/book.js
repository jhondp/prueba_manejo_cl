import { h } from '../dom.js';
import { renderMarkdown } from '../markdown.js';

export async function bookView(ctx) {
  const slug = ctx.route.param;
  if (!slug) {
    return h('section', { class: 'view' },
      h('h1', {}, 'Libro del conductor'),
      h('ul', { class: 'list' }, ctx.chapters.map((c) => h('li', {}, h('a', { href: `#/libro/${c.slug}` }, c.title)))));
  }
  const chapter = ctx.chapters.find((c) => c.slug === slug);
  if (!chapter) {
    return h('section', { class: 'view' }, h('p', {}, 'Capítulo no encontrado.'), h('a', { href: '#/libro' }, 'Volver al índice'));
  }
  const text = await fetch(`content/libro/${chapter.file}`).then((r) => r.text());
  return h('article', { class: 'view prose' }, h('a', { href: '#/libro' }, '← Índice'), h('div', { html: renderMarkdown(text) }));
}
