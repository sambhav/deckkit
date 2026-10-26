const assert = require('node:assert/strict');
module.exports = async function verifyBoard(page, base) {
  const source = [
    '## Roadmap', '::: board', '### Now', '- **Cache**', '  - Nested detail', '### Next', '- [Docs](https://example.com)', '### Later', '- More regions', ':::',
    '---', '## Invalid', '::: board', 'Keep this paragraph.', ':::',
  ].join('\n');
  await page.route('**/board-fixture.html*', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html data-fonts="off" data-highlight="off" data-icons="off"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + source + '</script></body></html>' }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/board-fixture.html?view=present');
  await page.waitForFunction(() => window.Deck?.slides.length === 2);
  const board = page.locator('.w-board');
  assert.equal(await board.locator('.w-board-column').count(), 3);
  assert.equal(await board.locator('.shown').count(), 1);
  assert.equal(await board.locator('.w-board-column > ul > li').count(), 3, 'nested bullets remain inside their card');
  await page.keyboard.press('ArrowDown');
  assert.equal(await board.locator('.shown').count(), 2);
  await board.locator('.w-board-title').last().focus();
  await page.keyboard.press('Enter');
  assert.equal(await board.locator('.shown').count(), 3);
  assert.equal(await page.evaluate(() => Deck.cur), 0, 'column control must not navigate away');
  await page.keyboard.press('s');
  assert.match(await page.locator('#src').textContent(), /::: board/);
  await page.keyboard.press('Escape');
  await page.evaluate(() => Deck.setView('read'));
  assert.equal(await board.locator('.w-board-title:disabled').count(), 3, 'article headings have no unnecessary action');
  assert.equal(await board.locator('.w-board-column > ul').evaluateAll(lists => lists.every(el => getComputedStyle(el).visibility === 'visible')), true);
  assert.match(await page.locator('.td-error').textContent(), /Board needs/);
  assert.match(await page.locator('#stage').textContent(), /Keep this paragraph/);
  await page.setViewportSize({ width: 320, height: 740 });
  assert.equal(await board.locator('.w-board-column').evaluateAll(cols => cols.every((el, i) => !i || el.getBoundingClientRect().top >= cols[i - 1].getBoundingClientRect().bottom)), true, 'phone columns stack in reading order');
  await page.evaluate(() => { Deck.setView('present'); Deck.go(0, 0); });
  assert.equal(await board.locator('.w-board-title:disabled').count(), 0);
  assert.equal(await board.locator('.shown').count(), 1, 'returning to slides resets the reveal');
};
