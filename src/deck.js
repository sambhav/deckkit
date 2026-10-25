import { renderMarkdown, renderInline, slideChunks } from './markdown.js';
import { parseCSV, chartDataset, csvDownload } from './data.js';

/* talkdown — slide decks written in Markdown (or HTML), presented on a 16:9 stage, read like an article on a phone.
 *
 * Present view (default on every screen)      Read view (R or the mobile Article button)
 *   ← → Space PgUp PgDn   slides               one scrolling column; speaker notes become the prose,
 *   ↑ ↓ Enter             steps, then slides   builds show finished, fixed-layout slides become figures
 *   1–9                   jump to a step       ← → hop between slides
 *   swipe                 next / previous
 *   Home End · O overview · N notes · T light / dark · R read / present · F fullscreen · S view source · ? keys · Esc close
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
 *   a table then {.chart}               a bar chart; {.chart .hbar}, {.chart .line} or {.chart .donut} for the others.
 *                                       First column: labels; each other column: a series (↓ adds them one by one)
 *   > quote, then a "— Name" line       a pull quote with its attribution
 *   - [x] done / - [ ] to do            a checklist
 *   text[^1] and a "[^1]: source" line  footnotes, set small at the foot of the slide
 *   $x^2$ and $$ … $$                   maths (KaTeX, fetched only if the deck has some; <html data-math="off"> to skip)
 *   layout: image + image: url          a full-bleed picture with the text over it
 *   ```terminal                         "$ command" lines type out one per ↓, the rest is their output
 *   ![title](demo.cast) or ```cast     plays an asciinema recording (a file needs the page served over http; a ```cast block plays anywhere); ![](youtube / vimeo / .mp4 link) embeds a video
 *   ::: accordion / ::: features        ### items that open one per ↓ / a grid of cards (a leading :icon: or image is the card's icon)
 *   :rocket:                            a Lucide icon in the theme's colours (any name from lucide.dev/icons)
 *   ::: agenda / ::: qr                 a contents slide linking every section / a QR code of the deck's link (or the URL inside)
 * Two formats from one deck: <!-- notes --> are spoken and read; <!-- say: … --> spoken only; <!-- read: … --> read only.
 *   ::: present-only / ::: read-only for slide content; frontmatter read: hide | text and present: hide for whole slides.
 * Presenting: P presenter view (next slide, notes, timer, in a second window) · L laser pointer · D draw on the slide
 *   ::: present-only / ::: read-only   content for one view only (or {.present-only} / {.read-only} on a block)
 */
(() => {
  const W = 1280, H = 720;
  const $ = id => document.getElementById(id);
  const root = document.documentElement;
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem('talkdown:' + k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('talkdown:' + k, JSON.stringify(v)); } catch {} },
  };

  /* ---------- theme + view, set before first paint ---------- */
  const q = new URLSearchParams(location.search);
  const portrait = matchMedia('(orientation: portrait) and (max-width: 900px)');   // present view becomes slide-over-notes
  // data-mode: light or dark (the viewer's choice, remembered). data-theme: the look, set by the author.
  // ?theme=light|dark is still read as a mode, for old links.
  const lookOf = p => { const t = p.get('theme'), m = /^(light|dark)$/.test(t); return { mode: p.get('mode') || (m ? t : null), look: t && !m ? t : null }; };
  const qLook = lookOf(q);
  root.dataset.mode = qLook.mode || store.get('mode', store.get('theme', root.dataset.mode || 'dark'));   // dark unless the author says <html data-mode="light">
  const picker = root.hasAttribute('data-theme-picker');
  if (q.has('presenter')) root.dataset.presenter = '';
  const chosen = qLook.look || (picker && store.get('look', null));
  root.dataset.theme = chosen || root.dataset.theme || 'clean';

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
  const initialView = q.get('view') || root.dataset.view;
  root.dataset.view = initialView === 'read' ? 'read' : 'present';
  const reading = () => root.dataset.view === 'read';

  /* ================= Markdown ================= */
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const qesc = s => s.replace(/"/g, '&quot;');
  const indent = l => l.match(/^\s*/)[0].length;
  const dedent = L => { const n = Math.min(...L.filter(l => l.trim()).map(indent)); return isFinite(n) ? L.map(l => l.slice(n)) : L; };
  const pad2 = n => String(n).padStart(2, '0');
  const inline = renderInline;

  /* a Markdown deck: slides split by ---; a chunk of only `key: value` lines is the next slide's frontmatter */
  const META = /^(section|name|layout|kicker|build|class|takeaway|id|image|read|present):\s*(.*)$/;
  let section = '', part = 0;
  const sourceOf = new WeakMap();   // slide element -> its Markdown as written, for view source
  function mdSlides(src) {
    // a deck can't contain a literal closing script tag, so it writes <\/script> and we restore it here
    const chunks = slideChunks(dedent(src.replace(/\r/g, '').replace(/<\\\/script/gi, '</script').split('\n')).join('\n'));
    const out = []; let meta = {}, head = [];
    for (const c of chunks) {
      const filled = c.filter(l => l.trim());
      if (!filled.length) continue;
      if (filled.every(l => META.test(l))) { for (const l of filled) { const [, k, v] = l.match(META); meta[k] = v.trim(); head.push(l.trim()); } continue; }
      out.push(mdSlide(c, meta, head)); meta = {}; head = [];
    }
    return out;
  }

  function mdSlide(L, meta, head = []) {
    const raw = L.join('\n').replace(/^\s*\n|\s+$/g, ''), notes = [], article = [], feet = [];
    const layout = meta.layout || 'default';
    const body = renderMarkdown(L.join('\n'), { collectNotes: true, notes, article, feet });
    const el = document.createElement('section');
    el.className = `slide md layout-${layout} ${meta.class || ''}`.trim();
    el.innerHTML = `<div class="content">${layout === 'section' ? `<div class="num">Part ${pad2(++part)}</div>` : ''}`
      + `${meta.kicker ? `<div class="kicker">${inline(meta.kicker)}</div>` : ''}${body}${feet.length ? `<div class="footnotes">${feet.join('')}</div>` : ''}</div>`
      + (notes.length ? `<aside class="notes">${notes.join('\n')}</aside>` : '')
      + (article.length ? `<aside class="article">${article.join('\n')}</aside>` : '');
    sourceOf.set(el, (head.length ? head.join('\n') + '\n---\n' : '') + raw);
    const heading = el.querySelector('h1, h2, h3')?.textContent.trim() || '';
    section = meta.section ?? (layout === 'section' ? heading : section);
    Object.assign(el.dataset, { section, name: meta.name || heading });
    if (meta.takeaway) el.dataset.takeaway = meta.takeaway;
    if (meta.id) el.dataset.id = meta.id;
    if (meta.read) el.dataset.read = meta.read;            // hide: leave it out of the article · text: only its prose
    if (meta.present) el.dataset.present = meta.present;   // hide: an article-only section, skipped when presenting
    if (meta.image) { el.style.setProperty('--image', `url("${encodeURI(meta.image)}")`); el.classList.add('has-image'); }
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
    c.querySelectorAll('p').forEach(p => { if (!p.textContent.trim() && !p.children.length && (p.className || p.id) && p.previousElementSibling) { p.previousElementSibling.classList.add(...p.classList); if (p.id) p.previousElementSibling.id = p.id; p.remove(); } });
    // Inner widgets must be transformed before an outer pane moves their nodes.
    [...c.querySelectorAll('.tabs, .toggle, .steps')].reverse().forEach(panes);
    c.querySelectorAll('.timeline').forEach(timeline);
    c.querySelectorAll('.stats').forEach(stats);
    c.querySelectorAll('blockquote').forEach(callout);
    c.querySelectorAll('blockquote:not(.callout)').forEach(quote);
    c.querySelectorAll('div.chart, figure[data-chart], table.chart').forEach(chart);
    c.querySelectorAll('table.explain').forEach(explain);
    c.querySelectorAll('td, th').forEach(marks);
    c.querySelectorAll('pre[data-steps]').forEach(codeSteps);
    c.querySelectorAll('.flip').forEach(flip);
    c.querySelectorAll('.accordion').forEach(accordion);
    c.querySelectorAll('.features').forEach(features);
    c.querySelectorAll('.w-term:not(.w-cast)').forEach(terminal);
    c.querySelectorAll('.w-cast').forEach(cast);
    c.querySelectorAll('.qr').forEach(b => { b.className = 'w w-qr'; b.dataset.url = b.textContent.trim(); b.textContent = ''; });
    c.querySelectorAll('.agenda').forEach(b => b.className = 'w w-agenda');
  }

  // a container's children, split into groups at each ### heading
  function byHeading(box) {
    const groups = [];
    for (const ch of [...box.children]) { if (ch.tagName === 'H3' || !groups.length) groups.push([]); groups.at(-1).push(ch); }
    return groups;
  }

  // ::: tabs / ::: toggle / ::: steps — each ### heading starts a pane
  let widgetId = 0;
  function panes(box) {
    const kind = ['tabs', 'toggle', 'steps'].find(k => box.classList.contains(k));
    const groups = byHeading(box);
    const titles = groups.map(g => g[0].tagName === 'H3' ? g[0].innerHTML : '');
    const w = document.createElement('div');
    w.className = `w w-${kind} ${[...box.classList].filter(k => k !== kind).join(' ')}`.trim();
    w.innerHTML = (kind === 'steps'
      ? `<div class="w-head"><span class="w-count"></span><span class="w-dots">${groups.map((_, i) => `<button aria-label="Step ${i + 1}"></button>`).join('')}</span><button class="w-next" data-next></button></div>`
      : `<div class="w-list" role="tablist">${titles.map(t => `<button role="tab">${t}</button>`).join('')}</div>`) + '<div class="w-panes"></div>';
    const holder = w.lastChild;
    for (const g of groups) { const p = document.createElement('section'); p.className = 'w-pane'; p.append(...g); holder.append(p); }
    box.replaceWith(w);
    const pick = [...w.firstChild.querySelectorAll('[role=tab], .w-dots button')], ps = [...holder.children];
    const id = `td-tabs-${++widgetId}`;
    if (kind !== 'steps') pick.forEach((b, j) => {
      b.id = `${id}-tab-${j}`; b.setAttribute('aria-controls', `${id}-panel-${j}`);
      ps[j].id = `${id}-panel-${j}`; ps[j].setAttribute('role', 'tabpanel'); ps[j].setAttribute('aria-labelledby', b.id);
    });
    const st = steps(w, ps.length, i => {
      ps.forEach((p, j) => p.classList.toggle('on', j === i));
      pick.forEach((b, j) => { b.classList.toggle('on', j === i); b.classList.toggle('done', j < i); if (kind !== 'steps') { b.setAttribute('aria-selected', j === i); b.tabIndex = j === i ? 0 : -1; } });
      if (kind === 'steps') w.firstChild.querySelector('.w-count').textContent = `Step ${i + 1} of ${ps.length}`;
    });
    pick.forEach((b, j) => b.addEventListener('click', () => st.go(j)));
    if (kind !== 'steps') w.firstChild.addEventListener('keydown', e => {
      const j = pick.indexOf(e.target); if (j < 0) return;
      const i = { ArrowRight: (j + 1) % pick.length, ArrowLeft: (j + pick.length - 1) % pick.length, Home: 0, End: pick.length - 1 }[e.key];
      if (i == null) return;
      e.preventDefault(); e.stopPropagation(); st.go(i); pick[i].focus();
    });
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
    const lineCount = code.children.length;
    const groups = pre.dataset.steps.split('|').map(g => new Set(g.split(',').flatMap(r => {
      const m = r.trim().match(/^(\d+)(?:-(\d+))?$/);
      if (!m) return [];
      const a = Math.max(1, +m[1]), b = Math.min(lineCount, +(m[2] || m[1]));
      return Array.from({ length: Math.max(0, b - a + 1) }, (_, k) => a + k);
    })));
    pre.stepper = steps(pre, groups.length + 1, i => {
      pre.classList.toggle('stepping', i > 0 && !reading());
      [...code.children].forEach((l, j) => l.classList.toggle('on', i > 0 && groups[i - 1].has(j + 1)));
    });
  }

  /* syntax highlighting: highlight.js, fetched only when the deck has fenced code.
     <html data-highlight="off"> turns it off; data-highlight="/path/highlight.min.js" self-hosts it. */
  const HLJS = 'https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.11.1/highlight.min.js';
  // fetch an optional library once; offline or blocked, the deck keeps its plain fallback
  function load(src, then, css) {
    if (css) document.head.insertAdjacentHTML('beforeend', `<link rel="stylesheet" href="${css}">`);
    const tag = document.createElement('script');
    tag.src = src; tag.onload = then;
    document.head.append(tag);
  }
  function highlight() {
    const pres = [...document.querySelectorAll('pre.code[data-lang]')], opt = root.dataset.highlight;
    if (!pres.length || opt === 'off') return;
    const run = () => pres.forEach(pre => {
      if (!window.hljs?.getLanguage(pre.dataset.lang)) return;
      const html = hljs.highlight(sources.get(pre) ?? pre.firstChild.textContent, { language: pre.dataset.lang, ignoreIllegals: true }).value;
      pre.firstChild.innerHTML = pre.dataset.steps ? perLine(html) : html;
      pre.stepper?.go(pre.stepper.i, true);
    });
    window.hljs ? run() : load(opt || HLJS, run);
  }

  /* maths: KaTeX, fetched only when the deck has $…$ or $$…$$. <html data-math="off"> leaves the TeX showing;
     data-math="/path/katex.min.js" self-hosts it (with katex.min.css next to it). */
  const KATEX = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';
  function maths() {
    const els = [...document.querySelectorAll('.math')], opt = root.dataset.math;
    if (!els.length || opt === 'off') return;
    const run = () => els.forEach(el => { try { katex.render(el.textContent, el, { displayMode: el.classList.contains('math-block'), throwOnError: false }); } catch {} });
    const js = opt || KATEX;
    window.katex ? run() : load(js, run, js.replace(/\.js$/, '.css'));
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
          archEdgeColor: v('--muted'), archEdgeArrowColor: v('--muted'), archEdgeWidth: '2', archGroupBorderColor: v('--muted'), archGroupBorderWidth: '1.5px',
          labelBoxBkgColor: v('--surface'), labelBoxBorderColor: v('--accent'), labelTextColor: v('--fg'), loopTextColor: v('--fg') } });
      for (const b of boxes) {
        try { const { svg } = await mermaid.render(`dk-diagram-${++n}`, b.dataset.src); b.innerHTML = svg; b.classList.add('drawn'); themeIcons(b); }
        catch { b.innerHTML = `<pre class="code w-diagram-src">${esc(b.dataset.src)}</pre>`; b.classList.remove('drawn'); }
      }
      if (portrait.matches && !reading()) fit();
    };
    // architecture icons arrive as blue tiles with white strokes in inline styles: hand those colours to the theme's CSS
    const themeIcons = b => b.querySelectorAll('svg[aria-roledescription=architecture] svg [style]').forEach(el => {
      const st = el.style;
      if (st.fill === 'rgb(8, 126, 191)') { st.fill = st.strokeWidth = ''; el.classList.add('dk-tile'); }
      if (st.stroke === 'rgb(255, 255, 255)') { st.stroke = ''; el.classList.add('dk-ink'); }
      if (st.fill === 'rgb(255, 255, 255)') { st.fill = ''; el.classList.add('dk-ink-fill'); }
    });
    const redraw = () => { clearTimeout(queued); queued = setTimeout(draw, 60); };
    // draw once the theme's fonts are in, so labels are measured in the face they're shown in
    const ready = () => {
      (document.fonts?.ready || Promise.resolve()).then(draw);
      document.fonts?.addEventListener('loadingdone', redraw);          // a theme's web font arrived: re-measure in it
      new MutationObserver(() => document.fonts.ready.then(redraw)).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-mode'] });
    };
    window.mermaid ? ready() : load(opt || MERMAID, ready);
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
    const items = byHeading(box);
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

  // a quote whose last line starts with — (or --) is a pull quote with that attribution
  function quote(q) {
    const p = q.querySelector(':scope > p:last-child'), m = p?.innerHTML.match(/(^|<br>\s*)(—|–|--)\s*(.+)$/s);
    if (!m) return;
    p.innerHTML = p.innerHTML.slice(0, m.index);
    if (!p.textContent.trim()) p.remove();
    q.classList.add('pull');
    q.insertAdjacentHTML('beforeend', `<footer>${m[3]}</footer>`);
  }

  // a table then {.chart}: column one holds the labels, every other column is a series. Drawn in HTML and CSS
  // (the line in SVG), so text stays crisp and reflows on phones; the table stays behind for screen readers.
  const niceMax = m => { if (m <= 0) return 1; const e = 10 ** Math.floor(Math.log10(m)), f = m / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; };
  let chartId = 0;
  function chart(source) {
    if (!source.parentElement || source.closest('.w-chart-box')) return;
    if (source.matches('table') && source.parentElement.closest('div.chart, figure[data-chart]')) return;
    const old = source.matches('table'), table = old ? source : source.querySelector(':scope > table');
    const csv = old ? null : source.querySelector(':scope > pre[data-lang="csv"]');
    let headers = [], rows = [], error = '', model;
    const kind = source.dataset.type || source.dataset.chart || ['hbar', 'line', 'donut'].find(k => source.classList.contains(k)) || 'bar';
    const initial = source.dataset.view || source.dataset.chartView || 'auto';
    const title = source.dataset.title || source.querySelector(':scope > figcaption')?.textContent || table?.caption?.textContent || 'Chart data';
    try {
      if (csv && table) throw new Error('Use one CSV block or one table per chart');
      if (csv) ({ headers, rows } = parseCSV(csv.textContent));
      else if (table) {
        headers = [...(table.tHead?.rows[0]?.cells || [])].map(cell => cell.textContent);
        rows = [...(table.tBodies[0]?.rows || [])].map(row => [...row.cells].map(cell => cell.textContent));
      } else throw new Error('A chart needs a CSV code block or a table');
      if (!['bar', 'hbar', 'line', 'donut'].includes(kind)) throw new Error('Unknown chart type: ' + kind);
      if (!['auto', 'chart', 'table', 'both'].includes(initial)) throw new Error('Unknown chart view: ' + initial);
      const unknown = [...source.attributes].find(a => a.name.startsWith('data-') && !['data-type','data-chart','data-view','data-chart-view','data-title','data-series'].includes(a.name));
      if (unknown) throw new Error('Unknown chart option: ' + unknown.name.slice(5));
      model = chartDataset(headers, rows, kind, source.dataset.series, old);
    } catch (e) { error = e.message; }
    const box = document.createElement('figure'); box.className = 'w-chart-box';
    if (source.id) box.id = source.id;
    box.classList.add(...[...source.classList].filter(c => !['chart','bar','hbar','line','donut'].includes(c)));
    const id = `td-chart-${++chartId}`; box.dataset.chartView = error ? 'table' : initial;
    box.innerHTML = `<figcaption id="${id}-title">${esc(title)}</figcaption><div class="w-chart-tools" role="group" aria-label="Chart display"><label>View <select><option value="auto">Auto</option><option value="chart">Chart</option><option value="table">Table</option><option value="both">Both</option></select></label><button type="button" class="w-csv-download">Download CSV</button></div>`;
    if (!source.dataset.title && !source.querySelector(':scope > figcaption') && !table?.caption) box.firstChild.className = 'w-chart-caption';
    const select = box.querySelector('select'); select.value = error ? 'table' : initial;
    select.disabled = !!error;
    select.addEventListener('change', () => { box.dataset.chartView = select.value; fit(); });
    const data = document.createElement('div'); data.className = 'w-chart-table'; data.tabIndex = 0; data.setAttribute('role', 'region'); data.setAttribute('aria-label', title + ' data');
    const shown = rows.slice(0, 200);
    data.innerHTML = `<table><caption>${esc(title)}</caption><thead><tr>${headers.map(h => `<th scope="col">${esc(String(h))}</th>`).join('')}</tr></thead><tbody>${shown.map(row => `<tr>${row.map((v,i) => `<${i ? 'td' : 'th'}${i ? '' : ' scope="row"'}>${esc(String(v))}</${i ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</tbody></table>`;
    if (rows.length > 200) data.insertAdjacentHTML('beforeend', `<p>Showing 200 of ${rows.length} rows. Download CSV for the complete dataset.</p>`);
    if (error) {
      const message = document.createElement('p'); message.className = 'td-error'; message.setAttribute('role', 'alert'); message.textContent = error; box.append(message);
      // Malformed CSV remains inspectable even when decoding fails.
      if (!headers.length && csv) { const pre = document.createElement('pre'); pre.className = 'code'; pre.textContent = csv.textContent; data.append(pre); }
    }
    const download = box.querySelector('button'); download.disabled = !headers.length;
    download.addEventListener('click', () => {
      const blob = new Blob([csvDownload(headers, rows)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = (title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'chart-data') + '.csv';
      document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    const w = document.createElement('div'); w.className = `w w-chart w-${kind}`; w.setAttribute('role', 'img'); w.setAttribute('aria-labelledby', `${id}-title`);
    if (model) {
      const labels = model.labels.map(v => esc(String(v)));
      const series = model.series.map(s => ({ name: esc(s.name), shown: rows.map(r => esc(String(r[s.index]))), v: s.values }));
      const values = series.flatMap(s => s.v), lo = Math.min(0, ...values), hi = Math.max(0, ...values);
      const min = lo < 0 ? -niceMax(-lo) : 0, max = hi > 0 ? niceMax(hi) : 0;
      const range = max - min || 1, pct = v => ((v - min) / range * 100).toFixed(2);
      const legend = items => `<div class="w-legend">${items.map(([name, j, extra = '']) => `<span class="s${j % 6}"><i></i>${name}${extra}</span>`).join('')}</div>`;
    if (kind === 'donut') {
      const v = series[0].v, total = v.reduce((a, b) => a + b, 0) || 1;
      let at = 0;
      w.innerHTML = `<div class="w-ring"><svg viewBox="0 0 42 42" aria-hidden="true"><circle class="w-track" cx="21" cy="21" r="15.915"/>${v.map((x, i) => {
        const p = x / total * 100, arc = `<circle class="s${i % 6}" cx="21" cy="21" r="15.915" stroke-dasharray="${p.toFixed(3)} ${(100 - p).toFixed(3)}" stroke-dashoffset="${(25 - at).toFixed(3)}"/>`;
        at += p; return arc;
      }).join('')}</svg><span>${series[0].name}</span></div>` + legend(labels.map((l, i) => [l, i, `<b>${series[0].shown[i]}</b>`]));
    } else if (kind === 'line') {
      const x = i => (labels.length > 1 ? i / (labels.length - 1) * 100 : 50).toFixed(2);
      w.innerHTML = (series.length > 1 ? legend(series.map((s, j) => [s.name, j])) : '') + `<div class="w-plot"><div class="w-area">`
        + `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${series.map((s, j) => `<polyline class="w-s s${j % 6}" points="${s.v.map((v, i) => `${x(i)},${100 - pct(v)}`).join(' ')}"/>`).join('')}</svg>`
        + series.map((s, j) => s.v.map((v, i) => `<i class="w-dot w-s s${j % 6}${i === s.v.length - 1 ? ' last' : ''}" style="left:${x(i)}%;bottom:${pct(v)}%"><b>${s.shown[i]}</b></i>`).join('')).join('')
        + labels.map((l, i) => `<span class="w-x" style="left:${x(i)}%">${l}</span>`).join('') + '</div></div>';
    } else {
      const bar = (s, j, i) => `<div class="w-b w-s s${j % 6}" style="--v:${(Math.abs(s.v[i]) / range * 100).toFixed(2)}%;--bottom:${pct(Math.min(0, s.v[i]))}%;--start:${pct(Math.min(0, s.v[i]))}%"><b>${s.shown[i]}</b></div>`;
      w.innerHTML = (series.length > 1 ? legend(series.map((s, j) => [s.name, j])) : '') + (kind === 'hbar'
        ? `<div class="w-rows">${labels.map((l, i) => `<div class="w-row"><span class="w-x">${l}</span><div class="w-track">${series.map((s, j) => bar(s, j, i)).join('')}</div></div>`).join('')}</div>`
        : `<div class="w-plot">${labels.map((l, i) => `<div class="w-grp">${series.map((s, j) => bar(s, j, i)).join('')}<span class="w-x">${l}</span></div>`).join('')}</div>`);
    }

      if (min < 0 && kind !== 'donut') {
        const plot = w.querySelector('.w-plot');
        if (plot) plot.insertAdjacentHTML('beforeend', `<span class="w-zero" style="bottom:${pct(0)}%"></span>`);
      }
      w.style.setProperty('--n', labels.length);
      // Register after mounting: the stepper must belong to its slide.
      box.append(w);
      box.plotSeries = series;
    }
    box.append(data); source.replaceWith(box);
    if (box.plotSeries?.length > 1 && kind !== 'donut') {
      const series = box.plotSeries;
      const parts = j => w.querySelectorAll(`.w-s.s${j % 6}, .w-legend > .s${j % 6}`);
      steps(w, series.length, i => series.forEach((_, j) => parts(j).forEach(el => el.classList.toggle('w-off', j > i))), { read: 'end' });
    }
    delete box.plotSeries;
  }

  // ::: accordion — each ### heading opens its section; ↓ opens them in turn
  function accordion(box) {
    const w = document.createElement('div'); w.className = 'w w-accordion';
    for (const g of byHeading(box)) {
      const d = document.createElement('div'); d.className = 'w-acc';
      const head = g[0].tagName === 'H3' ? g.shift() : null;
      d.innerHTML = `<button class="w-acc-h" aria-expanded="false">${head ? head.innerHTML : ''}</button><div class="w-acc-b"><div></div></div>`;
      d.querySelector('.w-acc-b > div').append(...g);
      w.append(d);
    }
    box.replaceWith(w);
    const items = [...w.children];
    const st = steps(w, items.length, i => items.forEach((d, j) => { d.classList.toggle('on', j === i); d.firstChild.setAttribute('aria-expanded', j === i); }));
    items.forEach((d, j) => d.firstChild.addEventListener('click', () => st.go(j)));
  }

  // ::: features — a grid of cards, one per ### heading; an :icon: or image at the start of the heading becomes its icon
  function features(box) {
    const w = document.createElement('div'); w.className = 'w w-features';
    w.innerHTML = byHeading(box).map(g => {
      const h = g[0].tagName === 'H3' ? g.shift() : null;
      const m = h?.innerHTML.match(/^\s*(<i class="ico"[^>]*><\/i>|<img [^>]*>)\s*/);
      return `<div class="w-feature">${m ? `<span class="w-icon">${m[1]}</span>` : ''}<h3>${h ? h.innerHTML.slice(m ? m[0].length : 0) : ''}</h3>${g.map(x => x.outerHTML).join('')}</div>`;
    }).join('');
    w.style.setProperty('--n', Math.min(3, w.children.length));
    box.replaceWith(w);
  }

  /* terminals: ```terminal fences type each "$ command" on ↓ and print its output; ![](x.cast) plays an asciinema recording */
  const termShell = (title, body) => `<div class="w-term-bar"><i></i><i></i><i></i><span>${title || 'Terminal'}</span></div><pre class="w-term-out">${body}</pre>`;
  function terminal(w) {
    const lines = JSON.parse(w.dataset.lines), cmds = [];
    for (const l of lines) { if (/^\$ /.test(l) || !cmds.length) cmds.push({ cmd: /^\$ /.test(l) ? l.slice(2) : null, out: [] }); if (!/^\$ /.test(l)) cmds.at(-1).out.push(l); }
    w.className = 'w w-term';
    w.innerHTML = termShell('', '');
    if (!cmds.length) return;
    const out = w.lastChild, row = c => (c.cmd != null ? `<span class="t-p">$</span> <span class="t-c">${esc(c.cmd)}</span>\n` : '') + c.out.map(o => `<span class="t-o">${esc(o)}</span>\n`).join('');
    let timer;
    steps(w, cmds.length, i => {
      clearInterval(timer);
      const done = cmds.slice(0, i).map(row).join(''), c = cmds[i];
      if (!started || reading() || matchMedia('(prefers-reduced-motion: reduce)').matches || c.cmd == null || w.closest('.slide') !== slide()) { out.innerHTML = done + row(c); return; }
      let k = 0;                                   // type the command, then print what it printed
      timer = setInterval(() => {
        k++;
        out.innerHTML = done + `<span class="t-p">$</span> <span class="t-c">${esc(c.cmd.slice(0, k))}</span><span class="t-cur"></span>`;
        if (k >= c.cmd.length) { clearInterval(timer); setTimeout(() => { if (out.isConnected) out.innerHTML = done + row(c); }, 260); }
      }, 34);
    }, { read: 'end' });
  }

  // asciinema v2: a JSON header line, then [time, "o", text] events. Plays when its slide opens; click to replay.
  const SGR = { 1: 'b', 2: 'dim', 30: 'k', 31: 'r', 32: 'g', 33: 'y', 34: 'bl', 35: 'm', 36: 'cy', 37: 'w', 90: 'k', 91: 'r', 92: 'g', 93: 'y', 94: 'bl', 95: 'm', 96: 'cy', 97: 'w' };
  function screen() {
    const rows = [[]]; let x = 0, y = 0, cls = '';
    const put = ch => { const r = rows[y]; while (r.length < x) r.push([' ', '']); r[x++] = [ch, cls]; };
    return {
      write(t) {
        for (const m of t.matchAll(/\x1b\[([\d;?]*)([A-Za-z])|\x1b[()][\dA-Z]|\x1b.|\r\n|[\n\r\b]|[^\x1b\r\n\b]/g)) {
          const [tok, args, cmd] = m;
          if (cmd === 'm') { cls = (args || '0').split(';').reduce((c, n) => +n === 0 ? '' : SGR[+n] ? `${c} t-${SGR[+n]}` : c, cls).trim(); }
          else if (cmd === 'K') rows[y].length = x;
          else if (cmd === 'J' && args.startsWith('2')) { rows.length = 0; rows.push([]); x = y = 0; }
          else if (cmd === 'H') { x = 0; y = 0; }
          else if (cmd || tok[0] === '\x1b') {}
          else if (tok === '\n' || tok === '\r\n') { y++; x = 0; if (!rows[y]) rows.push([]); }
          else if (tok === '\r') x = 0;
          else if (tok === '\b') x = Math.max(0, x - 1);
          else put(tok);
        }
      },
      html: () => rows.map(r => { let h = '', c = null; for (const [ch, k] of r) { if (k !== c) { if (c !== null) h += '</span>'; h += `<span class="${k}">`; c = k; } h += esc(ch); } return h + (c !== null ? '</span>' : ''); }).join('\n'),
    };
  }
  function cast(w) {
    w.className = 'w w-term w-cast';
    w.innerHTML = termShell(w.dataset.title, w.dataset.src ? `<a href="${w.dataset.src}">${esc(w.dataset.src)}</a>` : '');
    const out = w.lastChild;
    let events = null, run = 0;
    const show = (upTo = Infinity) => { const sc = screen(); for (const [t, , d] of events) if (t <= upTo) sc.write(d); out.innerHTML = sc.html(); };
    const play = async () => {
      if (!events) {
        try {
          const [head, ...rest] = (w.dataset.inline ?? await (await fetch(w.dataset.src)).text()).trim().split('\n');
          const limit = JSON.parse(head).idle_time_limit || 1.5;
          let t0 = 0, at = 0;                       // squash long pauses, like asciinema's idle_time_limit
          events = rest.map(l => JSON.parse(l)).filter(e => e[1] === 'o').map(e => { at += Math.min(limit, e[0] - t0); t0 = e[0]; return [at, 'o', e[2]]; });
        } catch {                                  // file:// pages can't fetch: say so, and keep the link
          if (location.protocol === 'file:') out.insertAdjacentHTML('beforeend', '\n<span class="t-o">Recordings play when the page is served (python3 -m http.server), or write the cast in a ```cast block.</span>');
          return;
        }
      }
      if (reading() || matchMedia('(prefers-reduced-motion: reduce)').matches) return show();
      const me = ++run, start = performance.now();
      const tick = () => { if (me !== run) return; const t = (performance.now() - start) / 1000; show(t); if (t <= events.at(-1)[0]) requestAnimationFrame(tick); };
      tick();
    };
    w.addEventListener('click', play);
    handlers.slide.push(s => { if (s.contains(w)) play(); else run++; });
    w.play = play;
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
    const st = steps(w, 2, i => { w.classList.toggle('on', i === 1); w.setAttribute('aria-pressed', i === 1); });
    w.addEventListener('click', () => st.go(st.i ? 0 : 1));
    w.addEventListener('keydown', e => { if (e.target === w && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); w.click(); } });
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
  let presentationSteps = new Map();
  const enterReading = () => {
    presentationSteps = new Map([...steppers.values()].flat().map(st => [st, st.i]));
    finishForReading();
  };
  const available = (s, view = root.dataset.view) => view === 'read' ? s.dataset.read !== 'hide' : s.dataset.present !== 'hide';

  /* ================= navigation ================= */
  let readAnchor = null;
  // force: re-render the chrome even if the slide hasn't changed (after a view switch, or at startup)
  function go(i, step, force) {
    const list = slides(), from = cur;
    cur = Math.max(0, Math.min(list.length - 1, i));
    if (!available(list[cur])) {
      const dir = cur < from ? -1 : 1, target = cur;
      while (list[cur] && !available(list[cur])) cur += dir;
      if (!list[cur]) {
        cur = target;
        while (list[cur] && !available(list[cur])) cur -= dir;
      }
      if (!list[cur]) { cur = from; return; }
    }
    const s = list[cur];
    if (reading()) {
      s.closest('.frame').scrollIntoView({ behavior: 'instant' });
      readAnchor = { y: scrollY };    // short sections near the end cannot always reach the top third
      announce(); return;
    }
    if (cur !== from || step != null) setAt(s, step ?? (cur === from - 1 ? Infinity : 0));
    if (cur !== from || force) { list.forEach(item => item.classList.toggle('active', item === s)); announce(); }
    sync();
  }
  function next() { if (reading() || !stepsOf(slide()).some(st => st.next())) go(cur + 1); }
  function prev() { if (reading() || ![...stepsOf(slide())].reverse().some(st => st.prev())) go(cur - 1); }

  // the current slide changed: update the chrome around it
  let ovCur;
  function announce() {
    const s = slide(), n = slides().length, pct = (cur + 1) / n;
    ovCur?.classList.remove('cur'); ovCur = $('overview').children[cur]; ovCur?.classList.add('cur');
    $('sectionLabel').textContent = $('mSec').textContent = s.dataset.section || '';
    $('count').textContent = $('dCount').textContent = `${cur + 1} / ${n}`;
    $('dCount').setAttribute('aria-label', `Slide ${cur + 1} of ${n}`);
    $('mProg').style.transform = `scaleX(${pct})`;
    if (!reading()) $('progress').style.transform = `scaleX(${pct})`;
    if ('notes' in root.dataset) fillNotes();
    $('notesTitle').textContent = `SPEAKER NOTES · ${s.dataset.name || ''}`;
    $('notesTk').textContent = s.dataset.takeaway ? 'Takeaway: ' + s.dataset.takeaway : '';
    $('notesBody').textContent = s.querySelector('.notes')?.textContent.trim() || '—';
    if ($('src').classList.contains('on')) fillSource();
    handlers.slide.forEach(f => f(s, cur));
    if (reading()) history.replaceState(null, '', '#' + (cur + 1)); else if (portrait.matches) fit();
    mobileState();
  }
  const fillNotes = () => { $('mNotes').innerHTML = slide().querySelector('.notes')?.innerHTML || ''; $('mNotes').scrollTop = 0; };   // the speaker's notes

  const label = s => s.querySelectorAll('[data-next]').forEach(b => b.textContent = done(s) ? 'Reset ↺' : 'Next →');
  function sync() {
    const s = slide(), n = total(s), k = at(s);
    $('stepNav').classList.toggle('on', n > 1);
    $('stepCount').textContent = `step ${k + 1}/${n}`;
    $('up').disabled = k === 0; $('down').disabled = k === n - 1;
    label(s);
    mobileState();
    if (!reading()) history.replaceState(null, '', '#' + (cur + 1) + (n > 1 && k ? '.' + (k + 1) : ''));
    broadcast();
  }

  /* ================= views ================= */
  // merge params into the query string, keeping the hash
  function setQuery(params) {
    const keep = new URLSearchParams(location.search); params.forEach((v, k) => keep.set(k, v));
    history.replaceState(null, '', '?' + keep + location.hash);
  }
  function setView(v, chosen = true) {
    if (v !== 'read' && v !== 'present') return;
    if (chosen) setQuery(new Map([['view', v]]));   // a reload or a shared link opens in the same view
    if (v === root.dataset.view) return;
    if (reading()) onScroll();                 // use the visible section, even before the next scroll event
    const i = Math.max(cur, 0);
    window.scrollTo({ top: scrollY, behavior: 'instant' });
    root.dataset.view = v;
    if (v === 'read') enterReading();
    else {
      for (const [st, k] of presentationSteps) st.go(k, true);
      delete root.dataset.notes;
      $('dNotes').classList.remove('on');
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    fit();
    go(i, undefined, true);
    icons();
  }
  const toggleView = () => setView(reading() ? 'present' : 'read');

  // read view: the current slide is the one crossing the top third of the screen
  let frames = [], scrolling = false;
  function onScroll() {
    scrolling = false;
    if (!reading()) return;
    if (!$('dPanel').hidden) setDock(false);
    const max = root.scrollHeight - innerHeight;
    $('progress').style.transform = `scaleX(${max > 0 ? scrollY / max : 1})`;
    if (readAnchor && Math.abs(scrollY - readAnchor.y) < 2) return;
    readAnchor = null;
    const y = scrollY < 2 ? 0 : innerHeight * .35;
    let i = max > 0 && scrollY >= max - 2
      ? frames.findLastIndex(f => f.getClientRects().length)
      : frames.findIndex(f => f.getClientRects().length && f.getBoundingClientRect().bottom > y);
    if (i < 0) i = frames.findLastIndex(f => f.getClientRects().length);
    if (i < 0) return;
    if (i !== cur) { cur = i; announce(); } else mobileState();
  }

  function mobileState() {
    if (!$('dSlides')) return;
    $('dSlides').setAttribute('aria-pressed', String(!reading()));
    $('dRead').setAttribute('aria-pressed', String(reading()));
    $('dNotes').setAttribute('aria-pressed', String('notes' in root.dataset));
    const list = slides(), s = slide();
    if (!s) return;
    $('dPrev').disabled = !list.slice(0, cur).some(item => available(item)) && (reading() || at(s) === 0);
    $('dNext').disabled = !list.slice(cur + 1).some(item => available(item)) && (reading() || done(s));
    $('dHome').disabled = !list.slice(0, cur).some(item => available(item)) && (reading() ? scrollY < 2 : at(s) === 0);
    const step = !reading() && total(s) > 1 ? `step ${at(s) + 1}/${total(s)}` : '';
    $('dCount').innerHTML = `<span>${cur + 1} / ${list.length}</span>${step ? `<small>${step}</small>` : ''}`;
    $('dCount').setAttribute('aria-label', `Slide ${cur + 1} of ${list.length}${step ? ', ' + step : ''}`);
    $('dPosition').textContent = cur + 1;
    $('dToggle').setAttribute('aria-label', `${$('dPanel').hidden ? 'Open' : 'Close'} navigation, slide ${cur + 1} of ${list.length}`);
    $('dHint').textContent = reading() ? 'Scroll to read. Switch to Slides to present this section.' : 'Swipe left/right to step. Tap the left/right edge to go back/forward.';
  }

  function setDock(open) {
    const panel = $('dPanel'), toggle = $('dToggle');
    const restoreFocus = !open && panel.contains(document.activeElement);
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    $('dock').classList.toggle('open', open);
    mobileState();
    if (restoreFocus) toggle.focus({ preventScroll: true });
  }

  function mobileNavigation() {
    const dialog = $('mobileNav'), list = $('mobileNavList');
    let sections = true;
    const render = () => {
      $('navSections').setAttribute('aria-selected', String(sections));
      $('navSlides').setAttribute('aria-selected', String(!sections));
      $('navSections').tabIndex = sections ? 0 : -1;
      $('navSlides').tabIndex = sections ? -1 : 0;
      list.setAttribute('aria-labelledby', sections ? 'navSections' : 'navSlides');
      list.replaceChildren();
      let previous;
      slides().forEach((s, i) => {
        if (!available(s)) return;
        const section = s.dataset.section || 'Opening';
        const chapter = previous !== section || s.classList.contains('layout-section');
        previous = section;
        if (sections && !chapter) return;
        const b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = `<span>${pad2(i + 1)}</span><b>${esc(sections ? section : (s.dataset.name || s.querySelector('h1, h2')?.textContent || 'Untitled'))}</b>`;
        const end = slides().findIndex((item, j) => j > i && (item.dataset.section || 'Opening') !== section);
        if (sections ? cur >= i && (end < 0 || cur < end) : cur === i) b.setAttribute('aria-current', 'location');
        b.onclick = () => { dialog.close(); go(i, undefined, true); };
        list.append(b);
      });
    };
    $('dToggle').onclick = () => setDock($('dPanel').hidden);
    document.addEventListener('click', e => { if (!$('dPanel').hidden && !e.target.closest('#dock')) setDock(false); });
    $('dSections').onclick = () => { sections = true; render(); setDock(false); dialog.showModal(); };
    dialog.addEventListener('close', () => { if ($('dock').getClientRects().length) $('dToggle').focus({ preventScroll: true }); });
    $('navClose').onclick = () => dialog.close();
    dialog.onclick = e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) dialog.close(); } };
    for (const [id, value] of [['navSections', true], ['navSlides', false]]) {
      $(id).onclick = () => { sections = value; render(); };
      $(id).onkeydown = e => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault(); sections = e.key === 'Home' || (e.key !== 'End' && !sections); render();
        $(sections ? 'navSections' : 'navSlides').focus();
      };
    }
  }

  /* ================= fitting the stage ================= */
  const dockSpace = () => $('dock').offsetHeight ? root.clientHeight - $('dock').getBoundingClientRect().top + 12 : 0;
  function fit() {
    const st = $('stage');
    st.style.top = st.style.width = st.style.height = '';
    root.style.setProperty('--dock-space', `${dockSpace()}px`);
    delete root.dataset.tall;
    if (reading()) {
      // fixed slides are scaled to the width of their figures
      st.style.transform = '';
      const fig = document.querySelector('.fig');
      if (fig) root.style.setProperty('--fit', Math.min(1, fig.clientWidth / W));
      return;
    }
    if (presenter) {                                   // the slide on the left, the presenter panel on the right
      const w = root.clientWidth * .62 - 48, h = root.clientHeight - 48;
      st.style.left = `${24 + w / 2}px`;
      st.style.transform = `translate(-50%,-50%) scale(${Math.min(w / W, h / H)})`;
      return;
    }
    if (!portrait.matches) {
      const height = root.clientHeight - dockSpace();
      st.style.top = `${height / 2}px`;
      st.style.transform = `translate(-50%,-50%) scale(${Math.min(root.clientWidth / W, height / H)})`; return;
    }
    const s = slide(), head = $('mhead').offsetHeight;
    if (s && tall(s, st, head)) return;
    // a fixed 16:9 slide spans the width under a native header, its own bar tucked behind it
    const k = root.clientWidth / W, bar = $('bar').offsetHeight;
    place(st, head, (H - bar) * k, -bar * k, k);
  }

  // portrait: the slide sits under the header, centred above the dock, or at the top with its notes below
  function place(st, head, h, shift, k) {
    const room = root.clientHeight - head - dockSpace();
    const top = 'notes' in root.dataset ? head : head + Math.max(0, (room - h) / 2);
    st.style.top = `${top + shift}px`;
    st.style.transform = `translateX(-50%) scale(${k})`;
    root.style.setProperty('--slide-bottom', `${top + h}px`);
  }
  function toggleNotes() {
    if (portrait.matches && !reading()) { root.toggleAttribute('data-notes'); $('dNotes').classList.toggle('on', 'notes' in root.dataset); mobileState(); fillNotes(); fit(); }
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
    const avail = (root.clientHeight - head - dockSpace()) * ('notes' in root.dataset ? .58 : 1) / k;
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
    home: '<path d="M2 8.5L9 2l7 6.5M4 7v9h10V7M7 16v-5h4v5"/>',
    code: '<path d="M6.5 5L2.5 9l4 4M11.5 5l4 4-4 4"/>',
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
      if (!isMd) widgets(n.querySelector('.content') || n);
      if (isMd && n.closest('#stage')) n.before(...made); else stage.append(...made);
      if (isMd) n.remove();
    }
    if (!$('bar')) stage.insertAdjacentHTML('afterbegin', `<div id="bar"><div class="title">${esc(document.title)}</div></div>`);
    const bar = $('bar');
    if (!$('sectionLabel')) bar.insertAdjacentHTML('beforeend', '<div class="section" id="sectionLabel"></div>');
    bar.insertAdjacentHTML('beforeend', `<div class="tools"><button class="ib" id="ovBtn" title="Overview (O)">${svg('grid')}</button><button class="ib" id="srcBtn" title="View source (S)">${svg('code')}</button><button class="ib" id="viewBtn"></button>${picker ? `<button class="ib" id="lookBtn" title="Theme" aria-haspopup="true">${svg('palette')}</button>` : ''}<button class="ib" id="themeBtn" title="Light / dark (T)"></button></div>`);

    // each slide sits in a frame with a label and its notes-as-prose, both shown only in read view
    const cue = /\[~?[\d.]+\s*(?:s|sec|secs|m|min|mins)\b[^\]]*\]\s*/gi;
    all = [...document.querySelectorAll('.slide')];
    all.forEach((s, i) => {
      if (!s.classList.contains('md') && !s.classList.contains('flow')) s.classList.add('fixed');
      const f = document.createElement('article'); f.className = 'frame';
      s.before(f);
      f.insertAdjacentHTML('beforeend', `<div class="rh"><span>${pad2(i + 1)}</span>${esc(s.dataset.section || '')}</div>`);
      f.append(s);
      if (s.dataset.read) f.dataset.read = s.dataset.read;
      if (s.dataset.present) f.dataset.present = s.dataset.present;
      const notes = s.querySelector('.article') || (s.classList.contains('md') ? null : s.querySelector('.notes'));
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
      <nav id="dock" aria-label="Presentation navigation">
        <div id="dPanel" hidden>
        <div class="view-switch" role="group" aria-label="Reading format"><button id="dSlides" aria-pressed="true">${svg('present')}<span>Slides</span></button><button id="dRead" aria-pressed="false">${svg('read')}<span>Article</span></button></div>
        <div class="dock-actions"><button id="dHome" aria-label="Back to top" title="Back to top">${svg('home')}</button><button id="dSections" aria-label="Jump to a section or slide" title="Sections" aria-haspopup="dialog">${svg('grid')}</button><button id="dPrev" aria-label="Previous slide or step" title="Previous">‹</button><span id="dCount"></span><button id="dNext" aria-label="Next slide or step" title="Next">›</button><button id="dNotes" aria-label="Speaker notes" aria-pressed="false" title="Speaker notes">${svg('notes')}</button></div>
        <p id="dHint"></p></div>
        <button id="dToggle" aria-label="Open navigation" aria-expanded="false" aria-controls="dPanel"><span id="dPosition" aria-hidden="true"></span><svg viewBox="0 0 18 18" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="3" cy="9" r="1.5"/><circle cx="9" cy="9" r="1.5"/><circle cx="15" cy="9" r="1.5"/></svg></button>
      </nav>
      <dialog id="mobileNav" aria-labelledby="navTitle"><div class="nav-heading"><h2 id="navTitle">Jump to</h2><button id="navClose" aria-label="Close navigation">×</button></div><div class="nav-tabs" role="tablist" aria-label="Browse presentation"><button id="navSections" role="tab" aria-controls="mobileNavList" aria-selected="true">Sections</button><button id="navSlides" role="tab" aria-controls="mobileNavList" aria-selected="false" tabindex="-1">Slides</button></div><div id="mobileNavList" role="tabpanel" aria-labelledby="navSections"></div></dialog>
      <div id="help">← → slides · ↑ ↓ steps · O overview · R read · T theme · ? keys</div>
      <div id="keys"><div class="kcard"><h3>Keyboard</h3>
        <p><kbd>←</kbd> <kbd>→</kbd> <kbd>Space</kbd> previous / next slide · <kbd>Home</kbd> <kbd>End</kbd> first / last</p>
        <p><kbd>↑</kbd> <kbd>↓</kbd> <kbd>Enter</kbd> previous / next step, then on to the next slide · <kbd>1</kbd>–<kbd>9</kbd> jump to a step</p>
        <p><kbd>R</kbd> read as an article / present · <kbd>T</kbd> light / dark · <kbd>O</kbd> overview · <kbd>N</kbd> notes · <kbd>F</kbd> fullscreen · <kbd>S</kbd> view the slide's Markdown · <kbd>Esc</kbd> close</p>
        <p><kbd>P</kbd> presenter view · <kbd>L</kbd> laser pointer · <kbd>D</kbd> draw on the slide</p>
      </div></div>
      <div id="src"><div class="kcard"><div class="sh"><h3>Markdown source</h3><button id="srcCopy">Copy</button></div><pre class="code"><code></code></pre></div></div>`);

    $('srcBtn').onclick = toggleSource;
    $('srcCopy').onclick = copySource;
    $('src').onclick = e => { if (!e.target.closest('.kcard')) $('src').classList.remove('on'); };
    $('viewBtn').onclick = toggleView;
    $('themeBtn').onclick = toggleTheme;
    if (picker) buildPicker();
    $('ovBtn').onclick = toggleOverview;
    $('prev').onclick = () => go(cur - 1);
    $('next').onclick = () => go(cur + 1);
    $('up').onclick = $('dPrev').onclick = prev;
    $('down').onclick = $('dNext').onclick = next;
    $('dSlides').onclick = () => { setDock(false); setView('present'); };
    $('dRead').onclick = () => { setDock(false); setView('read'); };
    $('dHome').onclick = () => {
      go(0, reading() ? undefined : 0, true);
      if (reading()) { window.scrollTo({ top: 0, behavior: 'instant' }); onScroll(); }
      setDock(false);
    };
    $('dNotes').onclick = () => { toggleNotes(); setDock(false); };
    mobileNavigation();
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
  function setMode(m) { root.dataset.mode = m; store.set('mode', m); icons(); }
  function setLook(t) { root.dataset.theme = t; if (picker) store.set('look', t); }
  const toggleTheme = () => setMode(root.dataset.mode === 'dark' ? 'light' : 'dark');

  // the theme picker (<html data-theme-picker>): each swatch carries the theme's own tokens
  const THEMES = {
    Everyday: ['clean', 'paper', 'slate', 'ledger', 'noir'],
    'Editorial & craft': ['editorial', 'swiss', 'atelier', 'mocha'],
    'Warm & friendly': ['rose', 'sunset', 'chalk', 'clinic'],
    'Nature & calm': ['forest', 'ocean', 'nord'],
    Tech: ['solar', 'terminal', 'ai', 'blueprint'],
    Loud: ['punk', 'volt', 'synth'],
  };
  // the mode each theme was designed in first (both always work); shown in the picker
  const DARK_FIRST = ['noir', 'chalk', 'nord', 'solar', 'terminal', 'ai', 'blueprint', 'volt', 'synth'];
  function buildPicker() {
    const pop = document.createElement('div'); pop.id = 'looks'; pop.setAttribute('role', 'menu');
    pop.innerHTML = Object.entries(THEMES).map(([group, ts]) => `<div class="lg">${group}</div>`
      + ts.map(t => { const first = DARK_FIRST.includes(t) ? 'dark' : 'light';
        return `<button role="menuitemradio" data-look="${t}" data-theme="${t}"><i></i><span>${t === 'ai' ? 'AI' : t[0].toUpperCase() + t.slice(1)}</span><em title="Designed ${first} first">${svg(first)}</em></button>`; }).join('')).join('');
    document.body.append(pop);
    const mark = () => pop.querySelectorAll('button').forEach(b => { b.dataset.mode = root.dataset.mode; b.setAttribute('aria-checked', b.dataset.look === root.dataset.theme); });
    pop.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      setLook(b.dataset.look);
    };
    $('lookBtn').onclick = e => { e.stopPropagation(); mark(); pop.classList.toggle('on'); };
    document.addEventListener('click', e => { if (!e.target.closest('#looks')) pop.classList.remove('on'); });
    new MutationObserver(mark).observe(root, { attributes: true, attributeFilter: ['data-mode', 'data-theme'] });
  }
  // view source: the current slide's Markdown as written (hand-built HTML slides have none); follows the slide while open
  function fillSource() {
    const md = sourceOf.get(slide())?.replace(/<\/script/gi, '<\\/script'), code = $('src').querySelector('code');   // as the author writes it
    $('srcCopy').hidden = md == null;
    if (md == null) { code.textContent = 'This slide is hand-built HTML; view the page source.'; return; }
    code.textContent = md;
    if (window.hljs?.getLanguage('markdown')) code.innerHTML = hljs.highlight(md, { language: 'markdown', ignoreIllegals: true }).value;
  }
  function toggleSource() { $('src').classList.toggle('on'); if ($('src').classList.contains('on')) fillSource(); }
  function copySource() {
    const b = $('srcCopy');
    navigator.clipboard?.writeText($('src').querySelector('code').textContent).then(() => { b.textContent = 'Copied'; setTimeout(() => b.textContent = 'Copy', 1400); }, () => {});
  }
  function toggleOverview() { const ov = $('overview'); ov.classList.toggle('on'); if (ov.classList.contains('on')) ov.querySelector('.cur')?.focus(); }

  /* ================= input ================= */
  function onKey(e) {
    if ($('mobileNav').open) return;    // the dialog owns focus, tab arrows and Escape
    if (e.key === 'Escape' && !$('dPanel').hidden) { setDock(false); e.preventDefault(); return; }
    if (e.target.closest('#dock')) return;
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
    if ($('src').classList.contains('on') && (lk === 's' || k === 'Escape')) { $('src').classList.remove('on'); return; }
    if ($('keys').classList.contains('on')) { $('keys').classList.remove('on'); if (k === '?' || k === 'Escape') return; }
    if (customKeys[k]) { customKeys[k](e); return; }

    if (lk === 'r') toggleView();
    else if (lk === 't') toggleTheme();
    else if (lk === 'o') toggleOverview();
    else if (lk === 's') toggleSource();
    else if (k === '?') $('keys').classList.add('on');
    else if (k === 'Escape') { delete root.dataset.laser; delete root.dataset.draw; ov.classList.remove('on'); $('notes').classList.remove('on'); $('looks')?.classList.remove('on'); }
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
    else if (lk === 'p') openPresenter();
    else if (lk === 'l') toggleMode('laser');
    else if (lk === 'd') toggleMode('draw');
    else if (lk === 'f') document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen();
  }

  function swipe() {
    let gesture = null, lastTap = -Infinity;
    // Embedded controls and horizontal scrollers own their gestures. Custom
    // interactive surfaces can opt out with data-no-swipe.
    const interactive = 'button, a, input, select, textarea, pre, table, iframe, video, audio, canvas, svg, [contenteditable], [draggable=true], [role="button"], [role="tab"], [role="slider"], [data-no-swipe], #dock, #mobileNav, #mNotes';
    const ownsGesture = target => {
      if (target.closest(interactive)) return true;
      for (let el = target; el && !el.classList.contains('slide'); el = el.parentElement) {
        if (el.scrollWidth > el.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return true;
      }
      return false;
    };
    addEventListener('touchstart', e => {
      gesture = null;
      if (reading() || $('mobileNav').open || e.touches.length !== 1 || ownsGesture(e.target)) return;
      const owner = e.target.closest('.slide');
      if (owner !== slide()) return;
      const t = e.touches[0];
      // Keep the browser's own back/forward edge gestures available.
      if (t.clientX < 16 || t.clientX > innerWidth - 16) return;
      gesture = { x: t.clientX, y: t.clientY, time: performance.now(), owner,
        scroll: owner.querySelector('.content')?.scrollTop || 0, distance: 0, vertical: false, dismiss: !$('dPanel').hidden };
    }, { passive: true });
    addEventListener('touchmove', e => {
      if (!gesture) return;
      if (e.touches.length !== 1) { gesture = null; return; }
      const dx = Math.abs(e.touches[0].clientX - gesture.x), dy = Math.abs(e.touches[0].clientY - gesture.y);
      gesture.distance = Math.max(gesture.distance, Math.hypot(dx, dy));
      if (dy > 12 && dy > dx * 1.2) gesture.vertical = true;
    }, { passive: true });
    addEventListener('touchcancel', () => { gesture = null; }, { passive: true });
    addEventListener('touchend', e => {
      const g = gesture; gesture = null;
      if (!g || e.touches.length || e.changedTouches.length !== 1 || reading() || slide() !== g.owner) return;
      if (g.dismiss) { setDock(false); return; }
      if (g.vertical || Math.abs((g.owner.querySelector('.content')?.scrollTop || 0) - g.scroll) > 1 || !getSelection().isCollapsed) return;
      const t = e.changedTouches[0], dx = t.clientX - g.x, dy = t.clientY - g.y, elapsed = performance.now() - g.time;
      const threshold = Math.min(90, Math.max(50, innerWidth * .12));
      if (elapsed < 800 && Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * 1.6) {
        dx < 0 ? next() : prev();
      } else if (elapsed < 300 && Math.max(g.distance, Math.hypot(dx, dy)) < 12) {
        const edge = Math.min(56, Math.max(36, innerWidth * .12)), now = performance.now();
        if (g.x > edge && g.x < innerWidth - edge) return;
        if (now - lastTap < 350) return;  // a double tap must not skip two steps
        lastTap = now;
        g.x < edge ? prev() : next();
      }
    }, { passive: true });
  }

  // #slide or #slide.step, 1-based; [0, 1] when there's no hash
  function fromHash() {
    const h = decodeURIComponent(location.hash.slice(1)), m = h.match(/^(\d+)(?:\.(\d+))?$/);
    if (m) return [+m[1], +(m[2] || 1)];
    const i = slides().findIndex(s => s.dataset.id === h);
    return i >= 0 ? [i + 1, 1] : [0, 1];
  }

  // :name: icons from Lucide, fetched once per name and inlined so they take the text colour
  const LUCIDE = 'https://cdn.jsdelivr.net/npm/lucide-static@0.468.0/icons/', iconCache = {};
  function lucide() {
    if (root.dataset.icons === 'off') return;
    document.querySelectorAll('i.ico[data-icon]').forEach(el => {
      const n = el.dataset.icon;
      (iconCache[n] ??= fetch((root.dataset.icons || LUCIDE) + n + '.svg').then(r => r.ok ? r.text() : Promise.reject()))
        .then(svg => { el.innerHTML = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/<svg[^>]*>/, t => t.replace(/\s(width|height)="\d+"/g, '')); })   // size from CSS
        .catch(() => { el.textContent = `:${n}:`; el.classList.add('missing'); });
    });
  }

  // ::: agenda lists the section slides, each linking to its slide
  function agendas() {
    const parts = slides().map((s, i) => [s, i]).filter(([s]) => s.classList.contains('layout-section'));
    document.querySelectorAll('.w-agenda').forEach(w => w.innerHTML = `<ol>${parts.map(([s, i]) =>
      `<li><a href="#${i + 1}"><b>${esc(s.querySelector('h1, h2')?.textContent || s.dataset.section || '')}</b>${s.querySelector('h1 + p, h2 + p') ? `<span>${esc(s.querySelector('h1 + p, h2 + p').textContent)}</span>` : ''}</a></li>`).join('')}</ol>`);
  }

  // ::: qr — a QR code of the URL inside, or of this deck without its slide number (qrcode-generator, fetched when used)
  const QRLIB = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
  function qrs() {
    const ws = [...document.querySelectorAll('.w-qr')];
    if (!ws.length) return;
    const draw = () => ws.forEach(w => {
      const url = w.dataset.url || location.origin + location.pathname, q = qrcode(0, 'M');
      q.addData(url); q.make();
      w.innerHTML = `<div class="w-qr-code">${q.createSvgTag({ cellSize: 4, margin: 0, scalable: true })}</div><a href="${url}">${esc(url.replace(/^https?:\/\//, ''))}</a>`;
    });
    window.qrcode ? draw() : load(QRLIB, draw);
  }

  /* laser pointer (L) and pen (D): both live on the stage, so they line up with the slide at any scale */
  function ink() {
    const st = $('stage');
    st.insertAdjacentHTML('beforeend', `<canvas id="ink" width="${W * 2}" height="${H * 2}"></canvas><div id="laser"></div>`);
    const cv = $('ink'), g = cv.getContext('2d'), dot = $('laser');
    g.scale(2, 2); g.lineCap = g.lineJoin = 'round';
    const local = e => { const r = st.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
    let pen = null;
    st.addEventListener('pointermove', e => {
      const [x, y] = local(e);
      if ('laser' in root.dataset) dot.style.transform = `translate(${x}px, ${y}px)`;
      if (pen) { g.lineTo(x, y); g.stroke(); }
    });
    cv.addEventListener('pointerdown', e => {
      const [x, y] = local(e); pen = true; cv.setPointerCapture(e.pointerId);
      g.strokeStyle = getComputedStyle(root).getPropertyValue('--accent'); g.lineWidth = 4;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + .1, y); g.stroke();
    });
    cv.addEventListener('pointerup', () => pen = null);
    handlers.slide.push(() => g.clearRect(0, 0, W, H));
  }
  const toggleMode = k => { const on = !(k in root.dataset); delete root.dataset.laser; delete root.dataset.draw; if (on) root.dataset[k] = ''; };

  /* presenter view (P): a second window shows the slide, the next one, the notes and a timer. The two windows follow
     each other over a BroadcastChannel, so either can drive. */
  const presenter = q.has('presenter');
  let channel, remote = false;
  function link() {
    if (!window.BroadcastChannel) return;
    channel = new BroadcastChannel('talkdown:' + location.pathname);
    channel.onmessage = ({ data }) => {
      if (reading() || (data.i === cur && data.k === at(slide()))) return;
      remote = true; go(data.i, data.k); remote = false;
    };
  }
  function broadcast() { if (channel && !remote && started && !reading()) channel.postMessage({ i: cur, k: at(slide()) }); }
  function presenterView() {
    document.body.insertAdjacentHTML('beforeend', `<div id="presenter">
      <div class="p-top"><span id="pTimer">0:00</span><button id="pReset" title="Restart the timer">Restart</button><span id="pClock"></span><span id="pCount"></span></div>
      <h5>Next</h5><div id="pNext"></div><h5>Notes</h5><div id="pNotes"></div></div>`);
    let t0 = Date.now();
    const clock = () => {
      const sec = Math.floor((Date.now() - t0) / 1000);
      $('pTimer').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      $('pClock').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    setInterval(clock, 1000); clock();
    $('pReset').onclick = () => { t0 = Date.now(); clock(); };
    handlers.slide.push((s, i) => {
      const nx = slides()[i + 1], box = $('pNext');
      box.innerHTML = '';
      box.style.setProperty('--k', box.clientWidth / W);
      if (nx) { const c = nx.cloneNode(true); c.classList.add('active'); c.removeAttribute('id'); c.querySelectorAll('[id]').forEach(e => e.removeAttribute('id')); box.append(c); }
      else box.innerHTML = '<p class="p-end">End of the deck</p>';
      $('pNotes').innerHTML = s.querySelector('.notes')?.innerHTML || '<p class="p-end">No notes for this slide.</p>';
      $('pCount').textContent = `${i + 1} / ${slides().length}`;
    });
  }
  const openPresenter = () => { const u = new URL(location.href); u.searchParams.set('presenter', ''); u.searchParams.set('view', 'present'); window.open(u, 'talkdown-presenter', 'width=1280,height=800'); };

  async function start() {
    // Only decks that explicitly reference Markdown perform a source fetch.
    // Inline decks still assemble synchronously, including when opened from disk.
    const references = [...document.querySelectorAll('script[type="text/markdown"][data-src]')];
    if (references.length) await Promise.all(references.map(async node => {
      try {
        if (!node.dataset.src.trim()) throw new Error('Missing Markdown URL');
        const response = await fetch(node.dataset.src);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        node.textContent = await response.text();
      } catch (error) {
        const message = document.createElement('p'); message.className = 'td-error td-load-error'; message.setAttribute('role', 'alert');
        message.textContent = `Could not load slides from ${node.dataset.src || '(empty URL)'}: ${error.message}. External Markdown requires HTTP; inline decks can open directly from disk.`;
        node.before(message); node.remove();
      }
    }));
    assemble();
    if (!all.length) return;
    agendas();
    qrs();
    lucide();
    ink();
    link();
    if (presenter) presenterView();
    highlight();
    diagrams();
    maths();
    document.querySelectorAll('[data-build]').forEach(build);
    document.querySelectorAll('[data-next]').forEach(b => b.addEventListener('click', () => {
      const s = b.closest('.slide');
      if (done(s)) setAt(s, 0); else stepsOf(s).some(st => st.next());
    }));
    // a clicked button keeps focus, so Space / Enter would press it again; hand the keys back to the deck
    document.addEventListener('click', e => { const b = e.target.closest('#stage button'); if (b) b.blur(); });
    // [text](#id) links to the slide with that id; [text](?theme=rose#id) and ?mode=dark restyle this page in place,
    // so the slide and step you're on stay put
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href]'); if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const u = new URL(a.href, location.href);
      if (u.origin + u.pathname !== location.origin + location.pathname) return;
      const { look, mode } = lookOf(u.searchParams), restyle = look || mode;
      const i = u.hash ? slides().findIndex(s => s.dataset.id === decodeURIComponent(u.hash.slice(1))) : -1;
      if (u.search ? !restyle : i < 0) return;
      e.preventDefault();
      if (look) setLook(look);
      if (mode) setMode(mode);
      if (restyle) setQuery(u.searchParams);
      if (i >= 0 && i !== cur) go(i, reading() ? undefined : 0);
    });
    addEventListener('keydown', onKey);
    addEventListener('hashchange', () => { const [sl, sp] = fromHash(); if (sl) go(sl - 1, reading() ? undefined : sp - 1); });
    let resizing = false;
    addEventListener('resize', () => { if (!resizing) { resizing = true; requestAnimationFrame(() => { resizing = false; fit(); }); } });
    addEventListener('scroll', () => { if (!scrolling) { scrolling = true; requestAnimationFrame(onScroll); } }, { passive: true });
    swipe();
    handlers.ready.forEach(f => f());
    started = true;
    const [sl, sp] = fromHash();
    if (reading()) enterReading();
    all.forEach(label);
    if (reading() && !sl) { cur = 0; announce(); fit(); onScroll(); }      // an article opens at the top
    else { cur = Math.max(0, sl - 1); fit(); go(cur, reading() ? undefined : sp - 1, true); }
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : setTimeout(start);

  window.Deck = {
    steps, tabs, build, go, next, prev, store, setView, chart, markdown: s => renderMarkdown(dedent(s.split('\n')).join('\n')),
    get cur() { return cur; },
    get slides() { return slides(); },
    get slide() { return slide(); },
    on(ev, f) { handlers[ev].push(f); },
    key(k, f) { customKeys[k] = f; },
  };
})();

