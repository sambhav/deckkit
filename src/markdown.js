import MarkdownIt from 'markdown-it';

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

// Talkdown's small inline additions sit on top of the standard Markdown lexer.
md.inline.ruler.before('emphasis', 'talkdown_inline', (state, silent) => {
  const text = state.src.slice(state.pos); let match, html, used;
  if ((match = text.match(/^\[\^([\w-]+)\]/))) html = `<sup class="fn">${escape(match[1])}</sup>`;
  else if ((match = text.match(/^:([a-z][a-z0-9]*(?:-[a-z0-9]+)*):/))) html = `<i class="ico" data-icon="${match[1]}" aria-hidden="true"></i>`;
  else if ((match = text.match(/^==(?=\S)(.+?)==/))) html = `<mark>${md.renderInline(match[1])}</mark>`;
  else if ((match = text.match(/^\$(?=[^\s$])([^$\n]*?\S)\$(?![\w$])/))) html = `<span class="math">${escape(match[1])}</span>`;
  else return false;
  used = match[0].length;
  if (!silent) { const token = state.push('html_inline', '', 0); token.content = html; }
  state.pos += used; return true;
});

const attrPattern = /\s*\{((?:[.#][\w-]+\s*)+)\}\s*$/;
md.core.ruler.before('inline', 'talkdown_attributes', state => {
  for (let i = 0; i < state.tokens.length; i++) {
    const token = state.tokens[i]; if (token.type !== 'inline') continue;
    const task = token.content.match(/^\[([ xX])\]\s+/);
    if (task && state.tokens[i - 1]?.hidden) {
      const li = state.tokens.slice(0, i).findLast(t => t.type === 'list_item_open');
      li?.attrSet('data-task', task[1] === ' ' ? 'todo' : 'done'); token.content = token.content.slice(task[0].length);
    }
    const match = token.content.match(attrPattern); if (!match) continue;
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
    if (fence.type !== 'fence' || !/\{\s*annotate\s*\}/.test(fence.info) || /^(terminal|cast|asciicast|mermaid)$/.test(lang)) continue;
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
md.renderer.rules.fence = (tokens, i) => {
  const token = tokens[i], info = token.info.trim(), lang = info.match(/^[\w+-]+/)?.[0] || '';
  const source = token.content.replace(/\n$/, ''), code = escape(source);
  if (lang === 'diff') return diff(source, info);
  if (lang === 'http') return httpExchange(source, info);
  if (/^(cast|asciicast)$/.test(lang)) return `<div class="w-term w-cast" data-inline="${code}"></div>`;
  if (lang === 'terminal') return `<div class="w-term" data-lines="${escape(JSON.stringify(source ? source.split('\n') : []))}"></div>`;
  const diagram = `<div class="w-diagram"><pre class="code w-diagram-src">${code}</pre></div>`;
  if (lang === 'mermaid') return /\{\s*source\s*\}/.test(info) ? `<div class="w-with-source"><pre class="code"><code>${code}</code></pre>${diagram}</div>` : diagram;
  const pins = token.meta?.pins, steps = !pins && info.match(/\{\s*steps:\s*([^}]*)\}/)?.[1];
  return `<pre class="code"${lang ? ` data-lang="${lang}"` : ''}${steps ? ` data-steps="${escape(steps)}"` : ''}${pins ? ` data-pins="${pins.join(',')}"` : ''}><code>${code}</code></pre>`;
};
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
        else if (name === 'links') { html += linkCards(body, options, classes, env); }
        else if (['notes', 'say', 'read'].includes(name) && env.collectNotes) {
          const content = compile(body, { ...env, collectNotes: false });
          if (name !== 'read') env.notes.push(content); if (name !== 'say') env.article.push(content);
        } else {
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
      } catch (error) { html += `<p class="td-error" role="alert">${escape(error.message)}</p>`; }
      i = end;
    } else if (token.type === 'td_column') { flush(); html += columns ? '</div><div>' : '<div class="cols"><div>'; columns = true; }
    else if (token.type === 'td_slide') { flush(); html += '<hr>'; }
    else if (token.type === 'td_math') { flush(); html += `<div class="math math-block">${escape(token.content)}</div>`; }
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
