const assert = require('node:assert/strict');
module.exports = async function verifyFlowStack(page, base) {
  const source = [
    'build: true', '---', '## Flow', '::: flow', '- **Prompt**', '- [Plan](https://example.com)', '- Result', ':::',
    '---', '## Vertical', '::: flow vertical', '- Start', '- Finish {.step}', ':::',
    '---', 'build: true', '---', '## Layers', '::: stack', '- App', '- Runtime', '- Hardware', ':::',
    '---', '## Invalid', '::: stack vertical', '- Keep this fallback', ':::',
  ].join('\n');
  await page.route('**/flow-stack-fixture.html*', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html data-fonts="off" data-highlight="off" data-icons="off"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + source + '</script></body></html>' }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/flow-stack-fixture.html?view=present');
  await page.evaluate(() => Talkdown.ready.then(() => {}));
  const flow = page.locator('.w-flow').first();
  assert.equal(await flow.locator('> li.shown').count(), 0);
  assert.equal(await flow.locator('a').isVisible(), false, 'unrevealed links cannot receive focus');
  await page.keyboard.press('ArrowDown');
  assert.equal(await flow.locator('> li.shown').count(), 1);
  await page.keyboard.press('ArrowDown');
  assert.equal(await flow.locator('> li.shown').count(), 2);
  await page.keyboard.press('s');
  assert.match(await page.locator('#src').textContent(), /::: flow/);
  await page.keyboard.press('Escape');
  await page.evaluate(() => Deck.setView('read'));
  assert.equal(await flow.locator('> li.shown').count(), 3);
  assert.equal(await page.locator('.w-stack > li.shown').count(), 3);
  assert.match(await page.locator('.td-error').textContent(), /stack:/);
  assert.match(await page.locator('#stage').textContent(), /Keep this fallback/);
  await page.setViewportSize({ width: 320, height: 740 });
  assert.equal(await flow.locator('> li').evaluateAll(items => items.every((el, i) => !i || el.getBoundingClientRect().top >= items[i - 1].getBoundingClientRect().bottom)), true);
  assert.equal(await page.locator('#stage').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, 'phone article does not overflow');
  await page.evaluate(() => { Deck.setView('present'); Deck.go(1, 0); });
  const vertical = page.locator('.w-flow.vertical');
  assert.equal(await vertical.locator('> li.shown').count(), 0);
  assert.equal(await vertical.locator('> li').first().isVisible(), true);
  await page.keyboard.press('ArrowDown');
  assert.equal(await vertical.locator('> li.shown').count(), 1);
  await page.evaluate(() => { Deck.go(2, 0); Deck.setView('read'); Deck.setView('present'); });
  assert.equal(await page.locator('.w-stack > li.shown').count(), 0, 'article expansion restores the presenter step');
};
