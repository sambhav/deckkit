// Run with `node tests/browser.cjs` after installing Playwright and its Chromium.
// Exported so the same checks can also run in a connected Playwright browser.
const verifyLatest = require('./latest.cjs');
const verifyVisualCharts = require('./visual-charts.cjs');
async function verify(page, base) {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [];
  page.on('pageerror', e => errors.push(e.stack || e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/?view=present');
  // A native HTML slide exists before the asynchronous runtime assembles the
  // Markdown deck. Wait for the loader's readiness contract, not that raw node.
  await page.evaluate(() => Talkdown.ready.then(() => {}));
  await page.evaluate(async () => {
    // The loader inserts stylesheets asynchronously; fonts.ready alone can
    // resolve before the optional Google Fonts stylesheet has arrived.
    await Promise.all([...document.querySelectorAll('link[rel=stylesheet]')].map(link => link.sheet ? null : new Promise(resolve => {
      link.addEventListener('load', resolve, { once: true }); link.addEventListener('error', resolve, { once: true });
      setTimeout(resolve, 3000);
    })));
    await document.fonts.ready;
  });
  const count = await page.evaluate(() => Deck.slides.length);
  const desktopOverflow = await page.evaluate(() => Deck.slides.flatMap((s, i) => {
    Deck.go(i, 999);
    const c = s.querySelector('.content');
    return c.scrollHeight > c.clientHeight + 2 || c.scrollWidth > c.clientWidth + 2 ? [s.dataset.name] : [];
  }));
  check(!desktopOverflow.length, 'Desktop clipping: ' + desktopOverflow.join(', '));
  const sizes = [[320, 740], [390, 844], [768, 1024]];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => new Promise(requestAnimationFrame));
    const clipped = await page.evaluate(() => Deck.slides.flatMap((s, i) => {
      Deck.go(i, 999);
      const c = s.querySelector('.content');
      return c.scrollHeight > c.clientHeight + 2 && getComputedStyle(c).overflowY !== 'auto' ? [s.dataset.name] : [];
    }));
    check(!clipped.length, width + 'px phone/tablet clipping: ' + clipped.join(', '));
  }
  await verifyMobileNavigation(page, base);
  await verifyNativeScrolling(page, base);
  const fixture = [
    '## Syntax fixtures', '', '<!-- Notes with `inline code`', '---', 'still notes -->', '',
    'Real footnote[^real]', '', '[^real]: A `code` footnote.', '',
    '````md', '```', '<!-- not notes -->', '[^demo]: keep in code', '---', '|||', ':::', '````', '',
    '::: tabs', '### Outer one', '::: tabs', '### Inner one', 'First', '### Inner two', 'Second', ':::',
    '### Outer two', 'Outer second', ':::', '',
    '```terminal', '```', '',
    '```js {steps: 1-9999999999 | invalid | 4-2}', 'hello', '```', '',
    '::: flip', '### Front', 'Back', ':::', '',
    '---', '## End',
  ].join('\n');
  await page.route('**/regression.html*', r => r.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html data-fonts="off" data-highlight="off" data-diagrams="off" data-icons="off"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + fixture + '</script></body></html>' }));
  await page.goto(base + '/regression.html?view=present');
  await page.waitForFunction(() => window.Deck?.slides.length === 2);
  check((await page.locator('pre code').first().textContent()).includes('[^demo]: keep in code'), 'Footnote definitions in fenced code must survive');
  check(!(await page.locator('.notes').first().textContent()).includes('not notes'), 'Code comments must not become notes');
  check((await page.locator('.notes').first().textContent()).includes('inline code'), 'Inline code inside notes must survive extraction');
  check(await page.locator('.footnotes code').textContent() === 'code', 'Inline code in actual footnotes must stay within the footnote');
  check(await page.locator('.w-tabs > .w-list > button').count() === 4, 'Nested tabs must keep their own controls');
  await page.locator('.w-tabs .w-tabs > .w-list > button').nth(1).click();
  check(await page.locator('.content > .w-tabs > .w-list > button.on').textContent() === 'Outer one', 'An inner tab must not change its outer tab');
  await page.locator('.w-tabs .w-tabs > .w-list > button').nth(1).focus();
  await page.keyboard.press('ArrowLeft');
  check(await page.locator('.w-tabs .w-tabs > .w-list > button.on').textContent() === 'Inner one', 'Arrow keys must select tabs without navigating the deck');
  check(await page.evaluate(() => Deck.cur) === 0, 'Tab keyboard navigation must stay on the slide');
  await page.locator('.w-flip').focus();
  await page.keyboard.press('Enter');
  check(await page.locator('.w-flip').getAttribute('aria-pressed') === 'true', 'Flip card must activate from keyboard');
  await page.keyboard.press('Space');
  check(await page.locator('.w-flip').getAttribute('aria-pressed') === 'false', 'Space must flip back without advancing slides');
  const csv = ['Label,Before,After', '"A, B",10,5', '"two', 'lines",20,10'].join('\n');
  const charts = [
    '## CSV', '::: chart type=line view=both title="Latency & time"', '```csv', csv, '```', ':::',
    '::: notes', 'Shared **notes**.', ':::', '::: say', 'Only spoken.', ':::', '::: read', 'Only read.', ':::',
    '---', '## Table', '::: chart type=line view=both', '| Label | Before | After |', '|---|---|---|', '| A, B | 10 | 5 |', '| two lines | 20 | 10 |', ':::',
    '---', '## Signed', '::: chart type=bar', '```csv', 'Label,Value', 'Low,-10', 'High,20', '```', ':::',
    '---', '## Donut', '::: chart type=donut series=After', '```csv', csv, '```', ':::',
    '---', '## Invalid', '::: chart type=line', '```csv', 'Label,Value', 'Bad,25%', '```', ':::',
    '---', '## Quotes', '::: chart type=line', '```csv', 'Label,Value', '"unclosed,10', '```', ':::',
  ].join('\n');
  const native = '<section class="slide flow"><div class="content"><h2>Native HTML</h2><figure data-chart="line" data-chart-view="both"><figcaption>Native data</figcaption><table><thead><tr><th>Label</th><th>Value</th></tr></thead><tbody><tr><th>A</th><td>1</td></tr><tr><th>B</th><td>2</td></tr></tbody></table></figure></div></section>';
  await page.route('**/charts.html*', r => r.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html data-fonts="off" data-highlight="off"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + charts + '</script>' + native + '</body></html>' }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/charts.html?view=present');
  await page.waitForFunction(() => window.Deck?.slides.length === 7);
  const first = page.locator('.w-chart-box').first();
  check(await first.locator('tbody tr').count() === 2, 'CSV data must render a real table');
  check(await first.locator('tbody tr').first().locator('th').textContent() === 'A, B', 'Quoted CSV commas must survive');
  check(await first.locator('tbody tr').nth(1).locator('th').textContent() === 'two\nlines', 'Quoted CSV newlines must survive');
  check(await first.locator('figcaption').textContent() === 'Latency & time', 'Quoted options must be decoded once');
  check(await first.locator('.w-chart').isVisible() && await first.locator('.w-chart-table').isVisible(), 'Both view must show plot and table');
  const compare = await page.evaluate(() => [...document.querySelectorAll('.w-chart-box')].slice(0,2).map(b => [...b.querySelectorAll('polyline')].map(p => p.getAttribute('points'))));
  check(JSON.stringify(compare[0]) === JSON.stringify(compare[1]), 'CSV and Markdown tables must produce identical plots');
  await first.locator('select').selectOption('table');
  check(!(await first.locator('.w-chart').isVisible()) && await first.locator('.w-chart-table').isVisible(), 'Table-only view must switch without navigation');
  await first.locator('select').selectOption('chart');
  check(await first.locator('.w-chart').isVisible() && !(await first.locator('.w-chart-table').isVisible()), 'Chart-only view must switch without navigation');
  await page.evaluate(() => {
    window.__downloadCSV = '';
    const create = URL.createObjectURL;
    URL.createObjectURL = blob => { blob.text().then(text => window.__downloadCSV = text); return create(blob); };
  });
  const download = page.waitForEvent('download');
  await first.locator('.w-csv-download').click();
  check(/^[a-z0-9-]+\.csv$/.test((await download).suggestedFilename()), 'CSV download must be a local file named from the chart title');
  await page.waitForFunction(() => window.__downloadCSV.includes('"A, B"'));
  check((await page.locator('.slide').first().locator('aside.notes').textContent()).includes('Only spoken.'), 'Explicit say notes must reach the presenter');
  check(!(await page.locator('.slide').first().locator('aside.notes').textContent()).includes('Only read.'), 'Read notes must stay out of presenter notes');
  check((await page.locator('.frame > .prose').first().textContent()).includes('Only read.'), 'Explicit read notes must reach article prose');
  check(await page.locator('.slide').nth(4).locator('[role=alert]').count() === 1, 'Invalid numeric cells need a visible diagnostic');
  check(await page.locator('.slide').nth(5).locator('pre').textContent() === 'Label,Value\n"unclosed,10', 'Malformed CSV source must remain inspectable');
  await page.evaluate(() => Deck.go(2));
  check(await page.locator('.slide.active .w-zero').count() === 1, 'Signed chart needs a zero baseline');
  check(await page.evaluate(() => [...document.querySelectorAll('.slide.active .w-b')].every(e => e.style.getPropertyValue('--v').startsWith('33.33') || e.style.getPropertyValue('--v').startsWith('66.67'))), 'Signed bars must use magnitudes on a shared scale');
  await page.evaluate(() => Deck.go(6));
  check(await page.locator('.slide.active .w-chart').count() === 1, 'Native HTML charts must mount too');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { Deck.setView('read'); Deck.go(0); });
  check(await first.locator('.w-chart').isVisible(), 'Explicit chart-only choice must survive read mode');
  await first.locator('select').selectOption('auto');
  check(await first.locator('.w-chart-table').isVisible(), 'Auto view must expose data in the article');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Chart data must not widen the phone page');
  // Exercise multiple asynchronous references.
  for (const assets of ['']) {
    const source = '## External\n\n```html\n<script>hello</script>\n```';
    await page.route('**/first.md', r => r.fulfill({ contentType: 'text/plain', body: source }));
    await page.route('**/second.md', r => r.fulfill({ contentType: 'text/plain', body: '## Second external' }));
    await page.route('**/missing.md', r => r.fulfill({ status: 404, body: 'missing' }));
    await page.route('**/references.html*', r => r.fulfill({ contentType: 'text/html', body:
      '<!doctype html><html data-fonts="off" data-highlight="off"><head><link rel="stylesheet" href="' + assets + 'deck.css"><script src="' + assets + 'deck.js"></script></head><body><script type="text/markdown">## Inline</script><script type="text/markdown" data-src="first.md"></script><section class="slide flow"><div class="content"><h2>Native</h2></div></section><script type="text/markdown" data-src="second.md"></script><script type="text/markdown" data-src="missing.md"></script></body></html>' }));
    await page.goto(base + '/references.html?view=read');
    await page.waitForFunction(() => window.Deck?.slides.length === 4);
    check(await page.evaluate(() => Deck.slides.map(s => s.dataset.name || s.querySelector('h2').textContent).join('|')) === 'Inline|External|Native|Second external', 'Reference loading must preserve slide order');
    check(await page.locator('#stage pre code').textContent() === '<script>hello</script>', 'Referenced Markdown must preserve literal closing script tags');
    check(await page.locator('.td-load-error').count() === 1, 'Failed references must be diagnosed without breaking other slides');
    check(await page.locator('#stage').evaluate(e => getComputedStyle(e).position) === 'static', 'Both asset URLs must load the stylesheet');
  }
  await page.route('**/empty-reference.html*', r => r.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html data-fonts="off"><head><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown" data-src="missing.md"></script></body></html>' }));
  await page.goto(base + '/empty-reference.html');
  await page.waitForFunction(() => window.Deck && document.querySelector('.td-load-error'));
  check(await page.locator('.td-load-error').isVisible(), 'A failed standalone reference needs a visible error');
  const visualCharts = await verifyVisualCharts(page, base);
  const latest = await verifyLatest(page, base);
  check(!errors.length, 'Browser errors: ' + errors.join(', '));
  return { slides: count, widths: sizes.map(s => s[0]), visualCharts, latest, errors };
}
async function verifyMobileNavigation(page, base) {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const control = async id => {
    if (!(await page.locator('#dPanel').isVisible())) await page.locator('#dToggle').click();
    await page.locator('#' + id).click();
  };
  const gesture = async (target, points) => page.locator(target).evaluate((el, points) => {
    for (let i = 0; i < points.length; i++) {
      const type = i === 0 ? 'touchstart' : i === points.length - 1 ? 'touchend' : 'touchmove';
      const touch = { clientX: points[i][0], clientY: points[i][1] };
      const event = new Event(type, { bubbles: true });
      Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : [touch] });
      Object.defineProperty(event, 'changedTouches', { value: [touch] });
      el.dispatchEvent(event);
    }
  }, points);
  const notes = 'This is the explanation that accompanies the walkthrough. '.repeat(45);
  const source = [
    'layout: title', 'id: opening', 'section: Opening', '---', '# Opening',
    '---', 'id: process', 'section: Process', '---', '## Process',
    '::: steps', '### First', 'Start here.', '### Second', 'Continue here.', '### Third', 'Finish here.', ':::',
    '```text', 'A wide code sample that can be scrolled without changing slides.', '```',
    '::: notes', notes, ':::',
    '---', 'id: stage', 'read: hide', '---', '## Stage only',
    '---', 'id: background', 'present: hide', '---', '## Background',
    'Article-only detail.',
    '---', 'id: finish', 'section: Finish', '---', '## Finish',
  ].join('\n');
  await page.route('**/mobile-navigation.html*', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html data-fonts="off" data-highlight="off"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + source + '</script></body></html>' }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/mobile-navigation.html');
  await page.waitForFunction(() => window.Deck?.slides.length === 5);
  check(await page.locator('html').getAttribute('data-view') === 'present', 'Phones should open as slides');
  check(await page.locator('#dock').isVisible(), 'Mobile controls must be reachable in slides');
  check(!(await page.locator('#dPanel').isVisible()), 'Mobile navigation must start collapsed');
  check(await page.locator('#dock').evaluate(el => el.offsetHeight <= 56 && el.offsetWidth <= 168), 'The floating arrows and menu must stay compact');
  const before = await page.locator('#stage').boundingBox();
  await page.locator('#dToggle').click();
  check(await page.locator('#dPanel').isVisible(), 'The floating button must reveal the full controls');
  const after = await page.locator('#stage').boundingBox();
  check(before.y === after.y && before.height === after.height, 'Opening controls must not move or resize the slide');
  await page.keyboard.press('Escape');
  check(!(await page.locator('#dPanel').isVisible()), 'Escape must collapse the controls');
  await page.evaluate(() => Deck.go(1, 1));
  await control('dNotes');
  check(await page.locator('#mNotes').evaluate(el => el.clientHeight > 70), 'Long phone slides must leave room for speaker notes');
  await control('dNotes');
  for (let i = 0; i < 3; i++) {
    await control('dRead');
    check(await page.locator('#dock').isVisible(), 'Article controls must remain visible');
    await control('dSlides');
    check(await page.evaluate(() => Deck.cur) === 1, 'Switching views must keep the visible section');
    check(await page.locator('.slide.active').count() === 1, 'Returning to slides must leave exactly one active slide');
    check(await page.locator('.slide.active .w-steps .w-pane.on h3').textContent() === 'Second', 'Article expansion must not overwrite the presenter step');
    check(await page.evaluate(() => scrollY) === 0, 'Article scroll offset must not displace the slide stage');
  }
  await control('dRead');
  await control('dSections');
  check(await page.locator('#mobileNav').isVisible(), 'Section picker must open as a dialog');
  await page.locator('#navSlides').click();
  check(!(await page.locator('#mobileNavList').textContent()).includes('Stage only'), 'Article navigation must omit presentation-only slides');
  await page.locator('#mobileNavList button').filter({ hasText: 'Background' }).click();
  check(await page.evaluate(() => Deck.cur) === 3, 'Slide picker must jump within the article');
  await control('dSlides');
  check(await page.evaluate(() => Deck.cur) === 4, 'Article-only content must switch to the next presentable slide');
  check(await page.locator('.slide.active').count() === 1, 'Changing sections in the article must clear the old active slide');
  await control('dSections');
  await page.locator('#navSlides').click();
  check(!(await page.locator('#mobileNavList').textContent()).includes('Background'), 'Slide navigation must omit article-only content');
  await page.keyboard.press('Escape');
  check(!(await page.locator('#mobileNav').isVisible()), 'Native Escape must dismiss the picker');
  await control('dRead');
  await page.evaluate(() => { Deck.go(0); Deck.go(2); });
  check(await page.evaluate(() => Deck.cur) === 3, 'Read navigation must skip hidden article frames');
  await page.locator('#dForward').click();
  check(await page.evaluate(() => Deck.cur) === 4, 'Article next must advance a slide, not a hidden widget step');
  await control('dHome');
  check(await page.evaluate(() => scrollY === 0 && Deck.cur === 0), 'Home must return to the top of the article');
  for (const [width, height] of [[320, 740], [844, 390], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => new Promise(requestAnimationFrame));
    check(await page.locator('html').getAttribute('data-view') === 'read', 'Rotation must preserve the chosen view');
    check(await page.locator('#dock').evaluate(el => {
      const box = el.getBoundingClientRect();
      return box.left >= 0 && box.right <= innerWidth + 1 && box.bottom <= innerHeight;
    }), 'The dock must fit the phone viewport');
  }
  await control('dSlides');
  await control('dRead');
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await page.waitForFunction(() => Deck.cur === 4);
  await control('dSlides');
  check(await page.evaluate(() => Deck.cur) === 4 && await page.locator('.slide.active').count() === 1, 'Switching after scrolling to the article end must present its last visible section');
  await page.evaluate(() => Deck.go(1));
  await page.locator('.slide.active pre').evaluate(el => {
    for (const [type, x] of [['touchstart', 220], ['touchend', 40]]) {
      const event = new Event(type, { bubbles: true });
      const touch = { clientX: x, clientY: 100 };
      Object.defineProperty(event, 'touches', { value: [touch] });
      Object.defineProperty(event, 'changedTouches', { value: [touch] });
      el.dispatchEvent(event);
    }
  });
  check(await page.evaluate(() => Deck.cur) === 1, 'Scrolling a code block must not swipe to another slide');
  await page.evaluate(() => Deck.go(1, 0));
  const activeStep = () => page.locator('.slide.active .w-steps .w-pane.on h3').textContent();
  for (const id of ['dBack', 'dForward', 'dToggle']) {
    check(await page.locator('#' + id).isVisible(), 'Previous, next and menu must stay visible without opening a panel');
    check(await page.locator('#' + id).evaluate(el => el.offsetWidth >= 48 && el.offsetHeight >= 48), 'Primary touch targets must be at least 48 CSS pixels');
  }
  await page.locator('#dForward').click();
  check(await page.evaluate(() => Deck.cur) === 1 && await activeStep() === 'Second', 'The floating next button must advance the current widget step');
  await page.locator('#dBack').click();
  check(await page.evaluate(() => Deck.cur) === 1 && await activeStep() === 'First', 'The floating previous button must reverse the current widget step');
  await page.locator('.slide.active .w-next').click();
  check(await activeStep() === 'Second', 'The walkthrough must advance from its own control');
  await page.locator('#dForward').click();
  check(await activeStep() === 'Third', 'Floating arrows must continue through widget steps');
  await page.locator('#dForward').click();
  check(await page.evaluate(() => Deck.cur) === 2, 'After the final step the floating next arrow must advance the slide');
  check(await page.locator('.local-steps').count() === 0, 'No inline code or terminal navigation bars should be injected');
  await page.evaluate(() => Deck.go(1, 0));
  await gesture('.slide.active .content', [[250, 300], [140, 302], [60, 301]]);
  await gesture('.slide.active .content', [[362, 300], [362, 300]]);
  check(await activeStep() === 'First', 'Swiping and tapping content must not trigger deck navigation');
  check(await page.locator('body').evaluate(el => getComputedStyle(el).touchAction === 'auto'), 'Native browser gestures must remain enabled');
  await control('dRead');
  await page.locator('#dToggle').click();
  await page.evaluate(() => window.scrollBy({ top: 80, behavior: 'instant' }));
  await page.evaluate(() => new Promise(requestAnimationFrame));
  check(await page.locator('#dPanel').isVisible(), 'Residual scrolling must not dismiss newly opened controls');
  await page.mouse.move(80, 180);
  await page.mouse.wheel(0, 80);
  await page.waitForFunction(() => document.getElementById('dPanel').hidden);
  await page.goto(base + '/mobile-navigation.html?view=read#process');
  await page.waitForFunction(() => window.Deck?.slides.length === 5);
  check(await page.locator('html').getAttribute('data-view') === 'read' && await page.evaluate(() => Deck.cur) === 1, 'Explicit article links must preserve their section');
}
async function verifyNativeScrolling(page, base) {
  const body = ['## Long slide', '', ...Array.from({ length: 35 }, (_, i) => 'Paragraph ' + i + ': native scrolling must work without changing slides.\n'), '```text', 'Wide code '.repeat(90), '```'].join('\n');
  await page.route('**/native-scrolling.html*', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html data-fonts="off" data-highlight="off"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + body + '</script></body></html>' }));
  await page.setViewportSize({ width: 390, height: 844 });
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    const drag = async (x1, y1, x2, y2) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1 }] });
      for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x1 + (x2 - x1) * i / 8, y: y1 + (y2 - y1) * i / 8 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await page.goto(base + '/native-scrolling.html?view=read');
    await page.waitForFunction(() => window.Deck?.slides.length === 1);
    await drag(170, 650, 170, 210);
    await page.waitForFunction(() => scrollY > 50);
    await page.locator('#dToggle').click();
    await page.locator('#dSlides').click();
    await drag(170, 650, 170, 210);
    await page.waitForFunction(() => Deck.slide.querySelector('.content').scrollTop > 50);
    const pre = page.locator('.slide.active pre');
    await pre.scrollIntoViewIfNeeded();
    const box = await pre.boundingBox();
    await drag(300, box.y + box.height / 2, 80, box.y + box.height / 2);
    await page.waitForFunction(() => document.querySelector('.slide.active pre').scrollLeft > 20);
    if (await page.evaluate(() => Deck.cur) !== 0) throw new Error('Native scrolling must not change slides');
  } finally {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await cdp.detach();
  }
}
module.exports = verify;
if (require.main === module) {
  (async () => {
    const { chromium } = require('playwright');
    const browser = await chromium.launch();
    try { console.log(await verify(await browser.newPage(), process.env.TALKDOWN_URL || 'http://127.0.0.1:8000')); }
    finally { await browser.close(); }
  })().catch(error => { console.error(error); process.exitCode = 1; });
}

