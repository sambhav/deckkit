/* deckkit — slide decks written in Markdown (or HTML), presented on a 16:9 stage, read like an article on a phone.
 *
 * Present view                               Read view (default on phones and portrait tablets, R to switch)
 *   ← → Space PgUp PgDn   slides               one scrolling column; speaker notes become the prose,
 *   ↑ ↓ Enter             steps, then slides   builds show finished, fixed-layout slides become figures
 *   1–9                   jump to a step       ← → hop between slides
 *   swipe                 next / previous
 *   Home End · O overview · N notes · T theme · R read / present · F fullscreen · ? keys · Esc close
 *
 * Steps. A slide's steps come from its steppers, run in document order (↓ advances the first unfinished one):
 *   Deck.steps(el, n, show, {read})   show(i) renders step i (0 = initial); read: 'end' shows the last step in read view
 *   Deck.tabs(container, onPick)      each button in the container is a step; clicking selects it
 *   <div data-build> … data-step="1"  reveal [data-step] children in order (.shown / .current)
 *   <button data-next>                advance the slide's steps; wraps to the start at the end
 * Entering a slide resets its steps; coming back from the next slide shows them finished. Hash: #slide or #slide.step.
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
  root.dataset.theme = q.get('theme') || store.get('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
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
      if ((m = l.match(/^(`{3,}|~{3,})\s*([\w+-]*)/))) {
        const body = []; i++;
        while (i < L.length && !L[i].startsWith(m[1])) body.push(L[i++]);
        i++;
        out += `<pre class="code"${m[2] ? ` data-lang="${m[2]}"` : ''}><code>${esc(body.join('\n'))}</code></pre>`;
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
  const META = /^(section|name|layout|kicker|build|class|takeaway):\s*(.*)$/;
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
    const chunks = split(dedent(src.replace(/\r/g, '').split('\n')), /^---\s*$/);
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
    const c = el.firstChild;
    if (meta.build && meta.build !== 'false') {
      // every block after the title builds in; lists build item by item
      const kids = [...c.querySelectorAll(':scope > *, :scope > .cols > div > *')].filter(k => !k.matches('.kicker, .num, .cols, h1, h2'));
      kids.forEach(k => (k.matches('ul, ol') ? [...k.children] : [k]).forEach(x => x.classList.add('step')));
    }
    const steps = c.querySelectorAll('.step');
    if (steps.length) { c.setAttribute('data-build', ''); steps.forEach((s, i) => s.dataset.step ??= i + 1); }
    return el;
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
    $('themeBtn').innerHTML = svg(root.dataset.theme === 'dark' ? 'light' : 'dark');
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
    bar.insertAdjacentHTML('beforeend', `<div class="tools"><button class="ib" id="ovBtn" title="Overview (O)">${svg('grid')}</button><button class="ib" id="viewBtn"></button><button class="ib" id="themeBtn" title="Light / dark (T)"></button></div>`);

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
  function toggleTheme() { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; store.set('theme', root.dataset.theme); icons(); }
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
    else if (k === 'Escape') { ov.classList.remove('on'); $('notes').classList.remove('on'); }
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
  function fromHash() { const m = location.hash.match(/^#(\d+)(?:\.(\d+))?/); return m ? [+m[1], +(m[2] || 1)] : [0, 1]; }

  function start() {
    assemble();
    document.querySelectorAll('[data-build]').forEach(build);
    document.querySelectorAll('[data-next]').forEach(b => b.addEventListener('click', () => {
      const s = b.closest('.slide');
      if (done(s)) setAt(s, 0); else stepsOf(s).some(st => st.next());
    }));
    // a clicked button keeps focus, so Space / Enter would press it again; hand the keys back to the deck
    document.addEventListener('click', e => { const b = e.target.closest('#stage button'); if (b) b.blur(); });
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
