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
const block = body => '::: hotspots\n' + body + '\n:::';
test('hotspots preserve image metadata and create percentage pins and an accessible numbered legend', () => {
  const html = md(block('![Dashboard](dash.png "Overview")\n- [0%, 100%] **Budget** and `p99`\n- [70.5%, 60%] [Latency](#latency)'));
  assert.doesNotMatch(html, /td-error/);
  assert.match(html, /class="w w-hotspots"/);
  assert.match(html, /src="dash.png" alt="Dashboard" title="Overview"/);
  assert.match(html, /left:0%;top:100%/);
  assert.match(html, /left:70.5%;top:60%/);
  assert.match(html, /type="button".*aria-label="1. Budget and p99"/);
  assert.match(html, /<figcaption>Overview<\/figcaption>/);
  assert.match(html, /<li value="1"><strong>Budget<\/strong> and <code>p99<\/code><\/li>/);
  assert.match(html, /<li value="2"><a href="#latency">Latency<\/a><\/li>/);
});
test('invalid hotspots explain the problem and keep readable Markdown fallback', () => {
  const invalid = ['', 'Keep this paragraph.', '![Image](x.png)', '- [10%, 20%] Missing image',
    '![Image](x.png)\n- [101%, 20%] Out of range', '![Image](x.png)\n- [-1%, 20%] Negative',
    '![Image](x.png)\n- [10, 20] Missing percent', '![Image](x.png)\n- [10%, 20%] ',
    '![Image](x.png)\n- [10%, 20%] Label\n  - Nested', '![Image](x.png)\n- [10%, 20%] ![Label](other.png)',
    '![Image](clip.mp4)\n- [10%, 20%] Video', '![Image](x.png) extra\n- [10%, 20%] Label',
    '![Image](x.png)\n1. [10%, 20%] Numbered'];
  for (const body of invalid) {
    const html = md(block(body));
    assert.match(html, /class="td-error" role="alert">hotspots:/, body);
    assert.doesNotMatch(html, /w-hotspot-pin/, body);
    if (body.includes('Out of range')) assert.match(html, /Out of range/);
  }
  assert.match(md('::: hotspots reveal=all\n![Image](x.png)\n- [10%, 20%] Label\n:::'), /no options are supported/);
});
test('hotspots escape labels, preserve loose bullet lists and do not consume fenced examples', () => {
  const html = md(block('![A & B](x.png)\n- [12%, 30%] A & B\n\n- [50%, 70%] `<script>`'));
  assert.doesNotMatch(html, /td-error/);
  assert.match(html, /aria-label="1. A &amp; B"/);
  assert.match(html, /<code>&lt;script&gt;<\/code>/);
  assert.doesNotMatch(md('```md\n' + block('![Image](x.png)\n- [10%, 20%] Label') + '\n```'), /w-hotspot-pin/);
});
