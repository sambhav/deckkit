const assert = require('node:assert/strict');
module.exports = async function verifyChat(page, base) {
  const source = ['## Transcript', '::: chat', '**user:** Summarise the failing test.', '**assistant:** Running it first.', '**tool** `pytest -k auth` → 1 failed', '**assistant:** The token fixture expired.', ':::', '---', '## Invalid', '::: chat', 'Keep this fallback.', ':::'].join('\n');
  await page.route('**/chat-fixture.html*', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html data-fonts="off" data-highlight="off"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + source + '</script></body></html>' }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/chat-fixture.html?view=present');
  await page.waitForFunction(() => window.Deck?.slides.length === 2);
  const chat = page.locator('.w-chat');
  const visible = () => chat.locator('.w-chat-message:not([hidden])').count();
  assert.equal(await visible(), 1);
  await page.keyboard.press('ArrowDown');
  assert.equal(await visible(), 2);
  await page.keyboard.press('ArrowDown');
  assert.equal(await visible(), 3);
  const tool = chat.locator('details');
  assert.equal(await tool.getAttribute('open'), null);
  await tool.locator('summary').focus();
  await page.keyboard.press('Enter');
  assert.notEqual(await tool.getAttribute('open'), null);
  assert.match(await tool.textContent(), /pytest -k auth/);
  assert.equal(await page.evaluate(() => Deck.cur), 0);
  await page.keyboard.press('Tab');
  await page.evaluate(() => Deck.go(0, 3));
  assert.equal(await visible(), 4);
  await page.keyboard.press('s');
  assert.match(await page.locator('#src').textContent(), /\*\*tool\*\* `pytest/);
  await page.keyboard.press('Escape');
  await page.evaluate(() => Deck.setView('read'));
  assert.equal(await visible(), 4);
  assert.match(await page.locator('.td-error').textContent(), /Chat needs/);
  assert.match(await page.locator('#stage').textContent(), /Keep this fallback/);
  await tool.locator('summary').click();
  assert.equal(await tool.getAttribute('open'), null);
  for (const mode of ['light', 'dark']) {
    for (const theme of ['clean', 'rose']) {
      await page.evaluate(({ mode, theme }) => Object.assign(document.documentElement.dataset, { mode, theme }), { mode, theme });
      await page.setViewportSize({ width: 320, height: 740 });
      assert.equal(await chat.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, 'phone transcript must fit');
      assert.equal(await visible(), 4);
    }
  }
  await page.evaluate(() => { Deck.setView('present'); Deck.go(0, 0); });
  assert.equal(await visible(), 1);
};
