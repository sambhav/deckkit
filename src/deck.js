import { activateExplorable } from './explorable.js';
import { renderMarkdown, renderInline, slideChunks } from './markdown.js';
import { glossary } from './glossary.js';
import { citations } from './citations.js';
import { timerRemaining } from './timer.js';
import { parseCSV, chartDataset, csvDownload } from './data.js';
import { magnitudeModel } from './magnitude.js';
import { gallery } from './gallery.js';
import { visualTypes, visualChart } from './visual-charts.js';
import { beforeAfter } from './before-after.js';
import { environmentDifferences } from './envdiff.js';
import { runCell, liveCode } from './runnable.js';
import { citeFormats } from './cite.js';

/* talkdown — slide decks written in Markdown (or HTML), presented on a 16:9 stage, read like an article on a phone.
 *
 * Present view (default on every screen)      Read view (R or the mobile menu)
 *   ← → Space PgUp PgDn   slides               one scrolling column; speaker notes become the prose,
 *   ↑ ↓ Enter             steps, then slides   builds show finished, fixed-layout slides become figures
 *   1–9                   jump to a step       ← → hop between slides
 *   Home End · O overview · N notes · T light / dark · R read / present · F fullscreen · S view source · ? keys · Esc close
 *
 * Themes: <html data-theme="rose"> (data-theme-dark="clean" for a different look in dark mode), 23 of them, each with a light and a dark mode and its own typefaces (fetched for the
 * active theme; <html data-fonts="off"> keeps system fonts). <html data-theme-picker> adds a picker to the top bar.
 * Article: a thin reading-progress bar always shows; <html data-read-progress> adds a section list beside the text on wide screens that follows the reader.
 * Top bar: <div id="bar"><div class="title">Name</div><a href="…">Link</a></div> in the page replaces the default title.
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
 *   ::: code-group + one fence each     language tabs; a pick switches every group in the deck and is remembered.
 *                                       ```js [Node.js] labels a tab; Deck.choice shares the stored pick with other widgets
 *   ::: install + ```sh macos / linux / windows   one command per system, as tabs; the viewer's system is picked first
 *                                       and a pick is remembered (Deck.choice group "os"), with a copy button on each
 *   ```lang {annotate} + a 1. 2. list   "# (1)" / "// (1)" line-end comments become numbered pins; ↓ highlights each line and its note
 *   ::: compare                         two images; draggable wipe, ↓ reveals 0 / 50 / 100%; article shows both
 *   ::: explorable                      [qps=1000]{range=100..10000} values and {qps*40/1000} arithmetic
 *   ::: quiz                            ### question, task-list choices (one [x]); ↓ reveals answer and explanation
 *   ::: prompt model="any-model" temperature=0   ### Prompt / ### Output; ↓ reveals the output
 *   ::: versus                          ### models side by side (2-4), optional > prompt quote and ### Verdict; ↓ adds one column
 *   ```tree {steps}                     a file tree: indent to nest, "dir/" for folders, "+ " "- " "* " added / removed / highlighted,
 *                                       "  # note" after a name; folders open and close, {steps} opens one per ↓
 *   ::: flip                            ### front, the rest is the back
 *   ::: flow / ::: stack               bulleted boxes; flow vertical changes direction; build: true or {.step} reveals items
 *   ::: changelog                       ### version · YYYY-MM-DD releases, #### group labels; one release per step, all in articles
 *   ::: timeline                        ### milestones; ↓ walks them; vertical on phones and in read view
 *   ::: quadrant x="Effort" y="Impact"  four ### quadrant labels, then optional - Label [0.2, 0.8] points
 *   ::: chat                            **user:** / **assistant:** / **system:** / **tool** messages; ↓ reveals messages; tool rows expand
 *   ```sequence                         A -> B: msg / A --> B: reply / note: text; ↓ draws the next message; articles add a numbered list
 *   ::: gallery                         Markdown images become a grid; ↓ highlights each, click opens a captioned lightbox
 *   ::: board                           ### columns with lists of cards; ↓ reveals each column, all shown in read view
 *   [@key] and ::: references          "- key: Reference" list; [@key] becomes a numbered [1] link, hover shows the entry
 *   ::: glossary                       Term: Definition lines; first use tooltips in articles, glossary: inline opts slides in
 *   ::: speaker                         optional photo, ### name, role and Markdown links; compact author box in read view
 *   author: date: tags: [a, b]          slide frontmatter: a byline under the title in the article, with reading time and <meta> / OpenGraph tags
 *   ::: cite                            share box from the page's title, author and date metadata; hidden on the stage unless `present`; copy link, Markdown, BibTeX
 *   ::: links                           a list of [Title](URL) descriptions becomes further-reading cards; no network fetches
 *   ::: hotspots                        image + - [12%, 30%] Label; ↓ selects each numbered pin; article shows a legend
 *   ::: timer 10m                     countdown started with ↓ or Start; pause/reset controls, duration text in articles
 *   ::: meter value=72 max=100 label="Done" unit=% / [1.2M]{count}   animated on ↓, final values in read view
 *   `spark:9,8,8,6,5,5`                inline SVG trend in prose or tables; accessible values, same in both views
 *   ```bench unit=ms                    lines of "name  12.1 ± 0.4" (or hyperfine JSON): ranked bars, whiskers, "N× slower"; table and CSV in read view
 *   ::: envdiff                         a normal table: key then environment columns; ↓ or toggle shows differing rows only
 *   ::: magnitude unit=s                a table of label | value drawn as log-scale bars (ns..days); ↓ reveals rows, table shown in articles
 *   ::: venn                            two or three ### sets, then "- A & B: label" regions; ↓ reveals each region; article lists them
 *   ::: stats                           big numbers: "- **42%** faster first response"
 *   > [!NOTE] / [!TIP] / [!WARNING]     callouts (also [!IMPORTANT], [!CAUTION])
 *   ```mermaid                          diagrams (Mermaid, fetched only if the deck has one; <html data-diagrams="off"> to skip);
 *                                       ```mermaid {source} sets the source beside the diagram; a click opens it full screen to zoom
 *                                       ```mermaid {steps: a,b: note | b,c} lights each step's nodes (and the edges between them) on ↓, notes become numbered stages
 *   [text](#id)                         link to the slide whose frontmatter says id: …
 *   ::: chart type=line                 a chart around a table or ```csv block: bar, hbar, line, donut, heatmap, scatter, bubble,
 *                                       waterfall, timeline, sankey, treemap, range. First column: labels; others: series
 *   > quote, then a "— Name" line       a pull quote with its attribution
 *   - [x] done / - [ ] to do            a checklist
 *   text[^1] and a "[^1]: source" line  footnotes, set small at the foot of the slide
 *   text.[>a margin note]              sidenote: numbered mark that opens a popover; in the article, beside the line on wide screens
 *   $$ {steps} … $$                   aligned equations separated by \\: ↓ reveals each line; article shows all
 *   $x^2$ and $$ … $$                   maths (KaTeX, fetched only if the deck has some; <html data-math="off"> to skip)
 *   layout: image + image: url          a full-bleed picture with the text over it
 *   ```diff {steps: hunks}              +/- lines tinted; ↓ highlights each @@ hunk (or {steps: 1-2 | 3}); title="file" view=split;
 *                                       Copy takes the new code
 *   ```log {steps: 3 | 5-6}          numbered logs with timestamps, severity and stepped highlights
 *   ```array                            [1, 3, 5] then lines like lo=0 hi=2 *5: ↓ moves the named pointers; *v marks a found value; article is a step table
 *   ```js {run}                         editable JavaScript with a Run button (↓ runs it) and its console output; runs in a sandboxed iframe
 *   ::: live                            ```html / ```css / ```js fences: editors beside a sandboxed preview that redraws as you type (stacked in read view)
 *   ```json {explore open=2 highlight="a.b"}  collapsible JSON tree; open=N levels (or all) start open; ↓ opens and marks each highlighted path
 *   ```regex                            a pattern line then "test: text" lines (or /pattern/flags); ↓ explains one part at a time, tests show match or not
 *   ```tokens {steps count}             text with | between tokens as coloured chips; {steps} reveals one per ↓, {count} shows the total (article always does)
 *   ```trace                            "name  start-ms  duration-ms" lines, indent nests; waterfall bars, ↓ reveals spans in order, click selects one
 *   ```terminal                         "$ command" lines type out one per ↓, the rest is their output
 *   ```bitfield bits=32                 "0-3 Version" lines draw a packet/register layout; ↓ highlights each field; the article adds a field table
 *   ::: endpoint GET /users/{id}        method badge, highlighted path parameters and Markdown reference; article path is a permalink
 *   ```http                             request then a blank line and HTTP status; ↓ reveals the response; article shows both
 *   ![title](demo.cast) or ```cast     plays an asciinema recording (a file needs the page served over http; a ```cast block plays anywhere); ![](youtube / vimeo / .mp4 link) embeds a video
 *   ::: accordion / ::: features        ### items that open one per ↓ / a grid of cards (a leading :icon: or image is the card's icon)
 *   [[Ctrl+Shift+P]] / [[Mod+K]]       inline keycaps; Mod is Command on Apple platforms and Control elsewhere
 *   [text]{.circle .step}               hand-drawn mark (.underline .circle .box .highlight .strike .bracket); .step draws it in on ↓
 *   :rocket:                            a Lucide icon in the theme's colours (any name from lucide.dev/icons)
 *   ::: browser url="…" / ::: window title="…" / ::: phone   CSS device frames around images, code or Markdown
 *   ::: agenda / ::: qr                 a contents slide linking every section / a QR code of the deck's link (or the URL inside)
 *   ::: ask url="https://…"              audience QR and readable destination in slides; Ask a question link in articles
 * Two formats from one deck: ::: notes are spoken and read; ::: say spoken only; ::: read read only.
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
  /* a choice shared by every widget in a group, remembered across slides, decks and windows (the presenter view follows).
     Deck.choice.get('lang', ['python', 'go']) -> the newest pick that is one of those options, or undefined.
     A group keeps its recent picks, so choosing pnpm in one code group does not forget python for another. */
  const choiceKey = g => 'choice:' + g, choiceFns = {};
  const choice = {
    get(group, options) { return store.get(choiceKey(group), []).find(v => options.includes(v)); },
    set(group, value) {
      store.set(choiceKey(group), [value, ...store.get(choiceKey(group), []).filter(v => v !== value)].slice(0, 12));
      (choiceFns[group] || []).forEach(f => f(value));
    },
    on(group, f) { (choiceFns[group] ||= []).push(f); },
  };
  const choiceElsewhere = e => {             // a pick made in another window of this deck (added in start)
    const group = e.key?.startsWith('talkdown:choice:') && e.key.slice(16), value = group && store.get(choiceKey(group), [])[0];
    if (value) (choiceFns[group] || []).forEach(f => f(value));
  };

  /* ---------- theme + view, set before first paint ---------- */
  const q = new URLSearchParams(location.search);
  const portrait = matchMedia('(orientation: portrait) and (max-width: 900px)');   // present view becomes slide-over-notes
  // data-mode: light or dark (the viewer's choice, remembered). data-theme: the look, set by the author.
  const lookOf = p => ({ mode: p.get('mode'), look: p.get('theme') });
  const qLook = lookOf(q);
  root.dataset.mode = qLook.mode || store.get('mode', root.dataset.mode || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));   // else the author's <html data-mode>, else the system's
  const picker = root.hasAttribute('data-theme-picker');
  if (q.has('presenter')) root.dataset.presenter = '';
  const chosen = qLook.look || (picker && store.get('look', null));
  // <html data-theme-dark="clean">: the look to open with when the deck starts in dark mode
  const looks = { light: root.dataset.theme || 'clean', dark: root.dataset.themeDark || root.dataset.theme || 'clean' };
  let picked = !!chosen;
  root.dataset.theme = chosen || looks[root.dataset.mode] || looks.light;

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
  const META = /^(section|name|layout|kicker|build|class|takeaway|id|image|read|present|glossary|author|date|tags):\s*(.*)$/;
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
    if (meta.glossary) el.dataset.glossary = meta.glossary;
    if (meta.read) el.dataset.read = meta.read;            // hide: leave it out of the article · text: only its prose
    if (meta.present) el.dataset.present = meta.present;   // hide: an article-only section, skipped when presenting
    // absolute, because a relative url() in a custom property resolves against the stylesheet (dist/), not the page
    if (meta.image) { el.style.setProperty('--image', `url("${new URL(meta.image, document.baseURI).href.replace(/"/g, '%22')}")`); el.classList.add('has-image'); }
    const c = el.firstChild;
    widgets(c);
    if (meta.author || meta.date || meta.tags) byline(c, meta);
    if (meta.build && meta.build !== 'false') {
      // every block after the title builds in; lists build item by item
      const kids = [...c.querySelectorAll(':scope > *, :scope > .cols > div > *')].filter(k => !k.matches('.kicker, .num, .cols, h1, h2'));
      kids.forEach(k => (k.matches('ul, ol') ? [...k.children] : [k]).forEach(x => x.classList.add('step')));
    }
    const marked = c.querySelectorAll('.step');
    if (marked.length) { c.setAttribute('data-build', ''); marked.forEach((s, i) => s.dataset.step ??= i + 1); }
    return el;
  }

  // author: / date: / tags: frontmatter: a byline under the slide's title, shown in both views; reading time is filled in by assemble()
  function byline(c, meta) {
    const box = document.createElement('p'); box.className = 'w w-byline byline';
    const part = (cls, html) => `<span class="${cls}">${html}</span>`;
    const bad = meta.date && !(/^\d{4}-\d{2}-\d{2}$/.test(meta.date) && !isNaN(Date.parse(meta.date)));
    const tags = (meta.tags || '').replace(/^\[|\]$/g, '').split(',').map(t => t.trim()).filter(Boolean);
    box.innerHTML = [
      meta.author && part('by', `By <b>${esc(meta.author)}</b>`),
      meta.date && !bad && `<time datetime="${meta.date}">${esc(new Date(meta.date + 'T00:00:00Z').toLocaleDateString('en', { dateStyle: 'long', timeZone: 'UTC' }))}</time>`,
      part('rt', ''),
      tags.length && `<span class="tags">${tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</span>`,
    ].filter(Boolean).join('');
    if (bad) box.insertAdjacentHTML('afterbegin', `<span class="td-error" role="alert">date: use YYYY-MM-DD, not "${esc(meta.date)}".</span>`);
    box.dataset.tags = tags.join(',');
    const h1 = c.querySelector('h1'); if (h1) h1.after(box); else c.prepend(box);
  }
  // read view: minutes from the words of the article, plus the matching <meta> and OpenGraph tags
  function bylineMeta() {
    const box = document.querySelector('.byline'); if (!box) return;
    let words = 0;
    for (const f of document.querySelectorAll('.frame')) {
      if (f.dataset.read === 'hide') continue;
      for (const part of f.querySelectorAll(f.dataset.read === 'text' ? '.prose' : '.content, .prose')) {
        const clone = part.cloneNode(true); clone.querySelectorAll('.byline').forEach(b => b.remove());
        words += (clone.textContent.match(/\S+/g) || []).length;
      }
    }
    const mins = Math.max(1, Math.round(words / 220));
    document.querySelectorAll('.byline .rt').forEach(e => { e.textContent = `${mins} min read`; });
    const author = box.querySelector('.by b')?.textContent, date = box.querySelector('time')?.dateTime;
    const add = (key, value, prop) => { if (!value) return; const m = document.createElement('meta'); m.setAttribute(prop ? 'property' : 'name', key); m.content = value; document.head.append(m); };
    add('og:type', 'article', 1); add('og:title', document.title, 1);
    add('author', author); add('article:author', author, 1); add('article:published_time', date, 1);
    for (const t of box.dataset.tags.split(',').filter(Boolean)) add('article:tag', t, 1);
    if (box.dataset.tags) add('keywords', box.dataset.tags);
  }

  /* ================= widgets, built from Markdown ================= */
  // Each one is a stepper (↑ ↓ walk it), and each degrades to plain, readable content in read view.
  const timers = [];
  function widgets(c) {
    // Markdown attributes are attached by the tokenizer. Leave authored empty
    // HTML elements intact: they can be captions or JavaScript mount points.
    // Inner widgets must be transformed before an outer pane moves their nodes.
    [...c.querySelectorAll('.tabs, .toggle, .steps')].reverse().forEach(panes);
    c.querySelectorAll('.timeline').forEach(timeline);
    c.querySelectorAll('.w-chat').forEach(chat);
    c.querySelectorAll('.w-derive').forEach(derive);
    c.querySelectorAll('.board').forEach(board);
    c.querySelectorAll('.w-quadrant').forEach(quadrantSteps);
    c.querySelectorAll('.w-venn').forEach(vennSteps);
    c.querySelectorAll('.gallery').forEach(b => gallery(b, steps));
    c.querySelectorAll('.stats').forEach(stats);
    c.querySelectorAll('.magnitude').forEach(magnitude);
    c.querySelectorAll('.w-hotspots').forEach(hotspots);
    c.querySelectorAll('.w-explore').forEach(activateExplorable);
    c.querySelectorAll('.timer').forEach(countdown);
    c.querySelectorAll('.w-meter, .w-countup').forEach(meter);
    c.querySelectorAll('.ink').forEach(drawMark);
    c.querySelectorAll('div.envdiff').forEach(envdiff);
    c.querySelectorAll('blockquote').forEach(callout);
    c.querySelectorAll('blockquote:not(.callout)').forEach(quote);
    c.querySelectorAll('div.chart, figure[data-chart]').forEach(chart);
    c.querySelectorAll('table.explain').forEach(explain);
    c.querySelectorAll('td, th').forEach(marks);
    c.querySelectorAll('pre[data-steps]').forEach(codeSteps);
    c.querySelectorAll('.w-annotate').forEach(annotate);
    c.querySelectorAll('.w-diff').forEach(diffBlock);
    c.querySelectorAll('.w-http').forEach(httpExchange);
    c.querySelectorAll('.w-log').forEach(logBlock);
    c.querySelectorAll('.w-array[data-array]').forEach(arrayStepper);
    c.querySelectorAll('.w-bitfield').forEach(bitfield);
    c.querySelectorAll('.w-bench').forEach(benchDownload);
    c.querySelectorAll('.w-seq').forEach(sequence);
    c.querySelectorAll('.w-json').forEach(jsonTree);
    c.querySelectorAll('.w-trace').forEach(traceSteps);
    c.querySelectorAll('pre.code').forEach(copyable);
    c.querySelectorAll('.install').forEach(install);
    c.querySelectorAll('.compare').forEach(box => beforeAfter(box, steps));
    [...c.querySelectorAll('.code-group')].reverse().forEach(codeGroup);
    c.querySelectorAll('.quiz').forEach(quiz);
    c.querySelectorAll('.w-prompt').forEach(prompt);
    c.querySelectorAll('.w-versus').forEach(versus);
    c.querySelectorAll('.w-regex').forEach(regexSteps);
    c.querySelectorAll('.flip').forEach(flip);
    c.querySelectorAll('.accordion').forEach(accordion);
    c.querySelectorAll('.features').forEach(features);
    c.querySelectorAll('.speaker').forEach(speaker);
    c.querySelectorAll('.w-run').forEach(w => runCell(w, { steps, reading, widgetId: () => ++widgetId }));
    c.querySelectorAll('.w-live').forEach(w => liveCode(w, { root }));
    c.querySelectorAll('.w-cite').forEach(cite);
    c.querySelectorAll('.w-term:not(.w-cast)').forEach(terminal);
    c.querySelectorAll('.w-cast').forEach(cast);
    c.querySelectorAll('.w-tree').forEach(tree);
    c.querySelectorAll('.qr').forEach(b => { b.className = 'w w-qr'; b.dataset.url = b.textContent.trim(); b.textContent = ''; });
    c.querySelectorAll('.agenda').forEach(b => b.className = 'w w-agenda');
  }

  function countdown(box) {
    const duration = Number(box.dataset.duration), id = timers.length;
    if (!Number.isFinite(duration) || duration <= 0 || duration > 86400000) return;
    box.classList.replace('timer', 'w-timer'); box.classList.add('w');
    const panel = document.createElement('div'); panel.className = 'w-timer-panel';
    panel.innerHTML = '<div class="w-timer-clock" role="timer" aria-label="Time remaining"></div><p class="w-timer-status" role="status"></p><div class="w-timer-controls"><button type="button">Start</button><button type="button">Reset</button></div>';
    box.prepend(panel);
    const [toggle, reset] = panel.querySelectorAll('button');
    // Preserve native button activation and keep deck navigation out of these controls.
    panel.addEventListener('keydown', e => { if ([' ', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) e.stopPropagation(); });
    const clock = panel.querySelector('.w-timer-clock'), status = panel.querySelector('.w-timer-status');
    let state = { remaining: duration, deadline: null }, tick;
    const render = () => {
      clearTimeout(tick);
      const remaining = timerRemaining(state), seconds = Math.ceil(remaining / 1000);
      clock.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      box.classList.toggle('is-finished', remaining === 0);
      toggle.textContent = state.deadline === null ? (remaining === duration ? 'Start' : 'Resume') : 'Pause';
      toggle.disabled = remaining === 0;
      const message = remaining === 0 ? 'Time is up' : state.deadline !== null ? 'Running' : remaining === duration ? 'Ready' : 'Paused';
      if (status.textContent !== message) status.textContent = message;
      // Article mode has no ticking clock, including in the accessibility tree.
      if (!reading() && !document.hidden && box.closest('.slide')?.classList.contains('active') && state.deadline !== null && remaining > 0) tick = setTimeout(render, 200);
    };
    const send = () => { if (channel && !remote && !reading()) channel.postMessage({ timer: id, state }); };
    const start = () => { if (!reading() && state.deadline === null && state.remaining > 0) { state = { ...state, deadline: Date.now() + state.remaining }; render(); send(); } };
    let lastStep = 0;
    steps(box, 2, k => { if (k !== lastStep && !reading()) { if (k) start(); else { state = { remaining: duration, deadline: null }; render(); send(); } } lastStep = k; });
    toggle.onclick = () => {
      if (reading()) return;
      if (state.deadline === null) start();
      else { state = { remaining: timerRemaining(state), deadline: null }; render(); send(); }
    };
    reset.onclick = () => { if (reading()) return; state = { remaining: duration, deadline: null }; render(); send(); };
    timers.push({ snapshot: () => state, apply(next) {
      if (!next || !Number.isFinite(next.remaining) || next.remaining < 0 || next.remaining > duration || !(next.deadline === null || Number.isFinite(next.deadline))) return;
      state = { remaining: next.remaining, deadline: next.deadline }; render();
    } });
    handlers.slide.push(render);
    document.addEventListener('visibilitychange', render);
    addEventListener('pagehide', () => clearTimeout(tick));
    addEventListener('pageshow', render);
    render();
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
    if (kind === 'steps') w.querySelector('.w-next').stepper = st;
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
  // every code block gets a Copy button (shown on hover, always on touch screens). Its label comes from CSS,
  // so the block's textContent stays exactly its code for the diagrams, charts and highlighter that read it.
  function copyable(pre) {
    if (pre.querySelector('.w-copy') || pre.closest('#src, .w-diff')) return;
    pre.insertAdjacentHTML('beforeend', '<button type="button" class="w-copy" aria-label="Copy code"></button>');
  }
  async function copyText(text, button) {
    try { await navigator.clipboard.writeText(text); }
    catch {      // file:// and older browsers: copy through a hidden textarea
      const t = Object.assign(document.createElement('textarea'), { value: text });
      t.style.cssText = 'position:fixed;opacity:0'; document.body.append(t); t.select(); document.execCommand('copy'); t.remove();
    }
    button.dataset.copied = ''; clearTimeout(button.reset); button.reset = setTimeout(() => delete button.dataset.copied, 1400);
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('.w-copy'); if (!b) return;
    const pre = b.closest('pre, .w-diff, .w-json'); if (pre) copyText(sources.get(pre) ?? pre.firstChild.textContent, b);
  });
  // sidenotes: the mark toggles its note (a popover on the stage, inline in a narrow article); Esc or an outside click closes
  const closeNotes = except => document.querySelectorAll('.sn[data-open]').forEach(n => { if (n !== except) { delete n.dataset.open; n.firstChild.setAttribute('aria-expanded', 'false'); } });
  document.addEventListener('click', e => {
    if (e.target.closest('.sn-body')) return;   // selecting or following a link in a note keeps it open
    const mark = e.target.closest('.sn-mark'), note = mark?.parentNode;
    closeNotes(note);
    if (!note) return;
    const open = note.toggleAttribute('data-open'); mark.setAttribute('aria-expanded', String(open));
    const body = note.lastChild; body.style.removeProperty('--sn-shift');
    if (open && getComputedStyle(body).position === 'absolute') {   // keep the popover inside the viewport
      const r = body.getBoundingClientRect(), m = 8;
      body.style.setProperty('--sn-shift', `${Math.max(m - r.left, Math.min(0, innerWidth - m - r.right))}px`);
    }
  });
  document.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && e.target.closest?.('.sn-mark')) e.stopPropagation(); }, true);   // Space on a mark opens it; it must not advance the slide
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.querySelector('.sn[data-open]')) { closeNotes(); } });
  // ```diff: Copy takes the new code (context and added lines); {steps: hunks} or {steps: 1-2 | 3} highlight in turn
  function diffBlock(fig) {
    // one Copy button for the figure (unified and split are two views of the same code)
    sources.set(fig, [...fig.querySelectorAll('.w-diff-uni :is(.d-ctx, .d-add)')].map(l => l.textContent.slice(1)).join('\n'));
    if (!fig.querySelector(':scope > .w-copy')) fig.insertAdjacentHTML('beforeend', '<button type="button" class="w-copy" aria-label="Copy the new code"></button>');
    const spec = fig.dataset.steps; if (!spec) return;
    const lines = [...fig.querySelectorAll('[data-line]')];
    const groups = spec === 'hunks'
      ? [...new Set(lines.map(l => +l.dataset.hunk || 0))].filter(Boolean).map(h => l => +l.dataset.hunk === h)
      : spec.split('|').map(g => { const set = rangeSet(g); return l => set.has(+l.dataset.line); }).filter(g => lines.some(g));   // groups past the end are dropped
    if (!groups.length) return;
    fig.stepper = steps(fig, groups.length + 1, i => {
      fig.classList.toggle('stepping', i > 0 && !reading());
      lines.forEach(l => l.classList.toggle('on', i > 0 && groups[i - 1](l)));
    });
    fig.addEventListener('click', e => {   // a click on a highlighted line jumps to its step
      const l = e.target.closest('[data-line]'), k = l && !reading() ? groups.findIndex(g => g(l)) : -1;
      if (k >= 0) fig.stepper.go(k + 1);
    });
  }
  // HTTP exchanges start at the request; one ↓ reveals the response. Article view always shows both.
  function httpExchange(fig) {
    const response = fig.querySelector('.w-http-response');
    steps(fig, 2, i => {
      const pending = i === 0 && !reading();
      response.classList.toggle('pending', pending);
      response.setAttribute('aria-hidden', String(pending));
      response.inert = pending;
    }, { read: 'end' });
  }
  // ```array: pointer chips under the cells move per step; the table (article view) lists every step
  function arrayStepper(fig) {
    const rows = JSON.parse(fig.dataset.array), cells = [...fig.querySelectorAll('.w-array-cell')], trs = [...fig.querySelectorAll('tbody tr')];
    fig.classList.add('live');
    const live = document.createElement('p'); live.className = 'w-array-status'; live.setAttribute('role', 'status'); fig.append(live);
    steps(fig, rows.length, i => {
      const r = rows[i];
      cells.forEach((cell, k) => {
        const at = Object.keys(r.p).filter(n => r.p[n] === k);
        cell.querySelector('.w-array-p').innerHTML = at.map(n => `<b>${esc(n)}</b>`).join('');
        cell.classList.toggle('on', at.length > 0);
        cell.classList.toggle('found', r.f.includes(cell.querySelector('.w-array-v').textContent));
      });
      trs.forEach((tr, k) => tr.classList.toggle('on', k === i));
      live.textContent = `Step ${i + 1}: ` + Object.entries(r.p).map(([n, k]) => `${n} at ${k}`).concat(r.f.map(v => `found ${v}`)).join(', ');
    }, { read: 'end' });
  }
  function bitfield(fig) {
    const n = +fig.dataset.fields, cells = [...fig.querySelectorAll('[data-field]')];
    if (n < 2) return;
    const st = steps(fig, n, i => cells.forEach(c => c.classList.toggle('on', +c.dataset.field === i)), { read: 'end' });
    cells.forEach(c => c.addEventListener('click', () => st.go(+c.dataset.field)));
  }
  // "2, 4-6" -> {2, 4, 5, 6}
  const rangeSet = (g, max = 1e4) => new Set(g.split(',').flatMap(r => {
    const m = r.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!m) return [];
    const a = Math.max(1, +m[1]), b = Math.min(max, +(m[2] || m[1]));
    return Array.from({ length: Math.max(0, b - a + 1) }, (_, k) => a + k);
  }));
  // ```bench is rendered by the parser; only the CSV download needs the runtime.
  function benchDownload(fig) {
    const csv = fig.dataset.csv; delete fig.dataset.csv;
    fig.querySelector('.w-bench-download').addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), a = document.createElement('a');
      a.href = url; a.download = 'benchmark.csv'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  function logBlock(pre) {
    sources.set(pre, pre.dataset.source); delete pre.dataset.source;
    // Keep Space native for scrolling and activating Copy when the log owns focus.
    pre.addEventListener('keydown', e => { if (e.key === ' ') e.stopPropagation(); });
    const spec = pre.dataset.logSteps; if (!spec) return;
    const lines = [...pre.querySelectorAll('.ln')];
    const groups = spec.split('|').map(g => rangeSet(g.replace(/\s/g, ''), lines.length));
    const marked = new Set(groups.flatMap(g => [...g]));
    pre.stepper = steps(pre, groups.length + 1, i => {
      pre.classList.toggle('stepping', i > 0 && !reading());
      lines.forEach((line, j) => line.classList.toggle('on', reading() ? marked.has(j + 1) : i > 0 && groups[i - 1].has(j + 1)));
      // Move only the log's viewport; scrolling a step must never move the slide or article.
      const target = i > 0 && !reading() ? lines.find(l => groups[i - 1].has(+l.dataset.line)) : null;
      if (target) pre.scrollTop = Math.max(0, target.offsetTop - pre.clientHeight / 3);
    }, { read: 'end' });
  }
  // ```json {explore}: nested <details>; each ↓ opens the path to the next highlight and marks it. Article view opens everything.
  function jsonTree(fig) {
    sources.set(fig, fig.dataset.source); delete fig.dataset.source;
    fig.insertAdjacentHTML('beforeend', '<button type="button" class="w-copy" aria-label="Copy the JSON"></button>');
    // Space toggles a focused summary natively; keep it from advancing the slide
    fig.addEventListener('keydown', e => { if (e.key === ' ') e.stopPropagation(); });
    const nodes = [...fig.querySelectorAll('.tn')], base = new Map([...fig.querySelectorAll('details')].map(d => [d, d.open]));
    const paths = JSON.parse(fig.dataset.highlight || '[]'), at = path => nodes.find(n => n.dataset.path === path);
    const marked = paths.map(at), lit = new Set(marked);
    steps(fig, paths.length + 1, i => {
      const on = reading() ? lit : new Set(marked.slice(0, i));
      nodes.forEach(n => n.classList.toggle('on', on.has(n)));
      for (const [d, was] of base) d.open = reading() || was || [...on].some(n => d.contains(n));
      const target = !reading() && i > 0 ? marked[i - 1] : null;   // keep the newest highlight in view inside the tree
      if (target) { const box = fig.getBoundingClientRect(), row = target.getBoundingClientRect(); if (row.top < box.top || row.bottom > box.bottom) fig.scrollTop += row.top - box.top - fig.clientHeight / 3; }
    }, { read: 'end' });
  }
  function codeSteps(pre) {
    const code = pre.firstChild;
    sources.set(pre, code.textContent);
    code.innerHTML = code.innerHTML.split('\n').map(l => `<span class="ln">${l}</span>`).join('');
    const lineCount = code.children.length;
    const groups = pre.dataset.steps.split('|').map(g => rangeSet(g, lineCount));
    pre.stepper = steps(pre, groups.length + 1, i => {
      pre.classList.toggle('stepping', i > 0 && !reading());
      [...code.children].forEach((l, j) => l.classList.toggle('on', i > 0 && groups[i - 1].has(j + 1)));
    });
  }

  // ```lang {annotate} and a numbered list: "# (n)" comments became pins (see markdown.js); ↓ highlights each pin's lines and its note
  function annotate(box) {
    const pre = box.querySelector(':scope > pre[data-pins]'), ol = box.querySelector(':scope > ol');
    if (!pre) return;
    const code = pre.firstChild, pins = pre.dataset.pins.split(',').map(Number), notes = ol ? [...ol.children] : [], first = ol ? ol.start : 1;
    const step = n => n >= first && n < first + notes.length ? n - first + 1 : -1;
    sources.set(pre, code.textContent);
    code.innerHTML = code.innerHTML.split('\n').map(l => `<span class="ln">${l}</span>`).join('');
    // pins go back on after the highlighter rewrites the lines; the number comes from CSS so textContent stays the code.
    // Like timeline rows, pins and notes are click targets; the keyboard steps them with ↓ and 1–9.
    pre.decorate = () => [...code.children].forEach((l, j) => pins[j] && l.insertAdjacentHTML('beforeend',
      `<span class="w-pin" data-n="${pins[j]}"></span>`));
    pre.decorate();
    notes.forEach((li, j) => li.dataset.n = first + j);
    const st = pre.stepper = steps(box, notes.length + 1, i => {
      const n = i ? first + i - 1 : 0;
      box.classList.toggle('stepping', i > 0);
      [...code.children].forEach((l, j) => l.classList.toggle('on', !!n && pins[j] === n));
      code.querySelectorAll('.w-pin').forEach(b => b.classList.toggle('on', +b.dataset.n === n));
      notes.forEach((li, j) => li.classList.toggle('on', j === i - 1));
    });
    box.addEventListener('click', e => {
      if (reading()) return;
      const pin = e.target.closest('.w-pin'), li = e.target.closest('.w-notes > li');
      const k = pin ? step(+pin.dataset.n) : li ? notes.indexOf(li) + 1 : -1;
      if (k > 0) st.go(k);
    });
  }

  // ::: code-group: the same code in several languages, one tab each. Picking a language switches every group in the deck
  // that has it, and is remembered (Deck.choice group "lang"). Not a stepper: the language is a preference, not a sequence.
  const LANGS = { js: 'JavaScript', javascript: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', typescript: 'TypeScript', tsx: 'TSX',
    py: 'Python', python: 'Python', rb: 'Ruby', ruby: 'Ruby', go: 'Go', golang: 'Go', rs: 'Rust', rust: 'Rust', java: 'Java',
    kt: 'Kotlin', kotlin: 'Kotlin', cs: 'C#', csharp: 'C#', cpp: 'C++', 'c++': 'C++', c: 'C', swift: 'Swift', php: 'PHP',
    sh: 'Shell', bash: 'Bash', zsh: 'Zsh', shell: 'Shell', powershell: 'PowerShell', ps1: 'PowerShell', sql: 'SQL',
    html: 'HTML', css: 'CSS', json: 'JSON', yaml: 'YAML', yml: 'YAML', toml: 'TOML', dart: 'Dart', scala: 'Scala', r: 'R' };
  const CODE = ':is(pre.code, .w-annotate, .w-diff, .w-term, .w-diagram, .w-with-source)';
  function codeGroup(box) {
    const panes = [], waiting = [];         // each block starts a tab; an error goes with the block after it, anything else with the one before
    for (const el of [...box.children]) {
      if (el.matches(CODE)) panes.push([...waiting.splice(0), el]);
      else if (panes.length && !el.matches('.td-error')) panes.at(-1).push(el);
      else waiting.push(el);
    }
    if (!panes.length) { box.insertAdjacentHTML('afterbegin', '<p class="td-error" role="alert">code-group needs fenced code blocks, one per language</p>'); return; }
    panes.at(-1).push(...waiting);
    const blocks = panes.map(p => p.find(el => el.matches(CODE)));
    const labels = blocks.map(b => {
      const lang = b.dataset.label || b.querySelector('[data-label]')?.dataset.label || b.dataset.lang || b.querySelector('pre[data-lang]')?.dataset.lang;
      return lang ? LANGS[lang.toLowerCase()] || lang : b.matches('.w-term') ? 'Terminal' : b.matches('.w-diff') ? 'Diff' : b.matches('.w-diagram, .w-with-source') ? 'Diagram' : 'Code';
    });
    const keys = labels.map(l => l.toLowerCase()), id = `td-code-${++widgetId}`;
    const w = document.createElement('div');
    w.className = `w w-codegroup ${[...box.classList].filter(k => k !== 'code-group').join(' ')}`.trim();
    w.innerHTML = `<div class="w-langs" role="tablist" aria-label="Language">${labels.map((l, j) =>
      `<button type="button" role="tab" id="${id}-tab-${j}" aria-controls="${id}-panel-${j}">${esc(l)}</button>`).join('')}</div><div class="w-cg-panes"></div>`;
    for (const [j, g] of panes.entries())
      w.lastChild.insertAdjacentHTML('beforeend', `<section class="w-cg-pane" role="tabpanel" id="${id}-panel-${j}" aria-labelledby="${id}-tab-${j}" data-label="${qesc(esc(labels[j]))}"></section>`), w.lastChild.lastChild.append(...g);
    const twice = labels.find((l, j) => keys.indexOf(keys[j]) !== j);
    if (twice) w.insertAdjacentHTML('afterbegin', `<p class="td-error" role="alert">code-group has two ${esc(twice)} tabs: label them like \`\`\`js [Node.js]</p>`);
    box.replaceWith(w);
    const tabs = [...w.querySelector('.w-langs').children], ps = [...w.lastChild.children];
    const show = i => {
      ps.forEach((p, j) => p.classList.toggle('on', j === i));
      tabs.forEach((b, j) => { b.classList.toggle('on', j === i); b.setAttribute('aria-selected', j === i); b.tabIndex = j === i ? 0 : -1; });
      if (started && w.closest('.slide') === slide()) sync();   // steps inside the hidden panes no longer count
    };
    show(Math.max(0, keys.indexOf(choice.get('lang', keys))));
    choice.on('lang', v => { const j = keys.indexOf(v); if (j >= 0) show(j); });
    tabs.forEach((b, j) => b.addEventListener('click', () => choice.set('lang', keys[j])));
    tabs[0].parentNode.addEventListener('keydown', e => {
      const j = tabs.indexOf(e.target); if (j < 0) return;
      const i = { ArrowRight: (j + 1) % tabs.length, ArrowLeft: (j + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
      if (i == null) return;
      e.preventDefault(); e.stopPropagation(); choice.set('lang', keys[i]); tabs[i].focus();
    });
  }

  // ::: install: one command per operating system (```sh macos, ```sh linux, ```powershell windows), one tab each.
  // The viewer's own system is selected first; a pick is remembered (Deck.choice group "os"). Not a stepper.
  const SYSTEMS = { macos: 'macOS', linux: 'Linux', windows: 'Windows' };
  const mySystem = () => {
    const ua = (navigator.userAgentData?.platform || navigator.platform || '') + ' ' + (navigator.userAgent || '');
    return /iphone|ipad|mac/i.test(ua) ? 'macos' : /win/i.test(ua) ? 'windows' : /linux|x11|cros/i.test(ua) ? 'linux' : '';
  };
  function install(box) {
    const fail = m => box.insertAdjacentHTML('afterbegin', `<p class="td-error" role="alert">install ${m}</p>`);
    const panes = [];
    for (const el of [...box.children]) {
      if (el.matches('pre.code')) panes.push([el]);
      else if (!el.matches('.td-error')) (panes.at(-1) || (panes[0] = [])).push(el);
    }
    if (!panes.length || !panes.some(p => p[0].matches('pre.code'))) return fail('needs fenced commands, one per system: ```sh macos, ```sh linux, ```powershell windows');
    const keys = panes.map(p => p[0].dataset.os);
    if (keys.includes(undefined)) return fail('needs a system after the language on every fence: ```sh macos, ```sh linux or ```powershell windows');
    const twice = keys.find((k, j) => keys.indexOf(k) !== j);
    if (twice) return fail(`has two ${SYSTEMS[twice]} blocks`);
    const id = `td-install-${++widgetId}`;
    const w = document.createElement('div');
    w.className = `w w-install ${[...box.classList].filter(k => k !== 'install').join(' ')}`.trim();
    w.innerHTML = `<div class="w-os" role="tablist" aria-label="Operating system">${keys.map((k, j) =>
      `<button type="button" role="tab" id="${id}-tab-${j}" aria-controls="${id}-panel-${j}">${SYSTEMS[k]}</button>`).join('')}</div><div class="w-os-panes"></div>`;
    for (const [j, g] of panes.entries())
      w.lastChild.insertAdjacentHTML('beforeend', `<section class="w-os-pane" role="tabpanel" id="${id}-panel-${j}" aria-labelledby="${id}-tab-${j}" data-label="${SYSTEMS[keys[j]]}"></section>`), w.lastChild.lastChild.append(...g);
    box.replaceWith(w);
    const tabs = [...w.querySelector('.w-os').children], ps = [...w.lastChild.children];
    const show = i => {
      ps.forEach((p, j) => p.classList.toggle('on', j === i));
      tabs.forEach((b, j) => { b.classList.toggle('on', j === i); b.setAttribute('aria-selected', j === i); b.tabIndex = j === i ? 0 : -1; });
    };
    show(Math.max(0, keys.indexOf(choice.get('os', keys) || mySystem())));
    choice.on('os', v => { const j = keys.indexOf(v); if (j >= 0) show(j); });
    tabs.forEach((b, j) => b.addEventListener('click', () => choice.set('os', keys[j])));
    tabs[0].parentNode.addEventListener('keydown', e => {
      const j = tabs.indexOf(e.target); if (j < 0) return;
      const i = { ArrowRight: (j + 1) % tabs.length, ArrowLeft: (j + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
      if (i == null) return;
      e.preventDefault(); e.stopPropagation(); choice.set('os', keys[i]); tabs[i].focus();
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
      pre.firstChild.innerHTML = pre.dataset.steps || pre.dataset.pins ? perLine(html) : html;
      pre.decorate?.();
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
    const run = () => els.forEach(el => {
      const source = el.textContent, derive = el.closest('.w-derive');
      try { katex.render(source, el, { displayMode: !!derive || el.classList.contains('math-block'), throwOnError: !!derive }); }
      catch {
        el.textContent = source;
        if (derive && !derive.querySelector('.td-error')) {
          const error = document.createElement('p'); error.className = 'td-error'; error.setAttribute('role', 'alert');
          error.textContent = 'Derivation contains invalid TeX; the original equation is shown.'; derive.prepend(error);
        }
      }
    });
    const js = opt || KATEX;
    window.katex ? run() : load(js, run, js.replace(/\.js$/, '.css'));
  }
  function derive(box) {
    const rows = [...box.querySelectorAll('tr')];
    const controls = document.createElement('div'); controls.className = 'w-derive-controls';
    const status = document.createElement('span'); status.setAttribute('role', 'status');
    const next = document.createElement('button'); next.type = 'button'; next.textContent = 'Next equation';
    controls.append(status, next); box.append(controls);
    const st = steps(box, rows.length, i => {
      rows.forEach((row, j) => {
        row.classList.toggle('current', j === i);
        row.classList.toggle('unrevealed', j > i);
        row.setAttribute('aria-hidden', String(j > i));
      });
      status.textContent = `Equation ${i + 1} of ${rows.length}`;
      next.disabled = i === rows.length - 1;
    }, { read: 'end' });
    next.addEventListener('click', () => st.next());
    // Space belongs to the focused native button, not slide navigation.
    next.addEventListener('keydown', e => { if (e.key === ' ') e.stopPropagation(); });
  }
  /* diagrams: Mermaid, fetched only when the deck has a ```mermaid block; coloured from the theme and redrawn when it changes.
     <html data-diagrams="off"> leaves the source showing; data-diagrams="/path/mermaid.min.js" self-hosts it. */
  const MERMAID = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
  function diagrams() {
    const boxes = [...document.querySelectorAll('.w-diagram')], opt = root.dataset.diagrams;
    if (!boxes.length || opt === 'off') return;
    boxes.forEach(b => b.dataset.src = b.textContent);
    boxes.forEach(b => b.dataset.steps && diagramSteps(b));
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
        try { const { svg } = await mermaid.render(`dk-diagram-${++n}`, b.dataset.src); b.innerHTML = svg; b.classList.add('drawn'); themeIcons(b); b.mark?.();
          Object.assign(b, { tabIndex: 0, title: 'Open full screen' }); b.setAttribute('role', 'button'); b.setAttribute('aria-label', 'Diagram: open full screen'); }
        catch { b.innerHTML = `<pre class="code w-diagram-src">${esc(b.dataset.src)}</pre>`; b.classList.remove('drawn'); b.removeAttribute('tabindex'); b.removeAttribute('role'); }
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
    // ```mermaid {steps: a,b | b,c}: ↓ lights each group's nodes and the edges between them, and dims the rest. Mermaid's own ids are
    // the handle: a node is g.node#<svg>-<kind>-<id>-<n> and an edge path is <svg>-L_<from>_<to>_<n>. The article shows it all.
    function diagramSteps(b) {
      const groups = JSON.parse(b.dataset.steps), stage = b.closest('.w-stepped'), notes = [...stage.querySelectorAll('.w-diagram-notes li')];
      const idOf = g => g.id.replace(/^.*?-(?:flowchart|state|class|classId|entity|er)-/, '').replace(/-\d+$/, '');
      // an edge path is <svg>-L_<from>_<to>_<n> (ids may hold underscores, so match against the step's own pairs)
      const edgeKey = id => id.replace(/^dk-diagram-\d+-/, '').replace(/^L_|_\d+$/g, '');
      const st = steps(stage, groups.length, i => {
        const svg = b.querySelector('svg'), stepping = !reading(), ids = new Set(stepping ? groups[i] : []);
        stage.classList.toggle('stepping', stepping);
        notes.forEach(li => { const on = stepping && +li.dataset.note === i; li.classList.toggle('on', on); on ? li.setAttribute('aria-current', 'step') : li.removeAttribute('aria-current'); });
        if (!svg) return;
        svg.classList.toggle('dk-stepping', stepping);
        svg.querySelectorAll('g.node').forEach(g => g.classList.toggle('dk-on', ids.has(idOf(g))));
        const pairs = new Set([...ids].flatMap(a => [...ids].map(c => `${a}_${c}`))), linked = new Set();
        svg.querySelectorAll('path.flowchart-link').forEach(p => {
          const on = pairs.has(edgeKey(p.id)); p.classList.toggle('dk-on', on); if (on) linked.add(p.id.replace(/^dk-diagram-\d+-/, ''));
        });
        svg.querySelectorAll('g.edgeLabel').forEach(l => l.classList.toggle('dk-on', linked.has(l.querySelector('[data-id]')?.dataset.id)));
      }, { read: 'end' });
      // after each (re)draw: say so when a step names a node the diagram doesn't have, then repaint the step
      b.mark = () => {
        const svg = b.querySelector('svg'); if (!svg) return;
        const have = new Set([...svg.querySelectorAll('g.node')].map(idOf)), missing = [...new Set(groups.flat())].find(id => !have.has(id));
        stage.querySelector(':scope > .td-error')?.remove();
        if (missing) stage.insertAdjacentHTML('afterbegin', `<p class="td-error" role="alert">${esc(`mermaid: no node "${missing}" (steps use the ids written in the diagram's source)`)}</p>`);
        st.go(st.i, true);
      };
    }
    const redraw = () => { clearTimeout(queued); queued = setTimeout(draw, 60); };
    // draw once the theme's fonts are in, so labels are measured in the face they're shown in
    const ready = () => {
      (document.fonts?.ready || Promise.resolve()).then(draw);
      document.fonts?.addEventListener('loadingdone', redraw);          // a theme's web font arrived: re-measure in it
      new MutationObserver(() => document.fonts.ready.then(redraw)).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-mode'] });
    };
    window.mermaid ? ready() : load(opt || MERMAID, ready);
  }

  // diagrams and charts open full screen on a click, or on Enter when focused
  const ZOOMABLE = '.w-diagram.drawn, .w-chart-box > .w-chart';
  document.addEventListener('click', e => { const b = e.target.closest(ZOOMABLE); if (b && !b.closest('#zoom') && !getSelection().toString()) zoom(b); });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches?.(ZOOMABLE)) { e.preventDefault(); e.stopPropagation(); zoom(e.target, true); } }, true);

  /* a diagram or chart opened full screen: wheel or pinch zooms around the pointer, drag pans, double-click zooms in or back out.
     The SVG itself moves into the viewer (Mermaid's styles and arrowheads are keyed to its ids) and back on close. */
  let zoomBox, zoomByKey, zoomMark;
  function zoom(b, byKey) {
    let z = $('zoom');
    if (!z) {
      document.body.insertAdjacentHTML('beforeend', `<div id="zoom" role="dialog" aria-modal="true" aria-label="Diagram"><p class="z-title"></p><div class="z-stage"><div class="z-layer w-diagram drawn"></div></div>
        <div class="z-bar"><button data-z="out" aria-label="Zoom out" title="Zoom out (−)">${svg('minus')}</button><span class="z-pct" aria-live="polite"></span><button data-z="in" aria-label="Zoom in" title="Zoom in (+)">${svg('plus')}</button><button data-z="fit" aria-label="Fit to screen" title="Fit (0)">${svg('fit')}</button><i></i><button data-z="close" aria-label="Close" title="Close (Esc)">${svg('close')}</button></div>
        <p class="z-hint">Scroll or pinch to zoom · drag to move</p></div>`);
      z = $('zoom');
      const stage = z.querySelector('.z-stage'), layer = z.querySelector('.z-layer'), pct = z.querySelector('.z-pct'), pts = new Map();
      let s = 1, x = 0, y = 0, pinch = null, drag = null, moved = false, down = null;
      const apply = () => { layer.style.transform = `translate(${x}px, ${y}px) scale(${s})`; pct.textContent = Math.round(s * 100) + '%'; z.classList.toggle('zoomed', s > 1); };
      const at = (k, cx, cy) => {      // zoom by k around a point in stage coordinates
        const n = Math.min(8, Math.max(1, s * k));
        if (n === 1) { s = 1; x = y = 0; } else { x = cx - (cx - x) * n / s; y = cy - (cy - y) * n / s; s = n; }
        apply();
      };
      let r = stage.getBoundingClientRect();      // read once per gesture, not on every pointer event
      const local = e => [e.clientX - r.left, e.clientY - r.top];
      const centre = () => [stage.clientWidth / 2, stage.clientHeight / 2];
      z.reset = () => { s = 1; x = y = 0; apply(); };
      z.measure = () => r = stage.getBoundingClientRect();
      addEventListener('resize', z.measure);
      z.key = k => { if (k === '+' || k === '=') at(1.4, ...centre()); else if (k === '-' || k === '_') at(1 / 1.4, ...centre()); else if (k === '0') z.reset(); else return false; return true; };
      stage.addEventListener('wheel', e => { e.preventDefault(); at(Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0015)), ...local(e)); }, { passive: false });
      stage.addEventListener('pointerdown', e => {
        r = stage.getBoundingClientRect(); down = e.target; stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, local(e)); moved = false;
        if (pts.size === 2) { const [a, c] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - c[0], a[1] - c[1]), m: [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2] }; drag = null; }
        else drag = { p: local(e), x, y };
      });
      stage.addEventListener('pointermove', e => {
        if (!pts.has(e.pointerId)) return;
        pts.set(e.pointerId, local(e));
        if (pinch && pts.size === 2) {
          const [a, c] = [...pts.values()], d = Math.hypot(a[0] - c[0], a[1] - c[1]), m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
          x += m[0] - pinch.m[0]; y += m[1] - pinch.m[1]; at(d / pinch.d, ...m); pinch = { d, m }; moved = true;
        } else if (drag && s > 1) {
          const p = local(e); x = drag.x + p[0] - drag.p[0]; y = drag.y + p[1] - drag.p[1]; moved ||= Math.hypot(p[0] - drag.p[0], p[1] - drag.p[1]) > 4; apply();
        }
      });
      const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) drag = null; };
      stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
      stage.addEventListener('dblclick', e => s > 1 ? z.reset() : at(2.5, ...local(e)));
      // a click on the backdrop, away from the diagram, closes; a click that ended a drag doesn't
      stage.addEventListener('click', () => { if (!moved && s === 1 && !down?.closest('svg')) unzoom(); });
      z.querySelector('.z-bar').onclick = e => {
        const k = e.target.closest('button')?.dataset.z;
        if (k === 'close') unzoom(); else if (k === 'fit') z.reset(); else if (k) at(k === 'in' ? 1.4 : 1 / 1.4, ...centre());
      };
      z.addEventListener('keydown', e => { if (e.key === 'Tab') { const bs = [...z.querySelectorAll('button')], i = bs.indexOf(document.activeElement); e.preventDefault(); bs[(i + (e.shiftKey ? -1 : 1) + bs.length) % bs.length].focus(); } });
    }
    // a diagram lends its SVG (Mermaid's styles and arrowheads are keyed to its ids); a chart lends itself
    const chart = b.matches('.w-chart'), g = chart ? b : b.querySelector('svg'); if (!g) return;
    zoomBox = b; zoomByKey = byKey; zoomMark = document.createComment('zoomed');
    (chart ? b.parentElement : b).style.minHeight = (chart ? b.parentElement : b).offsetHeight + 'px';
    g.before(zoomMark);
    const name = chart ? b.parentElement.querySelector('figcaption')?.textContent.trim() : '';
    z.querySelector('.z-title').textContent = name;
    z.setAttribute('aria-label', name || (chart ? 'Chart' : 'Diagram'));
    const layer = z.querySelector('.z-layer');
    layer.className = 'z-layer ' + (chart ? 'z-chart' : 'w-diagram drawn');
    layer.replaceChildren(g);
    z.reset(); z.measure();
    z.classList.add('on');
    z.querySelector('[data-z=close]').focus({ preventScroll: true });
  }
  function unzoom() {
    const z = $('zoom'), b = zoomBox; if (!z?.classList.contains('on')) return;
    z.classList.remove('on'); zoomBox = null;
    const g = z.querySelector('.z-layer').firstElementChild;
    if (zoomMark.isConnected) zoomMark.replaceWith(g); else g?.remove();     // a theme change redrew it while open: keep the new one
    (b.matches('.w-chart') ? b.parentElement : b).style.minHeight = '';
    // hand focus back only to keyboard users, so Space and Enter keep stepping the deck after a click
    if (zoomByKey) b.focus({ preventScroll: true }); else document.activeElement?.blur();
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

  // ```sequence — each ↓ draws the next message; the article view shows the whole diagram and its numbered list.
  function sequence(box) {
    const rows = [...box.querySelectorAll('.w-seq-step')];
    steps(box, rows.length, i => rows.forEach((row, j) => {
      row.classList.toggle('shown', j <= i);
      row.classList.toggle('current', j === i);
    }), { read: 'end' });
  }

  function chat(box) {
    const messages = [...box.children];
    box.querySelectorAll(':scope > details > summary').forEach(summary => summary.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
    }));
    steps(box, messages.length, i => messages.forEach((message, j) => {
      message.hidden = j > i;
      message.classList.toggle('current', j === i);
    }), { read: 'end' });
  }

  // ::: board — a roadmap of heading-led columns; list items become cards, without losing nested Markdown.
  function board(box) {
    const groups = byHeading(box);
    if (!groups.length || groups.some(g => g[0].tagName !== 'H3' || !g[0].textContent.trim() || g.slice(1).some(el => !el.matches('ul, ol')))) {
      box.insertAdjacentHTML('beforebegin', '<p class="td-error" role="alert">Board needs ### column headings and lists of cards.</p>');
      box.classList.remove('board'); return;
    }
    const w = document.createElement('div'); w.className = 'w w-board';
    w.style.setProperty('--n', Math.min(4, groups.length));
    for (const [head, ...lists] of groups) {
      const col = document.createElement('section'); col.className = 'w-board-column';
      const button = document.createElement('button'); button.type = 'button'; button.className = 'w-board-title';
      button.textContent = head.textContent; head.replaceChildren(button);
      col.append(head, ...lists); w.append(col);
    }
    box.replaceWith(w);
    const cols = [...w.children];
    const st = steps(w, cols.length, i => cols.forEach((col, j) => {
      col.classList.toggle('shown', j <= i); col.classList.toggle('on', j === i);
      const button = col.querySelector('.w-board-title');
      button.disabled = reading(); button.setAttribute('aria-pressed', j === i);
    }), { read: 'end' });
    cols.forEach((col, i) => col.querySelector('.w-board-title').addEventListener('click', () => st.go(i)));
  }

  // Assign release anchors after assembly: slide ids keep links stable when slides move.
  function changelogs() {
    slides().forEach((s, index) => s.querySelectorAll('.w-changelog').forEach((w, widget) => {
      const entries = [...w.children], used = new Set();
      entries.forEach(entry => {
        const base = `td-release-${s.dataset.id || index + 1}-${widget + 1}-${entry.dataset.release}`;
        let id = base, suffix = 1;
        while (document.getElementById(id) || used.has(id)) id = `${base}-${++suffix}`;
        used.add(id); entry.id = id;
        const a = entry.querySelector('.w-release-link'); a.href = '#' + encodeURIComponent(id);
        a.setAttribute('aria-label', `Release ${[a.querySelector('.w-release-version')?.textContent, a.querySelector('time')?.textContent].filter(Boolean).join(', ')}`);
      });
      const st = steps(w, entries.length, i => entries.forEach((entry, j) => {
        entry.classList.toggle('on', j === i);
        entry.setAttribute('aria-hidden', !reading() && j !== i);
      }), { read: 'end' });
      st.releaseWidget = w;
      // Preserve native link activation and Space scrolling rather than deck shortcuts.
      w.addEventListener('keydown', e => { if (e.target.closest('a, button') && (e.key === 'Enter' || e.key === ' ')) e.stopPropagation(); });
    }));
  }

  // ::: hotspots — native buttons over the intrinsic image, with a prose legend below.
  function hotspots(w) {
    const pins = [...w.querySelectorAll('.w-hotspot-pin')], labels = [...w.querySelector('.w-hotspots-legend').children];
    const id = `hotspots-${++widgetId}`;
    labels.forEach((label, i) => { label.id = `${id}-${i}`; pins[i].setAttribute('aria-controls', label.id); });
    const st = steps(w, pins.length, i => pins.forEach((pin, j) => {
      pin.classList.toggle('on', j === i); pin.setAttribute('aria-pressed', j === i);
      pin.disabled = reading(); labels[j].classList.toggle('on', j === i);
    }), { read: 'end' });
    pins.forEach((pin, i) => {
      pin.addEventListener('click', () => st.go(i));
      // Space activates a native button without becoming the deck's next-slide shortcut.
      pin.addEventListener('keydown', e => { if (e.key === ' ') e.stopPropagation(); });
    });
    const image = w.querySelector('img');
    const failed = () => {
      if (w.classList.contains('w-hotspots-failed')) return;
      w.classList.add('w-hotspots-failed');
      const error = document.createElement('p'); error.className = 'td-error'; error.setAttribute('role', 'alert');
      error.textContent = `hotspots: could not load image “${image.alt || image.getAttribute('src')}”. See the numbered legend below.`;
      w.prepend(error); pins.forEach(pin => pin.hidden = true);
    };
    // SVGs without width/height have no intrinsic width for a fit-content wrapper.
    // Bound the full-width overlay by the image ratio instead of shrink-wrapping it.
    const loaded = () => {
      if (image.naturalWidth && image.naturalHeight) w.style.setProperty('--hotspots-ratio', image.naturalWidth / image.naturalHeight);
    };
    image.addEventListener('load', loaded); loaded();
    image.addEventListener('error', failed);
    if (image.complete && !image.naturalWidth) failed();
  }

  // ```trace — waterfall rows in authored order: ↓ reveals one more span, clicking a row jumps to it
  function traceSteps(w) {
    const rows = [...w.querySelectorAll('.w-trace-row')], detail = w.querySelector('.w-trace-detail'), cells = [...w.querySelectorAll('.w-trace-table tbody tr')];
    const st = steps(w, rows.length, i => {
      rows.forEach((r, j) => { r.classList.toggle('shown', j <= i); r.classList.toggle('current', j === i); r.setAttribute('aria-pressed', j === i); });
      const c = cells[i].children;
      detail.textContent = `${c[0].textContent}: starts ${c[1].textContent}, lasts ${c[2].textContent}, ends ${c[3].textContent}`;
    }, { read: 'end' });
    rows.forEach((r, i) => r.addEventListener('click', () => st.go(i)));
  }

  function quadrantSteps(w) {
    const points = [...w.querySelectorAll('.w-quadrant-point')];
    const items = points.length ? [...w.querySelectorAll('[data-point]')] : [...w.querySelectorAll('[data-group]')];
    steps(w, points.length || 4, i => items.forEach((el, j) => {
      const index = points.length ? +el.dataset.point : j;
      el.classList.toggle('shown', index <= i);
    }), { read: 'end' });
  }

  // [text]{.circle .step} — a hand-drawn mark behind the text; with .step it draws in on ↓, otherwise it is always drawn
  // Paths are in a stretched 100x100 box (non-scaling stroke), so one outline fits any word or phrase.
  const INK = {
    underline: 'M2 86 C 28 80, 62 92, 98 83',
    strike: 'M1 52 C 30 45, 66 57, 99 48',
    circle: 'M54 5 C 20 2, 3 28, 5 52 C 7 80, 35 97, 62 94 C 90 92, 99 66, 96 38 C 93 14, 68 4, 38 10',
    box: 'M3 10 L97 5 L96 95 L4 92 L5 3',
    bracket: 'M13 7 C 3 10, 4 30, 4 50 C 4 70, 3 90, 13 93 M87 7 C 97 10, 96 30, 96 50 C 96 70, 97 90, 87 93',
    highlight: 'M1 22 C 30 14, 70 18, 99 12 L98 88 C 66 94, 30 86, 2 92 Z',
  };
  function drawMark(span) {
    const kind = span.className.match(/ink-(\w+)/)?.[1]; if (!INK[kind]) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', INK[kind]); path.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.append(path); span.prepend(svg);
    if (!('markStep' in span.dataset)) { span.classList.add('on'); return; }
    steps(span, 2, i => span.classList.toggle('on', i > 0), { read: 'end' });
  }

  // ::: venn — ↓ reveals each region's text in turn; the circles and set names are always there
  function vennSteps(w) {
    const regions = [...w.querySelectorAll('[data-region]')];
    if (!regions.length) return;
    steps(w, regions.length + 1, i => regions.forEach((r, j) => r.classList.toggle('shown', j < i)), { read: 'end' });
  }

  // ::: stats — each list item or paragraph leads with its number in bold: "**42%** faster first response"
  // Two states: the initial baseline, then the authored final value on cue.
  // Accessible text always exposes the final value, avoiding noisy live updates.
  function meter(w) {
    const owner = w.closest('.slide'), isMeter = w.classList.contains('w-meter');
    const value = +w.dataset.value, precision = Math.min(20, +w.dataset.precision || 0), suffix = w.dataset.suffix || '';
    const text = isMeter ? w.querySelector('strong') : w.firstElementChild;
    const fill = w.querySelector('.w-meter-track > span'), finalText = text.textContent;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, state = 0, previous = '';
    const paint = n => {
      text.textContent = n === value ? finalText : n.toFixed(precision) + suffix;
      if (fill) fill.style.width = `${n / +w.dataset.max * 100}%`;
    };
    const update = () => {
      const active = owner === slide() && !reading();
      const key = `${active}:${reading()}:${state}:${motion.matches}`;
      if (key === previous) return;
      previous = key;
      cancelAnimationFrame(frame); frame = 0;
      if (reading() || !active || motion.matches) { paint(value); return; }
      paint(0);
      if (!state) return;
      const start = performance.now();
      const tick = now => {
        if (!w.isConnected) { frame = 0; return; }
        // A preference can change before its asynchronous media-query event arrives.
        // Never let an already queued frame paint another intermediate value.
        if (motion.matches) { frame = 0; paint(value); return; }
        const progress = Math.min(1, (now - start) / 900);
        paint(value * (1 - (1 - progress) ** 3));
        frame = progress < 1 ? requestAnimationFrame(tick) : 0;
      };
      frame = requestAnimationFrame(tick);
    };
    steps(w, 2, i => { state = i; update(); }, { read: 'end' });
    handlers.slide.push(update);
    new MutationObserver(update).observe(root, { attributes: true, attributeFilter: ['data-view'] });
    motion.addEventListener('change', update);
  }

  // Keep the original table nodes as both the enhancement and the fallback.
  function envdiff(box) {
    const table = box.querySelector(':scope > table');
    let changed;
    try {
      if (box.children.length !== 1 || !table || [...box.attributes].some(a => a.name.startsWith('data-'))) throw new Error('envdiff needs one Markdown table and takes no options.');
      changed = environmentDifferences(
        [...(table.tHead?.rows[0]?.cells || [])].map(c => c.textContent),
        [...(table.tBodies[0]?.rows || [])].map(r => [...r.cells].map(c => c.textContent))
      );
    } catch (e) {
      const error = document.createElement('p'); error.className = 'td-error'; error.setAttribute('role', 'alert'); error.textContent = e.message;
      box.prepend(error); return;
    }
    box.classList.add('w', 'w-envdiff');
    const rows = [...table.tBodies[0].rows];
    [...table.tHead.rows[0].cells].forEach(cell => cell.scope = 'col');
    rows.forEach((row, i) => {
      row.classList.toggle('envdiff-same', !changed[i]);
      [...row.cells].slice(1).forEach(cell => { if (changed[i]) cell.classList.add('envdiff-changed'); });
      const key = row.cells[0], heading = document.createElement('th');
      heading.scope = 'row'; heading.append(...key.childNodes); key.replaceWith(heading);
    });
    const scroll = document.createElement('div'); scroll.className = 'w-envdiff-scroll'; scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', 'Environment configuration comparison');
    table.before(scroll); scroll.append(table);
    const tools = document.createElement('div'); tools.className = 'w-envdiff-tools';
    const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Differences only';
    const id = 'td-envdiff-' + (++widgetId); scroll.id = id; button.setAttribute('aria-controls', id);
    const status = document.createElement('span'); status.setAttribute('role', 'status');
    tools.append(button, status); box.prepend(tools);
    const st = steps(box, 2, i => {
      box.dataset.onlyDifferences = String(!!i); button.setAttribute('aria-pressed', String(!!i));
      status.textContent = i ? `${changed.filter(Boolean).length} of ${rows.length} rows differ` : `${rows.length} configuration rows`;
    });
    button.addEventListener('click', () => { st.go(st.i ? 0 : 1); fit(); });
    // Let native button activation finish without Space / Enter navigating the deck.
    button.addEventListener('keydown', e => { if ([' ', 'Enter'].includes(e.key)) e.stopPropagation(); });
    button.addEventListener('keyup', e => { if ([' ', 'Enter'].includes(e.key)) e.stopPropagation(); });
  }

  // ::: magnitude: one table, bars on a log scale so nine orders of magnitude share a row of bars; ↓ reveals row by row
  function magnitude(box) {
    const table = box.querySelector(':scope > table');
    const fail = message => { box.insertAdjacentHTML('beforebegin', `<p class="td-error" role="alert">magnitude: ${esc(message)}</p>`); box.classList.remove('magnitude'); };
    try {
      const unknown = [...box.attributes].find(a => a.name.startsWith('data-') && a.name !== 'data-unit');
      if (unknown) throw new Error('unknown option: ' + unknown.name.slice(5));
      if (!table) throw new Error('write a Markdown table, label then value, like | L1 hit | 0.5e-9 |');
      const headers = [...(table.tHead?.rows[0]?.cells || [])].map(cell => cell.textContent);
      const rows = [...(table.tBodies[0]?.rows || [])].map(row => [...row.cells].map(cell => cell.textContent));
      const unit = box.dataset.unit || '', m = magnitudeModel(headers, rows, unit);
      const w = document.createElement('div'); w.className = 'w w-magnitude'; if (box.id) w.id = box.id;
      w.setAttribute('role', 'group'); w.setAttribute('aria-label', `${headers[1] || 'Values'}, log scale over ${m.decades} orders of magnitude`);
      const items = m.items.map(it => `<li><span class="w-mag-label">${esc(it.label)}</span><span class="w-mag-track" aria-hidden="true"><span class="w-mag-bar" style="width:${(it.at * 100).toFixed(2)}%"></span></span><strong class="w-mag-value">${esc(it.text)}</strong></li>`).join('');
      w.innerHTML = `<ol class="w-mag-rows">${items}</ol><div class="w-mag-axis" aria-hidden="true">${m.ticks.map(t => `<span style="left:${(t.at * 100).toFixed(2)}%">${esc(t.text)}</span>`).join('')}</div><p class="w-mag-note">Log scale: each tick is ten times the last.</p>`;
      table.classList.add('w-mag-table'); w.append(table);
      box.replaceWith(w);
      const lis = [...w.querySelectorAll('.w-mag-rows > li')];
      const st = steps(w, lis.length, i => lis.forEach((li, j) => { li.classList.toggle('on', j === i); li.classList.toggle('shown', j <= i); }), { read: 'end' });
      lis.forEach((li, j) => li.addEventListener('click', () => st.go(j)));
    } catch (e) { fail(e.message); }
  }

  function stats(box) {
    const src = [...box.querySelectorAll(':scope > ul > li, :scope > ol > li, :scope > p')];
    const w = document.createElement('div'); w.className = 'w w-stats';
    if (src.some(el => !el.querySelector('strong'))) box.insertAdjacentHTML('beforebegin', '<p class="td-error" role="alert">stats: start each item with a bold number, like - **42%** faster.</p>');
    w.innerHTML = src.map(el => {
      const n = el.querySelector('strong'), num = n ? n.innerHTML : '';
      n?.remove();
      return `<div class="w-stat"><div class="w-stat-n">${num}</div><div class="w-stat-l">${el.innerHTML.trim()}</div></div>`;
    }).join('');
    w.style.setProperty('--n', Math.min(4, src.length));
    w.style.setProperty('--n-narrow', src.length === 3 ? 3 : Math.min(2, src.length));   // narrow screens: three across, never a lone third
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

  // Heatmap scale for this theme (see the heatmap in visual-charts.js): mixes where the text colour reads form the low half;
  // if they stop short, the high half starts where the on-accent (or background) ink reads and runs to full accent.
  function heatScale() {
    if (!document.querySelector('.w-heatmap')) return;
    const probe = document.createElement('i'); document.body.append(probe);
    // mixing with transparent makes the browser report any theme colour (hex, oklch, lab…) in sRGB
    const rgb = c => { probe.style.color = `color-mix(in srgb, ${c} 100%, transparent)`; const s = getComputedStyle(probe).color, m = s.match(/[\d.]+/g)?.map(Number) || [0, 0, 0];
      return s.startsWith('color(srgb') ? m.slice(0, 3).map(v => v * 255) : m.slice(0, 3); };
    const lum = c => c.map(x => { x /= 255; return x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }).reduce((a, x, i) => a + x * [.2126, .7152, .0722][i], 0);
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
    const steps = Array.from({ length: 35 }, (_, i) => 15 + i * 2.5), cell = steps.map(x => rgb(`color-mix(in srgb, var(--accent) ${x}%, var(--surface))`));
    const reads = (ink, i) => ratio(ink, cell[i]) >= 4.6;
    const fg = rgb('var(--fg)'), low = steps.findIndex((_, i) => !reads(fg, i)), lowEnd = Math.min(90, low < 0 ? 90 : steps[Math.max(0, low - 1)]);
    let set = { mid: (15 + lowEnd) / 2, high: (15 + lowEnd) / 2, top: lowEnd, ink: 'var(--fg)' };   // one ink, capped
    if (lowEnd < 75) for (const ink of ['var(--on-accent)', 'var(--bg)']) {
      const c = rgb(ink); let from = steps.length;
      while (from > 0 && reads(c, from - 1)) from--;   // the high half: every mix from here to full accent reads under this ink
      if (steps[from] <= 85) { set = { mid: lowEnd, high: steps[from], top: 100, ink }; break; }
    }
    if (set.top <= 15) set = { mid: 52, high: 52, top: 90, ink: 'var(--on-accent)' };   // a theme no ink reads on: keep the scale informative
    for (const [k, v] of Object.entries(set)) root.style.setProperty('--heat-' + k, typeof v === 'number' ? v + '%' : v);
    probe.remove();
  }

  // ::: chart or <figure data-chart>: column one holds the labels, every other column is a series. Drawn in HTML and CSS
  // (the line in SVG), so text stays crisp and reflows on phones; the table stays behind for screen readers.
  const niceMax = m => { if (m <= 0) return 1; const e = 10 ** Math.floor(Math.log10(m)), f = m / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; };
  let chartId = 0;
  function chart(source) {
    if (!source.parentElement || source.closest('.w-chart-box')) return;
    const table = source.querySelector(':scope > table'), csv = source.querySelector(':scope > pre[data-lang="csv"]');
    let headers = [], rows = [], error = '', model;
    const kind = source.dataset.type || source.dataset.chart || 'bar';
    const initial = source.dataset.view || source.dataset.chartView || 'auto';
    const title = source.dataset.title || source.querySelector(':scope > figcaption')?.textContent || table?.caption?.textContent || 'Chart data';
    try {
      if (csv && table) throw new Error('Use one CSV block or one table per chart');
      if (csv) ({ headers, rows } = parseCSV(csv.textContent));
      else if (table) {
        headers = [...(table.tHead?.rows[0]?.cells || [])].map(cell => cell.textContent);
        rows = [...(table.tBodies[0]?.rows || [])].map(row => [...row.cells].map(cell => cell.textContent));
      } else throw new Error('A chart needs a CSV code block or a table');
      if (!['bar', 'hbar', 'line', 'donut', ...visualTypes].includes(kind)) throw new Error('Unknown chart type: ' + kind);
      if (!['auto', 'chart', 'table', 'both'].includes(initial)) throw new Error('Unknown chart view: ' + initial);
      const unknown = [...source.attributes].find(a => a.name.startsWith('data-') && !['data-type','data-chart','data-view','data-chart-view','data-title', ...(visualTypes.includes(kind) ? [] : ['data-series']), ...(['scatter','bubble'].includes(kind) ? ['data-x','data-y'] : []), ...(kind === 'bubble' ? ['data-size'] : []), ...(kind === 'heatmap' ? ['data-total'] : [])].includes(a.name));
      if (unknown) throw new Error('Unknown chart option: ' + unknown.name.slice(5));
      model = visualTypes.includes(kind) ? { visual: visualChart(headers, rows, kind, { ...source.dataset, title }) } : chartDataset(headers, rows, kind, source.dataset.series);
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
    Object.assign(w, { tabIndex: 0, title: 'Open full screen' });
    if (model?.visual) {
      w.classList.add('w-visual-chart');
      w.setAttribute('role', 'region');
      w.setAttribute('aria-label', title + ' chart, scroll to explore, Enter to open full screen');
      w.innerHTML = model.visual;
      box.append(w);
    } else if (model) {
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
      // with several series, the lowest end value is labelled under its dot so neighbouring end labels do not collide
      const ends = series.map(s => s.v.at(-1)), lowEnd = s => series.length > 1 && s.v.at(-1) === Math.min(...ends);
      w.innerHTML = (series.length > 1 ? legend(series.map((s, j) => [s.name, j])) : '') + `<div class="w-plot"><div class="w-area">`
        + `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${series.map((s, j) => `<polyline class="w-s s${j % 6}" points="${s.v.map((v, i) => `${x(i)},${100 - pct(v)}`).join(' ')}"/>`).join('')}</svg>`
        + series.map((s, j) => s.v.map((v, i) => `<i class="w-dot w-s s${j % 6}${i === s.v.length - 1 ? ' last' + (lowEnd(s) ? ' below' : '') : ''}" style="left:${x(i)}%;bottom:${pct(v)}%"><b>${s.shown[i]}</b></i>`).join('')).join('')
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
    w.style.setProperty('--n-auto', Math.min(3, w.children.length));   // an author's --n overrides it
    box.replaceWith(w);
  }

  // ::: speaker — ordinary Markdown for a photo, name, role and links; no hidden content in either view.
  function speaker(box) {
    const headings = [...box.children].filter(el => el.tagName === 'H3');
    if (headings.length !== 1 || !headings[0].textContent.trim()) {
      const error = document.createElement('p'); error.className = 'td-error'; error.setAttribute('role', 'alert');
      error.textContent = 'speaker: include exactly one ### heading for the name.';
      box.prepend(error); return;   // leave the authored Markdown readable
    }
    const photo = [...box.children].find(el => el.matches('figure') && el.firstElementChild?.tagName === 'IMG');
    box.classList.remove('speaker'); box.classList.add('w', 'w-speaker');
    const body = document.createElement('div'); body.className = 'w-speaker-body';
    if (photo) { photo.classList.add('w-speaker-photo'); box.prepend(photo); }
    body.append(...[...box.childNodes].filter(node => node !== photo)); box.append(body);
    for (const link of body.querySelectorAll('a[href]')) {
      if (link.querySelector('.ico, svg, img')) continue;
      const icon = document.createElement('i'); icon.className = 'ico'; icon.setAttribute('aria-hidden', 'true');
      const url = link;
      icon.dataset.icon = url.protocol === 'mailto:' ? 'mail' : /(^|\.)github\.com$/i.test(url.hostname) ? 'github' : 'link';
      link.prepend(icon, document.createTextNode(' '));
    }
  }

  // ::: cite: defaults come from the page's own metadata; options on the container win. Copy buttons, no network.
  function cite(box) {
    const meta = n => document.querySelector(`meta[name="${n}"], meta[property="${n}"]`)?.content.trim() || '';
    const canonical = document.querySelector('link[rel=canonical]');
    const page = new URL(canonical?.href || location.href, document.baseURI);
    if (!/^(https?|file):$/.test(page.protocol)) page.href = location.href;   // never turn a hostile canonical into a link
    if (!canonical || page.href === location.href) { page.hash = ''; ['view', 'mode', 'theme', 'slide'].forEach(k => page.searchParams.delete(k)); }
    const date = (box.dataset.date || meta('date') || meta('article:published_time')).slice(0, 10);
    const data = {
      title: box.dataset.title || meta('og:title') || document.title.trim(), author: box.dataset.author || meta('author'),
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '', url: box.dataset.url || page.href,
    };
    if (!data.title) {
      box.innerHTML = '<p class="td-error" role="alert">cite: no title found; set title="…" or give the page a &lt;title&gt;.</p>'; return;
    }
    const f = citeFormats(data), e = s => qesc(esc(s));
    box.innerHTML = `<div class="w-cite-head"><span class="w-cite-label">Cite this</span><a class="w-cite-link" href="${e(f.link)}">${e(f.link)}</a></div>`
      + `<p class="w-cite-text">${e(f.text)}</p><div class="w-cite-actions" role="group" aria-label="Copy citation">`
      + [['link', 'Copy link'], ['markdown', 'Copy Markdown'], ['bibtex', 'Copy BibTeX']].map(([k, label]) => `<button type="button" data-copy="${k}">${label}</button>`).join('')
      + '</div><p class="w-cite-status" role="status"></p>';
    const status = box.querySelector('.w-cite-status');
    box.addEventListener('keydown', ev => { if ([' ', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(ev.key)) ev.stopPropagation(); });
    box.querySelectorAll('button').forEach(b => b.addEventListener('click', async () => {
      await copyText(f[b.dataset.copy], b);
      status.textContent = `Copied ${b.textContent.replace('Copy ', '')}`;
      clearTimeout(box.reset); box.reset = setTimeout(() => { status.textContent = ''; }, 1600);
    }));
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

  // ::: prompt — one reveal, with the complete pair visible in the article.
  function prompt(w) {
    const output = w.querySelector(':scope > .w-prompt-output');
    if (!output) return;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'w-prompt-reveal';
    output.id ||= `td-prompt-${++widgetId}`;
    button.setAttribute('aria-controls', output.id);
    w.insertBefore(button, output);
    const st = steps(w, 2, i => {
      output.hidden = !reading() && i === 0;
      button.hidden = reading();
      button.textContent = i ? 'Hide output' : 'Reveal output';
      button.setAttribute('aria-expanded', String(reading() || i === 1));
    }, { read: 'end' });
    button.addEventListener('click', () => st.go(st.i ? 0 : 1));
    // Native button activation stays local; the deck also listens for Space.
    w.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('button, a, input, select, textarea, summary')) e.stopPropagation();
    });
  }

  // ::: versus — one column per step, then the verdict; the article shows everything.
  function versus(w) {
    const parts = [...w.querySelectorAll(':scope > .w-versus-cols > section, :scope > .w-versus-verdict')];
    steps(w, parts.length, i => parts.forEach((p, j) => { p.classList.toggle('pending', j > i); p.inert = j > i; }), { read: 'end' });
  }

  // ```regex — step 0 shows the whole pattern; each ↓ then spotlights one top-level part. Article shows every part.
  function regexSteps(w) {
    const n = +w.dataset.parts || 0, parts = [...w.querySelectorAll('[data-i]')];
    steps(w, n + 1, k => {
      w.toggleAttribute('data-active', k > 0);
      parts.forEach(p => p.classList.toggle('on', +p.dataset.i === k));
    });
  }

  // Choices use native buttons, so keyboard and touch share the same action.
  function quiz(box) {
    const heading = box.querySelector(':scope > h3');
    const answer = box.querySelector(':scope > .quiz-answer');
    if (!heading || !answer || !box.querySelector(':scope > .quiz-choices > li')) {
      const error = document.createElement('p'); error.className = 'td-error'; error.setAttribute('role', 'alert');
      error.textContent = 'quiz: use a ### question, task-list choices and exactly one checked answer'; box.prepend(error); return;
    }
    box.className = 'w w-quiz';
    heading.id = `quiz-${++widgetId}`;
    box.setAttribute('role', 'group'); box.setAttribute('aria-labelledby', heading.id);
    answer.id = heading.id + '-answer';
    const status = document.createElement('p'); status.className = 'quiz-status';
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const buttons = [...box.querySelectorAll(':scope > .quiz-choices > li')].map(li => {
      const button = document.createElement('button'); button.type = 'button';
      button.innerHTML = li.innerHTML; button.dataset.correct = li.dataset.correct;
      button.setAttribute('aria-pressed', 'false');
      li.replaceChildren(button); return button;
    });
    const reveal = document.createElement('button'); reveal.type = 'button'; reveal.className = 'quiz-reveal';
    reveal.textContent = 'Show answer'; reveal.setAttribute('aria-controls', answer.id);
    const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'quiz-reset'; reset.textContent = 'Reset quiz';
    const clear = () => { status.textContent = ''; buttons.forEach(b => b.setAttribute('aria-pressed', 'false')); };
    const st = steps(box, 2, i => {
      box.classList.toggle('answered', i === 1);
      reveal.setAttribute('aria-expanded', String(i === 1));
      // Read view always exposes the prose answer, independent of quiz interaction.
      if (i === 0) clear();
    });
    buttons.forEach((button, i) => button.addEventListener('click', () => {
      buttons.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
      st.go(1);
      status.textContent = button.dataset.correct === 'true' ? 'Correct.' : 'Not quite. Review the answer below.';
    }));
    reveal.addEventListener('click', () => st.go(1));
    reset.addEventListener('click', () => { st.go(0); buttons[0].focus(); });
    // Space on a focused button must activate it instead of navigating slides.
    box.addEventListener('keydown', e => { if (e.target.tagName === 'BUTTON' && [' ', 'Enter'].includes(e.key)) e.stopPropagation(); });
    box.insertBefore(status, answer); box.append(reveal, reset);
  }

  // ```tree: each folder with children is a button that opens and closes it; {steps} opens one folder per ↓, in order
  function tree(w) {
    const folds = [...w.querySelectorAll('button.t-item')], open = b => b.getAttribute('aria-expanded') === 'true';
    const set = (b, on) => { b.setAttribute('aria-expanded', on); b.closest('li').classList.toggle('t-shut', !on); };
    w.addEventListener('keydown', e => { if (e.key === ' ' && folds.includes(e.target)) e.stopPropagation(); });   // Space toggles, not next slide
    // without {steps} every folder starts open, and opens again on entering the slide or the article
    const n = 'steps' in w.dataset ? folds.length + 1 : 1;
    steps(w, n, i => folds.forEach((b, j) => set(b, n === 1 || j < i)), { read: 'end' });
    folds.forEach(b => b.addEventListener('click', () => set(b, !open(b))));   // a click toggles just that folder
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
      n, i: 0, read, el,
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

  // a stepper inside a code group's hidden language is skipped, so ↓ walks only the code on screen
  const stepsOf = s => (steppers.get(s) || []).filter(st => !st.el.closest('.w-cg-pane:not(.on)'));
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
    sync(); squeezeSoon();
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
    if (reading()) writeHash('#' + (cur + 1)); else if (portrait.matches) fit();
    markRail();
    mobileState();
  }
  // <html data-read-progress>: a section list beside the article (wide screens) that follows the reader
  let railItems = [];
  function buildRail() {
    if (!('readProgress' in root.dataset) || $('rail')) return;
    const shown = slides().map((s, i) => [s, i]).filter(([s]) => available(s, 'read'));
    const chapters = new Set(shown.map(([s]) => s.dataset.section || '')).size > 1;   // sections when there are several, else one entry per slide
    let last;
    const items = shown.filter(([s]) => { const k = s.dataset.section || '', first = k !== last || s.classList.contains('layout-section'); last = k; return !chapters || first; });
    if (items.length < 2) return;
    const nav = document.createElement('nav'), ol = document.createElement('ol');
    nav.id = 'rail'; nav.setAttribute('aria-label', 'Sections');
    railItems = items.map(([s, i]) => {
      const li = document.createElement('li'), a = document.createElement('a');
      a.href = '#' + (i + 1);
      a.textContent = (chapters ? s.dataset.section : s.dataset.name) || s.querySelector('h1, h2')?.textContent || 'Untitled';
      a.onclick = e => { e.preventDefault(); go(i, undefined, true); };
      li.append(a); ol.append(li);
      return { i, a };
    });
    nav.append(ol); document.body.append(nav);
  }
  function markRail() {
    const on = railItems.findLast(r => r.i <= cur) || railItems[0];
    for (const r of railItems) r === on ? r.a.setAttribute('aria-current', 'location') : r.a.removeAttribute('aria-current');
  }
  const fillNotes = () => { $('mNotes').innerHTML = slide().querySelector('.notes')?.innerHTML || ''; $('mNotes').scrollTop = 0; };   // the speaker's notes

  const label = s => s.querySelectorAll('[data-next]').forEach(b => b.textContent = (b.stepper ? b.stepper.i === b.stepper.n - 1 : done(s)) ? 'Reset ↺' : 'Next →');
  function sync() {
    const s = slide(), n = total(s), k = at(s);
    $('stepNav').classList.toggle('on', n > 1);
    $('stepCount').textContent = `step ${k + 1}/${n}`;
    $('up').disabled = k === 0; $('down').disabled = k === n - 1;
    label(s);
    mobileState();
    if (!reading()) writeHash('#' + (cur + 1) + (n > 1 && k ? '.' + (k + 1) : ''));
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
    $('dPrev').disabled = reading() || at(s) === 0;
    $('dNext').disabled = reading() || done(s);
    $('dBack').disabled = !list.slice(0, cur).some(item => available(item)) && (reading() || at(s) === 0);
    $('dForward').disabled = !list.slice(cur + 1).some(item => available(item)) && (reading() || done(s));
    $('dBack').setAttribute('aria-label', reading() ? 'Previous section' : 'Previous step or slide');
    $('dForward').setAttribute('aria-label', reading() ? 'Next section' : 'Next step or slide');
    $('dHome').disabled = !list.slice(0, cur).some(item => available(item)) && (reading() ? scrollY < 2 : at(s) === 0);
    const step = !reading() && total(s) > 1 ? `step ${at(s) + 1}/${total(s)}` : '';
    $('dCount').innerHTML = `<span>${cur + 1} / ${list.length}</span>${step ? `<small>${step}</small>` : ''}`;
    $('dCount').setAttribute('aria-label', `Slide ${cur + 1} of ${list.length}${step ? ', ' + step : ''}`);
    $('dPosition').textContent = cur + 1;
    $('dToggle').setAttribute('aria-label', `${$('dPanel').hidden ? 'Open' : 'Close'} navigation, slide ${cur + 1} of ${list.length}`);
    $('dHint').textContent = reading() ? 'Scroll to read. Switch to Slides to present this section.' : 'Arrows move through steps, then slides. Scroll within long slides.';
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
    for (const type of ['touchstart', 'wheel']) addEventListener(type, e => {
      if (!$('dPanel').hidden && !e.target.closest('#dock')) setDock(false);
    }, { passive: true });
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

  // A Markdown slide whose blocks paint past the stage (a theme with larger type, a late KaTeX or Mermaid render) has them
  // scaled down just enough to fit, never below 80%. Slides that fit are untouched; phones and read view scroll instead.
  let squeezing = 0, watch = null, watched = null;
  const squeezeSoon = () => { cancelAnimationFrame(squeezing); squeezing = requestAnimationFrame(squeeze); };
  // late renders (maths, diagrams, code) resize blocks: re-fit then, but not for the observer's first report or our own zoom
  const sizes = new WeakMap();
  const resized = entries => {
    let changed = false;
    for (const e of entries) {
      const now = `${Math.round(e.contentRect.width)}x${Math.round(e.contentRect.height)}`, was = sizes.get(e.target);
      if (was && was !== now) changed = true;
      sizes.set(e.target, now);
    }
    if (changed) squeezeSoon();
  };
  function squeeze() {
    const s = slide(), c = s?.querySelector('.content');
    slides().forEach(x => x.style.removeProperty('--squeeze'));
    if (s !== watched) { watch?.disconnect(); watched = s; if (c) [...c.children].forEach(e => watch?.observe(e)); }
    if (!c || reading() || root.dataset.tall || !s.classList.contains('md') || !c.children.length) return;
    const cs = getComputedStyle(c), top = parseFloat(cs.paddingTop), room = c.clientHeight - top - parseFloat(cs.paddingBottom) / 2;   // may use half the bottom padding, clear of the controls
    for (let k = 1, i = 0; i < 4; i++) {
      const box = c.getBoundingClientRect(), scale = box.height / c.offsetHeight || 1;
      const rects = [...c.children].map(e => e.getBoundingClientRect()).filter(r => r.height);
      const lo = (Math.min(...rects.map(r => r.top)) - box.top) / scale, hi = (Math.max(...rects.map(r => r.bottom)) - box.top) / scale;
      if (hi <= c.clientHeight + 1 && lo >= -1) return;   // nothing painted outside the slide
      const next = Math.max(.8, k * room / (hi - lo));
      if (next >= k - .005) return;
      s.style.setProperty('--squeeze', (k = next).toFixed(3));
    }
  }

  // the presenter's next-slide preview is a copy: give it the same fit as the slide would get live
  function fitClone(c) {
    const box = c.querySelector('.content'); if (!box || !c.classList.contains('md')) return;
    const room = box.clientHeight - parseFloat(getComputedStyle(box).paddingTop) - parseFloat(getComputedStyle(box).paddingBottom) / 2;
    const need = Math.max(0, ...[...box.children].map(e => e.offsetTop + e.offsetHeight)) - parseFloat(getComputedStyle(box).paddingTop);
    if (need > room && room > 0) c.style.setProperty('--squeeze', Math.max(.8, room / need).toFixed(3));
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
    plus: '<path d="M9 4v10M4 9h10"/>',
    minus: '<path d="M4 9h10"/>',
    fit: '<path d="M2.5 6.5v-4h4M11.5 2.5h4v4M15.5 11.5v4h-4M6.5 15.5h-4v-4"/>',
    close: '<path d="M4.5 4.5l9 9M13.5 4.5l-9 9"/>',
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
    // Reuse slide navigation IDs: arbitrary child hashes are not deck destinations.
    const slideIds = new Set([...stage.querySelectorAll('.slide[data-id]')].map(s => s.dataset.id));
    stage.querySelectorAll('.w-endpoint-path').forEach(link => {
      const slide = link.closest('.slide');
      if (!slide) return;
      const label = link.closest('.w-endpoint').getAttribute('aria-label');
      if (!slide.dataset.id) {
        const base = 'endpoint-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
        let id = base, n = 2;
        while (slideIds.has(id) || document.getElementById(id)) id = base + '-' + n++;
        slide.dataset.id = id;
        slideIds.add(id);
      }
      link.href = '#' + encodeURIComponent(slide.dataset.id);
      link.setAttribute('aria-label', 'Permalink to ' + label);
    });
    const finishGlossary = glossary(stage);
    citations(stage, entry => {
      if (reading()) return entry?.scrollIntoView({ block: 'center' });
      const target = entry?.closest('.slide'); if (target) go(slides().indexOf(target));
    });
    // an author's own <div id="bar"> (a .title plus any links) becomes the top bar; talkdown adds the section and tools
    const own = $('bar');
    if (own && !stage.contains(own)) stage.prepend(own);
    if (!own) stage.insertAdjacentHTML('afterbegin', `<div id="bar"><div class="title">${esc(document.title)}</div></div>`);
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
    finishGlossary?.();
    bylineMeta();
    frames = [...document.querySelectorAll('.frame')];
    buildRail();

    stage.insertAdjacentHTML('beforeend', `
      <div id="progress"></div>
      <div id="pager"><span id="stepNav"><button id="up" title="Previous step (↑)">↑</button><span id="stepCount"></span><button id="down" title="Next step (↓)">↓</button></span><button id="prev" title="Previous slide (←)">‹</button><span id="count"></span><button id="next" title="Next slide (→)">›</button></div>`);
    document.body.insertAdjacentHTML('beforeend', `
      <div id="notes"><h4 id="notesTitle">SPEAKER NOTES</h4><div class="tk" id="notesTk"></div><div id="notesBody"></div></div>
      <div id="overview"></div>
      <div id="mhead"><b>${esc(bar.querySelector('.title')?.textContent || document.title)}</b><span id="mSec"></span><div id="mLinks"></div><i id="mProg"></i></div>
      <div id="mNotes"></div>
      <nav id="dock" aria-label="Presentation navigation">
        <button id="dBack" aria-label="Previous" title="Previous">‹</button><button id="dForward" aria-label="Next" title="Next">›</button>
        <div id="dPanel" hidden>
        <div class="view-switch" role="group" aria-label="Reading format"><button id="dSlides" aria-pressed="true">${svg('present')}<span>Slides</span></button><button id="dRead" aria-pressed="false">${svg('read')}<span>Article</span></button></div>
        <div class="dock-actions"><button id="dHome" aria-label="Back to top" title="Back to top">${svg('home')}</button><button id="dSections" aria-label="Jump to a section or slide" title="Sections" aria-haspopup="dialog">${svg('grid')}</button><button id="dPrev" aria-label="Previous step" title="Previous step">‹</button><span id="dCount"></span><button id="dNext" aria-label="Next step" title="Next step">›</button><button id="dNotes" aria-label="Speaker notes" aria-pressed="false" title="Speaker notes">${svg('notes')}</button></div>
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
      <div id="src"><div class="kcard"><div class="sh"><h3>Markdown source</h3><button id="srcCopy" class="w-copy" aria-label="Copy the Markdown"></button></div><pre class="code"><code></code></pre></div></div>`);

    // Preserve author links in the separate portrait header as well.
    for (const link of bar.querySelectorAll(':scope > a')) {
      const copy = link.cloneNode(true);
      copy.removeAttribute('id');
      copy.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      if (!copy.hasAttribute('aria-label')) copy.setAttribute('aria-label', link.textContent.trim() || link.title);
      $('mLinks').append(copy);
    }
    $('mLinks').hidden = !$('mLinks').children.length;

    $('srcBtn').onclick = toggleSource;
    $('srcCopy').onclick = copySource;
    $('src').onclick = e => { if (!e.target.closest('.kcard')) $('src').classList.remove('on'); };
    $('viewBtn').onclick = toggleView;
    $('themeBtn').onclick = toggleTheme;
    if (picker) buildPicker();
    $('ovBtn').onclick = toggleOverview;
    $('prev').onclick = () => go(cur - 1);
    $('next').onclick = () => go(cur + 1);
    $('up').onclick = prev;
    $('down').onclick = next;
    $('dBack').onclick = prev;
    $('dForward').onclick = next;
    $('dPrev').onclick = () => setAt(slide(), Math.max(0, at(slide()) - 1));
    $('dNext').onclick = () => setAt(slide(), Math.min(total(slide()) - 1, at(slide()) + 1));
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
  function setMode(m) { root.dataset.mode = m; store.set('mode', m); if (!picked) root.dataset.theme = looks[m]; icons(); }
  function setLook(t) { root.dataset.theme = t; picked = true; if (picker) store.set('look', t); }
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
  const copySource = () => copyText($('src').querySelector('code').textContent, $('srcCopy'));
  function toggleOverview() { const ov = $('overview'); ov.classList.toggle('on'); if (ov.classList.contains('on')) ov.querySelector('.cur')?.focus(); }

  /* ================= input ================= */
  function onKey(e) {
    if (document.querySelector('.w-gallery-lightbox[open]')) return;
    if ($('mobileNav').open) return;    // the dialog owns focus, tab arrows and Escape
    if ($('zoom')?.classList.contains('on')) {    // the diagram viewer owns the keyboard
      if (e.key === 'Escape') unzoom(); else if (!e.metaKey && !e.ctrlKey && $('zoom').key(e.key)) e.preventDefault();
      return;
    }
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


  // #slide or #slide.step, 1-based; [0, 1] when there's no hash
  let wrote = '';   // the hash the deck last wrote itself, so its own updates aren't followed back
  const writeHash = h => {
    // A release URL is also a navigation target. Keep it while it still names
    // the selected release, so reload and copying the address retain that target.
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target?.matches('.w-release') && target.closest('.slide') === slide() &&
        (reading() || fromHash()[1] === at(slide()) + 1)) h = location.hash;
    history.replaceState(null, '', h); wrote = location.hash;
  };
  function scrollToRelease(target) {
    if (!reading() || !target?.matches('.w-release')) return;
    target.scrollIntoView({ block: 'start', behavior: 'instant' });
    // A short final release can be clamped near the next frame. Keep its owner
    // current until the reader actually scrolls, just as go() does for a slide.
    readAnchor = { y: scrollY };
  }
  function fromHash() {
    const h = decodeURIComponent(location.hash.slice(1)), m = h.match(/^(\d+)(?:\.(\d+))?$/);
    if (m) return [+m[1], +(m[2] || 1)];
    const release = document.getElementById(h);
    if (release?.matches('.w-release')) {
      const owner = release.closest('.slide'), list = stepsOf(owner), widget = release.parentElement;
      const st = list.find(item => item.releaseWidget === widget);
      if (st) return [slides().indexOf(owner) + 1, 1 + list.slice(0, list.indexOf(st)).reduce((n, item) => n + item.n - 1, 0) + [...widget.children].indexOf(release)];
    }
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

  // ::: agenda lists the section slides, each linking to its slide; decks without section slides list where each section: starts
  function agendas() {
    const all = slides().map((s, i) => [s, i]);
    let parts = all.filter(([s]) => s.classList.contains('layout-section'));
    const starts = !parts.length;
    if (starts) parts = all.filter(([s, i]) => s.dataset.section && s.dataset.section !== all[i - 1]?.[0].dataset.section);
    document.querySelectorAll('.w-agenda').forEach(w => w.innerHTML = `<ol>${parts.map(([s, i]) =>
      starts ? `<li><a href="#${i + 1}"><b>${esc(s.dataset.section)}</b></a></li>` :
      `<li><a href="#${i + 1}"><b>${esc(s.querySelector('h1, h2')?.textContent || s.dataset.section || '')}</b>${s.querySelector('h1 + p, h2 + p') ? `<span>${esc(s.querySelector('h1 + p, h2 + p').textContent)}</span>` : ''}</a></li>`).join('')}</ol>`);
  }

  // ::: qr — a QR code of the URL inside, or of this deck without its slide number (qrcode-generator, fetched when used)
  const QRLIB = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
  function qrs() {
    const ws = [...document.querySelectorAll('.w-qr, .w-ask')];
    if (!ws.length) return;
    // Links are available immediately, including offline or when QR generation fails.
    ws.forEach(w => {
      // Let a focused audience link keep its native keyboard behavior.
      if (w.classList.contains('w-ask')) w.addEventListener('keydown', e => { if (['Enter', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) e.stopPropagation(); });
      if (w.querySelector('a')) return;
      const url = w.dataset.url || location.origin + location.pathname;
      const link = document.createElement('a'); link.textContent = url.replace(/^https?:\/\//, '');
      try { if (['http:', 'https:'].includes(new URL(url).protocol)) link.href = url; } catch {}
      w.append(link);
    });
    const draw = () => ws.forEach(w => {
      try {
        const url = w.dataset.url || location.origin + location.pathname, q = window.qrcode(0, 'M');
        q.addData(url); q.make();
        const code = document.createElement('div'); code.className = 'w-qr-code'; code.setAttribute('aria-hidden', 'true');
        code.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
        w.prepend(code);
      } catch { w.dataset.qr = 'unavailable'; }
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
      if (data.timerRequest) { if (!reading()) channel.postMessage({ timerStates: timers.map(t => t.snapshot()) }); return; }
      if (Array.isArray(data.timerStates)) { data.timerStates.forEach((state, i) => timers[i]?.apply(state)); return; }
      if (Number.isInteger(data.timer)) { timers[data.timer]?.apply(data.state); return; }
      if (reading() || (data.i === cur && data.k === at(slide()))) return;
      remote = true; go(data.i, data.k); remote = false;
    };
    channel.postMessage({ timerRequest: true });
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
      if (nx) { const c = nx.cloneNode(true); c.classList.add('active'); c.removeAttribute('id'); c.querySelectorAll('[id]').forEach(e => e.removeAttribute('id')); box.append(c); fitClone(c); }
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
    if (!all.length) { document.dispatchEvent(new CustomEvent('talkdown:error', { detail: new Error('No slides found on this page') })); return; }
    changelogs();
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
      if (b.stepper) { b.stepper.go(b.stepper.i === b.stepper.n - 1 ? 0 : b.stepper.i + 1); return; }
      const s = b.closest('.slide');
      if (done(s)) setAt(s, 0); else stepsOf(s).some(st => st.next());
    }));
    // a clicked button keeps focus, so Space / Enter would press it again; hand the keys back to the deck
    document.addEventListener('click', e => { const b = e.target.closest('#stage button'); if (b && !b.matches('.glossary-button') && (e.detail || !b.matches('.w-tree .t-item')) && !b.closest('.w-quiz, .w-timer-controls, .w-log, .w-envdiff, .w-prompt')) b.blur(); });
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
      // a jump to another slide gets its own history entry, so Back returns to where you were
      if (i >= 0 && i !== cur) { history.pushState(null, '', location.href); go(i, reading() ? undefined : 0); }
    });
    addEventListener('keydown', onKey);
    const followUrl = () => {
      if (location.hash === wrote) return;
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      const [sl, sp] = fromHash(); if (sl) go(sl - 1, reading() ? undefined : sp - 1);
      scrollToRelease(target);
    };
    addEventListener('hashchange', followUrl);
    addEventListener('storage', choiceElsewhere);
    addEventListener('popstate', followUrl);   // Back and Forward after a link jump
    addEventListener('storage', choiceElsewhere);
    let resizing = false;
    addEventListener('resize', () => { if (!resizing) { resizing = true; requestAnimationFrame(() => { resizing = false; fit(); squeeze(); }); } });
    watch = typeof ResizeObserver === 'function' ? new ResizeObserver(resized) : null;
    new MutationObserver(squeezeSoon).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-mode', 'data-view'] });
    document.fonts?.addEventListener('loadingdone', squeezeSoon);
    addEventListener('scroll', () => { if (!scrolling) { scrolling = true; requestAnimationFrame(onScroll); } }, { passive: true });
    document.dispatchEvent(new CustomEvent('talkdown:setup', { detail: window.Deck }));
    heatScale();
    new MutationObserver(heatScale).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-mode'] });
    addEventListener('load', heatScale);   // in case the stylesheet arrived after the deck was built
    handlers.ready.forEach(f => f());
    started = true;
    const releaseTarget = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    const [sl, sp] = fromHash();
    if (reading()) enterReading();
    all.forEach(label);
    if (reading() && !sl) { cur = 0; announce(); fit(); onScroll(); }      // an article opens at the top
    else { cur = Math.max(0, sl - 1); fit(); go(cur, reading() ? undefined : sp - 1, true); }
    scrollToRelease(releaseTarget);
  }
  // the loader waits for talkdown:setup or talkdown:error
  const boot = () => start().catch(error => { document.dispatchEvent(new CustomEvent('talkdown:error', { detail: error })); throw error; });
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : setTimeout(boot);

  window.Deck = {
    steps, tabs, build, go, next, prev, store, choice, setView, chart, markdown: s => renderMarkdown(dedent(s.split('\n')).join('\n')),
    get cur() { return cur; },
    get slides() { return slides(); },
    get slide() { return slide(); },
    on(ev, f) { handlers[ev].push(f); },
    key(k, f) { customKeys[k] = f; },
  };
})();


