const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const context = { document: { documentElement: { dataset: { fonts: 'off' }, hasAttribute: () => false }, readyState: 'loading', addEventListener() {} }, location: { search: '' }, localStorage: { getItem: () => null }, URL, URLSearchParams, matchMedia: () => ({ matches: false }), MutationObserver: class { observe() {} }, window: {} };
vm.runInNewContext(fs.readFileSync(require.resolve('../deck.js'), 'utf8'), context);
const md = text => context.window.Deck.markdown(text);
const wrap = body => '::: explorable\n' + body + '\n:::';
test('explorable numbers render scoped values, arithmetic precedence and initial prose', () => {
  const html = md(wrap('With [qps=1000]{range=100..10000} at [ms=40]{range=5..200}, **{qps*ms/1000}** workers; {(qps+ms)/2}.'));
  assert.match(html, /class="w w-explore"/);
  assert.match(html, /type="range" aria-label="qps"/);
  assert.match(html, /<strong><output[^>]+>40<\/output><\/strong>/);
  assert.match(html, />520<\/output>/);
  assert.doesNotMatch(html, /td-error/);
  assert.doesNotMatch(md('[qps=1000]{range=100..10000} {qps*2}'), /w-explore/);
  assert.match(md(wrap('[x=2]{range=0..10} {x}') + '\n' + wrap('[y=3]{range=0..10} {x}')), /unknown value or symbol: x/);
});
test('explorable rejects invalid ranges, duplicates, malformed syntax and unsafe expressions with fallback', () => {
  for (const body of ['[x=2]{range=10..0}', '[x=11]{range=0..10}', '[x=1]{range=0..10 step=0}', '[x=1]{range=0..10 step=2}', '[x=1]{range=no}', '[x=1]{range=0..10} [x=2]{range=0..10}', '[x=1]{range=0..10} {x/0}', '[x=1]{range=0..10} {window.location}', '[x=1]{range=0..10} {constructor(1)}', '[x=1]{range=0..10} {x**2}', 'No variables']) {
    const html = md(wrap(body)); assert.match(html, /role="alert">explorable:/, body); assert.doesNotMatch(html, /type="range"/, body);
  }
  assert.match(md(wrap('```js\n[x=1]{range=0..2}\n```')), /<code>\[x=1\]/);
  assert.match(md('::: explorable preset=x\n[x=1]{range=0..2}\n:::'), /no container options/);
});
test('explorable supports signed decimals, scientific notation, unary operators and bounded arithmetic', () => {
  const html = md(wrap('[x=-0.5]{range=-1..1 step=0.1} {-(x+1)*2%3} {1e3/2}'));
  assert.match(html, />-1<\/output>/); assert.match(html, />500<\/output>/);
  assert.doesNotMatch(html, /td-error/);
});
