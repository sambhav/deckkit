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

test('endpoint references preserve Markdown and highlight only path parameters', () => {
  const html = md('::: endpoint GET /v1/users/{id}\nReturns **one** user.\n| Param | Type | Notes |\n|---|---|---|\n| id | int | path |\n:::');
  assert.match(html, /class="w w-endpoint" aria-label="GET \/v1\/users\/\{id\}"/);
  assert.match(html, /w-endpoint-method">GET/);
  assert.match(html, /\/v1\/users\/<span class="w-endpoint-param">\{id\}<\/span>/);
  assert.match(html, /Returns <strong>one<\/strong> user/);
  assert.match(html, /<th>Param<\/th>/);
  assert.doesNotMatch(html, /td-error/);
});
test('endpoint accepts every standard method, optional body and nested fenced examples', () => {
  for (const method of ['GET','HEAD','POST','PUT','PATCH','DELETE','CONNECT','OPTIONS','TRACE']) {
    assert.doesNotMatch(md('::: endpoint ' + method + ' /health\n:::'), /td-error/);
  }
  const html = md('::: endpoint POST /users/{user-id}/items/{item_id}\n```http\nPOST / HTTP/1.1\n\nHTTP/1.1 201 Created\n```\n:::');
  assert.equal((html.match(/class="w-endpoint-param"/g) || []).length, 2);
  assert.match(html, /class="w-http"/);
  assert.doesNotMatch(html, /td-error/);
});
test('invalid endpoint signatures fail visibly and retain authored content', () => {
  for (const signature of ['endpoint', 'endpoint get /users', 'endpoint FETCH /users', 'endpoint GET users', 'endpoint GET /users foo=bar', 'endpoint GET /{id', 'endpoint GET /{}', 'endpoint GET /{{id}}']) {
    const html = md('::: ' + signature + '\nFallback **description**.\n:::');
    assert.match(html, /role="alert">endpoint:/);
    assert.match(html, /Fallback <strong>description<\/strong>/);
    assert.match(html, /<pre class="code"><code>::: /);
    assert.doesNotMatch(html, /class="w w-endpoint"/);
  }
});
test('endpoint paths escape HTML and attribute characters without Markdown interpretation', () => {
  const html = md('::: endpoint GET /<script>?q="x"&name=_test_\n:::');
  assert.match(html, /&lt;script&gt;\?q=&quot;x&quot;&amp;name=_test_/);
  assert.doesNotMatch(html, /<script>|<em>/);
  assert.match(md('::: endpoint GET /users\nExample\n'), /Unclosed container/);
});
