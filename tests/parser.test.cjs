const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

// Exercise the public parser without a browser or any production dependencies.
const context = {
  document: { documentElement: { dataset: { fonts: 'off' }, hasAttribute: () => false }, readyState: 'loading', addEventListener() {} },
  location: { search: '' }, localStorage: { getItem: () => null },
  URLSearchParams, matchMedia: () => ({ matches: false }),
  MutationObserver: class { observe() {} }, window: {},
};
vm.runInNewContext(fs.readFileSync(require.resolve('../deck.js'), 'utf8'), context);
const md = context.window.Deck.markdown;

test('literal punctuation escapes do not become formatting', () => {
  assert.equal(md('\\*literal\\* \\_name\\_ \\[link\\]'), '<p>*literal* _name_ [link]</p>');
  assert.equal(md('`C:\\tmp\\file`'), '<p><code>C:\\tmp\\file</code></p>');
});
test('multi-backtick code spans preserve embedded backticks and HTML', () => {
  assert.equal(md('``a`b``'), '<p><code>a`b</code></p>');
  assert.equal(md('`` <b>`x`</b> ``'), '<p><code>&lt;b&gt;`x`&lt;/b&gt;</code></p>');
});
test('links preserve balanced parentheses and quoted attributes', () => {
  assert.match(md('[link](https://example.com/a_(b))'), /href="https:\/\/example.com\/a_\(b\)"/);
  assert.match(md('[link](https://example.com/"x")'), /href="https:\/\/example.com\/&quot;x&quot;"/);
});
test('code spans and escaped pipes stay within one table cell', () => {
  const html = md('| A | B |\n| -- | -- |\n| `a|b` | c\\|d |');
  assert.equal((html.match(/<td>/g) || []).length, 2);
  assert.match(html, /<code>a\|b<\/code>/);
  assert.match(html, /<td>c\|d<\/td>/);
});
test('container examples inside a code fence do not close the container', () => {
  assert.equal(md('::: card\n```md\n:::\n```\nend\n:::'), '<div class="card"><pre class="code" data-lang="md"><code>:::</code></pre><p>end</p></div>');
});
test('closing fences must be bare, matching, and at least as long', () => {
  const html = md('````md\n```\n```not-a-close\n~~~~\n````\nend');
  assert.match(html, /<code>```\n```not-a-close\n~~~~<\/code>/);
  assert.match(html, /<p>end<\/p>$/);
});
test('media classes produce a single class attribute', () => {
  assert.match(md('![Demo](demo.mp4) {.step}'), /^<figure class="w-media step">/);
});
