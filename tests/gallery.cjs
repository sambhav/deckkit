module.exports = async function verifyGallery(page, base) {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const source = 'id: collection\n---\n## Gallery\n::: gallery\n![Dusk](assets/dusk.svg)\n![Portrait](assets/speaker.svg)\n![Missing](missing-gallery-image.png)\n:::\n---\n## Single\n::: gallery\n![Mark](docs/logo.svg)\n:::\n---\n## Invalid\n::: gallery\nKeep this fallback\n:::';
  await page.route('**/gallery-fixture.html*', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html data-fonts="off" data-icons="off" data-highlight="off"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + source + '</script></body></html>' }));
  await page.goto(base + '/gallery-fixture.html?view=present');
  await page.waitForFunction(() => window.Deck?.slides.length === 3);
  const gallery = page.locator('.w-gallery').first(), buttons = gallery.locator('button');
  check(await buttons.count() === 3, 'Gallery must retain all images');
  check(await buttons.nth(0).getAttribute('aria-current') === 'true', 'Gallery starts at first image');
  await page.keyboard.press('ArrowDown');
  check(await buttons.nth(1).getAttribute('aria-current') === 'true', 'Down must highlight next gallery image');
  await buttons.nth(0).focus(); await page.keyboard.press('Enter');
  const dialog = page.locator('.w-gallery-lightbox[open]');
  check(await dialog.isVisible(), 'Enter opens lightbox');
  check(await dialog.locator('[data-gallery=close]').evaluate(el => el === document.activeElement), 'Open focuses close');
  // Native dialogs may include browser chrome when tabbing past the last button.
  // Check toolbar navigation without assuming that browser-level wrap policy.
  await page.keyboard.press('Shift+Tab');
  check(await dialog.locator('[data-gallery=next]').evaluate(el => el === document.activeElement), 'Native modal moves focus to the previous gallery control');
  await page.keyboard.press('Tab');
  check(await dialog.locator('[data-gallery=close]').evaluate(el => el === document.activeElement), 'Native modal moves focus forward to Close');
  await page.keyboard.press('ArrowRight');
  check(await dialog.locator('figcaption').textContent() === 'Portrait', 'ArrowRight browses with captions');
  check(await buttons.nth(1).getAttribute('aria-current') === 'true', 'Lightbox arrow must not navigate deck steps');
  await dialog.locator('[data-gallery=next]').click();
  await page.waitForFunction(() => document.querySelector('.w-gallery-lightbox figcaption').textContent.includes('Image unavailable'));
  await page.keyboard.press('Escape');
  check(await buttons.nth(0).evaluate(el => el === document.activeElement), 'Escape restores original opener focus');
  await buttons.nth(0).focus(); await page.keyboard.press('Space');
  check(await dialog.isVisible(), 'Space opens the focused gallery image');
  check(await buttons.nth(1).getAttribute('aria-current') === 'true', 'Space must not navigate the slide');
  await page.keyboard.press('Escape');
  await buttons.nth(1).click(); await dialog.locator('[data-gallery=prev]').click();
  check(await dialog.locator('figcaption').textContent() === 'Dusk', 'Previous button browses images');
  await dialog.locator('[data-gallery=close]').click();
  check(await buttons.nth(1).evaluate(el => el === document.activeElement), 'Mouse close restores opener focus');
  await page.evaluate(() => Deck.go(1));
  await page.locator('.w-gallery').nth(1).locator('button').click();
  check(await dialog.locator('[data-gallery=next]').isDisabled(), 'Single gallery disables navigation');
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  check((await page.locator('#src').textContent()).includes('::: gallery'), 'S preserves authored gallery source');
  await page.keyboard.press('Escape');
  await page.evaluate(() => Deck.setView('read'));
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Gallery fits at ' + width);
    check(await gallery.locator('figcaption').count() === 3, 'All captions stay expanded in article');
    check(await buttons.nth(0).locator('img').isVisible(), 'Article image remains visible');
  }
  check((await page.locator('.slide').last().textContent()).includes('Keep this fallback'), 'Malformed input keeps fallback');
  check(await gallery.locator('[role=alert]').count() === 1, 'Broken image has visible diagnostic');
};
