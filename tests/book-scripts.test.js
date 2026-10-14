import test from 'node:test';
import assert from 'node:assert/strict';
import { coverage } from '../scripts/check-book.mjs';
import { buildIndex } from '../scripts/build-book-index.mjs';

test('coverage ignores markdown symbols and front matter', () => {
  const source = 'Hola mundo uno dos tres';
  const md = ['---\ntitle: X\nslug: x\norder: 1\n---\n# Hola mundo\n\n- uno\n- **dos** tres'];
  assert.equal(coverage(source, md), 1);
});

test('coverage detects missing text', () => {
  assert.ok(coverage('a b c d e f g h i j', ['a b c d e']) < 0.9);
});

test('buildIndex sorts by order and reads title and slug from front matter', () => {
  const files = [
    { name: '02-b.md', text: '---\ntitle: Segundo\nslug: b\norder: 2\n---\nx' },
    { name: '01-a.md', text: '---\ntitle: Primero\nslug: a\norder: 1\n---\nx' },
  ];
  assert.deepEqual(buildIndex(files), [
    { slug: 'a', title: 'Primero', file: '01-a.md' },
    { slug: 'b', title: 'Segundo', file: '02-b.md' },
  ]);
});

test('buildIndex rejects a file without front matter fields', () => {
  assert.throws(() => buildIndex([{ name: 'x.md', text: '# no front matter' }]), /front matter/);
});
