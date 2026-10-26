const assert = require('node:assert/strict');
module.exports = async function verifyHotspots(page, base) {
  const source = [
    '## Hotspots', '::: hotspots', '![Landscape](assets/dusk.svg "Image caption")',
    '- [0%, 0%] **First** corner', '- [62%, 60%] Second ridge', '- [100%, 100%] Last corner', ':::',
    '---', '## Invalid', '::: hotspots', '![Image](assets/dusk.svg)', '- [120%, 20%] Keep invalid label', ':::',
    '---', '## Unavailable image', '::: hotspots', '![Missing image](missing-hotspot.png)', '- [25%, 30%] Still readable', '- [70%, 50%] Also readable', ':::',
  ].join('\n');
  await page.route('**/hotspots-fixture.html*', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html data-fonts="off" data-highlight="off" data-icons="off"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + source + '</script></body></html>' }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/hotspots-fixture.html?view=present');
  await page.waitForFunction(() => window.Deck?.slides.length === 3);
  const w = page.locator('.w-hotspots').first(), pins = w.locator('.w-hotspot-pin'), labels = w.locator('.w-hotspots-legend > li');
  await w.locator('img').evaluate(image => image.decode());
  assert.ok(await w.locator('img').evaluate(image => image.getBoundingClientRect().width) > 100, 'dimensionless SVG must retain a usable overlay width');
  assert.equal(await pins.count(), 3);
  assert.equal(await pins.first().getAttribute('aria-pressed'), 'true');
  assert.equal(await labels.filter({ visible: true }).count(), 1);
  await page.keyboard.press('ArrowDown');
  assert.equal(await pins.nth(1).getAttribute('aria-pressed'), 'true');
  assert.equal(await labels.nth(1).isVisible(), true);
  assert.equal(await labels.nth(1).getAttribute('value'), '2', 'selected label retains its original ordinal');
  assert.equal(await labels.nth(1).evaluate(el => getComputedStyle(el).listStyleType), 'decimal');
  assert.equal(await labels.nth(1).evaluate(el => getComputedStyle(el, '::before').content), 'none', 'the deck counter must not duplicate the legend number');
  await pins.last().focus();
  await page.keyboard.press('Enter');
  assert.equal(await pins.last().getAttribute('aria-pressed'), 'true');
  await pins.first().focus();
  await page.keyboard.press('Space');
  assert.equal(await pins.first().getAttribute('aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => Deck.cur), 0, 'native pin keys must not navigate the deck');
  await pins.nth(1).click();
  assert.equal(await pins.nth(1).getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('s');
  assert.match(await page.locator('#src').textContent(), /::: hotspots/);
  assert.match(await page.locator('#src').textContent(), /\[62%, 60%\]/);
  await page.keyboard.press('Escape');
  const checkGeometry = async () => {
    assert.equal(await w.evaluate(w => {
      const image = w.querySelector('img').getBoundingClientRect();
      return [...w.querySelectorAll('button')].every((button, i) => {
        const b = button.getBoundingClientRect(), [x, y] = [[0, 0], [.62, .6], [1, 1]][i];
        return Math.abs(b.x + b.width / 2 - image.x - image.width * x) < 1 && Math.abs(b.y + b.height / 2 - image.y - image.height * y) < 1;
      });
    }), true, 'pins track the rendered image rather than its caption or container');
  };
  await checkGeometry();
  await page.evaluate(() => Deck.setView('read'));
  assert.equal(await labels.filter({ visible: true }).count(), 3);
  assert.equal(await w.locator('.w-hotspot-pin:disabled').count(), 3);
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await checkGeometry();
    assert.equal(await w.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, 'article must fit phone width');
  }
  assert.match(await page.locator('.td-error').first().textContent(), /coordinates must be percentages/);
  assert.match(await page.locator('#stage').textContent(), /Keep invalid label/);
  const failed = page.locator('.w-hotspots-failed');
  await failed.waitFor();
  assert.match(await failed.locator('.td-error').textContent(), /could not load image/);
  assert.equal(await failed.locator('.w-hotspots-legend > li').filter({ visible: true }).count(), 2);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { Deck.setView('present'); Deck.go(0, 0); });
  await pins.nth(1).dispatchEvent('click');
  assert.equal(await pins.nth(1).getAttribute('aria-pressed'), 'true');
  assert.equal(await labels.filter({ visible: true }).count(), 1);
  await checkGeometry();
};
