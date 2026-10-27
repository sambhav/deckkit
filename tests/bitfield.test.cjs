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
const md = source => context.window.Deck.markdown(source);
const fence = (body, info = 'bitfield bits=32') => '```' + info + '\n' + body + '\n```';

test('bitfield renders spanning cells, a reserved gap and a field table', () => {
  const html = md(fence('0-3 Version\n4-7 IHL\n16-31 Total <length>'));
  assert.match(html, /class="w w-bitfield"[^>]*data-fields="3"/);
  assert.match(html, /data-field="0" style="grid-column:1 \/ span 4"/);
  assert.match(html, /bf-gap[^]*span 8"[^]*unused/);
  assert.match(html, /Total &lt;length&gt;/);
  assert.match(html, /<td>16–31<\/td><td>16<\/td><td>Total &lt;length&gt;<\/td>/);
  assert.equal((html.match(/class="bf-row"/g) || []).length, 1);
});
test('bitfield defaults to 32 bits and wraps fields across rows', () => {
  const html = md(fence('0-15 Source\n16-31 Dest\n32-63 Sequence', 'bitfield'));
  assert.equal((html.match(/class="bf-row"/g) || []).length, 2);
  assert.match(md(fence('0-7 A\n4-11 B', 'bitfield bits=8')), /td-error[^]*overlap/);
  const split = md(fence('0-3 Lo\n4-11 Straddles', 'bitfield bits=8'));
  assert.equal((split.match(/data-field="1"/g) || []).length, 2);
  assert.match(split, /bf-cont/);
});
test('bitfield reports bad input visibly and keeps the source', () => {
  for (const [body, info, re] of [['', 'bitfield', /add one field/], ['oops', 'bitfield', /line 1 must look like/], ['5-2 Back', 'bitfield', /lower bit first/],
    ['0-3 A', 'bitfield bits=0', /bits must be/], ['0-3 A', 'bitfield width=8', /unknown option width/], ['0-3 A', 'bitfield wide', /unknown option wide/]]) {
    const html = md(fence(body, info));
    assert.match(html, re); assert.match(html, /role="alert"/); assert.match(html, /<pre class="code">/);
  }
});
