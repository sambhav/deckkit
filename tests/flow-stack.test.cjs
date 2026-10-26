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

for (const name of ['flow', 'stack']) {
  test(name + ' preserves a readable list with inline formatting and links', () => {
    const html = md(`::: ${name}\n- **App** with [docs](https://example.com)\n- Runtime {.step}\n:::`);
    assert.match(html, new RegExp(`class="w w-${name}"`));
    assert.match(html, /role="list"/);
    assert.match(html, /<strong>App<\/strong>/);
    assert.match(html, /<li class="step">Runtime/);
    assert.doesNotMatch(html, /td-error/);
  });
  test(name + ' fails visibly and preserves unsupported input', () => {
    for (const body of ['', 'Keep this prose.', '- ', '1. Ordered', '- First\n\nOutside', '- First\n\n- Second\n\n```js\nconst keep = 1;\n```']) {
      const html = md(`::: ${name}\n${body}\n:::`);
      assert.match(html, /class="td-error" role="alert"/);
      assert.doesNotMatch(html, new RegExp(`class="w w-${name}"`));
      if (body.includes('Keep')) assert.match(html, /Keep this prose/);
      if (body.includes('const keep')) assert.match(html, /const keep/);
    }
  });
}
test('flow direction and unsupported flags are diagnosed', () => {
  assert.match(md('::: flow vertical\n- A\n- B\n:::'), /class="w w-flow vertical"/);
  for (const directive of ['flow sideways', 'stack vertical', 'flow build=true']) {
    assert.match(md(`::: ${directive}\n- Keep this\n:::`), /role="alert"/);
    assert.match(md(`::: ${directive}\n- Keep this\n:::`), /Keep this/);
  }
});
test('loose list step markers reveal the whole box, while nested Markdown stays inside', () => {
  const html = md('::: flow\n- First {.step}\n\n- Second\n  - Detail\n:::');
  assert.match(html, /<li class="step"><p>First/);
  assert.match(html, /<li>Detail<\/li>/);
});
