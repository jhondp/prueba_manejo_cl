import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../js/markdown.js';

test('renders headings and joins wrapped paragraph lines', () => {
  assert.equal(renderMarkdown('# Título\n\nlínea uno\nlínea dos'), '<h1>Título</h1>\n<p>línea uno línea dos</p>');
});

test('renders unordered and ordered lists', () => {
  assert.equal(renderMarkdown('- a\n- b\n\n1. x\n2. y'), '<ul><li>a</li><li>b</li></ul>\n<ol><li>x</li><li>y</li></ol>');
});

test('renders bold and italic', () => {
  assert.equal(renderMarkdown('**uno** y *dos*'), '<p><strong>uno</strong> y <em>dos</em></p>');
});

test('strips front matter', () => {
  assert.equal(renderMarkdown('---\ntitle: X\n---\n# H'), '<h1>H</h1>');
});

test('escapes raw HTML so it can never execute', () => {
  const html = renderMarkdown('<script>alert(1)</script> & <img src=x onerror=1>');
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('<img'));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&amp;/);
});
