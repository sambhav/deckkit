module.exports = async function verifyCitations(page, base) {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const source = [
    '## Claims', 'Second [@b] came first, then [@a] and [@b] again; [@nope] is missing.', '',
    '---', '## References', '::: references', '- a: Alpha 2020', '- b: Beta 2021', '- unused: Never cited', ':::',
  ].join('\n');
  await page.route('**/citations.html*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body:
    '<!doctype html><html data-fonts="off" data-highlight="off"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + source + '</script></body></html>' }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/citations.html?view=present');
  await page.waitForFunction(() => window.Deck?.slides.length === 2);
  const links = page.locator('.slide').first().locator('a.cite-link');
  const texts = (await links.allTextContents()).join('|');
  check(texts === '1|2|1|unknown reference "nope"', 'Citations number by first use and flag unknown keys, got ' + texts);
  check(await links.first().getAttribute('title') === 'Beta 2021', 'Hover shows the entry');
  check((await page.locator('ol.w-references > li').evaluateAll(li => li.map(e => e.dataset.n + e.textContent.slice(0, 4)))).join('|') === '1Beta|2Alph|3Neve', 'References follow citation order, uncited last');
  await links.first().click();
  check(await page.evaluate(() => Deck.cur) === 1, 'Clicking a citation presents the references slide');
  await page.locator('#srcBtn').click();
  check((await page.locator('#src code').textContent()).includes('[@b]') || (await page.locator('#src').textContent()).includes('::: references'), 'Source keeps the authored syntax');
  await page.keyboard.press('Escape');
  await page.goto(base + '/citations.html?view=read');
  await page.waitForFunction(() => window.Deck?.slides.length === 2);
  check(await page.locator('ol.w-references > li').first().isVisible(), 'References are expanded in the article');
  await page.locator('a.cite-link').first().click();
  check(await page.locator('#td-ref-b').isVisible(), 'Citation scrolls to its entry in the article');
};
