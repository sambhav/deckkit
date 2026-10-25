// Development-only feasibility check, not part of the shipped runtime.
// Install markdown-it@15.0.3 in a scratch directory and expose it via NODE_PATH.
const MarkdownIt = require('markdown-it');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const zlib = require('node:zlib');
const md = new MarkdownIt({ html: true });

// Recognize individual directive lines, then let a later compiler group tokens.
// Never search raw text for the matching closing :::: the Markdown lexer owns
// fenced code and HTML blocks, so their contents cannot become directives.
md.block.ruler.before('fence', 'talkdown_marker', (state, start, end, silent) => {
  if (state.sCount[start] !== 0) return false;
  const line = state.src.slice(state.bMarks[start] + state.tShift[start], state.eMarks[start]);
  const match = line.match(/^:::\s*(?:([a-z][\w-]*)(?:\s+(.*))?)?\s*$/);
  if (!match) return false;
  if (silent) return true;
  const token = state.push('talkdown_marker', '', 0);
  token.block = true;
  token.map = [start, start + 1];
  token.meta = { name: match[1] || null, options: match[2] || '' };
  state.line = start + 1;
  return true;
}, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });

const markers = src => md.parse(src, {}).filter(t => t.type === 'talkdown_marker');
const csv = 'Quarter,Before,After\n"Q1, early",180,90\n"Q2\nlate",160,80';
const chart = '::: chart type=line view=both\n```csv\n' + csv + '\n```\n:::';
const tokens = md.parse(chart, {});
assert.equal(markers(chart).length, 2);
assert.equal(tokens.find(t => t.type === 'fence').content, csv + '\n');
assert.deepEqual(tokens.find(t => t.type === 'fence').map, [1, 7]);
assert.equal(markers('::: notes\n```md\n:::\n::: chart\n---\n```\n:::').length, 2);
assert.equal(markers('<!--\n::: chart\n:::\n-->').length, 0);
assert.equal(markers('::: tabs\n### One\n::: chart\ntext\n:::\n### Two\ntext\n:::').length, 4);
assert.match(md.render('\\*literal\\* and ``a`b``'), /\*literal\* and <code>a`b<\/code>/);
assert.match(md.render('[link](https://example.com/a_(b))'), /href="https:\/\/example.com\/a_\(b\)"/);

const browser = fs.readFileSync(require.resolve('markdown-it/browser'));
console.log(JSON.stringify({
  version: require('markdown-it/package.json').version,
  checks: 8,
  browserBytes: browser.length,
  gzipBytes: zlib.gzipSync(browser).length,
  note: 'Feasibility only: grouping, option validation, v0.1 migration and CSV decoding are not implemented here.',
}, null, 2));
