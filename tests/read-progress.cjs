// <html data-read-progress>: the section rail follows the reader in the article and stays out of the slides.
module.exports = async function verifyReadProgress(page, base) {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const long = Array(8).fill('Lorem ipsum dolor sit amet. '.repeat(40)).join('\n\n');
  const source = ['## One', '::: notes', long, ':::', '---', 'id: two\nsection: Part B\n---', '## Two', '::: notes', long, ':::', '---', 'section: Part C\n---', '## Three', '::: notes', long, ':::'].join('\n');
  const html = attr => '<!doctype html><html ' + attr + ' data-fonts="off" data-highlight="off" data-icons="off"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + source + '</script></body></html>';
  await page.route('**/rail-test.html*', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html('data-read-progress') }));
  await page.route('**/rail-off.html*', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html('') }));
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(base + '/rail-test.html?view=read');
  await page.waitForFunction(() => window.Deck?.slides.length === 3);
  check(await page.locator('#rail a').count() === 3, 'The rail must list each section');
  check(await page.locator('#rail').isVisible(), 'The rail must show beside a wide article');
  check(await page.locator('#rail a[aria-current]').count() === 1, 'One rail entry must be current');
  await page.locator('#rail a').nth(2).click();
  await page.waitForFunction(() => document.querySelector('#rail li:nth-child(3) a[aria-current]'));
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForFunction(() => document.querySelector('#rail li:first-child a[aria-current]'));
  await page.setViewportSize({ width: 1000, height: 800 });
  check(!(await page.locator('#rail').isVisible()), 'The rail must hide on narrow screens');
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => Deck.setView('present'));
  check(!(await page.locator('#rail').isVisible()), 'The rail must not show in the slides');
  await page.goto(base + '/rail-off.html?view=read');
  await page.waitForFunction(() => window.Deck?.slides.length === 3);
  check(await page.locator('#rail').count() === 0, 'Without the attribute there is no rail');
};
