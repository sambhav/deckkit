const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

test('magnitude formats values with readable units and places bars on a log scale', async () => {
  const { formatMagnitude, magnitudeModel } = await import('../src/magnitude.js');
  assert.equal(formatMagnitude(0.5e-9, 's'), '500 ps');
  assert.equal(formatMagnitude(100e-9, 's'), '100 ns');
  assert.equal(formatMagnitude(150e-6, 's'), '150 µs');
  assert.equal(formatMagnitude(0.15, 's'), '150 ms');
  assert.equal(formatMagnitude(2, 's'), '2 s');
  assert.equal(formatMagnitude(90, 's'), '1.5 min');
  assert.equal(formatMagnitude(999.9e-6, 's'), '1 ms');
  assert.equal(formatMagnitude(4096, 'B'), '4.1 kB');
  assert.equal(formatMagnitude(1200), '1.2 k');
  const m = magnitudeModel(['Op', 'Time'], [['a', '1e-9'], ['b', '1e-6'], ['c', '1']], 's');
  assert.deepEqual(m.items.map(i => Number(i.at.toFixed(6))), [0, 0.333333, 1]);
  assert.equal(m.decades, 9);
  assert.equal(m.ticks[0].text, '1 ns');
  assert.equal(m.ticks.at(-1).text, '1 s');
  assert.equal(magnitudeModel(['a', 'b'], [['x', '5']]).items[0].at.toFixed(3), '0.699');
  for (const bad of ['0', '-1', 'abc', '', '1e999']) assert.throws(() => magnitudeModel(['a', 'b'], [['x', bad]]), /Row 2/);
  assert.throws(() => magnitudeModel(['a', 'b'], []), /at least one row/);
  assert.throws(() => magnitudeModel(['a'], [['x']]), /value column/);
});

test('magnitude container keeps its table as the Markdown fallback', () => {
  const context = {
    document: { documentElement: { dataset: { fonts: 'off' }, hasAttribute: () => false }, readyState: 'loading', addEventListener() {} },
    location: { search: '' }, localStorage: { getItem: () => null },
    URL, URLSearchParams, matchMedia: () => ({ matches: false }), MutationObserver: class { observe() {} }, window: {},
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../deck.js'), 'utf8'), context);
  const html = context.window.Deck.markdown('::: magnitude unit=s\n| Op | Time |\n|---|---|\n| L1 hit | 0.5e-9 |\n:::');
  assert.match(html, /class="magnitude" data-unit="s"/);
  assert.match(html, /<table>/);
});
