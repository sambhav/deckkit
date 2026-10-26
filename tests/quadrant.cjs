const assert = require('node:assert/strict');
module.exports = async function verifyQuadrant(page, base) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/gallery.html?view=present#w-quadrant');
  await page.evaluate(() => Talkdown.ready.then(() => {}));
  const w = page.locator('.w-quadrant');
  assert.equal(await w.locator('.w-quadrant-point.shown').count(), 1);
  await page.keyboard.press('ArrowDown');
  assert.equal(await w.locator('.w-quadrant-point.shown').count(), 2);
  await page.evaluate(() => Deck.go(Deck.cur, 3));
  for (const mode of ['light', 'dark']) {
    await page.evaluate(mode => { document.documentElement.dataset.theme = 'terminal'; document.documentElement.dataset.mode = mode; }, mode);
    assert.equal(await w.locator('.w-quadrant-key').evaluate(el => {
      const key = el.getBoundingClientRect(), content = el.closest('.content').getBoundingClientRect();
      return key.bottom <= content.bottom && el.scrollWidth <= el.clientWidth + 1;
    }), true, 'the complete legend fits the terminal presentation stage');
  }
  await page.keyboard.press('s');
  assert.match(await page.locator('#src').textContent(), /::: quadrant x="Effort" y="Impact"/);
  await page.keyboard.press('Escape');
  for (const theme of ['rose', 'clean']) for (const mode of ['light', 'dark']) {
    await page.evaluate(({theme, mode}) => { document.documentElement.dataset.theme = theme; document.documentElement.dataset.mode = mode; Deck.setView('read'); }, {theme, mode});
    assert.equal(await w.locator('.w-quadrant-point.shown').count(), 4);
    assert.equal(await w.locator('.w-quadrant-groups section').count(), 4);
    await page.setViewportSize({ width: 320, height: 740 });
    assert.equal(await w.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, 'matrix fits a phone article');
    assert.equal(await w.locator('.w-quadrant-groups').evaluate(el => getComputedStyle(el).display), 'grid');
  }
  await page.evaluate(() => { Deck.setView('present'); Deck.go(Deck.cur, 0); });
  assert.equal(await w.locator('.w-quadrant-point.shown').count(), 1);
};
