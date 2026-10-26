const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const source = '### Quick wins\n### Big bets\n### Fill-ins\n### Money pits\n';
const md = async s => (await import(pathToFileURL(require.resolve('../src/markdown.js')))).renderMarkdown(s);
const block = body => '::: quadrant x="Effort" y="Impact"\n' + body + '\n:::';
test('quadrants render finite normalized points, axes and grouped readable labels', async () => {
  const html = await md(block(source + '- Cache [0.2, 0.8]\n- Midpoint [0.5, 0.5]\n- Edge [1, 0]'));
  assert.match(html, /class="w w-quadrant has-points"/);
  assert.match(html, /Impact ↑/); assert.match(html, /Effort →/);
  assert.match(html, /left:22.400000000000002%;top:24.799999999999997%/);
  assert.match(html, /<h4>Big bets<\/h4><ul><li>2. Midpoint/);
  assert.match(html, /<h4>Money pits<\/h4><ul><li>3. Edge/);
  assert.doesNotMatch(html, /td-error|NaN|Infinity/);
  assert.match(await md(block(source)), /No points/);
});
test('bad quadrants diagnose the problem and retain authored Markdown', async () => {
  for (const content of ['', 'Keep this paragraph', '### Only one', source + '- Bad [2, 0]', source + '- No coordinates', source + '- Parent [0, 0]\n  - Nested [1, 1]', source + '```md\n### Not a heading\n::: nope\n```', source + '::: stats\n- **42** points\n:::']) {
    const html = await md(block(content));
    assert.match(html, /class="td-error" role="alert">Quadrant:/);
    assert.doesNotMatch(html, /class="w w-quadrant/);
    if (content.includes('Keep this')) assert.match(html, /Keep this paragraph/);
    if (content.includes('Not a heading')) assert.match(html, /Not a heading/);
  }
  assert.match(await md('::: quadrant unknown=yes\n' + source + '\n:::'), /use only/);
});
test('quadrant axis and point text cannot inject generated markup', async () => {
  const html = await md('::: quadrant x="<svg>"\n' + source + '- <img src=x onerror=alert(1)> [0, 1]\n:::');
  assert.match(html, /&lt;svg&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img/);
});
