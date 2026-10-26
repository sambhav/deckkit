// Speaker cards retain accessible Markdown content and source in both views.
module.exports = async function verifySpeaker(page, base) {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const fixture = ['id: speaker', '---', '## Introduction', '::: speaker', '![Portrait](assets/speaker.svg "Ada Lovelace")', '### Ada **Lovelace**', 'Engineer', '- [GitHub](https://github.com/ada) · [Site](https://example.com)', ':::', '---', '## No photo', '::: speaker', '### Grace Hopper', 'Computer scientist', ':::', '---', '## Invalid', '::: speaker', 'Role without a name.', ':::', '', '::: speaker', '### One', '### Two', ':::'].join('\n');
  await page.route('**/speaker-test.html*', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html data-fonts="off" data-icons="off"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + fixture + '</script></body></html>' }));
  await page.goto(base + '/speaker-test.html?view=present');
  await page.waitForFunction(() => window.Deck?.slides.length === 3);
  const card = page.locator('.w-speaker').first();
  check(await card.locator('h3 strong').textContent() === 'Lovelace', 'Speaker name keeps inline formatting');
  check(await card.locator('.w-speaker-photo img').getAttribute('alt') === 'Portrait', 'Portrait keeps authored alternative text');
  check(await card.locator('.w-speaker-photo > figcaption').textContent() === 'Ada Lovelace', 'Portrait caption stays with the bounded photo figure');
  check(await card.locator('.w-speaker-body figure').count() === 0, 'A captioned portrait must not move into the text body');
  check(await card.locator('a').count() === 2, 'All speaker links remain real links');
  check(await card.locator('a .ico[aria-hidden=true]').count() === 2, 'Speaker link icons are decorative');
  check(await card.locator('a').first().getAttribute('href') === 'https://github.com/ada', 'Speaker keeps the authored destination');
  await card.locator('a').first().focus();
  check(await page.evaluate(() => document.activeElement.textContent.trim() === 'GitHub'), 'Speaker links support keyboard focus');
  check(await page.locator('.td-error').count() === 2, 'Missing or multiple names fail visibly');
  check(await page.locator('.speaker').first().textContent().then(text => text.includes('Role without a name.')), 'Invalid speaker keeps readable source content');
  check(await page.locator('.w-speaker').nth(1).locator('h3').textContent() === 'Grace Hopper', 'A photo is optional');
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  check(await page.locator('#src').textContent().then(text => text.includes('::: speaker') && text.includes('### Ada **Lovelace**')), 'Source view keeps the exact speaker Markdown');
  await page.keyboard.press('Escape');
  for (const width of [1440, 320, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => { Deck.setView('read'); Deck.go(0); });
    check(await card.locator('h3').isVisible() && await card.locator('a').first().isVisible(), 'Article shows name and links without interaction');
    check(await card.locator('.w-speaker-photo figcaption').isVisible(), 'Article preserves the portrait caption');
    check(await card.locator('.w-speaker-photo img').evaluate(el => el.getBoundingClientRect().width < 120), 'Captioned portraits keep the compact article sizing');
    check(await card.evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1; }), 'Speaker card fits article width');
  }
};
