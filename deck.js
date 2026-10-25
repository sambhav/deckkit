/* deckkit — slide decks written in Markdown (or HTML), presented on a 16:9 stage, read like an article on a phone.
 *
 * Present view                               Read view (default on phones and portrait tablets, R to switch)
 *   ← → Space PgUp PgDn   slides               one scrolling column; speaker notes become the prose,
 *   ↑ ↓ Enter             steps, then slides   builds show finished, fixed-layout slides become figures
 *   1–9                   jump to a step       ← → hop between slides
 *   swipe                 next / previous
 *   Home End · O overview · N notes · T light / dark · R read / present · F fullscreen · ? keys · Esc close
 *
 * Themes: <html data-theme="rose">, 23 of them, each with a light and a dark mode and its own typefaces (fetched for the
 * active theme; <html data-fonts="off"> keeps system fonts). <html data-theme-picker> adds a picker to the top bar.
 *
 * Steps. A slide's steps come from its steppers, run in document order (↓ advances the first unfinished one):
 *   Deck.steps(el, n, show, {read})   show(i) renders step i (0 = initial); read: 'end' shows the last step in read view
 *   Deck.tabs(container, onPick)      each button in the container is a step; clicking selects it
 *   <div data-build> … data-step="1"  reveal [data-step] children in order (.shown / .current)
 *   <button data-next>                advance the slide's steps; wraps to the start at the end
 * Entering a slide resets its steps; coming back from the next slide shows them finished. Hash: #slide, #slide.step or #id.
 *
 * Markdown widgets (each is a stepper, and reads as plain content in read view):
 *   ::: tabs / ::: toggle / ::: steps   ### headings start panes
 *   a table then {.explain}             the last column becomes the detail for the selected row; ✓ ◐ ✗ cells are coloured
 *   ```lang {steps: 2 | 3-4}            highlight those lines, one group per step (code is syntax-highlighted by highlight.js,
 *                                       fetched only if the deck has code; <html data-highlight="off"> to skip it)
 *   ::: flip                            ### front, the rest is the back
 *   ::: timeline                        ### milestones; ↓ walks them; vertical on phones and in read view
 *   ::: stats                           big numbers: "- **42%** faster first response"
 *   > [!NOTE] / [!TIP] / [!WARNING]     callouts
 *   ```mermaid                          diagrams (Mermaid, fetched only if the deck has one; <html data-diagrams="off"> to skip);
 *                                       ```mermaid {source} sets the source beside the diagram
 *   [text](#id)                         link to the slide whose frontmatter says id: …
 */
(() => {
  const W = 1280, H = 720;
  const $ = id => document.getElementById(id);
  const root = document.documentElement;
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem('deckkit:' + k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('deckkit:' + k, JSON.stringify(v)); } catch {} },
  };

  /* ---------- theme + view, set before first paint ---------- */
  const q = new URLSearchParams(location.search);
  const portrait = matchMedia('(orientation: portrait) and (max-width: 900px)');   // present view becomes slide-over-notes
  const small = matchMedia('(max-width: 760px), (max-height: 520px) and (pointer: coarse), (orientation: portrait) and (pointer: coarse)');
  // data-mode: light or dark (the viewer's choice, remembered). data-theme: the look, set by the author.
  // ?theme=light|dark is still read as a mode, for old links.
  const qTheme = q.get('theme'), qMode = q.get('mode') || (/^(light|dark)$/.test(qTheme) ? qTheme : null);
  root.dataset.mode = qMode || store.get('mode', store.get('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const picker = root.hasAttribute('data-theme-picker');
  const qLook = qTheme && !/^(light|dark)$/.test(qTheme) ? qTheme : null;
  const chosen = qLook || (picker && store.get('look', null));
  root.dataset.theme = chosen || root.dataset.theme || 'paper';

  // each theme's typefaces, fetched from Google Fonts for the active theme only (<html data-fonts="off"> skips this)
  const GF = 'https://fonts.googleapis.com/css2?display=swap&family=';
  const FONTS = {
    paper: 'Inter:opsz,wght@14..32,400..700&family=JetBrains+Mono:wght@400;500',
    rose: 'Fraunces:opsz,wght@9..144,400..700&family=DM+Sans:opsz,wght@9..40,400..700&family=DM+Mono:wght@400;500',
    sunset: 'Outfit:wght@400..700&family=JetBrains+Mono:wght@400;500',
    solar: 'IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500',
    forest: 'Lora:wght@400..700&family=Source+Sans+3:wght@400..700&family=Source+Code+Pro:wght@400;500',
    ocean: 'Manrope:wght@400..800&family=JetBrains+Mono:wght@400;500',
    nord: 'Rubik:wght@400..700&family=Fira+Code:wght@400;500',
    slate: 'Geist:wght@400..700&family=Geist+Mono:wght@400;500',
    ai: 'Sora:wght@400..700&family=Inter:opsz,wght@14..32,400..700&family=JetBrains+Mono:wght@400;500',
    noir: 'Archivo:wght@400..800&family=JetBrains+Mono:wght@400;500',
    editorial: 'Newsreader:opsz,wght@6..72,400..700&family=IBM+Plex+Mono:wght@400;500',
    punk: 'Anton&family=Space+Grotesk:wght@400..700&family=Space+Mono:wght@400;700',
    terminal: 'JetBrains+Mono:wght@400..700',
    swiss: 'Inter+Tight:wght@400..800&family=Inter:opsz,wght@14..32,400..700&family=JetBrains+Mono:wght@400;500',
    ledger: 'Source+Serif+4:opsz,wght@8..60,400..700&family=Inter:opsz,wght@14..32,400..700&family=JetBrains+Mono:wght@400;500',
    clinic: 'Nunito+Sans:opsz,wght@6..12,400..800&family=JetBrains+Mono:wght@400;500',
    chalk: 'Fredoka:wght@400..700&family=Nunito:wght@400..800&family=JetBrains+Mono:wght@400;500',
    mocha: 'DM+Serif+Display&family=DM+Sans:opsz,wght@9..40,400..700&family=DM+Mono:wght@400;500',
    atelier: 'Cormorant+Garamond:wght@400..700&family=Jost:wght@400..700&family=JetBrains+Mono:wght@400;500',
    volt: 'Big+Shoulders+Display:wght@600..900&family=Barlow:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500',
    blueprint: 'Barlow+Semi+Condensed:wght@400;500;600;700&family=Barlow:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500',
    synth: 'Chakra+Petch:wght@400;500;600;700&family=Space+Grotesk:wght@400..700&family=Space+Mono:wght@400;700',
  };
  FONTS.clean = FONTS.paper;
  const fontsLoaded = new Set();
  function loadFonts() {
    const t = root.dataset.theme;
    if (root.dataset.fonts === 'off' || fontsLoaded.has(t) || !FONTS[t]) return;
    fontsLoaded.add(t);
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = GF + FONTS[t];
    document.head.append(l);
  }
  loadFonts();
  new MutationObserver(loadFonts).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  root.dataset.view = q.get('view') || (small.matches ? 'read' : 'present');
  let viewChosen = q.has('view');
  const reading = () => root.dataset.view === 'read';

  /* ================= Markdown ================= */
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const qesc = s => s.replace(/"/g, '&quot;');
  const indent = l => l.match(/^\s*/)[0].length;
  const dedent = L => { const n = Math.min(...L.filter(l => l.trim()).map(indent)); return isFinite(n) ? L.map(l => l.slice(n)) : L; };
  const LI = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
  const FENCE = /^(`{3,}|~{3,})/;
  const pad2 = n => String(n).padStart(2, '0');
  const isStart = l => /^(#{1,6}\s|`{3}|~{3}|:::|>|([-*+]|\d+[.)])\s|<[a-zA-Z!/]|!\[)/.test(l.trimStart());

  // trailing {.class #id} on a heading, paragraph, list item or image
  function attrs(t) {
    const m = t.match(/\s*\{((?:[.#][\w-]+\s*)+)\}\s*$/);
    if (!m) return [t, ''];
    const cls = [...m[1].matchAll(/\.([\w-]+)/g)].map(x => x[1]), id = m[1].match(/#([\w-]+)/)?.[1];
    return [t.slice(0, m.index), (cls.length ? ` class="${cls.join(' ')}"` : '') + (id ? ` id="${id}"` : '')];
  }

  function inline(s) {
    const keep = [], hold = h => `\u0001${keep.push(h) - 1}\u0002`;
    s = s.replace(/`([^`]+)`/g, (_, c) => hold(`<code>${esc(c)}</code>`))
         .replace(/<\/?[a-zA-Z][^>]*>|&(?:[a-zA-Z]+|#\d+);/g, hold);         // inline HTML and entities pass through
    s = esc(s)
         .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, a, u) => hold(`<img src="${u}" alt="${qesc(a)}">`))
         .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => hold(`<a href="${u}"${/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : ''}>`) + t + hold('</a>'))
         .replace(/\*\*(?=\S)(.+?)\*\*/g, '<strong>$1</strong>')
         .replace(/==(?=\S)(.+?)==/g, '<mark>$1</mark>')
         .replace(/~~(?=\S)(.+?)~~/g, '<del>$1</del>')
         .replace(/(^|[^\w*])\*(?=\S)(.+?)\*(?!\w)/g, '$1<em>$2</em>')
         .replace(/(^|\W)_(?=\S)(.+?)_(?!\w)/g, '$1<em>$2</em>')
         .replace(/\\\n/g, '<br>')
         // typographer's quotes, ellipses and dashes
         .replace(/(^|[\s([{—–])"/g, '$1“').replace(/"/g, '”')
         .replace(/(^|[\s([{—–])'/g, '$1‘').replace(/'/g, '’')
         .replace(/\.\.\./g, '…').replace(/ -- /g, ' – ').replace(/---/g, '—');
    while (/\u0001\d+\u0002/.test(s)) s = s.replace(/\u0001(\d+)\u0002/g, (_, i) => keep[i]);
    return s;
  }

  function list(L, i) {
    const first = L[i].match(LI), base = first[1].length, tag = /\d/.test(first[2]) ? 'ol' : 'ul', items = [];
    while (i < L.length) {
      const l = L[i], m = l.match(LI);
      if (m && m[1].length === base) { items.push([m[3]]); i++; }
      else if (!l.trim()) {
        const nx = L.slice(i).find(x => x.trim());
        if (nx && (indent(nx) > base || nx.match(LI)?.[1].length === base)) { items.at(-1).push(''); i++; } else break;
      }
      else if (indent(l) > base || !isStart(l)) { items.at(-1).push(l); i++; }
      else break;
    }
    const lis = items.map(lines => {
      let k = 1; while (k < lines.length && lines[k].trim() && !isStart(lines[k])) k++;
      const [t, a] = attrs(lines.slice(0, k).map(s => s.trim()).join('\n'));
      return `<li${a}>${inline(t)}${blocks(dedent(lines.slice(k)))}</li>`;
    });
    return [i, `<${tag}>${lis.join('')}</${tag}>`];
  }

  function blocks(L) {
    let out = '', i = 0, m;
    while (i < L.length) {
      const l = L[i];
      if (!l.trim()) { i++; continue; }
      if ((m = l.match(/^(`{3,}|~{3,})\s*([\w+-]*)\s*(?:\{\s*steps:\s*([^}]*)\})?\s*(\{\s*source\s*\})?/))) {
        const body = []; i++;
        while (i < L.length && !L[i].startsWith(m[1])) body.push(L[i++]);
        i++;
        const src = esc(body.join('\n')), diagram = `<div class="w-diagram"><pre class="code w-diagram-src">${src}</pre></div>`;
        out += m[2] === 'mermaid' && m[4] ? `<div class="w-with-source"><pre class="code"><code>${src}</code></pre>${diagram}</div>`   // {source}: the text beside its diagram
          : m[2] === 'mermaid' ? diagram
          : `<pre class="code"${m[2] ? ` data-lang="${m[2]}"` : ''}${m[3] ? ` data-steps="${qesc(m[3])}"` : ''}><code>${esc(body.join('\n'))}</code></pre>`;
      } else if ((m = l.match(/^:::\s*(.+)$/))) {
        const body = []; let depth = 1; i++;
        for (; i < L.length; i++) { if (/^:::\s*\S/.test(L[i])) depth++; else if (/^:::\s*$/.test(L[i]) && !--depth) break; body.push(L[i]); }
        i++;
        out += `<div class="${qesc(m[1].trim())}">${blocks(body)}</div>`;
      } else if ((m = l.match(/^(#{1,6})\s+(.*)$/))) {
        const [t, a] = attrs(m[2]); out += `<h${m[1].length}${a}>${inline(t)}</h${m[1].length}>`; i++;
      } else if (/^>/.test(l)) {
        const body = []; while (i < L.length && /^>/.test(L[i])) body.push(L[i++].replace(/^>\s?/, ''));
        out += `<blockquote>${blocks(body)}</blockquote>`;
      } else if (LI.test(l)) {
        let html; [i, html] = list(L, i); out += html;
      } else if (/^\s*\|.*\|\s*$/.test(l) && /^\s*\|?\s*:?-{2,}/.test(L[i + 1] || '')) {
        const cells = r => r.trim().replace(/^\||(?<!\\)\|$/g, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
        const head = cells(l), al = cells(L[i + 1]).map(c => /^:-+:$/.test(c) ? 'center' : /-:$/.test(c) ? 'right' : '');
        const td = (tg, c, j) => `<${tg}${al[j] ? ` style="text-align:${al[j]}"` : ''}>${inline(c)}</${tg}>`;
        const rows = []; i += 2; while (i < L.length && /^\s*\|/.test(L[i])) rows.push(cells(L[i++]));
        out += `<table><thead><tr>${head.map((c, j) => td('th', c, j)).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, j) => td('td', c, j)).join('')}</tr>`).join('')}</tbody></table>`;
      } else if ((m = l.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*(\{[^}]*\})?\s*$/))) {
        const [, a] = attrs(l);
        out += `<figure${a}><img src="${m[2]}" alt="${qesc(m[1])}">${m[3] ? `<figcaption>${inline(m[3])}</figcaption>` : ''}</figure>`; i++;
      } else if (/^<[a-zA-Z!/]/.test(l)) {
        const body = []; while (i < L.length && L[i].trim()) body.push(L[i++]);
        out += body.join('\n');
      } else {
        const body = [l]; i++;
        while (i < L.length && L[i].trim() && !isStart(L[i])) body.push(L[i++]);
        const [t, a] = attrs(body.join('\n')); out += `<p${a}>${inline(t)}</p>`;
      }
    }
    return out;
  }

  /* a Markdown deck: slides split by ---; a chunk of only `key: value` lines is the next slide's frontmatter */
  const META = /^(section|name|layout|kicker|build|class|takeaway|id):\s*(.*)$/;
  // split lines on a separator line, ignoring separators inside fenced code
  function split(L, sep) {
    const out = [[]]; let fence = null;
    for (const l of L) {
      const f = l.match(FENCE);
      if (f) fence = fence ? (l.startsWith(fence) ? null : fence) : f[1];
      !fence && sep.test(l) ? out.push([]) : out.at(-1).push(l);
    }
    return out;
  }
  let section = '', part = 0;
  function mdSlides(src) {
    // a deck can't contain a literal closing script tag, so it writes <\/script> and we restore it here
    const chunks = split(dedent(src.replace(/\r/g, '').replace(/<\\\/script/gi, '</script').split('\n')), /^---\s*$/);
    const out = []; let meta = {};
    for (const c of chunks) {
      const filled = c.filter(l => l.trim());
      if (!filled.length) continue;
      if (filled.every(l => META.test(l))) { for (const l of filled) { const [, k, v] = l.match(META); meta[k] = v.trim(); } continue; }
      out.push(mdSlide(c, meta)); meta = {};
    }
    return out;
  }

  function mdSlide(L, meta) {
    const notes = [];
    // speaker notes are the HTML comments outside fenced code
    L = L.join('\n').split(/(^(?:`{3,}|~{3,})[^\n]*\n[\s\S]*?^(?:`{3,}|~{3,})\s*$|`[^`\n]+`)/m)
      .map((part, j) => j % 2 ? part : part.replace(/<!--([\s\S]*?)-->/g, (_, n) => (notes.push(n.trim()), ''))).join('').split('\n');
    const layout = meta.layout || 'default';
    const cols = split(L, /^\|\|\|\s*$/);
    // text before the first ||| spans the slide; each ||| starts a column
    const body = blocks(cols[0]) + (cols.length > 1 ? `<div class="cols">${cols.slice(1).map(c => `<div>${blocks(c)}</div>`).join('')}</div>` : '');
    const el = document.createElement('section');
    el.className = `slide md layout-${layout} ${meta.class || ''}`.trim();
    el.innerHTML = `<div class="content">${layout === 'section' ? `<div class="num">Part ${pad2(++part)}</div>` : ''}`
      + `${meta.kicker ? `<div class="kicker">${inline(meta.kicker)}</div>` : ''}${body}</div>`
      + (notes.length ? `<aside class="notes">${blocks(notes.join('\n\n').split('\n'))}</aside>` : '');
    const heading = el.querySelector('h1, h2, h3')?.textContent.trim() || '';
    section = meta.section ?? (layout === 'section' ? heading : section);
    Object.assign(el.dataset, { section, name: meta.name || heading });
    if (meta.takeaway) el.dataset.takeaway = meta.takeaway;
    if (meta.id) el.dataset.id = meta.id;
    const c = el.firstChild;
    widgets(c);
    if (meta.build && meta.build !== 'false') {
      // every block after the title builds in; lists build item by item
      const kids = [...c.querySelectorAll(':scope > *, :scope > .cols > div > *')].filter(k => !k.matches('.kicker, .num, .cols, h1, h2'));
      kids.forEach(k => (k.matches('ul, ol') ? [...k.children] : [k]).forEach(x => x.classList.add('step')));
    }
    const marked = c.querySelectorAll('.step');
    if (marked.length) { c.setAttribute('data-build', ''); marked.forEach((s, i) => s.dataset.step ??= i + 1); }
    return el;
  }

  /* ================= widgets, built from Markdown ================= */
  // Each one is a stepper (↑ ↓ walk it), and each degrades to plain, readable content in read view.
  function widgets(c) {
    // a line holding only {.class} applies to the block above it, e.g. a table
    c.querySelectorAll('p').forEach(p => { if (!p.textContent.trim() && !p.children.length && p.className && p.previousElementSibling) { p.previousElementSibling.classList.add(...p.classList); p.remove(); } });
    c.querySelectorAll('.tabs, .toggle, .steps').forEach(panes);
    c.querySelectorAll('.timeline').forEach(timeline);
    c.querySelectorAll('.stats').forEach(stats);
    c.querySelectorAll('blockquote').forEach(callout);
    c.querySelectorAll('table.explain').forEach(explain);
    c.querySelectorAll('td, th').forEach(marks);
    c.querySelectorAll('pre[data-steps]').forEach(codeSteps);
    c.querySelectorAll('.flip').forEach(flip);
  }

  // ::: tabs / ::: toggle / ::: steps — each ### heading starts a pane
  function panes(box) {
    const kind = ['tabs', 'toggle', 'steps'].find(k => box.classList.contains(k));
    const groups = [];
    for (const ch of [...box.children]) { if (ch.tagName === 'H3' || !groups.length) groups.push([]); groups.at(-1).push(ch); }
    const titles = groups.map(g => g[0].tagName === 'H3' ? g[0].innerHTML : '');
    const w = document.createElement('div');
    w.className = `w w-${kind} ${[...box.classList].filter(k => k !== kind).join(' ')}`.trim();
    w.innerHTML = (kind === 'steps'
      ? `<div class="w-head"><span class="w-count"></span><span class="w-dots">${groups.map((_, i) => `<button aria-label="Step ${i + 1}"></button>`).join('')}</span><button class="w-next" data-next></button></div>`
      : `<div class="w-list" role="tablist">${titles.map(t => `<button role="tab">${t}</button>`).join('')}</div>`) + '<div class="w-panes"></div>';
    const holder = w.lastChild;
    for (const g of groups) { const p = document.createElement('section'); p.className = 'w-pane'; p.append(...g); holder.append(p); }
    box.replaceWith(w);
    const pick = [...w.querySelectorAll('[role=tab], .w-dots button')], ps = [...holder.children];
    const st = steps(w, ps.length, i => {
      ps.forEach((p, j) => p.classList.toggle('on', j === i));
      pick.forEach((b, j) => { b.classList.toggle('on', j === i); b.classList.toggle('done', j < i); b.setAttribute('aria-selected', j === i); });
      if (kind === 'steps') w.querySelector('.w-count').textContent = `Step ${i + 1} of ${ps.length}`;
    });
    pick.forEach((b, j) => b.addEventListener('click', () => st.go(j)));
  }

  // a table followed by {.explain}: its last column becomes the detail for the selected row
  function explain(t) {
    const rows = [...(t.tBodies[0]?.rows || [])];
    if (!rows.length) return;
    const name = rows.map(r => r.cells[0].textContent.trim()), why = rows.map(r => r.cells[r.cells.length - 1].innerHTML);
    t.tHead?.rows[0].lastElementChild.remove();
    rows.forEach(r => r.lastElementChild.remove());
    const w = document.createElement('div'); w.className = 'w w-explain';
    t.replaceWith(w); w.append(t);
    w.insertAdjacentHTML('beforeend', `<div class="w-why"><div class="w-why-name"></div><p></p></div>`
      + `<dl class="w-why-all">${rows.map((_, i) => `<dt>${esc(name[i])}</dt><dd>${why[i]}</dd>`).join('')}</dl>`);
    const st = steps(w, rows.length, i => {
      rows.forEach((r, j) => r.classList.toggle('on', j === i));
      w.querySelector('.w-why-name').textContent = name[i];
      w.querySelector('.w-why p').innerHTML = why[i];
    });
    rows.forEach((r, i) => r.addEventListener('click', () => st.go(i)));
  }

  // ✓ ◐ ✗ at the start of a table cell become icons in the theme's colours; a cell holding only a mark is centred
  const MARK = {
    '✓': ['yes', '<path d="M3.5 8.4l3 3 6-6.8"/>'],
    '◐': ['part', '<circle cx="8" cy="8" r="5.6"/><path d="M8 2.4a5.6 5.6 0 0 0 0 11.2z" fill="currentColor"/>'],
    '✗': ['no', '<path d="M4.6 4.6l6.8 6.8M11.4 4.6l-6.8 6.8"/>'],
  };
  function marks(cell) {
    const m = cell.innerHTML.match(/^\s*([✓◐✗])/);
    if (!m) return;
    const [kind, path] = MARK[m[1]];
    cell.innerHTML = cell.innerHTML.replace(m[1], `<b class="mk mk-${kind}" role="img" aria-label="${kind}"><svg viewBox="0 0 16 16" width="1.15em" height="1.15em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${path}</svg></b>`);
    if (!cell.textContent.trim()) cell.classList.add('mk-only');
  }

  // ```lang {steps: 2 | 3-4 | 6} — each step highlights those lines
  const sources = new WeakMap();       // <pre> -> its code as written, for the syntax highlighter
  function codeSteps(pre) {
    const code = pre.firstChild;
    sources.set(pre, code.textContent);
    code.innerHTML = code.innerHTML.split('\n').map(l => `<span class="ln">${l}</span>`).join('');
    const groups = pre.dataset.steps.split('|').map(g => new Set(g.split(',').flatMap(r => { const [a, b = a] = r.trim().split('-').map(Number); return Array.from({ length: b - a + 1 }, (_, k) => a + k); })));
    pre.stepper = steps(pre, groups.length + 1, i => {
      pre.classList.toggle('stepping', i > 0);
      [...code.children].forEach((l, j) => l.classList.toggle('on', i > 0 && groups[i - 1].has(j + 1)));
    });
  }

  /* syntax highlighting: highlight.js, fetched only when the deck has fenced code.
     <html data-highlight="off"> turns it off; data-highlight="/path/highlight.min.js" self-hosts it. */
  const HLJS = 'https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.11.1/highlight.min.js';
  function highlight() {
    const pres = [...document.querySelectorAll('pre.code[data-lang]')], opt = root.dataset.highlight;
    if (!pres.length || opt === 'off') return;
    const run = () => pres.forEach(pre => {
      if (!window.hljs?.getLanguage(pre.dataset.lang)) return;
      const html = hljs.highlight(sources.get(pre) ?? pre.firstChild.textContent, { language: pre.dataset.lang, ignoreIllegals: true }).value;
      pre.firstChild.innerHTML = pre.dataset.steps ? perLine(html) : html;
      pre.stepper?.go(pre.stepper.i, true);
    });
    if (window.hljs) return run();
    const tag = document.createElement('script');
    tag.src = opt || HLJS; tag.onload = run;            // offline or blocked: the code just stays plain
    document.head.append(tag);
  }
  /* diagrams: Mermaid, fetched only when the deck has a ```mermaid block; coloured from the theme and redrawn when it changes.
     <html data-diagrams="off"> leaves the source showing; data-diagrams="/path/mermaid.min.js" self-hosts it. */
  const MERMAID = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
  function diagrams() {
    const boxes = [...document.querySelectorAll('.w-diagram')], opt = root.dataset.diagrams;
    if (!boxes.length || opt === 'off') return;
    boxes.forEach(b => b.dataset.src = b.textContent);
    let n = 0, queued;
    const draw = async () => {
      const v = k => getComputedStyle(root).getPropertyValue(k).trim(), font = v('--sans');
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', fontFamily: font, htmlLabels: false,
        flowchart: { curve: 'basis', padding: 16, htmlLabels: false }, state: { htmlLabels: false }, class: { htmlLabels: false },
        architecture: { iconSize: 56, fontSize: 18 },
        xyChart: { width: 900, height: 420, titleFontSize: 22, xAxis: { labelFontSize: 16 }, yAxis: { labelFontSize: 16, titleFontSize: 16 } },
        themeVariables: { darkMode: root.dataset.mode === 'dark', fontFamily: font, fontSize: '18px', background: v('--bg'),
          pie1: v('--accent'), pie2: v('--muted'), pie3: v('--accent-soft'), pie4: v('--line'), pie5: v('--accent-ink'), pieStrokeColor: v('--bg'), pieOuterStrokeColor: v('--line'),
          pieTitleTextColor: v('--fg'), pieSectionTextColor: v('--fg'), pieLegendTextColor: v('--fg'), pieTitleTextSize: '22px', pieSectionTextSize: '16px', pieLegendTextSize: '16px',
          xyChart: { backgroundColor: 'transparent', titleColor: v('--fg'), xAxisLabelColor: v('--muted'), yAxisLabelColor: v('--muted'), xAxisTitleColor: v('--muted'), yAxisTitleColor: v('--muted'),
                     xAxisLineColor: v('--line'), yAxisLineColor: v('--line'), xAxisTickColor: v('--line'), yAxisTickColor: v('--line'), plotColorPalette: `${v('--accent')}, ${v('--muted')}` },
          primaryColor: v('--surface'), primaryTextColor: v('--fg'), primaryBorderColor: v('--accent'), mainBkg: v('--surface'), nodeBorder: v('--accent'),
          secondaryColor: v('--accent-soft'), secondaryTextColor: v('--fg'), secondaryBorderColor: v('--accent'),
          tertiaryColor: v('--surface-2'), tertiaryTextColor: v('--fg'), tertiaryBorderColor: v('--line'),
          lineColor: v('--muted'), textColor: v('--fg'), clusterBkg: v('--surface-2'), clusterBorder: v('--line'), titleColor: v('--fg'),
          edgeLabelBackground: v('--bg'), noteBkgColor: v('--accent-soft'), noteTextColor: v('--fg'), noteBorderColor: v('--accent'),
          actorBkg: v('--surface'), actorBorder: v('--accent'), actorTextColor: v('--fg'), actorLineColor: v('--muted'), signalColor: v('--muted'), signalTextColor: v('--fg'),
          labelBoxBkgColor: v('--surface'), labelBoxBorderColor: v('--accent'), labelTextColor: v('--fg'), loopTextColor: v('--fg') } });
      for (const b of boxes) {
        try { const { svg } = await mermaid.render(`dk-diagram-${++n}`, b.dataset.src); b.innerHTML = svg; b.classList.add('drawn'); }
        catch { b.innerHTML = `<pre class="code w-diagram-src">${esc(b.dataset.src)}</pre>`; b.classList.remove('drawn'); }
      }
      if (portrait.matches && !reading()) fit();
    };
    const redraw = () => { clearTimeout(queued); queued = setTimeout(draw, 60); };
    // draw once the theme's fonts are in, so labels are measured in the face they're shown in
    const ready = () => {
      (document.fonts?.ready || Promise.resolve()).then(draw);
      document.fonts?.addEventListener('loadingdone', redraw);          // a theme's web font arrived: re-measure in it
      new MutationObserver(() => document.fonts.ready.then(redraw)).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-mode'] });
    };
    if (window.mermaid) return ready();
    const tag = document.createElement('script');
    tag.src = opt || MERMAID; tag.onload = ready;      // offline or blocked: the source stays visible
    document.head.append(tag);
  }

  // split highlighted HTML into line spans, closing and reopening any token that runs across a line break
  function perLine(html) {
    const open = []; let out = '<span class="ln">';
    for (const t of html.split(/(<span[^>]*>|<\/span>|\n)/)) {
      if (t === '\n') out += '</span>'.repeat(open.length) + '</span><span class="ln">' + open.join('');
      else if (t.startsWith('<span')) { open.push(t); out += t; }
      else if (t === '</span>') { open.pop(); out += t; }
      else out += t;
    }
    return out + '</span>'.repeat(open.length) + '</span>';
  }

  // ::: timeline — each ### heading is a milestone; ↓ walks them
  function timeline(box) {
    const items = [];
    for (const ch of [...box.children]) { if (ch.tagName === 'H3' || !items.length) items.push([]); items.at(-1).push(ch); }
    const w = document.createElement('ol'); w.className = 'w w-timeline';
    for (const g of items) { const li = document.createElement('li'); li.append(...g); w.append(li); }
    box.replaceWith(w);
    const lis = [...w.children];
    w.style.setProperty('--n', lis.length);
    const st = steps(w, lis.length, i => lis.forEach((li, j) => { li.classList.toggle('on', j === i); li.classList.toggle('done', j < i); }));
    lis.forEach((li, j) => li.addEventListener('click', () => st.go(j)));
  }

  // ::: stats — each list item or paragraph leads with its number in bold: "**42%** faster first response"
  function stats(box) {
    const src = [...box.querySelectorAll(':scope > ul > li, :scope > ol > li, :scope > p')];
    const w = document.createElement('div'); w.className = 'w w-stats';
    w.innerHTML = src.map(el => {
      const n = el.querySelector('strong'), num = n ? n.innerHTML : '';
      n?.remove();
      return `<div class="w-stat"><div class="w-stat-n">${num}</div><div class="w-stat-l">${el.innerHTML.trim()}</div></div>`;
    }).join('');
    w.style.setProperty('--n', Math.min(4, src.length));
    box.replaceWith(w);
  }

  // > [!NOTE] / [!TIP] / [!WARNING] / [!IMPORTANT] — GitHub-style callouts
  function callout(q) {
    const p = q.querySelector(':scope > p'), m = p?.innerHTML.match(/^\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*(<br>)?/i);
    if (!m) return;
    const kind = m[1].toLowerCase();
    p.innerHTML = p.innerHTML.slice(m[0].length);
    if (!p.textContent.trim()) p.remove();
    q.className = `callout callout-${kind}`;
    q.insertAdjacentHTML('afterbegin', `<div class="callout-label">${kind}</div>`);
  }

  // ::: flip — the ### heading is the front, the rest is the back
  function flip(box) {
    const w = document.createElement('div');
    w.className = `w w-flip ${[...box.classList].filter(k => k !== 'flip').join(' ')}`.trim();
    w.setAttribute('role', 'button'); w.tabIndex = 0;
    w.innerHTML = '<div class="w-face w-front"></div><div class="w-face w-back"></div>';
    const front = box.querySelector(':scope > h3');
    if (front) w.firstChild.append(front);
    w.lastChild.append(...box.childNodes);
    box.replaceWith(w);
    const st = steps(w, 2, i => w.classList.toggle('on', i === 1));
    w.addEventListener('click', () => st.go(st.i ? 0 : 1));
  }

  /* ================= steppers ================= */
  const steppers = new Map();          // slide -> [stepper, …] in registration order
  const handlers = { slide: [], ready: [] };
  const customKeys = {};
  let cur = -1, started = false, all = null;
  const slides = () => all || [...document.querySelectorAll('.slide')];   // fixed once the deck is assembled
  const slide = () => slides()[cur];

  function steps(el, n, show, { read } = {}) {
    const owner = el.closest('.slide');
    const st = {
      n, i: 0, read,
      // quiet: a batch caller (setAt) syncs the chrome once at the end
      go(k, quiet) { st.i = Math.max(0, Math.min(n - 1, k)); show(st.i); if (!quiet && started && owner === slide()) sync(); return st; },
      next() { return st.i < n - 1 && (st.go(st.i + 1), true); },
      prev() { return st.i > 0 && (st.go(st.i - 1), true); },
    };
    if (!steppers.has(owner)) steppers.set(owner, []);
    steppers.get(owner).push(st);
    show(0);
    if (started && reading() && read === 'end') st.go(n - 1);
    return st;
  }

  function tabs(container, onPick) {
    const bs = [...container.querySelectorAll('button')];
    const st = steps(container, bs.length, i => { bs.forEach((b, j) => b.classList.toggle('on', j === i)); onPick?.(i, bs[i]); });
    bs.forEach((b, i) => b.addEventListener('click', () => st.go(i)));
    return st;
  }

  function build(el) {
    const els = [...el.querySelectorAll('[data-step]')];
    const n = Math.max(0, ...els.map(e => +e.dataset.step)) + 1;
    return steps(el, n, i => els.forEach(e => { const s = +e.dataset.step; e.classList.toggle('shown', s <= i); e.classList.toggle('current', s === i); }), { read: 'end' });
  }

  const stepsOf = s => steppers.get(s) || [];
  const at = s => stepsOf(s).reduce((a, st) => a + st.i, 0);
  const total = s => stepsOf(s).reduce((a, st) => a + st.n - 1, 0) + 1;
  const done = s => at(s) >= total(s) - 1;
  function setAt(s, k) { for (const st of stepsOf(s)) { const take = Math.min(k, st.n - 1); st.go(take, true); k -= take; } if (started && s === slide()) sync(); }
  const finishForReading = () => slides().forEach(s => stepsOf(s).forEach(st => st.read === 'end' && st.go(st.n - 1, true)));

  /* ================= navigation ================= */
  // force: re-render the chrome even if the slide hasn't changed (after a view switch, or at startup)
  function go(i, step, force) {
    const list = slides(), from = cur;
    cur = Math.max(0, Math.min(list.length - 1, i));
    const s = list[cur];
    if (reading()) { s.closest('.frame').scrollIntoView({ behavior: force ? 'auto' : 'smooth' }); if (force) announce(); return; }
    if (cur !== from || step != null) setAt(s, step ?? (cur === from - 1 ? Infinity : 0));
    if (cur !== from || force) { list[from]?.classList.remove('active'); s.classList.add('active'); announce(); }
    sync();
  }
  function next() { if (!stepsOf(slide()).some(st => st.next())) go(cur + 1); }
  function prev() { if (![...stepsOf(slide())].reverse().some(st => st.prev())) go(cur - 1); }

  // the current slide changed: update the chrome around it
  let ovCur;
  function announce() {
    const s = slide(), n = slides().length, pct = (cur + 1) / n;
    ovCur?.classList.remove('cur'); ovCur = $('overview').children[cur]; ovCur?.classList.add('cur');
    $('sectionLabel').textContent = $('mSec').textContent = s.dataset.section || '';
    $('count').textContent = $('dCount').textContent = `${cur + 1} / ${n}`;
    $('mProg').style.transform = `scaleX(${pct})`;
    if (!reading()) $('progress').style.transform = `scaleX(${pct})`;
    if ('notes' in root.dataset) fillNotes();
    $('notesTitle').textContent = `SPEAKER NOTES · ${s.dataset.name || ''}`;
    $('notesTk').textContent = s.dataset.takeaway ? 'Takeaway: ' + s.dataset.takeaway : '';
    $('notesBody').textContent = s.querySelector('.notes')?.textContent.trim() || '—';
    handlers.slide.forEach(f => f(s, cur));
    if (reading()) history.replaceState(null, '', '#' + (cur + 1)); else if (portrait.matches) fit();
  }
  const fillNotes = () => { $('mNotes').innerHTML = slide().closest('.frame').querySelector('.prose')?.innerHTML || ''; $('mNotes').scrollTop = 0; };

  const label = s => s.querySelectorAll('[data-next]').forEach(b => b.textContent = done(s) ? 'Reset ↺' : 'Next →');
  function sync() {
    const s = slide(), n = total(s), k = at(s);
    $('stepNav').classList.toggle('on', n > 1);
    $('stepCount').textContent = `step ${k + 1}/${n}`;
    $('up').disabled = k === 0; $('down').disabled = k === n - 1;
    label(s);
    if (!reading()) history.replaceState(null, '', '#' + (cur + 1) + (n > 1 && k ? '.' + (k + 1) : ''));
  }

  /* ================= views ================= */
  function setView(v, chosen = true) {
    if (chosen) viewChosen = true;
    const i = Math.max(cur, 0);
    root.dataset.view = v;
    if (v === 'read') finishForReading();
    fit();
    go(i, v === 'read' ? undefined : 0, true);
    icons();
  }
  const toggleView = () => setView(reading() ? 'present' : 'read');

  // read view: the current slide is the one crossing the top third of the screen
  let frames = [], scrolling = false;
  function onScroll() {
    scrolling = false;
    if (!reading()) return;
    const y = innerHeight * .35;
    let i = frames.findIndex(f => f.getBoundingClientRect().bottom > y);
    if (i < 0) i = frames.length - 1;
    const max = root.scrollHeight - innerHeight;
    $('progress').style.transform = `scaleX(${max > 0 ? scrollY / max : 1})`;
    if (i !== cur) { cur = i; announce(); }
  }

  /* ================= fitting the stage ================= */
  const DOCK_GAP = 24;
  function fit() {
    const st = $('stage');
    st.style.top = st.style.width = st.style.height = '';
    delete root.dataset.tall;
    if (reading()) {
      // fixed slides are scaled to the width of their figures
      st.style.transform = '';
      const fig = document.querySelector('.fig');
      if (fig) root.style.setProperty('--fit', Math.min(1, fig.clientWidth / W));
      return;
    }
    if (!portrait.matches) { st.style.transform = `translate(-50%,-50%) scale(${Math.min(root.clientWidth / W, root.clientHeight / H)})`; return; }
    const s = slide(), head = $('mhead').offsetHeight;
    if (s && tall(s, st, head)) return;
    // a fixed 16:9 slide spans the width under a native header, its own bar tucked behind it
    const k = root.clientWidth / W, bar = $('bar').offsetHeight;
    place(st, head, (H - bar) * k, -bar * k, k);
  }

  // portrait: the slide sits under the header, centred above the dock, or at the top with its notes below
  function place(st, head, h, shift, k) {
    const room = root.clientHeight - head - $('dock').offsetHeight - DOCK_GAP;
    const top = 'notes' in root.dataset ? head : head + Math.max(0, (room - h) / 2);
    st.style.top = `${top + shift}px`;
    st.style.transform = `translateX(-50%) scale(${k})`;
    root.style.setProperty('--slide-bottom', `${top + h}px`);
  }
  function toggleNotes() {
    if (portrait.matches && !reading()) { root.toggleAttribute('data-notes'); $('dNotes').classList.toggle('on', 'notes' in root.dataset); fillNotes(); fit(); }
    else $('notes').classList.toggle('on');
  }

  // portrait phone: slides that can reflow go vertical, as tall as their content.
  // Markdown slides are responsive: laid out at the phone's own width in the article type scale.
  // Hand-built slides are styled in canvas pixels, so they get a 540px canvas scaled to fit (~0.75× on a phone).
  const PW = 540;
  const positioned = new WeakMap();    // slide -> has absolutely positioned content (static, so measured once)
  function tall(s, st, head) {
    const c = s.querySelector('.content');
    if (!c) return false;
    const md = s.classList.contains('md'), w = md ? root.clientWidth : PW, k = root.clientWidth / w;
    const avail = (root.clientHeight - head - $('dock').offsetHeight - DOCK_GAP) / k;
    root.dataset.tall = md ? 'fluid' : 'scaled';
    st.style.width = `${w}px`; st.style.height = `${avail}px`;
    if (!md && s.classList.contains('fixed')) {
      if (!positioned.has(s)) positioned.set(s, [...c.querySelectorAll('*')].some(e => getComputedStyle(e).position === 'absolute'));
      if (positioned.get(s) || c.scrollWidth > c.clientWidth + 1 || c.scrollHeight > c.clientHeight + 1) {
        delete root.dataset.tall; st.style.width = st.style.height = ''; return false;
      }
    }
    c.style.bottom = 'auto'; const need = c.offsetHeight; c.style.bottom = '';
    const h = Math.min(avail, Math.max(need, w * .6));
    st.style.height = `${h}px`;
    place(st, head, h * k, 0, k);
    return true;
  }

  /* ================= chrome ================= */
  const ICON = {
    notes: '<path d="M3.5 4.5h11M3.5 9h11M3.5 13.5h7"/>',
    palette: '<path d="M9 2a7 7 0 1 0 0 14c1 0 1.5-.6 1.5-1.4 0-.5-.3-.8-.3-1.3 0-.7.6-1.3 1.3-1.3h1.6A3 3 0 0 0 16 9c0-3.9-3.1-7-7-7z"/><circle cx="5.6" cy="8.4" r="1" fill="currentColor"/><circle cx="8.2" cy="5.4" r="1" fill="currentColor"/><circle cx="11.6" cy="6.2" r="1" fill="currentColor"/>',
    grid: '<rect x="2.5" y="2.5" width="5" height="5" rx="1"/><rect x="10.5" y="2.5" width="5" height="5" rx="1"/><rect x="2.5" y="10.5" width="5" height="5" rx="1"/><rect x="10.5" y="10.5" width="5" height="5" rx="1"/>',
    read: '<path d="M2 3.5h4.5A2.5 2.5 0 0 1 9 6v8.5a2 2 0 0 0-2-2H2zM16 3.5h-4.5A2.5 2.5 0 0 0 9 6v8.5a2 2 0 0 1 2-2h5z"/>',
    present: '<rect x="2" y="3" width="14" height="9.5" rx="1.5"/><path d="M9 12.5V16M6 16h6"/>',
    dark: '<path d="M15.5 11A6.5 6.5 0 1 1 7 2.5a5 5 0 0 0 8.5 8.5z"/>',
    light: '<circle cx="9" cy="9" r="3.2"/><path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4"/>',
  };
  const svg = k => `<svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;
  function icons() {
    $('viewBtn').innerHTML = svg(reading() ? 'present' : 'read');
    $('viewBtn').title = reading() ? 'Present (R)' : 'Read as an article (R)';
    $('themeBtn').innerHTML = svg(root.dataset.mode === 'dark' ? 'light' : 'dark');
  }

  function assemble() {
    // gather Markdown decks and loose HTML slides, in document order, onto one stage
    let stage = $('stage');
    if (!stage) { stage = document.createElement('div'); stage.id = 'stage'; document.body.prepend(stage); }
    for (const n of document.querySelectorAll('script[type="text/markdown"], body > section.slide')) {
      const isMd = n.tagName === 'SCRIPT', made = isMd ? mdSlides(n.textContent) : [n];
      if (isMd && n.closest('#stage')) n.before(...made); else stage.append(...made);
      if (isMd) n.remove();
    }
    if (!$('bar')) stage.insertAdjacentHTML('afterbegin', `<div id="bar"><div class="title">${esc(document.title)}</div></div>`);
    const bar = $('bar');
    if (!$('sectionLabel')) bar.insertAdjacentHTML('beforeend', '<div class="section" id="sectionLabel"></div>');
    bar.insertAdjacentHTML('beforeend', `<div class="tools"><button class="ib" id="ovBtn" title="Overview (O)">${svg('grid')}</button><button class="ib" id="viewBtn"></button>${picker ? `<button class="ib" id="lookBtn" title="Theme" aria-haspopup="true">${svg('palette')}</button>` : ''}<button class="ib" id="themeBtn" title="Light / dark (T)"></button></div>`);

    // each slide sits in a frame with a label and its notes-as-prose, both shown only in read view
    const cue = /\[~?[\d.]+\s*(?:s|sec|secs|m|min|mins)\b[^\]]*\]\s*/gi;
    all = [...document.querySelectorAll('.slide')];
    all.forEach((s, i) => {
      if (!s.classList.contains('md') && !s.classList.contains('flow')) s.classList.add('fixed');
      const f = document.createElement('article'); f.className = 'frame';
      s.before(f);
      f.insertAdjacentHTML('beforeend', `<div class="rh"><span>${pad2(i + 1)}</span>${esc(s.dataset.section || '')}</div>`);
      f.append(s);
      const notes = s.querySelector('.notes');
      if (notes) {
        const prose = s.classList.contains('md') ? notes.innerHTML.replace(cue, '')
          : notes.textContent.replace(cue, '').trim().split(/\n\s*\n/).map(p => `<p>${esc(p.trim())}</p>`).join('');
        f.insertAdjacentHTML('beforeend', `<div class="prose">${prose}</div>`);
      }
      if (s.classList.contains('fixed')) {
        // in read view a fixed slide is a figure with a button that presents it
        const fig = document.createElement('div'); fig.className = 'fig';
        s.before(fig); fig.append(s);
        fig.insertAdjacentHTML('beforeend', `<button class="present-btn" aria-label="Present slide ${i + 1}">${svg('present')}<span>Present</span></button>`);
        fig.addEventListener('click', () => { if (reading()) { setView('present'); go(i, 0); } });
      }
    });
    frames = [...document.querySelectorAll('.frame')];

    stage.insertAdjacentHTML('beforeend', `
      <div id="progress"></div>
      <div id="pager"><span id="stepNav"><button id="up" title="Previous step (↑)">↑</button><span id="stepCount"></span><button id="down" title="Next step (↓)">↓</button></span><button id="prev" title="Previous slide (←)">‹</button><span id="count"></span><button id="next" title="Next slide (→)">›</button></div>`);
    document.body.insertAdjacentHTML('beforeend', `
      <div id="notes"><h4 id="notesTitle">SPEAKER NOTES</h4><div class="tk" id="notesTk"></div><div id="notesBody"></div></div>
      <div id="overview"></div>
      <div id="mhead"><b>${esc(bar.querySelector('.title')?.textContent || document.title)}</b><span id="mSec"></span><i id="mProg"></i></div>
      <div id="mNotes"></div>
      <div id="dock"><button id="dPrev" title="Back">‹</button><span id="dCount"></span><button id="dNext" title="Next">›</button><button id="dNotes" title="Speaker notes (N)">${svg('notes')}</button><button id="dRead" title="Read as an article">${svg('read')}</button></div>
      <div id="help">← → slides · ↑ ↓ steps · O overview · R read · T theme · ? keys</div>
      <div id="keys"><div class="kcard"><h3>Keyboard</h3>
        <p><kbd>←</kbd> <kbd>→</kbd> <kbd>Space</kbd> previous / next slide · <kbd>Home</kbd> <kbd>End</kbd> first / last</p>
        <p><kbd>↑</kbd> <kbd>↓</kbd> <kbd>Enter</kbd> previous / next step, then on to the next slide · <kbd>1</kbd>–<kbd>9</kbd> jump to a step</p>
        <p><kbd>R</kbd> read as an article / present · <kbd>T</kbd> light / dark · <kbd>O</kbd> overview · <kbd>N</kbd> notes · <kbd>F</kbd> fullscreen · <kbd>Esc</kbd> close</p>
      </div></div>`);

    $('viewBtn').onclick = toggleView;
    $('themeBtn').onclick = toggleTheme;
    if (picker) buildPicker();
    $('ovBtn').onclick = toggleOverview;
    $('prev').onclick = () => go(cur - 1);
    $('next').onclick = () => go(cur + 1);
    $('up').onclick = $('dPrev').onclick = prev;
    $('down').onclick = $('dNext').onclick = next;
    $('dRead').onclick = () => setView('read');
    $('dNotes').onclick = toggleNotes;
    $('keys').onclick = () => $('keys').classList.remove('on');
    const ov = $('overview');
    all.forEach((s, i) => {
      const b = document.createElement('button');
      b.innerHTML = `<div class="i">${i + 1} · ${esc(s.dataset.section || '')}</div><div class="n">${esc(s.dataset.name || '')}</div>`;
      b.onclick = () => { ov.classList.remove('on'); go(i, 0); };
      ov.appendChild(b);
    });
    ov.onclick = e => { if (e.target === ov) ov.classList.remove('on'); };
    icons();
  }
  function toggleTheme() { root.dataset.mode = root.dataset.mode === 'dark' ? 'light' : 'dark'; store.set('mode', root.dataset.mode); icons(); }

  // the theme picker (<html data-theme-picker>): each swatch carries the theme's own tokens
  const THEMES = {
    Everyday: ['paper', 'clean', 'slate', 'ledger', 'noir'],
    'Editorial & craft': ['editorial', 'swiss', 'atelier', 'mocha'],
    'Warm & friendly': ['rose', 'sunset', 'chalk', 'clinic'],
    'Nature & calm': ['forest', 'ocean', 'nord'],
    Tech: ['solar', 'terminal', 'ai', 'blueprint'],
    Loud: ['punk', 'volt', 'synth'],
  };
  function buildPicker() {
    const pop = document.createElement('div'); pop.id = 'looks'; pop.setAttribute('role', 'menu');
    pop.innerHTML = Object.entries(THEMES).map(([group, ts]) => `<div class="lg">${group}</div>`
      + ts.map(t => `<button role="menuitemradio" data-look="${t}" data-theme="${t}"><i></i><span>${t === 'ai' ? 'AI' : t[0].toUpperCase() + t.slice(1)}</span></button>`).join('')).join('');
    document.body.append(pop);
    const mark = () => pop.querySelectorAll('button').forEach(b => { b.dataset.mode = root.dataset.mode; b.setAttribute('aria-checked', b.dataset.look === root.dataset.theme); });
    pop.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      root.dataset.theme = b.dataset.look; store.set('look', b.dataset.look); mark();
    };
    $('lookBtn').onclick = e => { e.stopPropagation(); mark(); pop.classList.toggle('on'); };
    document.addEventListener('click', e => { if (!e.target.closest('#looks')) pop.classList.remove('on'); });
    new MutationObserver(mark).observe(root, { attributes: true, attributeFilter: ['data-mode'] });
  }
  function toggleOverview() { const ov = $('overview'); ov.classList.toggle('on'); if (ov.classList.contains('on')) ov.querySelector('.cur')?.focus(); }

  /* ================= input ================= */
  function onKey(e) {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target, k = e.key, lk = k.toLowerCase();
    if (t.isContentEditable || /^(TEXTAREA|SELECT)$/.test(t.tagName) || (t.tagName === 'INPUT' && !/^(range|checkbox|radio)$/.test(t.type))) return;

    const ov = $('overview');
    if (ov.classList.contains('on')) {
      const bs = [...ov.children], i = Math.max(0, bs.indexOf(document.activeElement));
      const cols = Math.max(1, Math.round(ov.clientWidth / (bs[0].offsetWidth + 14)));
      const mv = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[k];
      if (mv) { e.preventDefault(); bs[Math.min(bs.length - 1, Math.max(0, i + mv))].focus(); }
      else if (k === 'Enter') { e.preventDefault(); bs[i].click(); }
      else if (k === 'Escape' || lk === 'o') ov.classList.remove('on');
      return;
    }
    if ($('keys').classList.contains('on')) { $('keys').classList.remove('on'); if (k === '?' || k === 'Escape') return; }
    if (customKeys[k]) { customKeys[k](e); return; }

    if (lk === 'r') toggleView();
    else if (lk === 't') toggleTheme();
    else if (lk === 'o') toggleOverview();
    else if (k === '?') $('keys').classList.add('on');
    else if (k === 'Escape') { ov.classList.remove('on'); $('notes').classList.remove('on'); $('looks')?.classList.remove('on'); }
    else if (reading()) {                                   // the page scrolls; ← → hop between slides
      if (k === 'ArrowRight') { e.preventDefault(); go(cur + 1); }
      else if (k === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
    }
    else if (['ArrowRight', 'PageDown', ' '].includes(k)) { e.preventDefault(); go(cur + 1); }
    else if (['ArrowLeft', 'PageUp'].includes(k)) { e.preventDefault(); go(cur - 1); }
    else if (k === 'ArrowDown' || (k === 'Enter' && t.tagName !== 'BUTTON')) { e.preventDefault(); next(); }
    else if (k === 'ArrowUp') { e.preventDefault(); prev(); }
    else if (/^[1-9]$/.test(k) && +k <= total(slide())) setAt(slide(), +k - 1);
    else if (k === 'Home') go(0);
    else if (k === 'End') go(slides().length - 1);
    else if (lk === 'n') toggleNotes();
    else if (lk === 'f') document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen();
  }

  function swipe() {
    let x0 = null, y0, idle;
    // in landscape the dock sits over the slide, so it fades after a few seconds and returns on the next touch
    const wake = () => { $('dock').classList.remove('idle'); clearTimeout(idle); idle = setTimeout(() => $('dock').classList.add('idle'), 2500); };
    addEventListener('touchstart', e => { wake(); x0 = !reading() && e.touches.length === 1 ? e.touches[0].clientX : null; y0 = e.touches[0].clientY; }, { passive: true });
    wake();
    addEventListener('touchend', e => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 40 && Math.abs(dx) > 1.5 * Math.abs(dy)) dx < 0 ? next() : prev();
    }, { passive: true });
  }

  // #slide or #slide.step, 1-based; [0, 1] when there's no hash
  function fromHash() {
    const h = decodeURIComponent(location.hash.slice(1)), m = h.match(/^(\d+)(?:\.(\d+))?$/);
    if (m) return [+m[1], +(m[2] || 1)];
    const i = slides().findIndex(s => s.dataset.id === h);
    return i >= 0 ? [i + 1, 1] : [0, 1];
  }

  function start() {
    assemble();
    highlight();
    diagrams();
    document.querySelectorAll('[data-build]').forEach(build);
    document.querySelectorAll('[data-next]').forEach(b => b.addEventListener('click', () => {
      const s = b.closest('.slide');
      if (done(s)) setAt(s, 0); else stepsOf(s).some(st => st.next());
    }));
    // a clicked button keeps focus, so Space / Enter would press it again; hand the keys back to the deck
    document.addEventListener('click', e => { const b = e.target.closest('#stage button'); if (b) b.blur(); });
    // [text](#id) links to the slide with that id
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]'), i = a ? slides().findIndex(s => s.dataset.id === decodeURIComponent(a.hash.slice(1))) : -1;
      if (i >= 0) { e.preventDefault(); go(i, 0); }
    });
    addEventListener('keydown', onKey);
    addEventListener('hashchange', () => { const [sl, sp] = fromHash(); if (sl) go(sl - 1, reading() ? undefined : sp - 1); });
    let resizing = false;
    addEventListener('resize', () => { if (!resizing) { resizing = true; requestAnimationFrame(() => { resizing = false; fit(); }); } });
    addEventListener('scroll', () => { if (!scrolling) { scrolling = true; requestAnimationFrame(onScroll); } }, { passive: true });
    small.addEventListener('change', e => { if (!viewChosen) setView(e.matches ? 'read' : 'present', false); });
    swipe();
    handlers.ready.forEach(f => f());
    started = true;
    const [sl, sp] = fromHash();
    if (reading()) finishForReading();
    all.forEach(label);
    if (reading() && !sl) { cur = 0; announce(); fit(); onScroll(); }      // an article opens at the top
    else { cur = Math.max(0, sl - 1); fit(); go(cur, reading() ? undefined : sp - 1, true); }
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : setTimeout(start);

  window.Deck = {
    steps, tabs, build, go, next, prev, store, setView, markdown: s => blocks(dedent(s.split('\n'))),
    get cur() { return cur; },
    get slides() { return slides(); },
    get slide() { return slide(); },
    on(ev, f) { handlers[ev].push(f); },
    key(k, f) { customKeys[k] = f; },
  };
})();
