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
md.renderer.rules.fence = (tokens, i) => {
  const token = tokens[i], info = token.info.trim(), lang = info.match(/^[\w+-]+/)?.[0] || '';
  const source = token.content.replace(/\n$/, ''), code = escape(source);
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
        const { name, options, classes } = directive(token.content);
        if (['notes', 'say', 'read'].includes(name) && env.collectNotes) {
          const content = compile(body, { ...env, collectNotes: false });
          if (name !== 'read') env.notes.push(content); if (name !== 'say') env.article.push(content);
        } else {
          const attrs = Object.entries(options).map(([k, v]) => ` data-${k}="${escape(v)}"`).join('');
          html += `<div class="${escape([name, ...classes].join(' '))}"${attrs}>${compile(body, env)}</div>`;
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
