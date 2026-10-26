const { test } = require('node:test');
const assert = require('node:assert/strict');
const render = async source => (await import('../src/markdown.js')).renderMarkdown(source);
test('chat splits adjacent role lines, keeps inline Markdown, and gives tools native disclosure', async () => {
  const html = await render('::: chat\n**user:** Summarise [the test](https://example.com).\n**assistant:** Running it first.\n**tool** `pytest -k auth` → 1 failed\n**assistant:** The **token** expired.\n:::');
  assert.equal((html.match(/class="w-chat-message/g) || []).length, 4);
  assert.match(html, /data-role="user"/);
  assert.match(html, /<details class="w-chat-message w-chat-tool"><summary>Tool call<\/summary>/);
  assert.match(html, /<code>pytest -k auth<\/code>/);
  assert.match(html, /<strong>token<\/strong>/);
  assert.doesNotMatch(html, /td-error/);
});
test('chat preserves multiline bodies, lists, fenced code and nested role-like text', async () => {
  const html = await render('::: chat\n**system:** Keep the transcript.\nContinuation.\n\n- **user:** this is a list\n\n```md\n**tool** literal\n:::\n```\n\n> **assistant:** quoted role\n\n**assistant:** Done.\n:::');
  assert.equal((html.match(/class="w-chat-message/g) || []).length, 2);
  assert.match(html, /<li><strong>user:<\/strong>/);
  assert.match(html, /<code>\*\*tool\*\* literal\n:::</);
  assert.match(html, /<blockquote>/);
  assert.match(html, /Continuation/);
});
test('chat code spans cannot create role boundaries', async () => {
  const html = await render('::: chat\n**user:** `code\n**tool** literal`\n**assistant:** Done.\n:::');
  assert.equal((html.match(/class="w-chat-message/g) || []).length, 2);
});
test('invalid chat keeps readable fallback and an alert', async () => {
  for (const source of ['', 'No role', '**user:**', '**unknown:** message', '**user:** Good\n**assistant:**']) {
    const html = await render('::: chat\n' + source + '\n:::');
    assert.match(html, /role="alert">Chat needs/);
    assert.doesNotMatch(html, /class="w w-chat"/);
    if (source.includes('No role')) assert.match(html, /No role/);
  }
  assert.match(await render('::: chat reveal=all\n**user:** Good\n:::'), /Chat needs/);
});

test('nested containers remain inside their message', async () => {
  const html = await render('::: chat\n**assistant:** Notes\n\n::: card\nA **card**.\n:::\n\n**user:** Thanks\n:::');
  assert.equal((html.match(/class="w-chat-message/g) || []).length, 2);
  assert.match(html, /<div class="card">/);
  assert.doesNotMatch(html, /td-error/);
});
