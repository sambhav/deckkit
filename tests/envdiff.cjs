// The fixture loads the built runtime directly, with UTF-8 text and no loader readiness dependency.
module.exports = async function verifyEnvdiff(page, base) {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const source = ['id: comparison', '---', '## Environment configuration', '::: envdiff',
    '| Key | dev | prod |', '|---|---|---|', '| `POOL` | **5** | [200](#next) |',
    '| SAME | 東京 | 東京 |', '| EMPTY | | enabled |', ':::', '---', 'id: next', '---', '## Next',
    '---', '## Bad input', '::: envdiff', 'Still readable.', ':::'].join('\n');
  await page.route('**/envdiff.html*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body:
    '<!doctype html><html data-fonts="off" data-highlight="off"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + source + '</script></body></html>' }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/envdiff.html?view=present');
  await page.waitForFunction(() => window.Deck?.slides.length === 3);
  const table = page.locator('.w-envdiff table'), toggle = page.locator('.w-envdiff-tools button');
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
  await page.setViewportSize({ width: 320, height: 740 });
  check(await table.locator('.envdiff-same').isVisible() && !(await toggle.isVisible()), 'Article view must always show the complete table');
  check(await table.locator('.envdiff-same').textContent().then(t => t.includes('東京')), 'Fixture must preserve UTF-8');
  check(await page.locator('.w-envdiff-scroll').evaluate(el => el.scrollWidth > el.clientWidth), 'Narrow tables must scroll locally');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'A wide table must not overflow the phone page');
  check(await page.locator('.td-error[role=alert]').textContent().then(t => t.includes('envdiff')), 'Malformed content needs a visible diagnostic');
  check(await page.locator('.slide').last().textContent().then(t => t.includes('Still readable.')), 'Malformed content must retain the Markdown fallback');
  return { source: true, steps: 2, keyboard: true, utf8: true, phone: true, fallback: true };
};
