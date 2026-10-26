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
    assert.match(await response.text(), /talkdown 0.4/);
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
  const html = renderMarkdown('Text\n\n::: say\nInline `note`.\n:::\n\n::: read\nArticle **only**.\n:::\n\n<!-- just a comment -->\n\n[^x]: A `code` footnote.', env);
  assert.doesNotMatch(html, /Inline/);
  assert.match(env.notes[0], /Inline <code>note<\/code>/);
  assert.equal(env.notes.length, 1);
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
test('chart numbers are plain: no units, symbols or separators', async () => {
  const { chartDataset } = await import('../src/data.js');
  assert.throws(() => chartDataset(['Q', 'V'], [['A', '42%']]), /expected a finite number/);
  assert.throws(() => chartDataset(['Q', 'V'], [['A', '1,200']]), /expected a finite number/);
  assert.throws(() => chartDataset(['Q', ...'abcdefg'], [['x', ...'1234567']], 'bar'), /up to six series/);
});
test('annotated code: line-end (n) comments become pins and the list after it becomes the notes', () => {
  const html = md('```python {annotate}\nconn = connect(dsn)  # (1)\nwith conn.transaction():  # (2)!\n    write(rows)\n```\n1. Opens a connection.\n2. Commits together.');
  assert.match(html, /^<div class="w-annotate"><pre class="code" data-lang="python" data-pins="1,2,0"><code>conn = connect\(dsn\)\nwith conn.transaction\(\):\n    write\(rows\)<\/code><\/pre><ol class="w-notes">/);
  assert.match(html, /<li>Commits together.<\/li><\/ol><\/div>$/);
  assert.match(md('```js {annotate}\na() // (1)\nb() /* (2) */\n```\n1. x\n2. y'), /data-pins="1,2"><code>a\(\)\nb\(\)<\/code>/);
  assert.match(md('```html {annotate}\n<p> <!-- (1) -->\n```\n1. x'), /data-pins="1"><code>&lt;p&gt;<\/code>/);
  assert.doesNotMatch(md('```js\na() // (1)\n```'), /data-pins|w-annotate/);   // only with {annotate}
});
test('annotated code reports missing notes, markers and lists', () => {
  assert.match(md('```js {annotate}\na() // (1)\n```'), /role="alert">\{annotate\} needs a numbered list/);
  assert.match(md('```js {annotate}\na()\n```\n1. x'), /role="alert">\{annotate\} found no markers: end a line with a comment like # \(1\) or \/\/ \(1\)/);
  const html = md('```js {annotate}\na() // (1)\nb() // (3)\n```\n1. x\n2. y');
  assert.match(html, /Marker \(3\) has no note/);
  assert.match(html, /Note 2 has no \(2\) marker/);
  assert.match(html, /<div class="w-annotate">/);   // the code still renders
});
test('annotated code only strips the language\'s own comments and leaves bad blocks as written', () => {
  assert.match(md('```python {annotate}\nh = n // (2)\nx = 1  # (1)\n```\n1. x'), /data-pins="0,1"><code>h = n \/\/ \(2\)\nx = 1<\/code>/);
  assert.match(md('```sql {annotate}\nselect 1 -- (1)\n```\n1. x'), /data-pins="1"><code>select 1<\/code>/);
  assert.match(md('```js {annotate}\na() // (0)\n```\n0. x'), /role="alert">\{annotate\} found no markers/);   // pins count from 1
  const unlisted = md('```js {annotate}\na() // (1)\n```');
  assert.match(unlisted, /a\(\) \/\/ \(1\)<\/code>/); assert.doesNotMatch(unlisted, /w-annotate|data-pins/);
  assert.doesNotMatch(md('```mermaid {annotate}\nA-->B %% (1)\n```\n1. x'), /w-annotate/);
});
test('diff fences tint lines, number hunks and take the title from the file header', async () => {
  const { renderMarkdown } = await import('../src/markdown.js');
  const html = renderMarkdown('```diff {steps: hunks} title="api.py"\n@@ def fetch(url):\n-    return requests.get(url)\n+    return session.get(url, timeout=5)\n@@ def close():\n     pass\n```');
  assert.match(html, /<figure class="w-diff" data-view="unified" data-steps="hunks"><figcaption>api.py<\/figcaption>/);
  assert.match(html, /class="ln d-del" data-line="2" data-hunk="1"><span class="d-m">-<\/span>    return requests.get\(url\)/);
  assert.match(html, /class="ln d-hunk" data-line="4" data-hunk="2">@@ def close\(\):/);
  assert.match(html, /class="ln d-ctx" data-line="5" data-hunk="2"><span class="d-m"> <\/span>    pass/);
  assert.doesNotMatch(html, /data-lang/);   // not handed to the syntax highlighter
  const git = renderMarkdown('```diff\ndiff --git a/x.py b/x.py\nindex 1..2\n--- a/x.py\n+++ b/x.py\n@@ -1 +1 @@\n-a\n+b\n```');
  assert.match(git, /<figcaption>x.py<\/figcaption>/);
  assert.doesNotMatch(git, /\+\+\+|index 1/);
  assert.match(git, /data-line="5" data-hunk="1">@@ -1 \+1 @@/);
});
test('a diff without @@ lines makes each run of changes a hunk; --- inside a hunk is a removed line', async () => {
  const { renderMarkdown } = await import('../src/markdown.js');
  const html = renderMarkdown('```diff\n a\n-b\n+c\n d\n+e\n```');
  assert.match(html, /d-ctx" data-line="1"><span/);
  assert.match(html, /d-add" data-line="3" data-hunk="1"/);
  assert.match(html, /d-ctx" data-line="4"><span/);
  assert.match(html, /d-add" data-line="5" data-hunk="2"/);
  assert.match(renderMarkdown('```diff\n@@ x\n--- old\n+++ new\n```'), /d-del" data-line="2" data-hunk="1"><span class="d-m">-<\/span>-- old/);
});
test('diff view=split pairs removed lines with the added lines after them', async () => {
  const { renderMarkdown } = await import('../src/markdown.js');
  const html = renderMarkdown('```diff view=split\n@@ x\n a\n-b\n-c\n+B\n```');
  const split = html.match(/<pre class="code w-diff-split"><code>(.*)<\/code><\/pre>/)[1];
  assert.match(split, /^<span class="ln d-hunk d-wide"/);
  assert.match(split, /d-del" data-line="3"[^]*?b<\/span><span class="ln d-add" data-line="5"/);
  assert.match(split, /d-del" data-line="4"[^]*?c<\/span><span class="ln d-none"><\/span>$/);
});
test('diff options fail visibly and keep the code readable', async () => {
  const { renderMarkdown } = await import('../src/markdown.js');
  assert.match(renderMarkdown('```diff view=wide\n+a\n```'), /role="alert">diff: view must be unified or split[^]*<pre class="code"><code>\+a<\/code>/);
  assert.match(renderMarkdown('```diff colour=red\n+a\n```'), /role="alert">diff: unknown option &quot;colour&quot;/);
  assert.match(renderMarkdown('```diff\n```'), /role="alert">diff: the block is empty/);
});
