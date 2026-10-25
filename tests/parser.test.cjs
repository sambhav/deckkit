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
const md = s => context.window.Deck.markdown(s).trim().replace(/>\n</g, '><');

test('browser test server returns missing-file errors without crashing', async () => {
  const server = require('./run-browser.cjs')();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    assert.equal((await fetch(base + '/missing-file.md')).status, 404);
    const response = await fetch(base + '/deck.js');
    assert.equal(response.status, 200);
    assert.match(await response.text(), /talkdown 0.2/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

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
  assert.match(md('[link](https://example.com/"x")'), /href="https:\/\/example.com\/%22x%22"/);
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
  assert.match(md('![Demo](demo.mp4) {.step}'), /^<figure class="(?:w-media step|step w-media)">/);
});

test('tokenizer preserves directives inside fences and supports nested containers', () => {
  const html = md('::: tabs\n### One\n::: card\n```md\n::: notes\n---\n|||\n```\n:::\n### Two\nContent\n:::');
  assert.match(html, /<div class="tabs">/);
  assert.match(html, /<div class="card">/);
  assert.match(html, /<code>::: notes\n---\n\|\|\|<\/code>/);
  assert.doesNotMatch(html, /td-error/);
});
test('quoted chart options survive Markdown rendering', () => {
  const html = md('::: chart type=line view=both title="Latency & time"\n```csv\nLabel,Value\n"A, B",12\n```\n:::');
  assert.match(html, /data-title="Latency &amp; time"/);
  assert.match(html, /<code>Label,Value\n&quot;A, B&quot;,12<\/code>/);
});
test('invalid directives have visible diagnostics', () => {
  assert.match(md('::: chart type=line type=bar\nvalue\n:::'), /Duplicate option: type/);
  assert.match(md('::: card\nvalue'), /Unclosed container/);
});
test('CSV decoder preserves quoted commas, newlines, quotes and BOM', async () => {
  const { parseCSV } = await import('../src/data.js');
  assert.deepEqual(parseCSV('\uFEFFName,Value\r\n"A, B",001\r\n"two\r\nlines",-2.5\r\n"say ""hi""",3'), {
    headers: ['Name','Value'], rows: [['A, B','001'], ['two\r\nlines','-2.5'], ['say "hi"','3']],
  });
  assert.throws(() => parseCSV('Name,Value\n"unclosed,2'), /CSV row/);
});
test('chart schema rejects bad cells and keeps negatives and scientific notation', async () => {
  const { chartDataset } = await import('../src/data.js');
  assert.deepEqual(chartDataset(['Label','Value'], [['one','-2.5'], ['two','1e3']], 'line').series[0].values, [-2.5,1000]);
  for (const value of ['', '25%', '£100', 'NaN', 'Infinity']) assert.throws(() => chartDataset(['L','V'], [['a',value]]), /Row 2/);
  assert.throws(() => chartDataset(['L','V'], [['a','1','2']]), /expected 2 columns/);
  assert.throws(() => chartDataset(['L','L'], [['a','1']]), /unique/);
  assert.throws(() => chartDataset(['L','V'], [['a','-1']], 'donut'), /nonnegative/);
  assert.throws(() => chartDataset(['L','A','B'], [['a','1','2']], 'donut'), /one numeric series/);
  assert.equal(chartDataset(['L','A','B'], [['a','1','2']], 'donut', 'B').series[0].name, 'B');
});
test('CSV download preserves raw numbers and escapes formula-like text', async () => {
  const { csvDownload, parseCSV } = await import('../src/data.js');
  const source = csvDownload(['Label','Value'], [['=SUM(A1)','001'], ['normal','-2.50']]);
  assert.deepEqual(parseCSV(source).rows, [["'=SUM(A1)",'001'], ['normal','-2.50']]);
});
test('notes and slide boundaries use tokens instead of splitting code or containers', async () => {
  const { renderMarkdown, slideChunks } = await import('../src/markdown.js');
  const env = { collectNotes: true, notes: [], article: [], feet: [] };
  const html = renderMarkdown('Text <!-- say: inline `note` -->\n\n::: read\nArticle **only**.\n:::\n\n[^x]: A `code` footnote.', env);
  assert.doesNotMatch(html, /inline/);
  assert.match(env.notes[0], /inline <code>note<\/code>/);
  assert.match(env.article[0], /<strong>only<\/strong>/);
  assert.match(env.feet[0], /<code>code<\/code>/);
  assert.equal(slideChunks('## One\n\n::: card\n---\n```md\n---\n```\n:::\n\n---\n## Two').length, 2);
  assert.match(renderMarkdown('$x$'), /class="math">x<\/span>/);
});
test('an unclosed container does not swallow later slides', async () => {
  const { slideChunks } = await import('../src/markdown.js');
  assert.equal(slideChunks('# One\n\n::: cols\nunclosed\n\n---\n# Two\n\n---\n# Three').length, 3);
});
test('math works in list items and indented code is never a table', async () => {
  const { renderMarkdown } = await import('../src/markdown.js');
  assert.match(renderMarkdown('- item\n\n  $$\n  x^2\n  $$'), /<li>[\s\S]*class="math math-block">x\^2</);
  assert.doesNotMatch(renderMarkdown('    | a | b |\n    |---|---|'), /<table>/);
});
test('typography keeps quotes, ellipses and dashes but not (c) or +-', async () => {
  const { renderMarkdown } = await import('../src/markdown.js');
  assert.equal(renderMarkdown('Wait... a -- b "q" (c) a+-b').trim(), '<p>Wait… a – b “q” (c) a+-b</p>');
});
test('legacy {.chart} tables keep lenient numbers, first-column donuts and many series', async () => {
  const { chartDataset } = await import('../src/data.js');
  assert.deepEqual(chartDataset(['Q', 'V'], [['A', '42%'], ['B', '$1,200']], 'bar', undefined, true).series[0].values, [42, 1200]);
  assert.equal(chartDataset(['Q', 'A', 'B'], [['x', '1', '2']], 'donut', undefined, true).series.length, 1);
  assert.equal(chartDataset(['Q', ...'abcdefg'], [['x', ...'1234567']], 'bar', undefined, true).series.length, 7);
  assert.throws(() => chartDataset(['Q', 'V'], [['A', '42%']]), /expected a finite number/);
});
