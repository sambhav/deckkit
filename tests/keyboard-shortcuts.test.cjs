const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function parser(platform) {
  const context = {
    document: { documentElement: { dataset: { fonts: 'off' }, hasAttribute: () => false }, readyState: 'loading', addEventListener() {} },
    navigator: platform === undefined ? undefined : { platform }, location: { search: '' }, localStorage: { getItem: () => null },
    URL, URLSearchParams, matchMedia: () => ({ matches: false }), MutationObserver: class { observe() {} }, window: {},
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../deck.js'), 'utf8'), context);
  return s => context.window.Deck.markdown(s);
}
const md = parser();
test('shortcut keycaps work in prose, formatting, lists, tables and links', () => {
  for (const source of ['Press [[Ctrl+Shift+P]] then [[Enter]].', '**[[Ctrl+Shift+P]]**', '- [[Ctrl+Shift+P]]', '| Key |\n|---|\n| [[Ctrl+Shift+P]] |', '[Use [[Ctrl+Shift+P]]](https://example.com)']) {
    const html = md(source);
    assert.match(html, /class="w-kbd" role="img" aria-label="Control plus Shift plus P"/);
    assert.match(html, /<kbd aria-hidden="true">Ctrl<\/kbd>/);
    assert.doesNotMatch(html, /td-error/);
  }
});
test('Mod adapts without changing explicit modifiers or requiring navigator', () => {
  for (const platform of ['MacIntel', 'iPad', 'iPhone']) {
    const html = parser(platform)('[[Mod+K]] [[Ctrl+K]]');
    assert.match(html, /aria-label="Command plus K"/);
    assert.match(html, />⌘<\/kbd>/);
    assert.match(html, /aria-label="Control plus K"/);
  }
  for (const platform of [undefined, 'Win32', 'Linux x86_64']) assert.match(parser(platform)('[[Mod+K]]'), /aria-label="Control plus K"/);
});
test('shortcut parsing leaves code, escapes, link destinations and unmatched delimiters intact', () => {
  const html = md('`[[Ctrl+P]]`\n\n```md\n[[Mod+K]]\n```\n\n\\[\\[Enter]] [link](https://example.com/[[Enter]]) [[unfinished');
  assert.doesNotMatch(html, /w-kbd/);
  assert.match(html, /<code>\[\[Ctrl\+P\]\]<\/code>/);
  assert.match(html, /\[\[unfinished/);
});
test('invalid chords fail visibly with escaped source, while Plus and arrows are named', () => {
  for (const source of ['[[]]', '[[Ctrl++P]]', '[[Ctrl+ ]]', '[[<img onerror=alert(1)>]]']) {
    const html = md(source);
    assert.match(html, /class="td-error" role="alert">Keyboard shortcut:/);
    assert.doesNotMatch(html, /<img/);
  }
  assert.match(md('[[Ctrl+Plus]] [[ArrowDown]]'), /aria-label="Control plus Plus"/);
  assert.match(md('[[ArrowDown]]'), /aria-label="Down arrow"/);
  assert.match(md('[[A&B+\"]]'), /aria-label="A&amp;B plus &quot;"/);
});

test('custom key names cannot resolve inherited object properties', () => {
  for (const key of ['constructor', 'toString', '__proto__']) {
    const html = md('[[' + key + ']]');
    assert.ok(html.includes('aria-label="' + key + '"'));
    assert.ok(html.includes('>' + key + '</kbd>'));
    assert.doesNotMatch(html, /undefined/);
  }
});
