const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

const context = {
  document: { documentElement: { dataset: { fonts: 'off' }, hasAttribute: () => false }, readyState: 'loading', addEventListener() {} },
  location: { search: '' }, localStorage: { getItem: () => null },
  URL, URLSearchParams, matchMedia: () => ({ matches: false }),
  MutationObserver: class { observe() {} }, window: {},
};
vm.runInNewContext(fs.readFileSync(require.resolve('../deck.js'), 'utf8'), context);
const md = s => context.window.Deck.markdown(s).trim().replace(/>\n</g, '><');

test('trace fences nest spans by indentation and fail visibly on bad input', () => {
  const html = md('```trace\nagent.run 0 4200\n  llm.plan 0 900\n    <b> 10 20\n  tool 900 2100\n```');
  assert.match(html, /class="w w-trace"/);
  assert.equal((html.match(/data-span="/g) || []).length, 4);
  assert.match(html, /data-span="2" style="--depth:2"/);
  assert.match(html, /&lt;b&gt;/);
  assert.match(html, /<td>4\.2 s<\/td>/);
  assert.match(md('```trace\n```'), /role="alert">trace: the block is empty/);
  assert.match(md('```trace\nagent 0\n```'), /role="alert">trace: line 1 should be/);
  assert.match(md('```trace {x}\na 0 1\n```'), /takes no options/);
  assert.match(md('```trace\n  a 0 1\n```'), /no parent span/);
});
