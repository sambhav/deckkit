module.exports = async function verifyChangelog(page, base) {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const source = [
    'id: releases', '---', '## Release notes', '::: changelog',
    '### v2 · 2026-10-25', '#### Added', '- **Diagrams** and [docs](#next)',
    '### v1 · 2026-10-18', '#### Fixed', '- Phone tables', ':::',
    '::: changelog', '### v1 · 2026-10-18', '- Another product', ':::',
    '---', 'id: next', '---', '## Next', '[Earlier release](#td-release-releases-1-v1)',
    '---', '## Bad notes', '::: changelog', '### v0 · 2026-02-30', '- Retained fallback', ':::',
  ].join('\n');
  await page.route('**/changelog.html*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body:
    '<!doctype html><html data-fonts="off" data-highlight="off"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + source + '</script></body></html>' }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/changelog.html?view=present');
  await page.waitForFunction(() => window.Deck?.slides.length === 3);
  const entries = page.locator('.w-changelog').first().locator('.w-release');
  check(await entries.first().isVisible() && !await entries.last().isVisible(), 'Present view must show only the first release');
  await page.keyboard.press('ArrowDown');
  check(await entries.last().isVisible() && !await entries.first().isVisible(), 'Down must select the next release');
  const href = await entries.last().locator('a.w-release-link').getAttribute('href');
  check(href === '#td-release-releases-1-v1', 'Release links must be stable and scoped to their slide and widget');
  check(await page.locator('#td-release-releases-2-v1').count() === 1, 'Repeated versions in other containers need unique anchors');
  await entries.last().locator('a.w-release-link').focus();
  await page.keyboard.press('Space');
  check(await page.evaluate(() => Deck.cur) === 0, 'Space on a release link must not advance the deck');
  await page.keyboard.press('Enter');
  check(await page.evaluate(() => Deck.cur) === 0 && await entries.last().isVisible(), 'Enter must activate the link without advancing steps');
  await page.locator('#srcBtn').click();
  check((await page.locator('#src code').textContent()).includes('### v2 · 2026-10-25'), 'Source must preserve authored release headings');
  await page.keyboard.press('Escape');
  await page.goto(base + '/changelog.html?view=present' + href);
  await page.waitForFunction(() => window.Deck?.slides.length === 3);
  check(await page.evaluate(() => Deck.cur) === 0 && await entries.last().isVisible(), 'A direct release hash must select its release step');
  check(await page.evaluate(() => location.hash) === href, 'Present navigation must retain the release permalink');
  await page.reload();
  await page.waitForFunction(() => window.Deck?.slides.length === 3);
  check(await entries.last().isVisible(), 'Reload must retain the selected release');
  await page.evaluate(() => Deck.go(1));
  await page.locator('.slide.active a').click();
  check(await page.evaluate(() => Deck.cur) === 0 && await entries.last().isVisible(), 'Cross-slide release links must use Deck navigation');
  await page.evaluate(() => Deck.setView('read'));
  await page.setViewportSize({ width: 320, height: 740 });
  check(await entries.first().isVisible() && await entries.last().isVisible(), 'Article view must show every release');
  check(await entries.evaluateAll(all => all.every(el => el.getAttribute('aria-hidden') === 'false')), 'Article entries must remain available to assistive technology');
  const positions = await entries.evaluateAll(all => all.map(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }));
  check(positions.every(r => r.left >= 0 && r.right <= 321) && positions[1].top >= positions[0].bottom, 'Phone article releases must stack without overflow');
  check((await page.locator('.td-error').textContent()).startsWith('changelog:'), 'Malformed releases must show a diagnostic');
  check((await page.locator('.slide').last().textContent()).includes('Retained fallback'), 'Malformed release notes must preserve ordinary Markdown');
  await page.goto(base + '/changelog.html?view=read' + href);
  await page.waitForFunction(() => window.Deck?.slides.length === 3);
  check(await page.evaluate(() => Deck.cur) === 0 && await entries.last().isVisible(), 'Article deep links must remain in the owning slide');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  check(await page.evaluate(() => location.hash) === href && await page.evaluate(() => Deck.cur) === 0, 'Article scrolling must retain the release permalink and its owning slide');
  await page.reload();
  await page.waitForFunction(() => window.Deck?.slides.length === 3);
  check(await page.evaluate(() => location.hash) === href && await page.evaluate(() => Deck.cur) === 0, 'Article release permalinks must survive a fresh reload');
  return { releases: 3, steps: 2, source: true, keyboard: true, anchors: true, phone: true };
};
