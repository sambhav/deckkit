const { test } = require('node:test');
const assert = require('node:assert/strict');
let render;
const ready = import('../src/markdown.js').then(m => { render = m.renderMarkdown; });

test('sparklines opt in only through code spans, including table cells', async () => {
  await ready;
  const html = render('| Service | Trend |\n|---|---|\n| API | `spark:9,8,8,6,5,5` |');
  assert.match(html, /<td><svg class="w-sparkline"/);
  assert.match(html, /role="img" aria-label="Sparkline values: 9, 8, 8, 6, 5, 5"/);
  assert.match(html, /stroke="currentColor"/);
  assert.match(html, /<title>Sparkline values: 9, 8, 8, 6, 5, 5<\/title>/);
  for (const source of ['spark:1,2', '`sparks:1,2`', '\\`spark:1,2\\`', '```js\nspark:1,2\n```', '    spark:1,2']) {
    assert.doesNotMatch(render(source), /w-sparkline/);
  }
  assert.equal((render('``spark:1,2`` and `x`').match(/w-sparkline/g) || []).length, 1);
});

test('sparkline geometry handles single, constant, signed, tiny and extreme finite values', async () => {
  await ready;
  assert.match(render('`spark:7`'), /<circle cx="48" cy="12"/);
  assert.match(render('`spark:0,0,0`'), /points="2,12 48,12 94,12"/);
  for (const values of ['-1.5, +2, .25, 3e2', '-1e308,0,1e308', '5e-324,1e-323', '1e308,1.0000000000000002e308', '-2,-2']) {
    const html = render('`spark:' + values + '`');
    assert.match(html, /<polyline/);
    assert.doesNotMatch(html, /NaN|Infinity|td-error/);
    for (const pair of html.match(/points="([^"]+)"/)[1].split(' ')) {
      const [x, y] = pair.split(',').map(Number);
      assert.ok(x >= 2 && x <= 94 && y >= 2 && y <= 22, pair);
    }
  }
});

test('malformed opt-in remains escaped code with a visible diagnostic', async () => {
  await ready;
  for (const values of ['', ',', '1,,2', '1,', ',1', 'NaN', 'Infinity', '1e309', '0x10', '1px', '1 2', '<img src=x onerror=alert(1)>']) {
    const html = render('`spark:' + values + '`');
    assert.match(html, /<code>spark:/);
    assert.match(html, /class="td-error w-sparkline-error" role="alert">spark:/);
    assert.doesNotMatch(html, /<svg|<img/);
  }
  assert.match(render('`spark:1,,2`'), /<code>spark:1,,2<\/code>/);
});
