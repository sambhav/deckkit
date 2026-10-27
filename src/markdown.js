import { promptPair } from './prompt.js';
import { versus } from './versus.js';
import { changelogHTML } from './changelog.js';
import { hotspotMarkup } from './hotspots.js';
import { explorableInline, explorable } from './explorable.js';
import { countValue, meterValue } from './meter.js';
import { benchBlock } from './bench.js';
import MarkdownIt from 'markdown-it';
import { quadrant } from './quadrant.js';

import { shortcut } from './keyboard-shortcuts.js';
import { chatTranscript } from './chat.js';
import { sequenceHTML } from './sequence.js';
import { parseGlossary } from './glossary.js';
import { parseReferences } from './citations.js';
import { derivation } from './derive.js';
import { timerDuration, timerLabel } from './timer.js';

const escape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Typographer keeps smart quotes; 'replacements' would also turn (c) into © and +- into ±,
// so talkdown_typography below restores only the ellipsis and dashes the old parser made.
const md = new MarkdownIt({ html: true, typographer: true }).disable(['lheading', 'replacements']);
const lineAt = (state, n) => state.src.slice(state.bMarks[n] + state.tShift[n], state.eMarks[n]);

// Individual markers are tokens. Code fences and HTML blocks own their content;
// container grouping never scans their raw text for a closing delimiter.
md.block.ruler.before('fence', 'talkdown', (state, start, end, silent) => {
  if (state.sCount[start] - state.blkIndent >= 4) return false;   // indented code
  const line = lineAt(state, start);
  let type, content = line, meta;
  // $$ math also works inside list items and quotes; slide structure stays top-level only.
  if (line.startsWith('$$')) type = 'td_math';
  else if (state.sCount[start] !== 0) return false;
  else if (/^---\s*$/.test(line)) type = 'td_slide';
  else if (/^\|\|\|\s*$/.test(line)) type = 'td_column';
  else if ((meta = line.match(/^:::\s*(.*?)\s*$/))) { type = 'td_container'; content = meta[1]; }
  else if ((meta = line.match(/^\[\^([\w-]+)\]:\s*(.*)$/))) { type = 'td_foot'; content = meta[2]; }
  else return false;
  if (silent) return true;
  const token = state.push(type, '', 0); token.block = true; token.content = content;
  if (type === 'td_foot') token.meta = { id: meta[1] };
  let next = start + 1;
  if (type === 'td_math') {
    const lines = [line.slice(2)];
    while (!/\$\$\s*$/.test(lines.at(-1)) && next < end) lines.push(lineAt(state, next++));
    token.content = lines.join('\n').replace(/\$\$\s*$/, '').trim();
  }
  token.map = [start, next]; state.line = next; return true;
}, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });

// Preserve the existing useful extension: a pipe inside inline code is not a
// table delimiter. Plain Markdown tables without edge pipes use the core rule.
function cells(line) {
  const out = []; let cell = '', ticks = 0;
  const text = line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\' && i + 1 < text.length) { cell += ch + text[++i]; continue; }
    if (ch === '`') {
      const run = text.slice(i).match(/^`+/)[0];
      if (!ticks) ticks = run.length; else if (ticks === run.length) ticks = 0;
      cell += run; i += run.length - 1;
    } else if (ch === '|' && !ticks) { out.push(cell.trim()); cell = ''; }
    else cell += ch;
  }
  out.push(cell.trim()); return out;
}
md.block.ruler.before('table', 'talkdown_table', (state, start, end, silent) => {
  if (start + 1 >= end || state.sCount[start] - state.blkIndent >= 4 || !/^\|/.test(lineAt(state, start))) return false;
  const head = cells(lineAt(state, start)), sep = cells(lineAt(state, start + 1));
  if (head.length !== sep.length || !sep.every(s => /^:?-{2,}:?$/.test(s))) return false;
  if (silent) return true;
  const open = (type, tag) => state.push(type + '_open', tag, 1);
  const close = (type, tag) => state.push(type + '_close', tag, -1);
  const row = (values, tag) => {
    open('tr', 'tr');
    values.forEach((value, i) => {
      const token = open(tag, tag), alignment = /^:-+:$/.test(sep[i]) ? 'center' : /-:$/.test(sep[i]) ? 'right' : '';
      if (alignment) token.attrSet('style', 'text-align:' + alignment);
      const inline = state.push('inline', '', 0); inline.content = value; inline.children = [];
      close(tag, tag);
    });
    close('tr', 'tr');
  };
  const token = open('table', 'table');
  open('thead', 'thead'); row(head, 'th'); close('thead', 'thead'); open('tbody', 'tbody');
  let next = start + 2;
  while (next < end && /^\|/.test(lineAt(state, next))) row(cells(lineAt(state, next++)), 'td');
  close('tbody', 'tbody'); close('table', 'table'); token.map = [start, next]; state.line = next; return true;
});

md.core.ruler.after('inline', 'talkdown_typography', state => {
  for (const token of state.tokens) {
    if (token.type !== 'inline') continue;
    for (const child of token.children) if (child.type === 'text') child.content = child.content.replace(/\.\.\./g, '…').replace(/ -- /g, ' – ').replace(/---/g, '—');
  }
});

// Run before links: shortcut brackets are unambiguous even beside Markdown links.
md.inline.ruler.before('link', 'talkdown_shortcut', (state, silent) => {
  const match = state.src.slice(state.pos).match(/^\[\[([^\]\n]*)\]\]/);
  if (!match) return false;
  if (!silent) { const token = state.push('html_inline', '', 0); token.content = shortcut(match[1]); }
  state.pos += match[0].length; return true;
});
md.inline.ruler.before('link', 'explorable', explorableInline);

// [>note text] is a sidenote: a numbered mark that opens a popover, or sits in the margin of the article on wide screens.
// Brackets inside balance, so a Markdown link works in a note; an unclosed "[>" stays literal.
function sidenote(state, silent) {
  const src = state.src;
  if (src.charCodeAt(state.pos) !== 0x5B || src.charCodeAt(state.pos + 1) !== 0x3E) return false;
  let depth = 1, i = state.pos + 2;
  for (; i < src.length && depth; i++) {
    const c = src[i];
    if (c === '\\') i++; else if (c === '[') depth++; else if (c === ']') depth--;
  }
  if (depth) return false;
  const body = src.slice(state.pos + 2, i - 1).trim();
  if (!silent) {
    const token = state.push('html_inline', '', 0);
    token.content = body && !/\[>/.test(body)
      ? `<span class="sn"><button type="button" class="sn-mark" aria-expanded="false" aria-label="Note"></button><span class="sn-body" role="note">${md.renderInline(body)}</span></span>`
      : `<span class="td-error" role="alert">Sidenote: write the note after [&gt; and close it with ].</span>`;
  }
  state.pos = i; return true;
}
md.inline.ruler.before('link', 'sidenote', sidenote);

const MARKS = ['underline', 'circle', 'box', 'highlight', 'strike', 'bracket'];
// Talkdown's small inline additions sit on top of the standard Markdown lexer.
md.inline.ruler.before('emphasis', 'talkdown_inline', (state, silent) => {
  const text = state.src.slice(state.pos); let match, html, used;
  if ((match = text.match(/^\[([^\]\n]*)\]\{count\}/))) {
    try { const n = countValue(match[1]); html = `<span class="w-countup" data-value="${n.value}" data-precision="${n.precision}" data-suffix="${escape(n.suffix)}" role="img" aria-label="${escape(match[1])}"><span aria-hidden="true">${escape(match[1])}</span></span>`; }
    catch (error) { html = `<span class="td-error" role="alert">${escape(error.message)}</span> ${escape(match[1])}`; }
  }
  else if ((match = text.match(/^\[([^\[\]\n]+)\]\{((?:\s*\.[\w-]+)+)\s*\}/)) && /\.(?:underline|circle|box|highlight|strike|bracket)\b/.test(match[2])) {
    const names = match[2].match(/[\w-]+/g), kinds = names.filter(n => MARKS.includes(n));
    const bad = names.filter(n => n !== 'step' && !MARKS.includes(n));
    if (kinds.length > 1 || bad.length) html = `<span class="td-error" role="alert">mark: use one of ${MARKS.join(', ')}, plus optional .step${bad.length ? ` (not .${escape(bad[0])})` : ''}.</span> ${escape(match[1])}`;
    else html = `<span class="ink ink-${kinds[0]}"${names.includes('step') ? ' data-mark-step' : ''}>${md.renderInline(match[1])}</span>`;
  }
  else if ((match = text.match(/^\[\^([\w-]+)\]/))) html = `<sup class="fn">${escape(match[1])}</sup>`;
  else if ((match = text.match(/^\[@([\w.:-]+(?:;\s*@[\w.:-]+)*)\]/))) html = '<span class="cite">[' + match[1].split(/;\s*@/).map(k => `<a class="cite-link" data-cite="${escape(k)}">${escape(k)}</a>`).join(', ') + ']</span>';
  else if ((match = text.match(/^:([a-z][a-z0-9]*(?:-[a-z0-9]+)*):/))) html = `<i class="ico" data-icon="${match[1]}" aria-hidden="true"></i>`;
  else if ((match = text.match(/^==(?=\S)(.+?)==/))) html = `<mark>${md.renderInline(match[1])}</mark>`;
  else if ((match = text.match(/^\$(?=[^\s$])([^$\n]*?\S)\$(?![\w$])/))) html = `<span class="math">${escape(match[1])}</span>`;
  else return false;
  used = match[0].length;
  if (!silent) { const token = state.push('html_inline', '', 0); token.content = html; }
  state.pos += used; return true;
});

// A code span is the explicit opt-in; fences and ordinary numeric code stay literal.
const codeInline = md.renderer.rules.code_inline;
md.renderer.rules.code_inline = (tokens, i, options, env, self) => {
  const source = tokens[i].content;
  if (!source.startsWith('spark:')) return codeInline(tokens, i, options, env, self);
  const parts = source.slice(6).split(',').map(s => s.trim());
  const number = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
  const values = parts.map(Number);
  if (parts.some((s, n) => !number.test(s) || !Number.isFinite(values[n]))) {
    return codeInline(tokens, i, options, env, self)
      + '<span class="td-error w-sparkline-error" role="alert">spark: use comma-separated finite numbers (for example spark:9,8,5).</span>';
  }
  // Normalize before subtracting, so even opposite signs near Number.MAX_VALUE stay finite.
  let magnitude = 0;
  for (const value of values) magnitude = Math.max(magnitude, Math.abs(value));
  const scaled = values.map(value => magnitude ? value / magnitude : 0);
  let min = Infinity, max = -Infinity;
  for (const value of scaled) { min = Math.min(min, value); max = Math.max(max, value); }
  const y = value => max === min ? 12 : 22 - (value - min) / (max - min) * 20;
  const points = scaled.map((value, n) => `${2 + n / Math.max(1, values.length - 1) * 92},${y(value)}`).join(' ');
  const label = escape('Sparkline values: ' + parts.join(', '));
  const drawing = values.length === 1
    ? '<circle cx="48" cy="12" r="2" fill="currentColor"/>'
    : `<polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<svg class="w-sparkline" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 24" width="96" height="24" role="img" aria-label="${label}" focusable="false"><title>${label}</title>${drawing}</svg>`;
};

const attrPattern = /\s*\{((?:[.#][\w-]+\s*)+)\}\s*$/;
md.core.ruler.before('inline', 'talkdown_attributes', state => {
  for (let i = 0; i < state.tokens.length; i++) {
    const token = state.tokens[i]; if (token.type !== 'inline') continue;
    const task = token.content.match(/^\[([ xX])\]\s+/);
    if (task && state.tokens[i - 1]?.hidden) {
      const li = state.tokens.slice(0, i).findLast(t => t.type === 'list_item_open');
      li?.attrSet('data-task', task[1] === ' ' ? 'todo' : 'done'); token.content = token.content.slice(task[0].length);
    }
    const match = token.content.match(attrPattern); if (!match || (match.index && token.content[match.index - 1] === ']' && !match[0].startsWith(' ') && new RegExp(`\\.(?:${MARKS.join('|')})\\b`).test(match[1]))) continue;
    token.content = token.content.slice(0, match.index);
    let owner = state.tokens[i - 1];
    if (!token.content.trim() && i >= 2 && state.tokens[i + 1]?.type === 'paragraph_close') {
      let balance = 0;
      for (let j = i - 2; j >= 0; j--) {
        balance += state.tokens[j].nesting;
        if (balance === 0 && state.tokens[j].nesting === 1) { owner = state.tokens[j]; break; }
      }
      state.tokens.splice(i - 1, 3); i -= 2;
    } else if (owner?.hidden) owner = state.tokens.slice(0, i).findLast(t => t.type === 'list_item_open') || owner;
    for (const a of match[1].matchAll(/([.#])([\w-]+)/g)) a[1] === '.' ? owner.attrJoin('class', a[2]) : owner.attrSet('id', a[2]);
  }
});

function embed(url, alt) {
  let match;
  if ((match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/))) url = `https://www.youtube-nocookie.com/embed/${match[1]}`;
  else if ((match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/))) url = `https://player.vimeo.com/video/${match[1]}`;
  else if (/\.(mp4|webm|mov)(\?|#|$)/i.test(url)) return `<video src="${escape(url)}" controls playsinline preload="metadata" aria-label="${escape(alt)}"></video>`;
  else if (/\.cast(\?|#|$)/i.test(url)) return `<div class="w-term w-cast" data-src="${escape(url)}" data-title="${escape(alt)}"></div>`;
  else return '';
  return `<div class="w-frame"><iframe src="${escape(url)}" title="${escape(alt || 'Video')}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
}
const imageRule = md.renderer.rules.image;
md.renderer.rules.image = (tokens, i, options, env, self) => embed(tokens[i].attrGet('src'), tokens[i].content) || imageRule(tokens, i, options, env, self);
md.core.ruler.after('inline', 'talkdown_figures', state => {
  state.tokens.forEach((token, i) => {
    if (token.type !== 'inline' || token.children?.length !== 1 || token.children[0].type !== 'image') return;
    const open = state.tokens[i - 1], close = state.tokens[i + 1];
    if (open?.type !== 'paragraph_open' || close?.type !== 'paragraph_close') return;
    open.tag = close.tag = 'figure'; open.hidden = close.hidden = false;
    if (embed(token.children[0].attrGet('src'), '')) open.attrJoin('class', 'w-media');
    const title = token.children[0].attrGet('title');
    if (title) { const caption = new state.Token('html_inline', '', 0); caption.content = `<figcaption>${md.renderInline(title)}</figcaption>`; token.children.push(caption); }
  });
});
// ```lang {annotate}: a "# (1)" comment closing a line becomes pin 1, explained by item 1 of the numbered list right after
// the block (the Material for MkDocs convention, so the Markdown still reads as code plus a list on GitHub).
// Only the language's own comment syntax counts, so Python's n // (2) stays code; unknown languages take # // and /* */.
const COMMENTS = [
  [/^(python|py|sh|bash|shell|console|zsh|fish|yaml|yml|toml|ruby|rb|perl|r|dockerfile|makefile|make|powershell|ps1|nix|elixir|ex|julia|graphql|ini|conf|tcl|coffeescript|crystal|nim)$/, ['#']],
  [/^(sql|lua|haskell|hs|elm|ada|plsql|psql)$/, ['--']],
  [/^(tex|latex|erlang|matlab|octave|prolog)$/, ['%']],
  [/^(lisp|clojure|clj|scheme|racket|asm|nasm)$/, [';+']],
  [/^(html|xml|svg|markdown|md|vue|xhtml)$/, ['<!--']],
  [/^(css|scss|less)$/, ['/*']],
];
const pinPattern = lang => {
  const kinds = COMMENTS.find(([re]) => re.test(lang.toLowerCase()))?.[1] || ['#', '//', '/*'];
  const n = '\\(([1-9]\\d*)\\)!?';
  const forms = kinds.map(k => k === '/*' ? `\\/\\*\\s*${n}\\s*\\*\\/` : k === '<!--' ? `<!--\\s*${n}\\s*-->` : `${k.replace(/\//g, '\\/')}\\s*${n}`);
  const example = { '#': '# (1)', '//': '// (1)', '--': '-- (1)', '%': '% (1)', ';+': '; (1)', '<!--': '<!-- (1) -->', '/*': '/* (1) */' };
  return { re: new RegExp(`(?:^|\\s+)(?:${forms.join('|')})\\s*$`), example: kinds.slice(0, 2).map(k => example[k]).join(' or ') };
};
md.core.ruler.after('block', 'talkdown_annotate', state => {
  const t = state.tokens;
  const html = content => Object.assign(new state.Token('html_block', '', 0), { content, block: true });
  const alert = e => `<p class="td-error" role="alert">${escape(e)}</p>\n`;
  for (let i = 0; i < t.length; i++) {
    const fence = t[i], lang = fence.info.trim().match(/^[\w+-]+/)?.[0] || '';
    if (fence.type !== 'fence' || !/\{\s*annotate\s*\}/.test(fence.info) || /^(terminal|cast|asciicast|mermaid|log)$/.test(lang)) continue;
    // without its list the block is left as written (this also covers an unclosed fence that swallowed the rest)
    if (!(t[i + 1]?.type === 'ordered_list_open' && t[i + 1].level === fence.level)) {
      t.splice(i, 0, html(alert('{annotate} needs a numbered list right after the code block, one item per (n) marker'))); i++; continue;
    }
    const { re: PIN, example } = pinPattern(lang), pins = [], errors = [];
    const lines = fence.content.replace(/\n$/, '').split('\n').map(line => {
      const m = line.match(PIN); pins.push(m ? +m.slice(1).find(Boolean) : 0); return m ? line.slice(0, m.index) : line;
    });
    fence.content = lines.join('\n') + '\n'; fence.meta = { ...fence.meta, pins };
    const first = +(t[i + 1].attrGet('start') ?? 1); let end = i + 2, count = 0;
    for (; !(t[end].type === 'ordered_list_close' && t[end].level === fence.level); end++) if (t[end].type === 'list_item_open' && t[end].level === fence.level + 1) count++;
    t[i + 1].attrJoin('class', 'w-notes');
    const used = new Set(pins.filter(Boolean));
    if (!used.size) errors.push(`{annotate} found no markers: end a line with a comment like ${example}`);
    for (const n of [...used].sort((a, b) => a - b)) if (n < first || n >= first + count) errors.push(`Marker (${n}) has no note in the list after the code`);
    if (used.size) for (let n = first; n < first + count; n++) if (!used.has(n)) errors.push(`Note ${n} has no (${n}) marker in the code`);
    t.splice(end + 1, 0, html('</div>\n'));
    t.splice(i, 0, html(errors.map(alert).join('') + '<div class="w-annotate">\n'));
    i = end + 2;
  }
});
// ```diff {steps: hunks} title="api.py" view=split: lines tinted by their +/- marker. Every line keeps data-line
// (its line in the fence, for {steps: 1-2 | 3}) and data-hunk (for {steps: hunks}): a hunk starts at each @@ line,
// or, in a diff without @@ lines, is each run of changed lines. Git's file header before the first @@ becomes the title.
function diff(source, info) {
  // bad options still show the diff as plain code under the error, so nothing the author wrote is lost
  const fail = text => `<p class="td-error" role="alert">${escape(text)}</p>` + (source.trim() ? `<pre class="code"><code>${escape(source)}</code></pre>` : '');
  // {…} groups outside quotes are fence options; only {steps: …} is one
  const braces = [], rest = info.replace(/"[^"]*"|'[^']*'|\{[^}]*\}/g, m => m[0] === '{' ? (braces.push(m), ' ') : m);
  const odd = braces.find(b => !/^\{\s*steps:/.test(b));
  if (odd) return fail(`diff: unknown option ${odd} (use {steps: hunks} or {steps: 1-2 | 3})`);
  const steps = braces[0]?.match(/^\{\s*steps:\s*([^}]*)\}/)[1].trim();
  const range = '\\d+(?:\\s*-\\s*\\d+)?(?:\\s*,\\s*\\d+(?:\\s*-\\s*\\d+)?)*';
  if (steps != null && !new RegExp(`^(?:hunks|${range}(?:\\s*\\|\\s*${range})*)$`).test(steps)) return fail(`diff: steps must be hunks or line groups like 1-2 | 3, not "${steps}"`);
  let parsed;
  try { parsed = directive(rest.trim()); } catch (error) { return fail('diff: ' + error.message); }
  const { title = '', view = 'unified', ...unknown } = parsed.options, extra = [...Object.keys(unknown), ...parsed.classes];
  if (extra.length) return fail(`diff: unknown option "${extra[0]}" (use title="…", view=unified|split or {steps: hunks})`);
  if (!['unified', 'split'].includes(view)) return fail(`diff: view must be unified or split, not "${view}"`);
  if (!source.trim()) return fail('diff: the block is empty');
  const lines = source.split('\n'), first = lines.findIndex(l => l.startsWith('@@'));
  // file headers: a "diff …" line, or "--- " then "+++ " then "@@", plus git's extended header lines up to the hunk
  const header = new Map();   // first line of each header -> its file name
  for (let j = 0; j < lines.length; j++) {
    const t = lines[j];
    if (!t.startsWith('diff ') && !(t.startsWith('--- ') && lines[j + 1]?.startsWith('+++ ') && lines[j + 2]?.startsWith('@@'))) continue;
    let k = j, name = '';
    for (; k < lines.length && (k === j || /^(index |--- |\+\+\+ |new file|deleted file|similarity |rename |copy |old mode|new mode|Binary )/.test(lines[k])); k++) {
      const m = lines[k].match(/^(\+\+\+|---) (?!\/dev\/null)([^\t]*)/);
      if (m && (m[1] === '+++' || !name)) name = m[2].replace(/^[ab]\//, '');
      if (!name && lines[k].startsWith('diff --git ')) name = lines[k].match(/ b\/(.*)$/)?.[1] || '';
    }
    header.set(j, { name, end: k }); j = k - 1;
  }
  let file = '', hunk = 0, run = false, skip = -1, seen = false;
  const rows = lines.map((text, j) => {
    if (header.has(j)) {
      const h = header.get(j); skip = h.end;
      if (!seen && !file) { file = h.name; return null; }   // the first file names the figure
      seen = true;
      return h.name ? { kind: 'meta', line: j + 1, hunk: 0, mark: ' ', body: h.name, file: true } : null;   // later files: a separator
    }
    if (j < skip) return null;
    seen = true;
    const kind = text[0] === '+' ? 'add' : text[0] === '-' ? 'del' : text.startsWith('@@') ? 'hunk' : text[0] === '\\' ? 'meta' : 'ctx';
    const changed = kind === 'add' || kind === 'del';
    if (kind === 'hunk') hunk++;
    else if (first < 0) { if (changed && !run) hunk++; run = changed; }
    const own = first < 0 ? run : hunk > 0, plain = kind === 'hunk' || kind === 'meta';
    return { kind, line: j + 1, hunk: own ? hunk : 0, mark: changed ? text[0] : ' ', body: plain ? text : text.slice(changed || text[0] === ' ' ? 1 : 0) };
  }).filter(Boolean);
  if (!rows.length) return fail('diff: nothing after the file header');
  const cell = (r, wide) => `<span class="ln d-${r.kind}${r.file ? ' d-file' : ''}${wide ? ' d-wide' : ''}" data-line="${r.line}"${r.hunk ? ` data-hunk="${r.hunk}"` : ''}>`
    + (r.kind === 'hunk' || r.kind === 'meta' ? escape(r.body) : `<span class="d-m">${r.mark}</span>${escape(r.body)}`) + '</span>';
  let split = '';
  if (view === 'split') {
    // old on the left, new on the right: each run of removed lines sits beside the added lines that follow it
    const out = [], empty = '<span class="ln d-none"></span>';
    for (let k = 0; k < rows.length;) {
      const r = rows[k];
      if (r.kind === 'hunk' || r.kind === 'meta') { out.push(cell(r, true)); k++; continue; }
      if (r.kind === 'ctx') { out.push(cell(r) + cell(r)); k++; continue; }
      const del = [], add = [];
      while (rows[k]?.kind === 'del') del.push(rows[k++]);
      while (rows[k]?.kind === 'add') add.push(rows[k++]);
      for (let m = 0; m < Math.max(del.length, add.length); m++) out.push((del[m] ? cell(del[m]) : empty) + (add[m] ? cell(add[m]) : empty));
    }
    split = `<pre class="code w-diff-split"><code>${out.join('')}</code></pre>`;
  }
  const name = title || file;
  return `<figure class="w-diff" data-view="${view}"${steps ? ` data-steps="${escape(steps)}"` : ''}>`
    + (name ? `<figcaption>${escape(name)}</figcaption>` : '')
    + `<pre class="code w-diff-uni"><code>${rows.map(r => cell(r)).join('')}</code></pre>${split}</figure>`;
}
// A single HTTP exchange: a request, a blank separator, then the response status line.
// Keep both messages as code, so bodies and headers remain readable without JavaScript.
function httpExchange(source, info) {
  const fail = message => `<p class="td-error" role="alert">${escape('http: ' + message)}</p><pre class="code"><code>${escape(source)}</code></pre>`;
  if (info !== 'http') return fail('no options are supported; use a plain http fence');
  const lines = source.split('\n');
  const request = lines[0]?.match(/^([!#$%&'*+.^_`|~0-9A-Z-]+)\s+(\S+)\s+HTTP\/(\d+(?:\.\d+)?)\s*$/);
  if (!request) return fail('start with a request line, for example GET /users HTTP/1.1');
  const at = lines.findIndex((line, i) => i > 0 && !lines[i - 1].trim() && /^HTTP\//.test(line));
  if (at < 0) return fail('add a blank line followed by a response status line, for example HTTP/1.1 200 OK');
  const response = lines[at].match(/^HTTP\/\d+(?:\.\d+)?\s+([1-5]\d{2})(?:\s+(.*))?\s*$/);
  if (!response) return fail('the response status must be between 100 and 599');
  const status = response[1], kind = +status < 200 ? 'info' : +status < 300 ? 'success' : +status < 400 ? 'redirect' : 'error';
  const panel = (name, badge, content, cls) => `<section class="w-http-${cls}" aria-label="HTTP ${name.toLowerCase()}"><header><span>${name}</span><strong class="w-http-badge">${escape(badge)}</strong></header><pre class="code" data-lang="http"><code>${escape(content)}</code></pre></section>`;
  // Remove only the one separating blank line; preserve any authored blank lines inside each message.
  return `<figure class="w-http" data-status="${kind}">`
    + panel('Request', request[1], lines.slice(0, at - 1).join('\n'), 'request')
    + panel('Response', status + (response[2]?.trim() ? ' ' + response[2].trim() : ''), lines.slice(at).join('\n'), 'response') + '</figure>';
}
// A bit layout: one "0-3 Name" (or "7 Flag") line per field. Fields wrap into rows of `bits` cells; gaps render as reserved.
function bitfield(source, info) {
  const fail = message => `<p class="td-error" role="alert">${escape('bitfield: ' + message)}</p><pre class="code"><code>${escape(source)}</code></pre>`;
  let spec; try { spec = directive(info); } catch (e) { return fail(e.message); }
  const { options, classes } = spec, unknown = [...Object.keys(options).filter(k => k !== 'bits'), ...classes];
  if (unknown.length) return fail('unknown option ' + unknown[0] + '; the only option is bits=N');
  const bits = options.bits == null ? 32 : /^\d+$/.test(options.bits) ? +options.bits : 0;
  if (bits < 1 || bits > 64) return fail('bits must be a whole number from 1 to 64');
  const fields = [];
  for (const [n, line] of source.split('\n').entries()) {
    if (!line.trim()) continue;
    const m = line.match(/^\s*(\d+)(?:\s*-\s*(\d+))?\s+(\S.*?)\s*$/);
    if (!m) return fail(`line ${n + 1} must look like "0-3 Name" or "7 Flag"`);
    const from = +m[1], to = m[2] == null ? from : +m[2];
    if (to < from) return fail(`line ${n + 1}: write the lower bit first, as in ${to}-${from}`);
    if (to >= 4096) return fail(`line ${n + 1}: bit ${to} is out of range`);
    fields.push({ from, to, name: m[3] });
  }
  if (!fields.length) return fail('add one field per line, for example 0-3 Version');
  const sorted = [...fields].sort((a, b) => a.from - b.from);
  for (let i = 1; i < sorted.length; i++) if (sorted[i].from <= sorted[i - 1].to) return fail(`"${sorted[i - 1].name}" and "${sorted[i].name}" overlap at bit ${sorted[i].from}`);
  const total = Math.ceil((sorted.at(-1).to + 1) / bits) * bits, index = new Map(fields.map((f, i) => [f, i]));
  const range = (a, b) => a === b ? String(a) : `${a}\u2013${b}`;
  const cells = (from, to, name, i) => {
    const out = [];
    for (let at = from; at <= to;) {
      const end = Math.min(to, (Math.floor(at / bits) + 1) * bits - 1), row = Math.floor(at / bits);
      out.push({ row, html: `<span class="bf-cell${i == null ? ' bf-gap' : ''}${at > from ? ' bf-cont' : ''}"${i == null ? '' : ` data-field="${i}"`} style="grid-column:${at % bits + 1} / span ${end - at + 1}"><span class="bf-bits">${range(at, end)}</span><span class="bf-name">${escape(i == null ? 'unused' : name)}</span></span>` });
      at = end + 1;
    }
    return out;
  };
  const parts = []; let next = 0;
  for (const f of sorted) { if (f.from > next) parts.push(...cells(next, f.from - 1, '', null)); parts.push(...cells(f.from, f.to, f.name, index.get(f))); next = f.to + 1; }
  if (next < total) parts.push(...cells(next, total - 1, '', null));
  const rows = Array.from({ length: total / bits }, (_, r) => `<div class="bf-row" style="--bits:${bits}">${parts.filter(p => p.row === r).map(p => p.html).join('')}</div>`);
  const table = `<table class="bf-table"><thead><tr><th>Bits</th><th>Width</th><th>Field</th></tr></thead><tbody>${sorted.map(f => `<tr><td>${range(f.from, f.to)}</td><td>${f.to - f.from + 1}</td><td>${escape(f.name)}</td></tr>`).join('')}</tbody></table>`;
  return `<figure class="w w-bitfield" aria-label="${escape(`${bits}-bit layout with ${fields.length} fields`)}" data-fields="${fields.length}"><div class="bf-grid">${rows.join('')}</div>${table}</figure>`;
}
// Logs remain literal code; only an optional leading timestamp and severity are decorated.
function logBlock(raw, info) {
  const source = raw.replace(/\n$/, ''), lines = source.split('\n');
  const fail = message => `<p class="td-error" role="alert">${escape('log: ' + message)}</p><pre class="code"><code>${escape(raw)}</code></pre>`;
  const match = info.match(/^log(?:\s+\{\s*steps:\s*([^}]+)\})?$/);
  if (!match) return fail('use a plain fence or {steps: 1-2 | 3}');
  if (!source.trim()) return fail('the block is empty');
  const spec = match[1]?.trim();
  if (spec != null) {
    const range = '\\d+(?:\\s*-\\s*\\d+)?';
    if (!new RegExp(`^${range}(?:\\s*,\\s*${range})*(?:\\s*\\|\\s*${range}(?:\\s*,\\s*${range})*)*$`).test(spec)) return fail('steps must be line groups like 1-2 | 3');
    for (const part of spec.split(/[|,]/)) {
      const [a, b = a] = part.trim().split(/\s*-\s*/).map(Number);
      if (a < 1 || b < a || b > lines.length) return fail('step lines must be ordered ranges within the log');
    }
  }
  const rows = lines.map((line, i) => {
    const timestamp = line.match(/^(?:\[?(?:\d{4}-\d{2}-\d{2}[T ])?\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?\]?)(?=\s|$)/)?.[0] || '';
    const rest = line.slice(timestamp.length), severity = rest.match(/^(\s*)(TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL|CRITICAL)(?=\s|$)/);
    const body = severity ? escape(severity[1]) + `<span class="log-level log-${severity[2].toLowerCase()}">${severity[2]}</span>` + escape(rest.slice(severity[0].length)) : escape(rest);
    return `<span class="ln" data-line="${i + 1}">${timestamp ? `<span class="log-time">${escape(timestamp)}</span>` : ''}${body || ' '}</span>`;
  });
  return `<pre class="code w-log" tabindex="0" role="region" aria-label="Log output" data-source="${escape(raw)}"${spec ? ` data-log-steps="${escape(spec)}"` : ''}><code>${rows.join('')}</code></pre>`;
}
// ```array: the first line is the data, each later line one step of name=index pointers; *value marks a found cell.
// The table is the complete record (and the article view); deck.js turns the cells into a stepper.
function arrayBlock(raw, info) {
  const fail = message => `<p class="td-error" role="alert">${escape('array: ' + message)}</p><pre class="code"><code>${escape(raw)}</code></pre>`;
  if (info !== 'array') return fail('no options are supported; use a plain array fence');
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return fail('the block is empty');
  const cells = lines[0].replace(/^\[/, '').replace(/\]$/, '').split(',').map(c => c.trim());
  if (cells.some(c => !c)) return fail('the first line must be the data, such as [1, 3, 5]');
  if (cells.length > 40) return fail('at most 40 cells');
  const rows = [], names = [];
  for (const [n, line] of lines.slice(1).entries()) {
    const pointers = {}, found = [];
    for (const tok of line.split(/\s+/)) {
      const ptr = tok.match(/^([A-Za-z_]\w*)=(\d+)$/);
      if (ptr) {
        if (Object.hasOwn(pointers, ptr[1])) return fail(`step ${n + 1} sets ${ptr[1]} twice`);
        if (+ptr[2] >= cells.length) return fail(`step ${n + 1}: ${ptr[1]}=${ptr[2]} is outside the ${cells.length} cells (indexes start at 0)`);
        pointers[ptr[1]] = +ptr[2]; if (!names.includes(ptr[1])) names.push(ptr[1]);
      } else if (tok.length > 1 && tok[0] === '*') found.push(tok.slice(1));
      else return fail(`step ${n + 1}: "${tok}" should be name=index or *value`);
    }
    for (const v of found) if (!cells.includes(v)) return fail(`step ${n + 1}: *${v} is not in the data`);
    rows.push({ p: pointers, f: found });
  }
  const list = `<div class="w-array-cells" role="list" aria-label="Array">${cells.map((c, i) => `<div class="w-array-cell" role="listitem"><span class="w-array-v">${escape(c)}</span><span class="w-array-i">${i}</span><span class="w-array-p"></span></div>`).join('')}</div>`;
  const table = rows.length ? `<table class="w-array-table"><thead><tr><th>Step</th>${names.map(n => `<th>${escape(n)}</th>`).join('')}<th>Found</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td>${names.map(n => `<td>${n in r.p ? r.p[n] : ''}</td>`).join('')}<td>${r.f.map(escape).join(', ')}</td></tr>`).join('')}</tbody></table>` : '';
  return `<figure class="w w-array"${rows.length ? ` data-array="${escape(JSON.stringify(rows))}"` : ''}>${list}${table}</figure>`;
// "a,b: note | b,c" becomes [{ ids: [a, b], note }, { ids: [b, c] }]; a group's note follows its first colon
function mermaidSteps(spec) {
  const groups = spec.split('|').map(g => {
    const colon = g.indexOf(':'), list = colon < 0 ? g : g.slice(0, colon);
    return { ids: list.split(',').map(x => x.trim()).filter(Boolean), note: colon < 0 ? '' : g.slice(colon + 1).trim(), raw: list };
  });
  const empty = groups.findIndex(g => !g.ids.length || g.raw.split(',').some(x => !x.trim()));
  if (empty >= 0) return { error: `step ${empty + 1} needs node ids, like {steps: client,edge | edge,origin}` };
  const space = groups.find(g => g.ids.some(x => /\s/.test(x)));
  if (space) return { error: `node ids have no spaces, not "${space.ids.find(x => /\s/.test(x))}"` };
  return { groups };
}
// ```json {explore open=2 highlight="user.roles"}: a collapsible tree built from nested <details>, so it works without JavaScript.
// open=N starts N levels expanded (or all); highlight lists comma-separated paths (a.b[0].c) that ↓ opens and marks in turn.
function jsonTree(raw, info) {
  const source = raw.replace(/\n$/, '');
  const fail = message => `<p class="td-error" role="alert">${escape('explore: ' + message)}</p><pre class="code"><code>${escape(raw)}</code></pre>`;
  const braces = [], rest = info.replace(/^[\w+-]+/, '').replace(/"[^"]*"|'[^']*'|\{[^}]*\}/g, m => m[0] === '{' ? (braces.push(m), ' ') : m);
  if (braces.length !== 1 || rest.trim()) return fail('use one {explore open=2 highlight="a.b"} group');
  if (info.match(/^[\w+-]+/)?.[0] !== 'json') return fail('only json is supported');
  let parsed;
  try { parsed = directive(braces[0].slice(1, -1).trim()); } catch (error) { return fail(error.message); }
  const { open = '1', highlight = '', ...unknown } = parsed.options, extra = [...Object.keys(unknown), ...parsed.classes];
  if (extra.length) return fail(`unknown option "${extra[0]}" (use open=N|all and highlight="a.b, c[0]")`);
  if (!/^(\d{1,3}|all)$/.test(open)) return fail(`open must be a number or all, not "${open}"`);
  if (!source.trim()) return fail('the block is empty');
  let data;
  try { data = JSON.parse(source); } catch (error) { return fail('invalid JSON: ' + error.message); }
  const levels = open === 'all' ? Infinity : +open;
  const segments = path => [...path.matchAll(/\[(\d+)\]|([^.[\]]+)/g)].map(m => m[1] ?? m[2]);
  const join = segs => segs.reduce((a, k) => a + (/^\d+$/.test(k) ? `[${k}]` : (a ? '.' : '') + k), '');
  const marks = [];
  for (const spec of highlight.split(',').map(x => x.trim()).filter(Boolean)) {
    let at = data;
    const segs = segments(spec);
    for (const k of segs) at = at && typeof at === 'object' && Object.hasOwn(at, k) ? at[k] : undefined;
    if (!segs.length || at === undefined) return fail(`highlight path "${spec}" does not exist`);
    marks.push(join(segs));
  }
  const tag = [...new Set(marks)];
  const kind = v => v === null ? 'null' : typeof v;
  const key = k => k == null ? '' : `<span class="tk">${escape(typeof k === 'number' ? String(k) : JSON.stringify(k))}</span><span class="tp">: </span>`;
  const leaf = v => `<span class="tv tv-${kind(v)}">${escape(JSON.stringify(v))}</span>`;
  const node = (v, k, segs, depth) => {
    const attrs = ` data-path="${escape(join(segs))}"`;
    const arr = Array.isArray(v), entries = v && typeof v === 'object' ? (arr ? v.map((x, i) => [i, x]) : Object.entries(v)) : null;
    if (!entries?.length) return `<div class="tn tl"${attrs}>${key(k)}${entries ? `<span class="tp">${arr ? '[]' : '{}'}</span>` : leaf(v)}</div>`;
    const [o, c] = arr ? '[]' : '{}', n = entries.length;
    return `<details class="tn"${attrs}${depth < levels ? ' open' : ''}><summary>${key(k)}<span class="tp">${o}</span><span class="tsum"> ${n} ${arr ? (n === 1 ? 'item' : 'items') : (n === 1 ? 'key' : 'keys')} </span><span class="tp">${c}</span></summary>`
      + `<div class="tc">${entries.map(([ek, ev]) => node(ev, ek, [...segs, String(ek)], depth + 1)).join('')}</div><span class="tp tclose">${c}</span></details>`;
  };
  return `<figure class="w-tree" role="group" aria-label="JSON explorer" data-source="${escape(source)}"${tag.length ? ` data-highlight="${escape(JSON.stringify(tag))}"` : ''}>${node(data, null, [], 0)}</figure>`;
}
// ```js [Node.js]: a bracketed label after the language (VitePress's convention) names the block's tab in a ::: code-group
md.renderer.rules.fence = (tokens, i) => {
  const out = fence(tokens[i]), label = tokens[i].info.match(/^\s*[\w+-]+\s+\[([^\]\n]+)\]/)?.[1].trim();
  return label ? out.replace(/^<[\w-]+/, m => `${m} data-label="${escape(label)}"`) : out;
};
function fence(token) {
  const info = token.info.trim().replace(/^([\w+-]+)\s+\[[^\]\n]+\]/, '$1'), lang = info.match(/^[\w+-]+/)?.[0] || '';
  const source = token.content.replace(/\n$/, ''), code = escape(source);
  if (lang === 'log') return logBlock(token.content, info);
  if (lang === 'sequence') return sequenceHTML(source);
  if (/\{\s*explore(?=[\s}])/.test(info)) return jsonTree(token.content, info);
  if (lang === 'diff') return diff(source, info);
  if (lang === 'http') return httpExchange(source, info);
  if (lang === 'array') return arrayBlock(source, info);
  if (lang === 'bitfield') return bitfield(source, info);
  if (lang === 'bench') return benchBlock(source, info);
  if (/^(cast|asciicast)$/.test(lang)) return `<div class="w-term w-cast" data-inline="${code}"></div>`;
  if (/\{\s*run\s*\}/.test(info)) {
    if (!/^(js|javascript)$/.test(lang)) return `<p class="td-error" role="alert">run: only js blocks can run, as in \`\`\`js {run}</p><pre class="code"><code>${code}</code></pre>`;
    return `<div class="w w-run"><pre class="code"><code>${code}</code></pre></div>`;
  }
  if (lang === 'terminal') return `<div class="w-term" data-lines="${escape(JSON.stringify(source ? source.split('\n') : []))}"></div>`;
  if (lang === 'mermaid') {
    // {steps: client,edge: note | edge,origin}: each group lists node ids (and so the edges between them) to light on ↓
    const spec = info.match(/\{\s*steps:([^}]*)\}/)?.[1], plan = spec != null && mermaidSteps(spec);
    const bad = plan?.error ? `<p class="td-error" role="alert">${escape('mermaid: ' + plan.error)}</p>` : '';
    const notes = plan?.groups?.some(g => g.note) ? `<ol class="w-diagram-notes">${plan.groups.map((g, k) => g.note ? `<li data-step="${k}">${escape(g.note)}</li>` : '').join('')}</ol>` : '';
    const diagram = `<div class="w-diagram"${plan?.groups ? ` data-steps="${escape(JSON.stringify(plan.groups.map(g => g.ids)))}"` : ''}><pre class="code w-diagram-src">${code}</pre></div>`;
    const stage = plan?.groups ? `<div class="w-stepped">${diagram}${notes}</div>` : diagram;
    return bad + (/\{\s*source\s*\}/.test(info) ? `<div class="w-with-source"><pre class="code"><code>${code}</code></pre>${stage}</div>` : stage);
  }
  const diagram = `<div class="w-diagram"><pre class="code w-diagram-src">${code}</pre></div>`;
  const pins = token.meta?.pins, steps = !pins && info.match(/\{\s*steps:\s*([^}]*)\}/)?.[1];
  return `<pre class="code"${lang ? ` data-lang="${lang}"` : ''}${steps ? ` data-steps="${escape(steps)}"` : ''}${pins ? ` data-pins="${pins.join(',')}"` : ''}><code>${code}</code></pre>`;
}
const linkOpen = md.renderer.rules.link_open;
md.renderer.rules.link_open = (tokens, i, options, env, self) => {
  if (/^https?:/.test(tokens[i].attrGet('href'))) { tokens[i].attrSet('target', '_blank'); tokens[i].attrSet('rel', 'noopener'); }
  return linkOpen ? linkOpen(tokens, i, options, env, self) : self.renderToken(tokens, i, options);
};

export function directive(text) {
  const name = text.match(/^[\w-]+/)?.[0]; if (!name) throw new Error('Expected a container name');
  const options = {}, classes = []; let rest = text.slice(name.length).trim();
  while (rest) {
    const match = rest.match(/^([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s]+)))?(?:\s+|$)/);
    if (!match) throw new Error('Invalid container option: ' + rest);
    if (match[2] == null && match[3] == null && match[4] == null) classes.push(match[1]);
    else { if (Object.hasOwn(options, match[1])) throw new Error('Duplicate option: ' + match[1]); options[match[1]] = match[2] ?? match[3] ?? match[4]; }
    rest = rest.slice(match[0].length);
  }
  return { name, options, classes };
}

// Endpoint signatures are positional, unlike ordinary key=value container options.
function endpoint(signature, tokens, env) {
  const content = compile(tokens, env);
  const fail = message => `<p class="td-error" role="alert">endpoint: ${escape(message)}</p><pre class="code"><code>${escape('::: ' + signature)}</code></pre>${content}`;
  const match = signature.match(/^endpoint\s+(GET|HEAD|POST|PUT|PATCH|DELETE|CONNECT|OPTIONS|TRACE)\s+(\/[^\s]*)$/);
  if (!match) return fail('use ::: endpoint METHOD /path with an uppercase HTTP method and no options.');
  const [, method, path] = match;
  if (/[{}]/.test(path.replace(/\{[A-Za-z_][\w.-]*\}/g, ''))) return fail('path parameters must use {name}, with balanced braces.');
  const label = path.split(/(\{[A-Za-z_][\w.-]*\})/g).map(part => part.startsWith('{') ? `<span class="w-endpoint-param">${escape(part)}</span>` : escape(part)).join('');
  return `<section class="w w-endpoint" aria-label="${escape(method + ' ' + path)}"><header class="w-endpoint-header"><strong class="w-endpoint-method">${method}</strong><a class="w-endpoint-path"><code>${label}</code></a></header><div class="w-endpoint-body">${content}</div></section>`;
}

// ::: live holds ```html, ```css and ```js fences, one of each at most; the runtime turns them into editors beside a sandboxed preview.
function liveCode(tokens, options, classes, env) {
  const fail = message => `<p class="td-error" role="alert">live: ${escape(message)}</p>${compile(tokens, env)}`;
  if (Object.keys(options).length || classes.length) return fail('no options are supported; use ```html, ```css and ```js fences.');
  const langs = [], panes = [];
  for (const t of tokens) {
    if (t.type !== 'fence') return fail('use only ```html, ```css and ```js fences inside.');
    const lang = { html: 'html', css: 'css', js: 'js', javascript: 'js' }[t.info.trim().match(/^[\w+-]+/)?.[0]];
    if (!lang || /\{/.test(t.info)) return fail('use only ```html, ```css and ```js fences, without options.');
    if (langs.includes(lang)) return fail(`there is more than one ${lang} fence.`);
    langs.push(lang); panes.push(`<div class="w-live-pane" data-lang="${lang}"><pre class="code"><code>${escape(t.content.replace(/\n$/, ''))}</code></pre></div>`);
  }
  if (!panes.length) return fail('add at least one ```html, ```css or ```js fence.');
  return `<div class="w w-live">${panes.join('')}</div>`;
}

// ::: links keeps ordinary Markdown as its fallback; all card text is authored, never fetched.
function linkCards(tokens, options, classes, env) {
  const fail = message => `<p class="td-error" role="alert">links: ${escape(message)}</p>${compile(tokens, env)}`;
  if (Object.keys(options).length || classes.length) return fail('no options are supported; use a bulleted list of links.');
  if (tokens[0]?.type !== 'bullet_list_open' || tokens.at(-1)?.type !== 'bullet_list_close') return fail('expected a bulleted list of [Title](URL) descriptions.');
  const cards = [];
  for (let i = 1; i < tokens.length - 1; i += 5) {
    if (tokens.slice(i, i + 5).map(t => t.type).join(',') !== 'list_item_open,paragraph_open,inline,paragraph_close,list_item_close') return fail('each item must be one paragraph, starting with [Title](URL).');
    const inline = tokens[i + 2].children, end = inline.findIndex(t => t.type === 'link_close');
    if (inline[0]?.type !== 'link_open' || end < 2 || inline.filter(t => t.type === 'link_open').length !== 1 || inline.some(t => ['html_inline', 'image'].includes(t.type))) return fail('each item must start with one text link; put plain text or inline formatting after it.');
    const href = inline[0].attrGet('href');
    let url;
    try { url = new URL(href, 'https://talkdown.invalid/'); } catch { return fail('the link URL is invalid.'); }
    if (!['http:', 'https:'].includes(url.protocol)) return fail('use an HTTP(S) URL, a relative page URL or a #section link.');
    const label = md.renderer.renderInline(inline.slice(1, end), md.options, env);
    if (!inline.slice(1, end).some(t => t.content.trim())) return fail('every link needs a title.');
    const description = md.renderer.renderInline(inline.slice(end + 1), md.options, env).trim();
    const domain = /^(?:https?:)?\/\//i.test(href) ? url.hostname : 'This site';
    const external = /^(?:https?:)?\/\//i.test(href) ? ' target="_blank" rel="noopener"' : '';
    const title = inline[0].attrGet('title');
    cards.push(`<li class="w-link-item"><a class="w-link-card" href="${escape(href)}"${external}${title ? ` title="${escape(title)}"` : ''}><span class="w-link-domain">${escape(domain)}</span><span class="w-link-title">${label}</span>${description ? `<span class="w-link-description">${description}</span>` : ''}</a></li>`);
  }
  if (!cards.length) return fail('add at least one [Title](URL) list item.');
  return `<ul class="w w-links">${cards.join('')}</ul>`;
}

// Simple diagrams stay ordinary lists: no renderer or network dependency.
function flowStack(name, tokens, options, classes, env) {
  const fail = message => `<p class="td-error" role="alert">${name}: ${escape(message)}</p>${compile(tokens, env)}`;
  if (Object.keys(options).length || classes.some(c => name !== 'flow' || c !== 'vertical')) return fail('use a bulleted list; only flow accepts the vertical flag.');
  if (tokens[0]?.type !== 'bullet_list_open' || tokens.at(-1)?.type !== 'bullet_list_close') return fail('expected one non-empty bulleted list.');
  let depth = 0, item = null, count = 0, hasText = false;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^(bullet|ordered)_list_open$/.test(t.type)) depth++;
    if (/^(bullet|ordered)_list_close$/.test(t.type)) {
      depth--;
      if (!depth && i !== tokens.length - 1) return fail('expected one bulleted list, without other blocks outside it.');
    }
    if (t.type === 'list_item_open' && depth === 1) { item = t; hasText = false; count++; }
    if (item && t.type === 'inline' && t.content.trim()) hasText = true;
    // A loose list attaches {.step} to its paragraph. Reveal its whole box instead.
    if (item && t.type === 'paragraph_open' && t.attrGet('class')?.split(/\s+/).includes('step')) {
      item.attrJoin('class', 'step');
      const remaining = t.attrGet('class').split(/\s+/).filter(c => c !== 'step').join(' ');
      if (remaining) t.attrSet('class', remaining); else t.attrs = t.attrs.filter(([key]) => key !== 'class');
    }
    if (t.type === 'list_item_close' && depth === 1) {
      if (!hasText) return fail('every item needs a label.');
      item = null;
    }
  }
  if (!count || depth) return fail('expected one non-empty bulleted list.');
  tokens[0].attrJoin('class', ['w', `w-${name}`, ...classes].join(' '));
  tokens[0].attrSet('role', 'list');
  tokens[0].attrSet('aria-label', name === 'flow' ? 'Process flow' : 'Layers, top to bottom');
  return compile(tokens, env);
}

// Audience destinations must stand alone when the QR library is unavailable.
function audienceAsk(tokens, options, classes, env) {
  const fail = message => `<p class="td-error" role="alert">ask: ${escape(message)}</p>${compile(tokens, env)}`;
  if (classes.length || Object.keys(options).some(key => key !== 'url')) return fail('only the url option is supported.');
  if (tokens.length) return fail('put the destination in url="https://…" and leave the block empty.');
  let url;
  try { url = new URL(options.url); } catch { return fail('provide an absolute HTTP(S) URL.'); }
  if (!/^https?:\/\//i.test(options.url) || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || /[\s\u0000-\u001f\u007f]/.test(options.url)) return fail('provide an absolute HTTP(S) URL without credentials or whitespace.');
  const href = escape(url.href), short = escape(url.href.replace(/^https?:\/\//, ''));
  return `<div class="w w-ask" data-url="${href}"><a href="${href}"><span class="w-ask-label">Ask a question</span><span class="w-ask-url" aria-hidden="true">${short}</span></a></div>`;
}

// Decorative device chrome is static: preserve all of the Markdown content in both views.
function deviceFrame(name, options, classes, content) {
  const allowed = name === 'browser' ? ['url'] : name === 'window' ? ['title'] : [];
  const invalid = Object.keys(options).find(key => !allowed.includes(key));
  const error = invalid ? `${name}: unsupported option "${invalid}"` : !content.trim() ? `${name}: add an image, code block or Markdown content` : '';
  if (error) return `<p class="td-error" role="alert">${escape(error)}</p>${content}`;
  const label = name === 'browser' ? options.url || 'Browser' : name === 'window' ? options.title || 'Window' : 'Phone';
  const chrome = name === 'phone'
    ? '<div class="w-device-speaker" aria-hidden="true"></div>'
    : `<figcaption class="w-device-bar"><span class="w-device-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="w-device-label">${escape(label)}</span></figcaption>`;
  return `<figure class="${escape(['w', 'w-device', `w-${name}`, ...classes].join(' '))}" aria-label="${escape(label)}">${chrome}<div class="w-device-body">${content}</div></figure>`;
}

// A single question keeps the source readable as a heading and a task list.
function quiz(tokens, options, classes, env) {
  const fail = message => `<p class="td-error" role="alert">quiz: ${escape(message)}</p>${compile(tokens, env)}`;
  if (Object.keys(options).length || classes.length) return fail('takes no options');
  if (tokens[0]?.type !== 'heading_open' || tokens[0].tag !== 'h3' || !tokens[1]?.content.trim() || tokens[3]?.type !== 'bullet_list_open')
    return fail('start with one ### question and a task list');
  const choices = []; let i = 4, continuation = '';

  while (tokens[i]?.type === 'list_item_open') {
    const item = tokens[i], text = tokens[i + 2];
    if (tokens[i + 1]?.type !== 'paragraph_open' || text?.type !== 'inline' || tokens[i + 3]?.type !== 'paragraph_close' || tokens[i + 4]?.type !== 'list_item_close')
      return fail('each choice must be one text paragraph');
    const mark = text.content.match(/^\[([ xX])\]\s+/);
    const task = item.attrGet('data-task') || (mark ? mark[1] === ' ' ? 'todo' : 'done' : null);
    let label = mark ? text.content.slice(mark[0].length) : text.content;
    // The proposal places explanation immediately after the final choice.
    // Markdown treats it as a soft continuation of that item; lift it back out.
    if (label.includes('\n') && tokens[i + 5]?.type === 'bullet_list_close') {
      const lines = label.split('\n'); label = lines.shift(); continuation = lines.join('\n');
    }
    if (label.includes('\n')) return fail('keep each choice on one line');
    if (!task || !label.trim() || md.parseInline(label, env)[0].children?.some(t => ['link_open', 'image', 'html_inline'].includes(t.type)))
      return fail('use - [ ] choices and one - [x] answer; choices cannot contain links or HTML');
    choices.push({ correct: task === 'done', label }); i += 5;
  }
  if (tokens[i]?.type !== 'bullet_list_close' || choices.length < 2 || choices.filter(c => c.correct).length !== 1)
    return fail('needs at least two choices and exactly one - [x] answer');
  const explanation = tokens.slice(i + 1);
  if (explanation.some(t => t.type === 'heading_open')) return fail('use one question per quiz');
  const answer = choices.find(c => c.correct);
  return `<div class="quiz"><h3>${md.renderInline(tokens[1].content)}</h3><ul class="quiz-choices">${choices.map(c => `<li data-correct="${c.correct}">${md.renderInline(c.label)}</li>`).join('')}</ul><div class="quiz-answer"><p><strong>Answer:</strong> ${md.renderInline(answer.label)}</p>${continuation ? compile(md.parse(continuation, env), env) : ''}${compile(explanation, env)}</div></div>`;
}

function compile(tokens, env) {
  let html = '', buffer = [], columns = false;
  const flush = () => { html += md.renderer.render(buffer, md.options, env); buffer = []; };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'td_container') {
      flush();
      if (!token.content) { html += '<p class="td-error" role="alert">Unexpected ::: closing delimiter</p>'; continue; }
      let depth = 1, end = i + 1;
      for (; end < tokens.length; end++) if (tokens[end].type === 'td_container') { depth += tokens[end].content ? 1 : -1; if (!depth) break; }
      if (depth) { html += `<p class="td-error" role="alert">Unclosed container at line ${(token.map?.[0] || 0) + 1}</p>`; }
      const body = tokens.slice(i + 1, end);
      try {
        if (/^endpoint(?:\s|$)/.test(token.content)) { html += endpoint(token.content, body, env); i = end; continue; }
        const { name, options, classes } = directive(token.content);
        if (name === 'flow' || name === 'stack') { html += flowStack(name, body, options, classes, env); }
        else if (name === 'hotspots') {
          try { html += hotspotMarkup(body, options, classes, { inline: ts => md.renderer.renderInline(ts, md.options, env), escape }); }
          catch (error) { html += `<p class="td-error" role="alert">hotspots: ${escape(error.message)}</p>` + compile(body, env); }
        }
        else if (name === 'compare') {
          const images = [];
          let invalid = Object.keys(options).length || classes.length;
          for (const t of body) {
            if (t.type === 'inline') for (const [index, child] of (t.children || []).entries()) {
              // The figure core rule adds a title caption; regenerate the comparison captions below.
              if (child.type === 'html_inline' && index === 1 && t.children[0].type === 'image' && t.children[0].attrGet('title') && child.content === `<figcaption>${md.renderInline(t.children[0].attrGet('title'))}</figcaption>`) continue;
              if (child.type === 'image' && child.content.trim() && !embed(child.attrGet('src'), child.content)) images.push(child);
              else if (!['softbreak', 'hardbreak'].includes(child.type) && !(child.type === 'text' && !child.content.trim())) invalid = true;
            }
            else if (!['paragraph_open', 'paragraph_close'].includes(t.type)) invalid = true;
          }
          if (invalid || images.length !== 2) html += '<p class="td-error" role="alert">Compare needs exactly two Markdown images with alt text, before then after; it takes no options.</p>' + compile(body, env);
          else html += '<div class="compare">' + images.map(t => '<figure>' + md.renderer.renderInline([t], md.options, env) + '<figcaption>' + (t.attrGet('title') ? md.renderInline(t.attrGet('title')) : escape(t.content)) + '</figcaption></figure>').join('') + '</div>';
        }
        else if (name === 'quadrant') {
          try { html += quadrant(body, options, classes); }
          catch (error) { html += `<p class="td-error" role="alert">${escape(error.message)}</p>` + compile(body, env); }
        }
        else if (name === 'chat') { html += chatTranscript(body, { options, classes, escape, render: ts => compile(ts, env), renderInline: ts => md.renderer.renderInline(ts, md.options, env) }); }
        else if (name === 'glossary') {
          const source = body.filter(t => t.type === 'inline').map(t => t.content).join('\n');
          try {
            if (Object.keys(options).length || classes.length || body.some(t => !['paragraph_open', 'paragraph_close', 'inline'].includes(t.type))) throw new Error('use plain Term: Definition lines, without options');
            const entries = parseGlossary(source);
            html += '<dl class="w-glossary">' + entries.map(([term, definition]) => `<dt>${escape(term)}</dt><dd>${escape(definition)}</dd>`).join('') + '</dl>';
          } catch (error) { html += `<p class="td-error" role="alert">Glossary: ${escape(error.message)}</p>` + compile(body, env); }
        }
        else if (name === 'references') {
          try {
            if (Object.keys(options).length || classes.length || body.some(t => !['bullet_list_open', 'bullet_list_close', 'list_item_open', 'list_item_close', 'paragraph_open', 'paragraph_close', 'inline'].includes(t.type)) || body.filter(t => t.type === 'bullet_list_open').length > 1) throw new Error('use one flat list of "- key: Reference" items, without options');
            const entries = parseReferences(body.filter(t => t.type === 'inline').map(t => t.content));
            html += '<ol class="w-references">' + entries.map(([key, text]) => `<li data-key="${escape(key)}">${md.renderInline(text.replace(/(^|\s)(https?:\/\/[^\s<>]*[^\s<>.,;:)])/g, '$1<$2>'), env)}</li>`).join('') + '</ol>';
          } catch (error) { html += `<p class="td-error" role="alert">References: ${escape(error.message)}</p>` + compile(body, env); }
        }
        else if (name === 'explorable') { html += explorable(body, options, classes, md, escape, env); }
        else if (name === 'quiz') { html += quiz(body, options, classes, env); }
        else if (name === 'timer') {
          const duration = classes.length === 1 && !Object.keys(options).length && timerDuration(classes[0]);
          const content = compile(body, env);
          html += duration
            ? `<div class="timer" data-duration="${duration}"><p class="w-timer-duration">Duration: ${timerLabel(duration)}</p><div class="w-timer-body">${content}</div></div>`
            : '<p class="td-error" role="alert">timer: use a duration such as 10m or 1h30m (1 second to 24 hours), with no options.</p>' + content;
        }
        else if (name === 'ask') { html += audienceAsk(body, options, classes, env); }
        else if (name === 'meter') {
          const content = compile(body, env);
          try {
            const { value, max } = meterValue(options);
            if (classes.length || content.trim()) throw new Error('meter: use options on an empty container.');
            const label = escape(options.label), unit = escape(options.unit || '');
            html += `<div class="w w-meter" data-value="${value}" data-max="${max}" data-precision="${(options.value.split('.')[1] || '').length}" data-suffix="${unit}"><div class="w-meter-heading"><span>${label}</span><strong aria-hidden="true">${value}${unit}</strong></div><div class="w-meter-track" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${value}" aria-valuetext="${value}${unit}"><span style="width:${value / max * 100}%"></span></div></div>`;
          } catch (error) { html += `<p class="td-error" role="alert">${escape(error.message)}</p><p>${escape(token.content)}</p>${content}`; }
        }
        else if (name === 'prompt') { html += promptPair(body, options, classes, part => compile(part, env)); }
        else if (name === 'versus') { html += versus(body, options, classes, part => compile(part, env)); }
        else if (name === 'changelog') {
          try { html += changelogHTML(body, ts => compile(ts, env), options, classes); }
          catch (error) { html += `<p class="td-error" role="alert">changelog: ${escape(error.message)}</p>` + compile(body, env); }
        }
        else if (name === 'live') { html += liveCode(body, options, classes, env); }
        else if (name === 'links') { html += linkCards(body, options, classes, env); }
        else if (['notes', 'say', 'read'].includes(name) && env.collectNotes) {
          const content = compile(body, { ...env, collectNotes: false });
          if (name !== 'read') env.notes.push(content); if (name !== 'say') env.article.push(content);
        } else {
          if (name === 'gallery') {
            const images = body.filter(t => t.type === 'inline');
            const valid = !Object.keys(options).length && images.length && body.every(t =>
              ['paragraph_open', 'paragraph_close'].includes(t.type) || t.type === 'inline' && t.children.every((c, j) =>
                (['image', 'softbreak', 'hardbreak'].includes(c.type) && (c.type !== 'image' || !embed(c.attrGet('src'), c.content))) ||
                (c.type === 'html_inline' && j === 1 && t.children.length === 2 && t.children[0].type === 'image' && t.children[0].attrGet('title'))));
            if (!valid) {
              html += '<p class="td-error" role="alert">Gallery needs Markdown images and takes no options.</p>' + compile(body, env);
              i = end; continue;
            }
          }
          if (name === 'board') {
            let columns = 0, invalid = Object.keys(options).length || classes.length;
            for (let j = 0; j < body.length;) {
              const t = body[j];
              if (t.type === 'heading_open' && t.tag === 'h3') {
                invalid ||= !body[j + 1]?.content.trim(); columns++; j += 3;
              } else if (columns && /^(bullet|ordered)_list_open$/.test(t.type)) {
                let depth = 1; j++;
                while (j < body.length && depth) {
                  if (/^(bullet|ordered)_list_open$/.test(body[j].type)) depth++;
                  if (/^(bullet|ordered)_list_close$/.test(body[j].type)) depth--;
                  j++;
                }
              } else { invalid = true; break; }
            }
            if (!columns || invalid) {
              html += '<p class="td-error" role="alert">Board needs ### column headings and lists of cards; it takes no options.</p>' + compile(body, env);
              i = end; continue;
            }
          }
          const attrs = Object.entries(options).map(([k, v]) => ` data-${k}="${escape(v)}"`).join('');
          const content = compile(body, env);
          html += ['browser', 'window', 'phone'].includes(name)
            ? deviceFrame(name, options, classes, content)
            : `<div class="${escape([name, ...classes].join(' '))}"${attrs}>${content}</div>`;
        }
      } catch (error) { html += `<p class="td-error" role="alert">${escape(error.message)}</p>`; if (/^(?:timer|prompt|versus)(?:\s|$)/.test(token.content)) html += compile(body, env); }
      i = end;
    } else if (token.type === 'td_column') { flush(); html += columns ? '</div><div>' : '<div class="cols"><div>'; columns = true; }
    else if (token.type === 'td_slide') { flush(); html += '<hr>'; }
    else if (token.type === 'td_math') {
      flush();
      if (/^\{steps\}(?:\s|$)/.test(token.content)) {
        const source = token.content.replace(/^\{steps\}\s*/, '');
        try {
          const rows = derivation(source);
          html += '<div class="w w-derive"><div class="w-derive-scroll" tabindex="0" role="region" aria-label="Equation derivation"><table role="presentation"><tbody>' + rows.map(row => '<tr>' + row.map(cell => `<td><span class="math">${escape(cell)}</span></td>`).join('') + '</tr>').join('') + '</tbody></table></div></div>';
        } catch (error) {
          html += `<p class="td-error" role="alert">${escape(error.message)}</p><pre>${escape(source)}</pre>`;
        }
      } else html += `<div class="math math-block">${escape(token.content)}</div>`;
    }
    else if (token.type === 'td_foot') {
      const foot = `<p><sup>${escape(token.meta.id)}</sup> ${md.renderInline(token.content)}</p>`;
      if (env.collectNotes) env.feet.push(foot); else { flush(); html += foot; }
    }
    else buffer.push(token);
  }
  flush(); if (columns) html += '</div></div>'; return html;
}
export const renderInline = text => md.renderInline(text);
export function renderMarkdown(text, env = {}) { return compile(md.parse(text, env), env); }
export function slideChunks(text) {
  const lines = text.split('\n'), boundaries = [], all = []; let depth = 0;
  for (const token of md.parse(text, {})) {
    if (token.type === 'td_container') depth = Math.max(0, depth + (token.content ? 1 : -1));
    if (token.type === 'td_slide') { all.push(token.map[0]); if (!depth) boundaries.push(token.map[0]); }
  }
  // An unclosed ::: must not swallow every later slide: fall back to splitting on every ---.
  if (depth) boundaries.splice(0, boundaries.length, ...all);
  const out = []; let start = 0;
  for (const line of boundaries) { out.push(lines.slice(start, line)); start = line + 1; }
  out.push(lines.slice(start)); return out;
}
