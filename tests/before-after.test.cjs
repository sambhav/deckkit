const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const context = {
  document: { documentElement: { dataset: { fonts: 'off' }, hasAttribute: () => false }, readyState: 'loading', addEventListener() {} },
  location: { search: '' }, localStorage: { getItem: () => null }, URL, URLSearchParams,
  matchMedia: () => ({ matches: false }), MutationObserver: class { observe() {} }, window: {},
};
vm.runInNewContext(fs.readFileSync(require.resolve('../deck.js'), 'utf8'), context);
const md = s => context.window.Deck.markdown(s);
test('compare accepts adjacent or separated Markdown images and retains captions as fallback', () => {
  for (const separator of ['\n', '\n\n', ' ']) {
    const html = md('::: compare\n![Before & original](old.png "Old title")' + separator + '![After <change>](new.png)\n:::');
    assert.match(html, /class="compare"/);
    assert.equal((html.match(/<figure>/g) || []).length, 2);
    assert.match(html, /<figcaption>Old title<\/figcaption>/);
    assert.match(html, /<figcaption>After &lt;change&gt;<\/figcaption>/);
    assert.match(html, /title="Old title"/);
    assert.doesNotMatch(html, /td-error/);
  }
});
test('compare diagnoses invalid structure and preserves authored fallback', () => {
  const examples = ['', '![One](old.png)', '![A](a.png)\n![B](b.png)\n![C](c.png)',
    '![](a.png)\n![B](b.png)', 'Keep this text.\n![A](a.png)\n![B](b.png)',
    '### Nested heading\n![A](a.png)\n![B](b.png)', '::: card\n![A](a.png)\n![B](b.png)\n:::',
    '```md\n![A](a.png)\n![B](b.png)\n```', '![Movie](clip.mp4)\n![After](a.png)'];
  for (const body of examples) {
    const html = md('::: compare\n' + body + '\n:::');
    assert.match(html, /role="alert">Compare needs exactly two Markdown images/);
    assert.doesNotMatch(html, /class="compare"/);
    if (body.includes('Keep this text')) assert.match(html, /Keep this text/);
  }
  for (const options of ['position=50', 'wide', 'unknown']) {
    assert.match(md('::: compare ' + options + '\n![A](a.png)\n![B](b.png)\n:::'), /Compare needs/);
  }
});
test('compare stays inert inside a source fence and can nest inside a pane', () => {
  assert.doesNotMatch(md('```md\n::: compare\n![A](a.png)\n![B](b.png)\n:::\n```'), /class="compare"/);
  assert.match(md('::: tabs\n### Changes\n::: compare\n![A](a.png)\n![B](b.png)\n:::\n:::'), /class="tabs"[\s\S]*class="compare"/);
});
