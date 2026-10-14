const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) =>
  escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');

export function renderMarkdown(src) {
  const lines = src.replace(/^---\n[\s\S]*?\n---\n/, '').split('\n');
  const out = [];
  let para = [];
  let list = null;
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };
  const addItem = (tag, text) => {
    flushPara();
    if (list?.tag !== tag) { flushList(); list = { tag, items: [] }; }
    list.items.push(text);
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { flushPara(); flushList(); }
    else if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      flushPara(); flushList();
      out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
    }
    else if ((m = line.match(/^[-*]\s+(.*)$/))) addItem('ul', m[1]);
    else if ((m = line.match(/^\d+[.)]\s+(.*)$/))) addItem('ol', m[1]);
    else { flushList(); para.push(line.trim()); }
  }
  flushPara();
  flushList();
  return out.join('\n');
}
