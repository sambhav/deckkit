const { test } = require('node:test');
const assert = require('node:assert/strict');
const render = async source => (await import('../src/markdown.js')).renderMarkdown(source);
const fence = body => '```sequence\n' + body + '\n```';

test('sequence parses requests, replies, notes and participant order', async () => {
  const html = await render(fence('Browser -> Server: ClientHello\nServer --> Browser: ServerHello\nnote: checks the cert\nnote over Browser,Server: Secure\nServer -> Server: Log <it>'));
  assert.match(html, /class="w w-seq" style="--n:2"/);
  assert.deepEqual([...html.matchAll(/class="w-seq-person">([^<]*)</g)].map(m => m[1]), ['Browser', 'Server']);
  assert.equal((html.match(/data-dir="rtl" data-reply/g) || []).length, 1);
  assert.equal((html.match(/class="w-seq-msg" data-dir/g) || []).length, 2);
  assert.equal((html.match(/class="w-seq-self"/g) || []).length, 1);
  assert.equal((html.match(/class="w-seq-note"/g) || []).length, 2);
  assert.equal((html.match(/data-step="/g) || []).length, 4, 'a bare note shares the step of the message before it');
  assert.match(html, /Log &lt;it&gt;/);
  assert.doesNotMatch(html, /<it>/);
  assert.match(html, /<ol class="w-seq-list"><li>Browser to Server: ClientHello<\/li><li>Server replies to Browser: ServerHello <em>\(Note: checks the cert\)<\/em><\/li>/);
});

test('sequence accepts spaced names and arrows without spaces', async () => {
  const html = await render(fence('API Server->Data-Base: query\n\n# comment\nData-Base-->API Server: rows'));
  assert.deepEqual([...html.matchAll(/class="w-seq-person">([^<]*)</g)].map(m => m[1]), ['API Server', 'Data-Base']);
});

test('invalid sequence keeps the source and an alert', async () => {
  for (const body of ['', 'just text', 'note: only a note', 'A => B: nope', 'A -> B: ok\nnote over A,B,C: many', 'A -> B: ok\nnote:']) {
    const html = await render(fence(body));
    assert.match(html, /role="alert">sequence: /, body);
    assert.doesNotMatch(html, /class="w w-seq"/);
  }
});
