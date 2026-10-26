const test = require('node:test');
const assert = require('node:assert/strict');
test('derivations split outer TeX alignment while preserving nested maths and comments', async () => {
  const { derivation } = await import('../src/derive.js');
  assert.deepEqual(derivation(String.raw`T &= N \cdot t \\ &= 40\,s`), [['T', '= N \\cdot t'], ['', '= 40\\,s']]);
  assert.deepEqual(derivation(String.raw`A &= \begin{matrix}1 & 2 \\ 3 & 4\end{matrix} \\ &= \text{a \& b}`), [['A', '= \\begin{matrix}1 & 2 \\\\ 3 & 4\\end{matrix}'], ['', '= \\text{a \\& b}']]);
  assert.equal(derivation('x &= 1 % ignored & \\\\\n \\\\ &= 2').length, 2);
  assert.deepEqual(derivation(String.raw`x &= 1 \\`), [['x', '= 1']]);
});
test('derivations fail visibly with readable escaped source for malformed input', async () => {
  const { renderMarkdown } = await import('../src/markdown.js');
  for (const body of ['', String.raw`x &= {1`, String.raw`x &= 1 \\ \\ &= 2`, String.raw`x &= \begin{matrix}1\end{cases}`]) {
    const html = renderMarkdown('$$ {steps}\n' + body + '\n$$');
    assert.match(html, /class="td-error" role="alert">Derivation/);
    assert.match(html, /<pre>/);
    assert.doesNotMatch(html, /w-derive/);
  }
  assert.match(renderMarkdown('$$ {steps}\n<& {\n$$'), /&lt;&amp;/);
});
test('stepped maths is opt-in and retains aligned cells, explanations, and plain TeX fallback', async () => {
  const { renderMarkdown } = await import('../src/markdown.js');
  const html = renderMarkdown(String.raw`$$ {steps}
T &= N \cdot t \\
  &= 40\,s \quad \text{total time}
$$`);
  assert.match(html, /class="w w-derive"/);
  assert.equal((html.match(/<tr>/g) || []).length, 2);
  assert.match(html, /\\text\{total time\}/);
  assert.match(html, /tabindex="0" role="region" aria-label="Equation derivation"/);
  assert.match(renderMarkdown('$$\nx^2\n$$'), /class="math math-block">x\^2/);
  assert.doesNotMatch(renderMarkdown('```tex\n$$ {steps}\nx &= 1\n$$\n```'), /w-derive/);
});
