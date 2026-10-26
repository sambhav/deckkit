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
const md = text => context.window.Deck.markdown(text);
test('glossary preserves plain definitions, punctuation, colons and hostile text safely', () => {
  const html = md('::: glossary\nTTFB: Time: first byte.\nC++: A language with <templates> & pointers.\n:::');
  assert.match(html, /<dl class="w-glossary"><dt>TTFB<\/dt><dd>Time: first byte\.<\/dd>/);
  assert.match(html, /<dt>C\+\+<\/dt><dd>A language with &lt;templates&gt; &amp; pointers\.<\/dd>/);
  assert.doesNotMatch(html, /td-error/);
});
test('invalid glossary diagnoses empty, duplicate, malformed and structured entries with readable fallback', () => {
  for (const text of ['', 'TTFB', 'TTFB: ', ': Missing term', 'TTFB: One\nTTFB: Two', '### TTFB\nFirst byte', '- TTFB: Time', '```txt\nTTFB: Time\n```']) {
    const html = md('::: glossary\n' + text + '\n:::');
    assert.match(html, /class="td-error" role="alert">Glossary:/, text);
    if (text === 'TTFB') assert.match(html, /<p>TTFB<\/p>/);
  }
  assert.match(md('::: glossary inline\nTTFB: Time\n:::'), /Glossary: use plain/);
});
test('glossary syntax stays literal in code and nested containers keep definitions', () => {
  assert.doesNotMatch(md('```md\n::: glossary\nTTFB: Time\n:::\n```'), /<dl/);
  assert.match(md('::: card\n::: glossary\nTTFB: Time\n:::\n:::'), /<div class="card"><dl class="w-glossary">/);
});
