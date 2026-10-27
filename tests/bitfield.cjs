// A bit layout steps one field per ↓ in the present view; the article shows the field table and no highlight.
module.exports = async function verifyBitfield(page, base) {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const source = 'id: bits\n---\n## Header\n```bitfield bits=16\n0-3 Version\n4-7 IHL\n8-15 Flags\n```\n---\n## Next';
  await page.route('**/bitfield-fixture.html*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html data-fonts="off" data-highlight="off" data-icons="off"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + source + '</script></body></html>' }));
  await page.goto(base + '/bitfield-fixture.html?view=present');
  await page.waitForFunction(() => window.Deck?.slides.length === 2);
  const on = page.locator('.bf-cell.on');
  check(await on.count() === 1 && await on.getAttribute('data-field') === '0', 'The first field must start highlighted');
  check(!(await page.locator('.bf-table').isVisible()), 'The field table belongs to the article');
  await page.keyboard.press('ArrowDown');
  check(await on.getAttribute('data-field') === '1', 'Down must highlight the next field');
  await page.locator('[data-field="2"]').click();
  check(await on.getAttribute('data-field') === '2', 'Clicking a field must jump to it');
  await page.goto(base + '/bitfield-fixture.html?view=read');
  await page.waitForFunction(() => window.Deck?.slides.length === 2);
  check(await page.locator('.bf-table tbody tr').count() === 3 && await page.locator('.bf-table').isVisible(), 'The article must show the field table');
  check(await page.locator('.bf-cell.on').evaluate(el => getComputedStyle(el).boxShadow === 'none'), 'The article must not highlight a field');
};
