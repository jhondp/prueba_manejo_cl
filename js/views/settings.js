import { h } from '../dom.js';

export async function settingsView(ctx) {
  const message = h('p', { role: 'status' });
  const say = (text) => { message.textContent = text; };

  const exportProgress = async () => {
    const blob = new Blob([await ctx.store.exportJson()], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'progreso-manejo.json' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const importProgress = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      await ctx.store.importJson(await file.text());
      say('Progreso importado.');
    } catch {
      say('El archivo no es un progreso válido. No se cambió nada.');
    }
  };

  const resetProgress = async () => {
    if (!confirm('¿Borrar todo tu progreso? Esta acción no se puede deshacer.')) return;
    await ctx.store.reset();
    say('Progreso borrado.');
  };

  return h('section', { class: 'view' },
    h('h1', {}, 'Ajustes'),
    h('p', { class: 'lead' }, 'Tu progreso vive solo en este navegador. Exporta una copia para llevarla a otro dispositivo.'),
    h('div', { class: 'actions' },
      h('button', { class: 'btn', onclick: exportProgress }, 'Exportar progreso'),
      h('label', { class: 'btn ghost' }, 'Importar progreso', h('input', { type: 'file', accept: 'application/json', hidden: true, onchange: importProgress })),
      h('button', { class: 'btn ghost', onclick: resetProgress }, 'Borrar progreso')),
    message);
}
