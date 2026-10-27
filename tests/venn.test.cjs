const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const md = async s => (await import(pathToFileURL(require.resolve('../src/markdown.js')))).renderMarkdown(s);
const sets = '### Fast\n### Cheap\n### Good\n';
const block = body => '::: venn\n' + body + '\n:::';
test('venn renders circles, stepped regions and a region list', async () => {
  const html = await md(block(sets + '- Fast & Cheap: Sloppy\n- good & fast: Expensive\n- Fast & Cheap & Good: Unicorn\n- Cheap: Cheap alone'));
  assert.match(html, /class="w w-venn" data-sets="3" data-regions="4"/);
  assert.equal((html.match(/w-venn-circle c/g) || []).length, 3);
  assert.match(html, /<li><strong>Fast &amp; Good<\/strong>: Expensive<\/li>/);
  assert.match(html, /<b>Cheap<\/b><span>Cheap alone<\/span>/);
  assert.doesNotMatch(html, /td-error/);
});
test('two sets and sets without regions are valid', async () => {
  assert.match(await md(block('### A\n### B\n- A & B: Both')), /data-sets="2" data-regions="1"/);
  assert.match(await md(block('### A\n### B')), /data-regions="0"/);
});
test('bad venns diagnose the problem and keep the Markdown', async () => {
  for (const c of ['', 'Plain text', '### One\n- One: x', sets + '- Fast & Nope: x', sets + '- Fast & Fast: x', sets + '- Fast & Cheap: x\n- Cheap & Fast: y', sets + '- Fast & Cheap', '### A\n### B\n### C\n### D', sets + '- Fast: x\n  - nested: y', sets + '```md\nfenced\n```']) {
    const html = await md(block(c));
    assert.match(html, /class="td-error" role="alert">Venn:/, c);
    assert.doesNotMatch(html, /class="w w-venn"/);
  }
  assert.match(await md('::: venn size=2\n' + sets + '\n:::'), /no options/);
});
test('venn text cannot inject markup', async () => {
  const html = await md(block('### <b>x\n### B\n- B: <img src=x onerror=alert(1)>'));
  assert.doesNotMatch(html, /<img src=x/);
});
