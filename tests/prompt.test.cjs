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
const pair = (body, params = '') => md(`::: prompt ${params}\n${body}\n:::`);
const body = '### Prompt\nSummarise **this**.\n### Output\nA short answer.';

test('prompt pair preserves heading-led Markdown and optional zero temperature', () => {
  const html = pair(body, 'model="any-model" temperature=0');
  assert.match(html, /class="w w-prompt"/);
  assert.match(html, /any-model · temperature=0/);
  assert.match(html, /<section class="w-prompt-input"><h3>Prompt<\/h3><p>Summarise <strong>this<\/strong>/);
  assert.match(html, /<section class="w-prompt-output"><h3>Output<\/h3><p>A short answer/);
  assert.doesNotMatch(pair(body), /w-prompt-params|td-error/);
  assert.match(pair(body, 'temperature=.7'), /temperature=.7/);
});

test('nested containers, lists, quotes, code, and subheadings stay inside the pair', () => {
  const html = pair('### Prompt\n::: card\n### Nested title\n- First\n  - Child\n:::\n> ### Quoted heading\n> detail\n\n#### Detail\n```md\n### Output\n::: prompt\n```\n### Output\n[Answer](https://example.com)\n\n| A | B |\n|--|--|\n|1|2|');
  assert.doesNotMatch(html, /td-error/);
  assert.match(html, /<div class="card"><h3>Nested title/);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<h4>Detail/);
  assert.match(html, /<code>### Output\n::: prompt/);
  assert.match(html, /<a href="https:\/\/example.com"/);
  assert.match(html, /<table>/);
});

test('invalid prompt structure and parameters fail visibly with content retained', () => {
  for (const invalid of ['', '### Prompt\nOnly input', '### Output\nWrong\n### Prompt\nOrder', 'intro\n' + body, body + '\n### Extra\nKeep me', '### Prompt\n### Output\nOnly output', '### Prompt\nInput\n### Output']) {
    const html = pair(invalid);
    assert.match(html, /class="td-error" role="alert">prompt:/);
    assert.doesNotMatch(html, /class="w w-prompt"/);
    if (invalid.includes('Keep me')) assert.match(html, /Keep me/);
  }
  for (const options of ['model=""', 'temperature=NaN', 'temperature=Infinity', 'temperature=-1', 'temperature=""', 'typed', 'speed=10', 'model=a model=b']) {
    const html = pair(body, options);
    assert.match(html, /role="alert"/);
    assert.match(html, /A short answer/);
    assert.doesNotMatch(html, /class="w w-prompt"/);
  }
});

test('model labels are escaped and never used as markup', () => {
  const html = pair(body, 'model="<img src=x onerror=alert(1)>"');
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img/);
});
