#!/usr/bin/env node
// Component QA + PR preview for talkdown. Serves the repo, opens one gallery slide in many devices, themes,
// modes and views, checks it, and writes screenshots plus a composed preview.png.
//
//   npm run build && node scripts/qa.cjs --slide w-diff [--page gallery.html] [--selector .w-diff]
//        [--name "Diff fence"] [--out playwright-output/qa/w-diff] [--steps 3]
//
// Checks (any failure exits 1; warnings are printed but pass):
//   errors     page errors, console errors and .td-error / [role=alert] diagnostics on the slide
//   fit        no page-level horizontal scroll; the component stays inside the viewport; present-view slides do not clip
//   contrast   every visible text inside the component meets WCAG AA (4.5:1, 3:1 for large text) in the sampled themes × modes
//   targets    on touch devices in read view, interactive controls are at least 24×24 px (44×44, or anything on the scaled
//              present stage, is a warning)
//   focus      keyboard focus inside the component is visible (desktop)
//   steps      the slide has the expected number of steps (--steps), and stepping never throws
//
// Checks run in parallel contexts (--jobs n, default: cores - 2).
// Audit every slide of a page (no screenshots; themes switch in place, so it is fast):
//   npm run qa   (node scripts/qa.cjs --all: gallery.html and index.html in parallel; --page a.html,b.html for others)
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const createStaticServer = require(path.join(root, 'tests/run-browser.cjs'));
const { chromium } = (() => { for (const m of ['playwright-core', 'playwright']) try { return require(path.join(root, 'node_modules', m)); } catch {} throw new Error('npm ci first: no playwright in node_modules'); })();

const args = Object.fromEntries(process.argv.slice(2).join(' ').split(/\s+--/).filter(Boolean)
  .map(a => a.replace(/^--/, '')).map(a => { const [k, ...v] = a.split(/\s+|=/); return [k, v.join(' ').replace(/^"|"$/g, '') || true]; }));
if (!args.slide && !args.all) { console.error('usage: qa.cjs --slide <slide id> [--page gallery.html] [--selector .w-x] [--name ..] [--steps n] [--out dir]'); process.exit(2); }
const pages = String(args.page || (args.all ? 'gallery.html,index.html' : 'gallery.html')).split(','), page_ = pages[0];
const out = path.resolve(root, args.out || `playwright-output/qa/${args.slide}`);
if (!args.all) fs.mkdirSync(out, { recursive: true });

const THEMES = ['clean', 'paper', 'slate', 'ledger', 'noir', 'editorial', 'swiss', 'atelier', 'mocha', 'rose', 'sunset', 'chalk',
  'clinic', 'forest', 'ocean', 'nord', 'solar', 'terminal', 'ai', 'blueprint', 'punk', 'volt', 'synth'];
// A representative handful: default, serif, monochrome, loud display type, monospace metrics, low-contrast accent.
// --themes all (or a comma list) widens the sweep.
const SAMPLE = ['clean', 'paper', 'noir', 'punk', 'terminal', 'nord'];
const SWEEP = args.themes === 'all' ? THEMES : args.themes ? String(args.themes).split(',') : SAMPLE;
const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 } },
  laptop: { viewport: { width: 1280, height: 800 } },
  'ipad-portrait': { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true },
  'ipad-landscape': { viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true },
  phone: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  'phone-small': { viewport: { width: 320, height: 740 }, hasTouch: true, isMobile: true },
  'phone-landscape': { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true },
};
// Screenshots: a spread of colourful themes, both modes, every device class. These also feed preview.png.
const SHOTS = [
  ['desktop', 'present', 'rose', 'light'], ['desktop', 'present', 'synth', 'dark'], ['desktop', 'present', 'ocean', 'light'],
  ['desktop', 'present', 'clean', 'dark'], ['desktop', 'read', 'paper', 'light'], ['ipad-portrait', 'present', 'blueprint', 'dark'],
  ['ipad-landscape', 'present', 'sunset', 'light'], ['phone', 'read', 'paper', 'light'], ['phone', 'present', 'ai', 'dark'],
  ['phone', 'read', 'nord', 'dark'], ['phone-small', 'read', 'forest', 'light'], ['phone-landscape', 'present', 'mocha', 'dark'],
];

const failures = [], warnings = [];
const fail = (where, msg) => failures.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

// wait for late renders (fonts, KaTeX, Mermaid) so measurements are not taken mid-swap; CDN-backed, so allow up to 10s
const settle = page => page.evaluate(async () => {
  const done = () => [...document.querySelectorAll('.w-diagram')].every(d => d.classList.contains('drawn') || d.querySelector(':scope > pre'))
    && [...document.querySelectorAll('.math')].every(m => m.querySelector('.katex'));
  for (let t = 0; t < 100 && !done(); t++) await new Promise(r => setTimeout(r, 100));
  await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 3000))]);
});

async function open(browser, device, { theme, mode, view }) {
  const ctx = await browser.newContext({ ...DEVICES[device], deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && !/fonts\.g|Failed to load resource/.test(m.text()) && errors.push(m.text()));
  await page.goto(`${base}/${page_}?theme=${theme}&mode=${mode}&view=${view}#${args.slide}`);
  await page.evaluate(() => Talkdown.ready.then(() => {}));
  await page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.sheet ? null : new Promise(r => {
      l.addEventListener('load', r, { once: true }); l.addEventListener('error', r, { once: true }); setTimeout(r, 3000);
    })));
    await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 3000))]);
  });
  const found = await page.evaluate(([id, view]) => {
    const i = Deck.slides.findIndex(s => s.dataset.id === id);
    if (i < 0) return false;
    Deck.setView(view); Deck.go(i, 999);
    if (view === 'read') Deck.slides[i].closest('.frame').scrollIntoView({ block: 'start' });
    return true;
  }, [args.slide, view]);
  if (!found) throw new Error(`No slide with id: ${args.slide} in ${page_}`);
  await settle(page);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(150);
  return { ctx, page, errors };
}

// Runs in the page: fit, contrast and touch-target checks for the slide's component.
function inspect([id, selector, touch, colours = true]) {
  const slide = typeof id === 'number' ? Deck.slides[id] : Deck.slides.find(s => s.dataset.id === id);
  const box = selector ? slide.querySelector(selector) : slide.querySelector('.content');
  const res = { missing: !box, alerts: slide.querySelectorAll('.td-error, [role=alert]').length, contrast: [], targets: [] };
  if (!box) return res;
  const reading = document.documentElement.dataset.view === 'read';
  const r = box.getBoundingClientRect(), c = slide.querySelector('.content');
  res.pageScroll = document.documentElement.scrollWidth > innerWidth + 1;
  res.outside = r.left < -1 || r.right > innerWidth + 1;
  // painted boxes past the slide's content area (margins do not count); scrolling regions are fine
  if (!reading && c && getComputedStyle(c).overflowY !== 'auto') {
    const edge = c.getBoundingClientRect(), stage = slide.getBoundingClientRect();
    const bottom = Math.min(edge.bottom, stage.bottom), right = Math.min(edge.right, stage.right);
    const over = [...c.querySelectorAll('*')].find(e => {
      const b = e.getBoundingClientRect(); if (b.width <= 1 || b.height <= 1 || e.closest('.notes, [hidden], .katex-mathml')) return false;   // KaTeX's MathML is the screen-reader copy
      for (let a = e.parentElement; a && a !== c; a = a.parentElement) { const r = a.getBoundingClientRect(); if ((r.width <= 1 || r.height <= 1) && getComputedStyle(a).overflow !== 'visible') return false; }   // inside a visually hidden box (KaTeX MathML)
      const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || cs.position === 'fixed') return false;
      return b.bottom > bottom + 2 || b.right > right + 2;
    });
    if (over) res.clipped = `<${over.tagName.toLowerCase()} class="${over.getAttribute('class') || ''}"> "${over.textContent.trim().slice(0, 30)}"`;
  }
  const rgb = s => {
    let m = s.match(/rgba?\(([^)]+)\)/);
    if (m) { const v = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v[3] ?? 1]; }
    if ((m = s.match(/color\(srgb ([^)]+)\)/))) { const v = m[1].split(/[\s/]+/).filter(Boolean).map(Number); return [v[0] * 255, v[1] * 255, v[2] * 255, v[3] ?? 1]; }
    return null;
  };
  const lum = ([R, G, B]) => [R, G, B].map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }).reduce((a, x, i) => a + x * [0.2126, 0.7152, 0.0722][i], 0);
  const blend = (top, under) => top.slice(0, 3).map((x, i) => x * top[3] + under[i] * (1 - top[3]));
  // What is painted under the text: the elements at its centre below it (siblings like chart bars and SVG rects count,
  // ancestors whose box does not reach the text do not). Images, canvases, gradients and video are unknown.
  function background(el) {
    let rect = el.getBoundingClientRect();   // sample clear of sticky headers and docks
    if (rect.top < innerHeight * .15 || rect.bottom > innerHeight * .85 || rect.left < 0 || rect.right > innerWidth) { el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); rect = el.getBoundingClientRect(); }
    const x = Math.min(innerWidth - 1, Math.max(0, rect.left + rect.width / 2)), y = Math.min(innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
    const raw = document.elementsFromPoint(x, y), root = raw.filter(e => e === document.documentElement || e === document.body);
    const host = el.closest('.slide, .frame') || document.body;   // floating chrome (dock, nav buttons) is not the text's background
    const stack = [...raw.filter(e => !root.includes(e) && (host.contains(e) || e.contains(host))), ...root], at = stack.indexOf(el);   // the page background always goes last
    const below = at >= 0 ? stack.slice(at + 1) : stack.length ? stack : [...function* () { for (let e = el.parentElement; e; e = e.parentElement) yield e; }()];   // pointer-events: none text is not in the stack
    // SVG text on a shape (heatmap cell, bar): use the topmost sibling shape whose box holds the text's centre, by geometry,
    // so scrolled or clipped charts still measure right
    if (el instanceof SVGTextElement) {
      const t = el.getBBox(), cx = t.x + t.width / 2, cy = t.y + t.height / 2;
      const shape = [...el.parentNode.children].filter(e => e !== el && e instanceof SVGGeometryElement && !(e instanceof SVGLineElement) && getComputedStyle(e).fill !== 'none')
        .filter(e => { const b = e.getBBox(); return cx >= b.x && cx <= b.x + b.width && cy >= b.y && cy <= b.y + b.height; }).at(-1);
      if (shape) {
        const f = rgb(getComputedStyle(shape).fill), base = background(el.ownerSVGElement);
        if (f && !base.unknown) return { col: blend([...f.slice(0, 3), f[3] * +getComputedStyle(shape).fillOpacity], base.col) };
      }
    }
    const own = rgb(getComputedStyle(el).backgroundColor), layers = own && own[3] > 0 ? [own] : [];   // a <mark> or chip paints its own
    for (const e of own && own[3] >= 1 ? [] : below) {
      if (el.contains(e)) continue;
      const cs = getComputedStyle(e);
      if (/^(IMG|VIDEO|CANVAS|IFRAME|image)$/.test(e.tagName) || (cs.backgroundImage !== 'none')) return { unknown: true };
      const shape = e instanceof SVGGeometryElement && cs.fill !== 'none' ? rgb(cs.fill) : null;
      const bg = shape ? [...shape.slice(0, 3), shape[3] * (+cs.fillOpacity) * (+cs.opacity)] : rgb(cs.backgroundColor);
      if (bg && bg[3] > 0) { layers.push(bg); if (bg[3] >= 1) break; }
    }
    let col = [255, 255, 255];
    for (const l of layers.reverse()) col = blend(l, col);
    return { col };
  }
  const seenOpacity = new Map(), opacity = e => !e || e === document.body ? 1 : seenOpacity.get(e) ?? (seenOpacity.set(e, +getComputedStyle(e).opacity * opacity(e.parentElement)), seenOpacity.get(e));
  const walker = document.createTreeWalker(colours ? box : document.createElement('i'), NodeFilter.SHOW_TEXT);   // layout-only runs skip contrast
  const seen = new Set();
  for (let n; (n = walker.nextNode());) {
    const el = n.parentElement; if (!n.textContent.trim() || seen.has(el)) continue; seen.add(el);
    const cs = getComputedStyle(el), rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height || cs.visibility === 'hidden' || +cs.opacity === 0 || el.closest('[aria-hidden=true], .w-diagram svg')) continue;
    if (opacity(el) < 0.99) continue;   // intentionally dimmed (inactive steps); judged by eye in screenshots
    // haloed SVG text (paint-order: stroke) reads against its own outline
    const halo = el instanceof SVGElement && cs.paintOrder.startsWith('stroke') && parseFloat(cs.strokeWidth) >= 2 && rgb(cs.stroke);
    const bg = halo ? { col: halo.slice(0, 3) } : background(el); if (bg.unknown) continue;
    const fgRaw = rgb(el instanceof SVGElement ? (cs.fill !== 'none' ? cs.fill : cs.color) : cs.color); if (!fgRaw) continue;
    const fg = blend(fgRaw, bg.col);
    const [a, b] = [lum(fg), lum(bg.col)].sort((x, y) => y - x), ratio = (a + 0.05) / (b + 0.05);
    const size = parseFloat(cs.fontSize), large = size >= 24 || (size >= 18.66 && +cs.fontWeight >= 700);
    if (ratio < (large ? 3 : 4.5)) res.contrast.push(`${ratio.toFixed(2)}:1 "${n.textContent.trim().slice(0, 30)}" <${el.tagName.toLowerCase()} class="${el.className?.baseVal ?? el.className}"> ink rgb(${fg.map(Math.round)}) on rgb(${bg.col.map(Math.round)})`);
  }
  if (touch) {
    const all = [...box.querySelectorAll('button, a[href], [role=button], [role=tab], input, select, summary, [tabindex]:not([tabindex="-1"])')]
      .map(el => ({ el, b: el.getBoundingClientRect() })).filter(t => t.b.width);
    for (const { el, b } of all) {
      if (el.tagName === 'A' && el.parentElement.textContent.trim().length > el.textContent.trim().length && /^(P|LI|TD|DD|FIGCAPTION|SPAN|EM|STRONG)$/.test(el.parentElement.tagName)) continue;   // inline link: exempt
      const label = `${Math.round(b.width)}×${Math.round(b.height)} ${el.tagName.toLowerCase()} "${(el.textContent.trim() || el.getAttribute('aria-label') || '').slice(0, 20)}"`;
      if (b.width >= 44 || b.height >= 44) continue;
      // WCAG 2.5.8 spacing exception: an undersized target passes if a 24px box centred on it touches no other target
      const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      const crowded = all.some(o => o.el !== el && !o.el.contains(el) && !el.contains(o.el) && o.b.left < cx + 12 && o.b.right > cx - 12 && o.b.top < cy + 12 && o.b.bottom > cy - 12);
      const small = b.width < 24 || b.height < 24;
      res.targets.push({ hard: small && crowded, t: label + (small && !crowded ? ' (spaced)' : '') });
    }
  }
  return res;
}

async function check(browser, device, combo, shot) {
  const where = `${device} ${combo.view} ${combo.theme}/${combo.mode}`;
  const { ctx, page, errors } = await open(browser, device, combo);
  try {
    const touch = !!DEVICES[device].hasTouch;
    const r = await page.evaluate(inspect, [args.slide, args.selector || null, touch]);
    const scaled = combo.view === 'present';   // the present stage scales to fit, so small targets there are warnings
    if (r.missing) fail(where, `selector ${args.selector} not found on the slide`);
    if (r.alerts) fail(where, `${r.alerts} diagnostic(s) (.td-error / role=alert) on the slide`);
    if (r.pageScroll) fail(where, 'page scrolls horizontally');
    if (r.outside) fail(where, 'component extends past the viewport');
    if (r.clipped) fail(where, 'slide content is clipped in present view: ' + r.clipped);
    for (const c of r.contrast || []) fail(where, 'contrast ' + c);
    for (const t of r.targets || []) (t.hard && !scaled ? fail : warn)(where, 'small touch target ' + t.t);
    for (const e of errors) fail(where, 'error: ' + e);
    if (shot) await page.screenshot({ path: path.join(out, `${device}-${combo.view}-${combo.theme}-${combo.mode}.png`) });
  } finally { await ctx.close(); }
}

async function interaction(browser) {
  const { ctx, page, errors } = await open(browser, 'desktop', { theme: 'rose', mode: 'light', view: 'present' });
  try {
    const n = await page.evaluate(id => {
      const i = Deck.slides.findIndex(s => s.dataset.id === id); Deck.go(i, 0);
      let k = 0; while (Deck.cur === i && k < 200) { Deck.next(); k++; }
      Deck.go(i, 0); return k;   // steps on the slide = advances before leaving it
    }, args.slide);
    if (args.steps && +args.steps !== n) fail('steps', `expected ${args.steps} step(s), found ${n}`);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(out, 'step-first.png') });
    if (n > 1) { await page.evaluate(id => Deck.go(Deck.slides.findIndex(s => s.dataset.id === id), 999), args.slide); await page.waitForTimeout(150); await page.screenshot({ path: path.join(out, 'step-last.png') }); }
    // keyboard focus is visible on the first focusable control inside the component
    const focus = await page.evaluate(([id, sel]) => {
      const slide = Deck.slides.find(s => s.dataset.id === id);
      const box = sel ? slide?.querySelector(sel) : slide?.querySelector('.content');
      // Glossary annotations and other controls may exist in the DOM but be
      // hidden in this view. Only a visible, enabled control can receive focus.
      const el = [...(box?.querySelectorAll('button, a[href], [role=button], [role=tab], input, [tabindex]:not([tabindex="-1"])') || [])]
        .find(el => !el.matches(':disabled') && !el.closest('[inert], [hidden]') && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0);
      if (!el) return null;
      el.focus({ focusVisible: true });
      const cs = getComputedStyle(el), rect = el.getBoundingClientRect();
      const describe = node => node && ({ tag: node.tagName, classes: node.getAttribute('class'), text: node.textContent.trim().slice(0, 80), slide: node.closest('.slide')?.dataset.id });
      return {
        ok: Deck.slide === slide && document.activeElement === el && ((cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none'),
        target: describe(el), active: describe(document.activeElement), currentSlide: Deck.slide?.dataset.id,
        requestedSlide: id, disabled: el.matches(':disabled'), rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        outline: `${cs.outlineWidth} ${cs.outlineStyle} ${cs.outlineColor}`, boxShadow: cs.boxShadow,
      };
    }, [args.slide, args.selector || null]);
    if (focus && !focus.ok) fail('focus', 'control did not receive visible focus: ' + JSON.stringify(focus));
    for (const e of errors) fail('steps', 'error while stepping: ' + e);
    console.log(`steps: ${n}`);
  } finally { await ctx.close(); }
}

async function compose(browser) {
  const img = f => fs.existsSync(path.join(out, f)) ? 'data:image/png;base64,' + fs.readFileSync(path.join(out, f)).toString('base64') : '';
  const frame = (f, label, cls = '') => img(f) ? `<figure class="${cls}"><img src="${img(f)}"><figcaption>${label}</figcaption></figure>` : '';
  const name = args.name || args.slide;
  const html = `<!doctype html><meta charset=utf-8><style>
    body{margin:0;padding:48px;background:#0f1115;color:#e8e8ea;font:15px/1.4 Inter,system-ui,sans-serif;width:1900px}
    h1{font-size:30px;margin:0 0 6px;font-weight:650} p{margin:0 0 28px;color:#9a9aa2}
    .row{display:flex;gap:24px;align-items:flex-start;margin-bottom:28px}
    figure{margin:0;flex:1} img{width:100%;display:block;border-radius:14px;box-shadow:0 0 0 1px #2a2b30,0 12px 32px #0008}
    figure.phone{flex:0 0 220px} figure.tablet{flex:0 0 330px} figure.wide-phone{flex:0 0 470px}
    figcaption{margin-top:10px;color:#9a9aa2;font-size:13px}</style>
    <h1>${name}</h1><p>talkdown component preview: desktop, iPad and phone; present and read views; light and dark themes</p>
    <div class=row>${frame('desktop-present-rose-light.png', 'Desktop · present · rose light')}${frame('desktop-present-synth-dark.png', 'Desktop · present · synth dark')}${frame('desktop-present-ocean-light.png', 'Desktop · present · ocean light')}</div>
    <div class=row>${frame('step-first.png', 'First step')}${frame('step-last.png', 'Last step')}${frame('desktop-read-paper-light.png', 'Desktop · article · paper light')}</div>
    <div class=row>${frame('ipad-portrait-present-blueprint-dark.png', 'iPad · present · blueprint dark', 'tablet')}${frame('phone-read-paper-light.png', 'Phone · article · paper light', 'phone')}${frame('phone-present-ai-dark.png', 'Phone · present · ai dark', 'phone')}${frame('phone-read-nord-dark.png', 'Phone · article · nord dark', 'phone')}${frame('phone-small-read-forest-light.png', '320px · article · forest light', 'phone')}</div>`;
  const page = await browser.newPage({ viewport: { width: 1996, height: 800 }, deviceScaleFactor: 1 });
  await page.setContent(html); await page.waitForLoadState('load');
  await page.screenshot({ path: path.join(out, 'preview.png'), fullPage: true });
  await page.close();
}

async function audit(browser, page_) {
  // colours do not depend on the viewport: the theme sweep once on the stage, contrast once in the article (phone read), layout everywhere
  const runs = [['desktop', 'present', true], ['phone', 'read', false, true],
    ['laptop', 'present'], ['ipad-portrait', 'present'], ['ipad-portrait', 'read'],
    ['ipad-landscape', 'present'], ['phone', 'present'], ['phone-small', 'read'], ['phone-landscape', 'present'], ['phone-landscape', 'read']];
  // the all-themes sweep is split into chunks so it runs across several contexts at once
  const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
  const tasks = runs.flatMap(([device, view, allThemes, colours = allThemes]) => (allThemes ? chunk(SWEEP.flatMap(t => [[t, 'light'], [t, 'dark']]), 2) : [[['clean', 'light'], ['paper', 'dark']]]).map(themes => [device, view, themes, colours]));
  return tasks.map(([device, view, themes, colours]) => async () => {
    const ctx = await browser.newContext({ ...DEVICES[device], reducedMotion: 'reduce' });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/${page_}?view=${view}`);
    await page.evaluate(() => Talkdown.ready.then(() => {}));
    await page.evaluate(`window.__inspect = ${inspect}`);
    await settle(page);
    for (const [theme, mode] of themes) {   // [theme, mode] pairs; layout-only runs need just one of each
      // switch in place: the runtime fetches the theme's fonts; wait for their stylesheet and faces before measuring
      await page.evaluate(async ([t, m]) => {
        Object.assign(document.documentElement.dataset, { theme: t, mode: m });
        await Promise.all([...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.sheet ? null : new Promise(r => {
          l.addEventListener('load', r, { once: true }); l.addEventListener('error', r, { once: true }); setTimeout(r, 3000);
        })));
        await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 3000))]);
      }, [theme, mode]);
      // every slide in one round trip
      const results = await page.evaluate(async ([view, touch, colours]) => {
        const out = [], frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));   // let fit-to-stage settle
        for (let i = 0; i < Deck.slides.length; i++) {
          Deck.go(i, 999);
          if (view === 'read') Deck.slides[i].closest('.frame')?.scrollIntoView({ block: 'start' });
          await frame();
          out.push({ name: Deck.slides[i].dataset.name || 'slide ' + (i + 1), ...window.__inspect([i, null, touch, colours]) });
        }
        return out;
      }, [view, !!DEVICES[device].hasTouch, colours]);
      results.forEach((r, i) => {
        const where = `${page_} ${device} ${view} ${theme}/${mode} #${i + 1} "${r.name}"`;
        if (r.alerts) fail(where, `${r.alerts} diagnostic(s)`);
        if (r.pageScroll) fail(where, 'page scrolls horizontally');
        if (r.outside) fail(where, 'content extends past the viewport');
        if (r.clipped) fail(where, 'slide content is clipped in present view: ' + r.clipped);
        for (const c of r.contrast) fail(where, 'contrast ' + c);
        for (const t of r.targets) (t.hard && view === 'read' ? fail : warn)(where, 'small touch target ' + t.t);
      });
    }
    for (const e of errors) fail(`${page_} ${device} ${view}`, 'error: ' + e);
    await ctx.close();
  });
}
// run tasks a few at a time (one browser, several contexts)
async function pool(tasks, n = +args.jobs || Math.max(4, require('node:os').availableParallelism() - 2)) {   // --jobs n overrides
  const queue = [...tasks];
  await Promise.all(Array.from({ length: n }, async () => { while (queue.length) await queue.shift()(); }));
}

let base;
(async () => {
  const server = createStaticServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port;
  const launch = { channel: 'chrome', args: ['--proxy-bypass-list=<-loopback>'] };   // the installed Chrome (preinstalled on GitHub runners)
  const browser = await chromium.launch(launch);
  try {
    if (args.all) await pool((await Promise.all(pages.map(p => audit(browser, p)))).flat());
    else {
      // Contrast and fit across the sampled themes in both modes, on desktop present and phone read.
      // Every check opens its own context, so they run side by side.
      const checks = [];
      for (const theme of SWEEP) for (const mode of ['light', 'dark']) {
        checks.push(() => check(browser, 'desktop', { theme, mode, view: 'present' }), () => check(browser, 'phone', { theme, mode, view: 'read' }));
      }
      // Every device class and view, with screenshots for the preview.
      for (const [device, view, theme, mode] of SHOTS) checks.push(() => check(browser, device, { theme, mode, view }, true));
      for (const device of Object.keys(DEVICES)) for (const view of ['present', 'read']) checks.push(() => check(browser, device, { theme: 'clean', mode: 'light', view }));
      await pool([...checks, () => interaction(browser)]);
      await compose(browser);
    }
  } finally { await browser.close(); server.close(); }
  const uniq = a => [...new Set(a)];
  for (const w of uniq(warnings)) console.log('warn  ' + w);
  for (const f of uniq(failures)) console.log('FAIL  ' + f);
  console.log(`\n${pages.join(', ')}: ${uniq(failures).length} failure(s), ${uniq(warnings).length} warning(s).` + (args.all ? '' : ` Screenshots and preview.png in ${path.relative(root, out)}/`));
  process.exitCode = failures.length ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 2; });
