// The fixture loads the built runtime directly, with UTF-8 text and no loader readiness dependency.
module.exports = async function verifyEnvdiff(page, base) {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const source = ['id: comparison', '---', '## Environment configuration', '::: envdiff',
    '| Key | dev | prod |', '|---|---|---|', '| `POOL` | **5** | [200](#next) |',
    '| SAME | 東京 | 東京 |', '| EMPTY | | enabled |', ':::', '---', 'id: next', '---', '## Next',
    '::: envdiff', '| Key | development | staging | production-eu | production-us |', '|---|---|---|---|---|',
    '| `CONNECTION_POOL_MAXIMUM_SIZE` | 5 | 20 | 200 | 200 |', ':::',
    '---', '## Bad input', '::: envdiff', 'Still readable.', ':::'].join('\n');
  await page.route('**/envdiff.html*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body:
    '<!doctype html><html data-fonts="off" data-highlight="off"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + source + '</script></body></html>' }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/envdiff.html?view=present');
  await page.waitForFunction(() => window.Deck?.slides.length === 3);
  const comparison = page.locator('#stage .slide[data-id="comparison"] .w-envdiff');
  const table = comparison.locator('table'), toggle = comparison.locator('.w-envdiff-tools button');
  check(await table.locator('.envdiff-changed').count() === 4, 'Every environment cell in a differing row must be marked');
  check(await table.locator('strong').textContent() === '5' && await table.locator('a').textContent() === '200', 'Inline formatting and links must survive');
  check(await table.locator('th[scope=row] code').textContent() === 'POOL', 'Key formatting must survive row-header conversion');
  check(await table.locator('tr.envdiff-same').isVisible(), 'All rows start visible');
  await page.keyboard.press('ArrowDown');
  check(await toggle.getAttribute('aria-pressed') === 'true' && !(await table.locator('.envdiff-same').isVisible()), 'The presentation step must hide identical rows');
  await toggle.focus();
  await page.keyboard.press('Space');
  check(await page.evaluate(() => Deck.cur) === 0 && await toggle.getAttribute('aria-pressed') === 'false', 'Native Space must toggle without navigating away');
  check(await toggle.evaluate(el => el === document.activeElement), 'Space must retain focus on the environment toggle');
  await toggle.focus(); await page.keyboard.press('Enter');
  check(await page.evaluate(() => Deck.cur) === 0 && await toggle.getAttribute('aria-pressed') === 'true', 'Native Enter must toggle without navigating away');
  check(await toggle.evaluate(el => el === document.activeElement), 'Enter must retain focus on the environment toggle');
  await page.locator('#srcBtn').click();
  check((await page.locator('#src code').textContent()).includes('::: envdiff\n| Key'), 'S/source must retain authored Markdown');
  await page.keyboard.press('Escape');
  await page.evaluate(() => Deck.setView('read'));
  const compact = comparison.locator('.w-envdiff-scroll');
  const wide = page.locator('#stage .slide[data-id="next"] .w-envdiff-scroll');
  const geometry = () => wide.evaluate(el => {
    const table = el.querySelector('table'), cell = table.querySelector('tbody th'), ts = getComputedStyle(table), cs = getComputedStyle(cell);
    const bounds = node => { const { x, y, width, height } = node.getBoundingClientRect(); return { x, y, width, height, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth }; };
    return { view: document.documentElement.dataset.view, viewport: innerWidth, pageWidth: document.documentElement.scrollWidth,
      slide: el.closest('.slide').dataset.id, visible: !!el.getClientRects().length && getComputedStyle(el).visibility === 'visible',
      viewportBounds: bounds(el), tableBounds: bounds(table), cellBounds: bounds(cell),
      tableDisplay: ts.display, tableLayout: ts.tableLayout, tableMinWidth: ts.minWidth, tableOverflowX: ts.overflowX,
      cellMinWidth: cs.minWidth, cellWhiteSpace: cs.whiteSpace, cellOverflowWrap: cs.overflowWrap, cellText: cell.textContent };
  });
  check(await compact.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'A compact table must fit the desktop article');
  check(await wide.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'A wide table must fit when the article has enough space');
  await page.setViewportSize({ width: 320, height: 740 });
  check(await table.locator('.envdiff-same').isVisible() && !(await toggle.isVisible()), 'Article view must always show the complete table');
  check(await table.locator('.envdiff-same').textContent().then(t => t.includes('東京')), 'Fixture must preserve UTF-8');
  check(await compact.evaluate(el => el.getBoundingClientRect().width <= innerWidth), 'Compact tables must stay within the phone page');
  const phone = await geometry();
  check(phone.view === 'read' && phone.slide === 'next' && phone.visible && phone.viewportBounds.width > 0, 'Measure the visible source table in article view: ' + JSON.stringify(phone));
  check(phone.tableDisplay === 'table' && phone.cellWhiteSpace === 'nowrap', 'Environment cells must retain readable table layout: ' + JSON.stringify(phone));
  check(phone.viewportBounds.scrollWidth > phone.viewportBounds.clientWidth, 'A genuinely wide environment table must scroll locally on a phone: ' + JSON.stringify(phone));
  check(await wide.evaluate(el => { el.scrollLeft = el.scrollWidth; return el.scrollLeft > 0; }), 'The local environment viewport must allow horizontal scrolling: ' + JSON.stringify(phone));
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'A wide table must not overflow the phone page: ' + JSON.stringify(phone));
  check(await page.locator('.td-error[role=alert]').textContent().then(t => t.includes('envdiff')), 'Malformed content needs a visible diagnostic');
  check(await page.locator('.slide').last().textContent().then(t => t.includes('Still readable.')), 'Malformed content must retain the Markdown fallback');
  return { source: true, steps: 2, keyboard: true, utf8: true, phone: true, fallback: true };
};
