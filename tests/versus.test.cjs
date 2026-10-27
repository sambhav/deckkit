const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = {
  document: { documentElement: { dataset: { fonts: 'off' }, hasAttribute: () => false }, readyState: 'loading', addEventListener() {} },
  location: { search: '' }, localStorage: { getItem: () => null }, URL, URLSearchParams,
  matchMedia: () => ({ matches: false }), MutationObserver: class { observe() {} }, window: {},
};
vm.runInNewContext(fs.readFileSync(require.resolve('../deck.js'), 'utf8'), context);
const md = source => context.window.Deck.markdown(source);
const cmp = (body, params = '') => md(`::: versus ${params}\n${body}\n:::`);

test('versus renders prompt, equal columns and verdict', () => {
  const html = cmp('> Prompt: Explain p99.\n### A\nShort **answer**.\n### B\n```js\nx\n```\n### Verdict\nA wins.');
  assert.doesNotMatch(html, /td-error/);
  assert.match(html, /class="w w-versus" style="--n:2"/);
  assert.match(html, /<div class="w-versus-prompt"><blockquote>/);
  assert.equal((html.match(/class="w-versus-col"/g) || []).length, 2);
  assert.match(html, /<section class="w-versus-verdict"><h3>Verdict<\/h3><p>A wins/);
  assert.match(html, /<code>x/);
});

test('versus works without prompt or verdict, with 2 to 4 columns, and keeps nested content', () => {
  assert.match(cmp('### A\none\n### B\ntwo\n### C\nthree\n### D\nfour'), /--n:4/);
  const html = cmp('### A\n::: card\n### Inner\n- x\n:::\n```md\n### B\n```\n### B\ntwo');
  assert.doesNotMatch(html, /td-error|w-versus-prompt|w-versus-verdict/);
  assert.match(html, /<div class="card"><h3>Inner/);
});

test('invalid versus input fails visibly and keeps content', () => {
  for (const [body, params] of [['### A\nonly one', ''], ['### A\n1\n### B\n2\n### C\n3\n### D\n4\n### E\n5', ''], ['intro\n### A\n1\n### B\n2', ''],
    ['### A\n1\n### B\n', ''], ['### A\n1\n### B\n2', 'x=1'], ['> q\n', ''], ['### A\n1\n### Verdict\nv', '']]) {
    const html = cmp(body, params);
    assert.match(html, /class="td-error" role="alert">versus:/, body);
    assert.doesNotMatch(html, /class="w w-versus"/);
  }
  assert.match(cmp('### A\nonly one'), /only one/);
});
