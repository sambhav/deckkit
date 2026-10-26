// Static frames retain authored content, including inner widgets, in both views.
module.exports = async function verifyDeviceFrames(page, base) {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const source = [
    'id: devices', '---', '## Device frames',
    '::: browser url="https://example.com/' + 'settings/'.repeat(30) + '"',
    '![Sunset](assets/dusk.svg)', ':::',
    '::: window title=\'Build "release"\'', '```sh', 'npm test', '```', ':::',
    '::: phone', '::: tabs', '### First', 'First view', '### Second', 'Second view', ':::', ':::',
    '---', '## Long phone content', '::: phone', ...Array.from({ length: 16 }, (_, i) => '- Item ' + i), ':::',
    '---', '## Invalid', '::: phone title="unsupported"', '**Keep this**', ':::',
  ].join('\n');
  await page.route('**/device-frames.html*', r => r.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html data-fonts="off" data-highlight="off" data-icons="off"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + source + '</script></body></html>' }));
  await page.goto(base + '/device-frames.html');
  await page.waitForFunction(() => window.Deck?.slides.length === 3);
  check(await page.locator('.w-device').count() === 4, 'Device frames must render all three variants');
  check(await page.locator('.w-window figcaption').textContent() === 'Build "release"', 'Window titles must stay literal');
  check(await page.locator('.w-device iframe').count() === 0, 'A browser URL is a caption, never a live embed');
  check(await page.locator('.w-phone .w-tabs').count() === 1, 'Frames must preserve nested widgets');
  await page.keyboard.press('s');
  check((await page.locator('#src').textContent()).includes('::: browser url='), 'Source view must retain frame syntax');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { Deck.setView('read'); Deck.go(1, 999); });
  check(await page.locator('.w-phone .w-pane').last().isVisible(), 'Nested frame content must expand in article view');
  const longPhone = page.locator('.w-phone').last();
  check(await longPhone.locator('li').count() === 16, 'Long phone content must remain intact');
  check(await longPhone.locator('.w-device-body').evaluate(el => el.clientHeight >= el.scrollHeight - 1), 'Article frames must expand to their full content');
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => new Promise(requestAnimationFrame));
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Frames must fit at ' + width + 'px');
    check(await page.locator('.w-browser .w-device-label').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Long URL must wrap at ' + width + 'px');
  }
  check((await page.locator('.td-error').textContent()).includes('unsupported option'), 'Unsupported options must fail visibly');
  check(await page.locator('.slide').last().locator('strong').textContent() === 'Keep this', 'Invalid frames must preserve their contents');
};
