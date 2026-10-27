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
const md = text => context.window.Deck.markdown(text);

test('citations render cite links and a reference list', () => {
  const html = md('Holds [@kaplan2020] and [@a.b; @c-d].\n\n::: references\n- kaplan2020: Kaplan *et al.* 2020. https://arxiv.org/abs/2001.08361\n- a.b: One\n- c-d: Two\n:::');
  assert.match(html, /<span class="cite">\[<a class="cite-link" data-cite="kaplan2020">kaplan2020<\/a>\]<\/span>/);
  assert.match(html, /<span class="cite">\[<a class="cite-link" data-cite="a\.b">a\.b<\/a>, <a class="cite-link" data-cite="c-d">c-d<\/a>\]<\/span>/);
  assert.match(html, /<ol class="w-references"><li data-key="kaplan2020">Kaplan <em>et al\.<\/em> 2020\. <a href="https:\/\/arxiv\.org\/abs\/2001\.08361" target/);
  assert.doesNotMatch(html, /td-error/);
});

test('citations stay literal in code and footnotes keep working', () => {
  const html = md('`[@x]` and \\[@y] and [^1].\n\n[^1]: Note');
  assert.doesNotMatch(html, /cite-link/);
  assert.match(html, /<sup class="fn">1<\/sup>/);
});

test('invalid references diagnose with a readable fallback', () => {
  for (const text of ['', 'no separator', '- ok: fine\n- ok: again', '- key:', '### key\ntext', '- a: b\n  - c: nested']) {
    const html = md('::: references\n' + text + '\n:::');
    assert.match(html, /<p class="td-error" role="alert">References: /, text);
    assert.doesNotMatch(html, /w-references/, text);
  }
  assert.match(md('::: references big\n- a: b\n:::'), /without options/);
});
