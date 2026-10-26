const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

// Exercise the public parser without a browser or any production dependencies.
const context = {
  document: { documentElement: { dataset: { fonts: 'off' }, hasAttribute: () => false }, readyState: 'loading', addEventListener() {} },
  location: { search: '' }, localStorage: { getItem: () => null },
  URL, URLSearchParams, matchMedia: () => ({ matches: false }),
  MutationObserver: class { observe() {} }, window: {},
};
vm.runInNewContext(fs.readFileSync(require.resolve('../deck.js'), 'utf8'), context);
const md = s => context.window.Deck.markdown(s).trim().replace(/>\n</g, '><');

test('boards keep heading-led lists, nested cards and code as readable Markdown', () => {
  const html = md('::: board\n### Now\n- **Cache**\n  - Nested detail\n### Next\n1. Docs\n\n   ```js\n   launch()\n   ```\n### Later\n:::');
  assert.match(html, /^<div class="board"><h3>Now<\/h3><ul>/);
  assert.match(html, /<strong>Cache<\/strong>/);
  assert.match(html, /Nested detail/);
  assert.match(html, /<ol>/);
  assert.match(html, /launch\(\)/);
  assert.doesNotMatch(html, /td-error/);
});

test('invalid boards explain the syntax and preserve their fallback content', () => {
  for (const body of ['', 'paragraph', '## Wrong heading\n- Card', '- No heading', '### \n- Card', '### Now\nParagraph']) {
    const html = md('::: board\n' + body + '\n:::');
    assert.match(html, /role="alert">Board needs ### column headings/);
    if (body.includes('Paragraph')) assert.match(html, /Paragraph/);
  }
  assert.match(md('::: board reveal=cards\n### Now\n- Card\n:::'), /Board needs/);
});

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
test('a multi-file diff drops every file header and marks later files with a separator', async () => {
  const { renderMarkdown } = await import('../src/markdown.js');
  const html = renderMarkdown('```diff\ndiff --git a/a.py b/a.py\nindex 1..2\n--- a/a.py\n+++ b/a.py\n@@ -1 +1 @@\n-a\n+b\ndiff --git a/b.py b/b.py\nindex 3..4\n--- a/b.py\n+++ b/b.py\n@@ -1 +1 @@\n-c\n+d\n```');
  assert.match(html, /<figcaption>a.py<\/figcaption>/);
  assert.match(html, /class="ln d-meta d-file" data-line="8">b.py<\/span>/);
  assert.doesNotMatch(html, /diff --git|index |a\/b.py|\+\+ b/);
  assert.match(html, /data-line="12" data-hunk="2">@@/);
});
test('diff steps and brace options are validated; braces inside a quoted title are kept', async () => {
  const { renderMarkdown } = await import('../src/markdown.js');
  assert.match(renderMarkdown('```diff {steps: foo}\n+a\n```'), /role="alert">diff: steps must be hunks or line groups/);
  assert.match(renderMarkdown('```diff {step: hunks}\n+a\n```'), /role="alert">diff: unknown option \{step: hunks\}/);
  assert.match(renderMarkdown('```diff {steps: 1-2 | 3, 5}\n+a\n```'), /data-steps="1-2 \| 3, 5"/);
  assert.match(renderMarkdown('```diff title="{x}.py" {steps: hunks}\n+a\n```'), /<figcaption>\{x\}.py<\/figcaption>/);
});


test('HTTP fences pair a request and response and preserve escaped message bodies', () => {
  const html = md('```http\nPOST /users HTTP/1.1\nContent-Type: application/json\n\n{"name":"<Sam>"}\n\nHTTP/1.1 201 Created\nContent-Type: application/json\n\n{"id":7}\n```');
  assert.match(html, /class="w-http" data-status="success"/);
  assert.match(html, /aria-label="HTTP request"[^]*w-http-badge">POST<\/strong>/);
  assert.match(html, /w-http-response[^]*w-http-badge">201 Created<\/strong>/);
  assert.match(html, /&lt;Sam&gt;/);
  assert.match(html, /&quot;name&quot;:&quot;&lt;Sam&gt;&quot;}<\/code><\/pre>/);
  assert.match(md('```http\nGET / HTTP/2\n\nHTTP/2 404 Not Found\n```'), /data-status="error"/);
  assert.match(md('```http\nGET / HTTP/3\n\nHTTP/3 302\n```'), /data-status="redirect"/);
});

test('invalid HTTP exchanges fail visibly and retain the authored source', () => {
  for (const [source, error] of [
    ['', 'start with a request line'],
    ['GET /users', 'start with a request line'],
    ['GET / HTTP/1.1', 'add a blank line'],
    ['GET / HTTP/1.1\nHTTP/1.1 200 OK', 'add a blank line'],
    ['GET / HTTP/1.1\n\nHTTP/1.1 999 Nope', 'the response status must be between'],
  ]) {
    const html = md('```http\n' + source + '\n```');
    assert.match(html, new RegExp('role="alert">http: ' + error));
    assert.match(html, /<pre class="code"><code>/);
    assert.doesNotMatch(html, /class="w-http"/);
  }
  assert.match(md('```http {steps: 1}\nGET / HTTP/1.1\n\nHTTP/1.1 200 OK\n```'), /http: no options are supported/);
});


test('speaker cards preserve ordinary Markdown, inline formatting and links', () => {
  const html = md('::: speaker\n![Portrait](photo.jpg)\n### Ada **Lovelace**\nEngineer\n- [GitHub](https://github.com/ada) · [Site](https://example.com)\n:::');
  assert.match(html, /<div class="speaker"><figure><img src="photo.jpg" alt="Portrait"><\/figure><h3>Ada <strong>Lovelace<\/strong><\/h3>/);
  assert.match(html, /<li><a href="https:\/\/github.com\/ada"[^>]*>GitHub<\/a> · <a href="https:\/\/example.com"[^>]*>Site<\/a><\/li>/);
  assert.match(md('::: speaker\n### No photo\nA role.\n:::'), /<h3>No photo<\/h3><p>A role.<\/p>/);
  assert.match(md('```md\n::: speaker\n### Example\n:::\n```'), /::: speaker/);
});


test('speaker portrait titles render as captions without losing image metadata', () => {
  const html = md('::: speaker\n![Ada portrait](photo.jpg "Ada **Lovelace**")\n### Ada Lovelace\nEngineer\n:::');
  assert.match(html, /<figure><img src="photo.jpg" alt="Ada portrait" title="Ada \*\*Lovelace\*\*"><figcaption>Ada <strong>Lovelace<\/strong><\/figcaption><\/figure>/);
});

test('link cards use authored titles, destinations and inline descriptions', () => {
  const html = md('::: links\n- [**Talkdown**](https://github.com/sambhav/talkdown) Write `Markdown`.\n- [Guide](guide.html) Local guide\n- [Next](#next)\n:::');
  assert.match(html, /class="w w-links"/);
  assert.equal((html.match(/class="w-link-card"/g) || []).length, 3);
  assert.match(html, /w-link-domain">github.com<\/span>/);
  assert.match(html, /w-link-title"><strong>Talkdown<\/strong><\/span>/);
  assert.match(html, /w-link-description">Write <code>Markdown<\/code>./);
  assert.match(html, /href="guide.html"><span class="w-link-domain">This site/);
  assert.match(html, /href="#next"/);
  assert.doesNotMatch(html, /<img|<iframe/);
});
test('invalid link cards show diagnostics and retain ordinary Markdown fallback', () => {
  for (const body of ['', 'No list', '- Missing link', '- [Title](https://example.com) [Second](https://example.org)', '- [Title](mailto:hello@example.com)', '- [Title](https://example.com)\n  - nested', '- [Title](https://example.com) <b>HTML</b>']) {
    const html = md('::: links\n' + body + '\n:::');
    assert.match(html, /class="td-error" role="alert">links:/);
    assert.doesNotMatch(html, /class="w w-links"/);
    if (body.includes('Title')) assert.match(html, />Title<\/a>/);
  }
  assert.match(md('::: links columns=2\n- [Title](https://example.com)\n:::'), /links: no options/);
});
test('link cards preserve escaped destinations, loose lists and relative paths', () => {
  const html = md('::: links\n- [One](https://example.com/a?x=1&y=2 "A & B") First\n\n- [Two](../read.html) Second\n:::');
  assert.match(html, /href="https:\/\/example.com\/a\?x=1&amp;y=2"/);
  assert.match(html, /title="A &amp; B"/);
  assert.match(html, /href="..\/read.html"/);
});

test('device frames preserve Markdown and escape their captions', () => {
  const browser = md('::: browser url="https://example.com/?a=1&b=<x>"\n![Settings](settings.png)\n:::');
  assert.match(browser, /<figure class="w w-device w-browser"/);
  assert.match(browser, /class="w-device-label">https:\/\/example.com\/\?a=1&amp;b=&lt;x&gt;<\/span>/);
  assert.match(browser, /<img src="settings.png" alt="Settings">/);
  assert.match(md('::: window title=\'Build "release"\'\n```sh\nnpm test\n```\n:::'), /aria-label="Build &quot;release&quot;"/);
  assert.match(md('::: phone\n::: tabs\n### First\nHello\n### Second\nWorld\n:::\n:::'), /w-device-body"><div class="tabs">/);
  assert.match(md('::: browser\nHello **reader**\n:::'), /w-device-label">Browser<\/span>[\s\S]*<strong>reader<\/strong>/);
});
test('device frames fail visibly for empty content or unsupported options', () => {
  assert.match(md('::: phone\n:::'), /role="alert">phone: add an image/);
  assert.match(md('::: browser title="wrong"\nKeep **this**\n:::'), /role="alert">browser: unsupported option &quot;title&quot;<\/p><p>Keep <strong>this<\/strong>/);
  assert.match(md('::: window url="wrong"\nKeep this\n:::'), /window: unsupported option/);
  assert.match(md('::: phone title="wrong"\nKeep this\n:::'), /phone: unsupported option/);
});


test('quiz keeps formatted choices, one answer and explanation as readable fallback', () => {
  const html = md('::: quiz\n### Why?\n- [ ] **First**\n- [x] Second\n\nBecause the tail matters.\n:::');
  assert.match(html, /class="quiz"/);
  assert.match(html, /data-correct="false"><strong>First/);
  assert.match(html, /data-correct="true">Second/);
  assert.match(html, /<strong>Answer:<\/strong> Second/);
  assert.match(html, /Because the tail matters/);
  assert.doesNotMatch(html, /td-error/);
});
test('quiz diagnoses invalid questions and preserves their prose', () => {
  const cases = ['', 'Keep this prose.', '## Wrong\n- [ ] A\n- [x] B', '### Q\n- [ ] A\n- [ ] B', '### Q\n- [x] A\n- [x] B', '### Q\n- [x] Only', '### Q\n- A\n- [x] B', '### Q\n- [ ] [Link](https://example.com)\n- [x] B', '### Q\n- [ ] A\n  - Nested\n- [x] B', '### Q\n- [ ] A\n- [x] B\n\n### Another'];
  for (const source of cases) assert.match(md('::: quiz\n' + source + '\n:::'), /role="alert">quiz:/, source);
  assert.match(md('::: quiz score=true\nKeep this prose.\n:::'), /takes no options.*Keep this prose/);
});
test('loose quiz task lists keep their markers and correct choice', () => {
  assert.doesNotMatch(md('::: quiz\n### Q\n- [ ] A\n\n- [X] B\n\nExplanation.\n:::'), /td-error/);
});

test('quiz accepts the proposal explanation without a blank line', () => {
  const html = md('::: quiz\n### Q\n- [ ] A\n- [x] B\nThe tail matters.\n:::');
  assert.match(html, /data-correct="true">B<\/li>/);
  assert.match(html, /class="quiz-answer">.*<p>The tail matters\.<\/p>/);
});
test('gallery accepts consecutive or separated Markdown images and preserves captions', () => {
  for (const separator of ['\n', '\n\n']) {
    const html = md('::: gallery\n![Rose & ocean](rose.png)' + separator + '![Synth](synth.png)\n:::');
    assert.match(html, /class="gallery"/);
    assert.match(html, /alt="Rose &amp; ocean"/);
    assert.equal((html.match(/<img /g) || []).length, 2);
    assert.doesNotMatch(html, /td-error/);
  }
});

test('invalid galleries diagnose input and retain readable fallback', () => {
  for (const input of ['', 'Keep this text', '![Image](a.png)\nExtra prose', '![Movie](movie.mp4)', '- ![List](a.png)']) {
    assert.match(md('::: gallery\n' + input + '\n:::'), /role="alert">Gallery needs Markdown images/);
  }
  const html = md('::: gallery columns=3\n![Keep caption](a.png)\n:::');
  assert.match(html, /Gallery needs/);
  assert.match(html, /alt="Keep caption"/);
});

 test('gallery accepts ordinary image titles without losing the alt caption', () => {
  const html = md('::: gallery\n![Alt caption](image.png "Optional title")\n:::');
  assert.match(html, /class="gallery"/);
  assert.match(html, /alt="Alt caption"/);
  assert.doesNotMatch(html, /td-error/);
});
test('timer durations remain readable and preserve Markdown instructions', () => {
  const html = md('::: timer 1h30m5s\nTry **pairs**.\n:::');
  assert.match(html, /data-duration="5405000"/);
  assert.match(html, /Duration: 1 hour 30 minutes 5 seconds/);
  assert.match(html, /<strong>pairs<\/strong>/);
  assert.doesNotMatch(html, /td-error/);
});
test('bad timers fail visibly and preserve the exercise fallback', () => {
  for (const value of ['', '0s', '25h', '2m1h', '1.5m', '-5s', '10m foo', 'duration=10m', '999999999999999999h']) {
    const html = md('::: timer ' + value + '\nKeep **this**.\n:::');
    assert.match(html, /role="alert"/);
    assert.match(html, /Keep <strong>this<\/strong>/);
  }
});
test('ask has an accessible HTTP(S) link before the optional QR renderer runs', () => {
  const html = md('::: ask url="https://example.com/questions?topic=Q%26A&from=talk"\n:::');
  assert.match(html, /class="w w-ask"/);
  assert.match(html, /href="https:\/\/example.com\/questions\?topic=Q%26A&amp;from=talk"/);
  assert.match(html, /<span class="w-ask-label">Ask a question<\/span>/);
  assert.match(html, /aria-hidden="true">example.com/);
  assert.doesNotMatch(html, /td-error|<svg/);
  assert.match(md('::: ask url=\'https://example.com/"quoted"\'\n:::'), /href="https:\/\/example.com\/%22quoted%22"/);
  assert.match(md('::: ask url="http://example.com/feedback"\n:::'), /class="w w-ask"/);
});
test('ask rejects unsafe, missing and malformed destinations with readable diagnostics', () => {
  for (const url of ['', 'javascript:alert(1)', 'data:text/html,test', '//example.com', '/feedback', 'https:example.com', 'ftp://example.com', 'https://user:pass@example.com', 'https://example.com/white space', 'not-a-url']) {
    const html = md('::: ask url="' + url + '"\n:::');
    assert.match(html, /class="td-error" role="alert">ask:/, url);
    assert.doesNotMatch(html, /href=|class="w w-ask"/, url);
  }
  assert.match(md('::: ask\n:::'), /ask: provide/);
  assert.match(md('::: ask url="https://example.com" size=large\n:::'), /only the url option/);
  assert.match(md('::: ask url="https://example.com" big\n:::'), /only the url option/);
  const invalidBody = md('::: ask url="https://example.com"\n**Keep this**\n:::');
  assert.match(invalidBody, /leave the block empty/);
  assert.match(invalidBody, /<strong>Keep this<\/strong>/);
});

test('meters expose final accessible values and preserve authored fallback diagnostics', () => {
  const html = md('::: meter value=72 max=100 label="Migration done" unit=%\n:::');
  assert.match(html, /role="meter" aria-label="Migration done" aria-valuemin="0" aria-valuemax="100" aria-valuenow="72" aria-valuetext="72%"/);
  assert.match(html, /width:72%/);
  assert.match(md('::: meter value=0 label="Empty"\n:::'), /aria-valuenow="0"/);
  for (const opts of ['value=101 label="Bad"', 'value=-1 label="Bad"', 'value=NaN label="Bad"', 'value=Infinity label="Bad"', 'value=1 max=0 label="Bad"', 'value=1 max=-2 label="Bad"', 'value=1', 'value=1 label="Bad" speed=2', 'value=1 label="Bad" unit=""']) {
    assert.match(md('::: meter ' + opts + '\n:::'), /role="alert">meter:/);
  }
  assert.match(md('::: meter value=1 label="Test"\n**Fallback**\n:::'), /<strong>Fallback<\/strong>/);
  assert.match(md(`::: meter value=2 label='<unsafe>' unit='"x'\n:::`), /aria-label="&lt;unsafe&gt;"/);
});
test('inline counts work inside emphasis and lists but leave code and escapes literal', () => {
  const html = md('- **[1.2M]{count}** requests/day');
  assert.match(html, /<strong><span class="w-countup" data-value="1.2" data-precision="1" data-suffix="M" role="img" aria-label="1.2M">/);
  assert.match(md('[0]{count} [-12.5%]{count} [8k]{count}'), /data-value="-12.5"/);
  for (const bad of ['NaN', 'Infinity', '1,000', 'one', '']) assert.match(md('[' + bad + ']{count}'), /role="alert">count:/);
  assert.doesNotMatch(md('`[1.2M]{count}` \\[1.2M]{count}'), /w-countup/);
});

test('envdiff keeps a normal table and inline formatting as its readable fallback', () => {
  const html = md('::: envdiff\n| Key | dev | prod |\n|---|---|---|\n| `POOL` | **5** | [200](#next) |\n| EMPTY | | enabled |\n:::');
  assert.match(html, /class="envdiff"/);
  assert.match(html, /<table>/);
  assert.match(html, /<code>POOL<\/code>/);
  assert.match(html, /<strong>5<\/strong>/);
  assert.match(html, /<a href="#next">200<\/a>/);
  assert.match(html, /<td><\/td>/);
});
