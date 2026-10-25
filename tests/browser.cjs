// Run with `node tests/browser.cjs` after installing Playwright and its Chromium.
// Exported so the same checks can also run in a connected Playwright browser.
async function verify(page, base) {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/?view=present');
  await page.waitForFunction(() => window.Deck?.slides.length);
  await page.evaluate(() => document.fonts.ready);
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
  await page.goto(base + '/examples/external.html?view=read');
  await page.waitForFunction(() => window.Deck?.slides.length === 2);
  check(await page.locator('#stage pre code').textContent() === "<script>console.log('hello');</script>", 'External Markdown must preserve literal script tags');

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
  await page.route('**/regression.md', r => r.fulfill({ body: fixture, contentType: 'text/plain' }));
  await page.route('**/regression.html*', r => r.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html data-fonts="off" data-highlight="off" data-diagrams="off" data-icons="off"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown" data-src="regression.md"></script></body></html>' }));
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
  check(!errors.length, 'Browser errors: ' + errors.join(', '));
  return { slides: count, widths: sizes.map(s => s[0]), errors };
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
