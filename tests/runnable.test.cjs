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

test('js {run} becomes a runnable cell and keeps its code as the fallback', () => {
  const html = md('```js {run}\nconsole.log(1 < 2)\n```');
  assert.match(html, /<div class="w w-run"><pre class="code"><code>console\.log\(1 &lt; 2\)/);
  assert.doesNotMatch(md('```js\nx\n```'), /w-run/);
});
test('run on a language that cannot run is a visible error with the code kept', () => {
  const html = md('```python {run}\nprint(1)\n```');
  assert.match(html, /role="alert">run: only js blocks/);
  assert.match(html, /print\(1\)/);
});
test('live collects html, css and js fences', () => {
  const html = md('::: live\n```html\n<b>x</b>\n```\n```css\nb{color:red}\n```\n```javascript\nlet a\n```\n:::');
  assert.match(html, /class="w w-live"/);
  assert.deepEqual([...html.matchAll(/data-lang="(\w+)"/g)].map(m => m[1]), ['html', 'css', 'js']);
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
});
test('live reports bad input and shows the original content', () => {
  for (const [source, message] of [
    ['::: live\n:::', 'at least one'],
    ['::: live\njust text\n:::', 'only'],
    ['::: live\n```html\na\n```\n```html\nb\n```\n:::', 'more than one html'],
    ['::: live\n```python\na\n```\n:::', 'only'],
    ['::: live foo=1\n```html\na\n```\n:::', 'no options'],
  ]) {
    const html = md(source);
    assert.match(html, /role="alert">live: /, source);
    assert.match(html, new RegExp(message), source);
    assert.doesNotMatch(html, /class="w w-live"/);
  }
});
