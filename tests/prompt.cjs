const assert = require('node:assert/strict');
module.exports = async function verifyPrompt(page, base) {
  const source = ['id: pair', '---', '## Prompt pair', '::: prompt model="any-model" temperature=0', '### Prompt', 'Summarise **this**.', '::: card', '### Nested heading', '- Nested content', ':::', '```md', '### Output', '```', '### Output', 'The **complete** answer.', '```js', 'fetch(url)', '```', ':::', '---', '## Invalid pair', '::: prompt', 'Keep the fallback.', ':::'].join('\n');
  await page.route('**/prompt-fixture.html*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html data-fonts="off" data-highlight="off" data-icons="off"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + source + '</script></body></html>' }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/prompt-fixture.html?view=present');
  await page.waitForFunction(() => window.Deck?.slides.length === 2);
  const pair = page.locator('.w-prompt'), output = pair.locator(':scope > .w-prompt-output'), button = pair.locator(':scope > .w-prompt-reveal');
  assert.equal(await pair.locator('.card h3').textContent(), 'Nested heading');
  assert.equal(await output.isVisible(), false);
  assert.equal(await button.getAttribute('aria-expanded'), 'false');
  await page.keyboard.press('ArrowDown');
  assert.equal(await output.isVisible(), true);
  assert.equal(await button.getAttribute('aria-expanded'), 'true');
  await page.evaluate(() => { navigator.clipboard.writeText = text => { window.__promptCopy = text; return Promise.resolve(); }; });
  const copy = output.locator('pre.code button');
  await copy.focus();
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(() => Deck.cur), 0, 'nested native controls keep Space local');
  assert.match(await page.evaluate(() => window.__promptCopy), /fetch\(url\)/);
  assert.equal(await copy.evaluate(el => document.activeElement === el), true, 'Copy keeps native keyboard focus');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => Deck.cur), 0, 'repeated Copy activation stays on the pair slide');
  await button.focus();
  await page.keyboard.press('ArrowUp');
  assert.equal(await output.isVisible(), false);
  await button.focus();
  let revealed = false;
  for (const key of ['Space', 'Enter', 'Space', 'Space', 'Enter', 'Enter']) {
    await page.keyboard.press(key);
    revealed = !revealed;
    assert.equal(await output.isVisible(), revealed, `${key} toggles output without refocusing`);
    assert.equal(await button.evaluate(el => document.activeElement === el), true, `${key} keeps native button focus`);
    assert.equal(await page.evaluate(() => Deck.cur), 0, `${key} stays on the pair slide`);
  }
  await page.keyboard.press('s');
  assert.match(await page.locator('#src').textContent(), /::: prompt model="any-model" temperature=0/);
  await page.keyboard.press('Escape');
  await page.evaluate(() => Deck.setView('read'));
  assert.equal(await output.isVisible(), true);
  assert.equal(await button.isVisible(), false);
  assert.match(await output.textContent(), /The complete answer/);
  assert.match(await page.locator('.td-error').textContent(), /prompt:/);
  assert.match(await page.locator('#stage').textContent(), /Keep the fallback/);
  for (const theme of ['clean', 'paper']) for (const mode of ['light', 'dark']) {
    await page.evaluate(({theme, mode}) => { document.documentElement.dataset.theme = theme; document.documentElement.dataset.mode = mode; }, {theme, mode});
    await page.setViewportSize({ width: 320, height: 740 });
    assert.equal(await pair.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, `${theme}/${mode} pair fits phone`);
    assert.equal(await output.isVisible(), true);
  }
  await page.evaluate(() => { Deck.setView('present'); Deck.go(0, 0); });
  assert.equal(await output.isVisible(), false);
  assert.equal(await button.isVisible(), true);
};
