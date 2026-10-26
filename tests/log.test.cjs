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
test('logs decorate timestamps and severities without interpreting literal messages', () => {
  const html = md('```log {steps: 1 | 2-3}\n12:00:01 INFO  started\n2026-10-26T12:00:02.123Z WARN pool <90%\n  at <script>alert("oops")</script>\n```');
  assert.match(html, /class="code w-log" tabindex="0" role="region" aria-label="Log output"/);
  assert.match(html, /data-log-steps="1 \| 2-3"/);
  assert.match(html, /class="log-time">2026-10-26T12:00:02.123Z/);
  assert.match(html, /class="log-level log-info">INFO/);
  assert.match(html, /data-line="3">  at &lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /data-source="12:00:01 INFO  started\n/);
});
test('logs preserve blank lines, spacing, unknown levels and bracketed timestamps', () => {
  const html = md('```log\n[12:00:01] ERROR failure\n\nCUSTOM  message\n```');
  assert.equal((html.match(/data-line=/g) || []).length, 3);
  assert.match(html, /log-time">\[12:00:01\]/);
  assert.match(html, /log-error">ERROR/);
  assert.match(html, /CUSTOM  message/);
  assert.doesNotMatch(html, /td-error/);
});
test('invalid log options and line ranges fail visibly and retain escaped raw content', () => {
  for (const option of ['{steps: 0}', '{steps: 2-1}', '{steps: 3}', '{steps: 1 |}', '{steps: 1} {steps: 2}', 'title="no"', '{annotate}', '{steps: 999999999999999999999}']) {
    const html = md('```log ' + option + '\nERROR <bad>\nline two\n```');
    assert.match(html, /role="alert">log:/, option);
    assert.match(html, /ERROR &lt;bad&gt;\nline two/, option);
    assert.doesNotMatch(html, /class="code w-log"/, option);
  }
  assert.match(md('```log\n```'), /log: the block is empty/);
});
test('log step ranges accept comma groups and whitespace without adding runtime dependencies', () => {
  assert.match(md('```log {steps: 1 - 2, 3 | 4}\na\nb\nc\nd\n```'), /data-log-steps="1 - 2, 3 \| 4"/);
});
