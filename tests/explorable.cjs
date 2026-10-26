module.exports = async function verifyExplorable(page, base) {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const source = 'id: explore\n---\n## Capacity\n::: explorable\nAt [qps=1000]{range=100..10000} requests/s and [ms=40]{range=5..200} ms, **{qps*ms/1000}** workers.\n:::\n\n::: explorable\nAnother [qps=2]{range=1..10}: {qps*2}.\n:::\n\n---\n## Errors\n::: explorable\n[x=1]{range=0..2} {1/x}\n:::\n';
  await page.route('**/explorable.html*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html data-fonts="off" data-highlight="off" data-icons="off"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + source + '</script></body></html>' }));
  await page.goto(base + '/explorable.html');
  await page.waitForFunction(() => window.Deck?.slides?.length === 2);
  const box = page.locator('.w-explore').first(), qps = box.locator('input').first(), result = box.locator('.w-explore-result');
  check(await box.locator('[role=alert]').count() === 0, 'Valid widgets must not contain a diagnostic');
  check(await result.textContent() === '40', 'Initial result must use authored values');
  await qps.focus(); await page.keyboard.press('ArrowRight');
  check(await qps.inputValue() === '1001', 'Native arrow key must increment the slider');
  check(await result.textContent() === '40.04', 'Slider keyboard changes must recompute results');
  check(await page.locator('.slide').first().evaluate(el => el.classList.contains('active')), 'Slider keys must not navigate the deck');
  check(await page.locator('.w-explore').nth(1).locator('.w-explore-result').textContent() === '4', 'Containers with the same variable name must stay independent');
  await qps.evaluate(input => { input.value = '2000'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  check(await result.textContent() === '80', 'Pointer/touch input events must recompute results');
  await page.locator('h2').first().click(); await page.keyboard.press('s');
  check((await page.locator('#src').textContent()).includes('[qps=1000]{range=100..10000}'), 'Source must retain the exact authored declaration');
  await page.keyboard.press('Escape');
  await page.evaluate(() => Deck.setView('read'));
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Explorable prose must fit at ' + width);
    check(await qps.evaluate(el => el.getBoundingClientRect().height >= 32), 'Slider needs a touch target at least 32px high');
  }
  const invalid = page.locator('.w-explore').last();
  await invalid.locator('input').evaluate(input => { input.value = '0'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  check(await invalid.locator('[role=alert]').isVisible(), 'Nonfinite interactive results need a visible error');
  check(await invalid.locator('.w-explore-result').textContent() === 'undefined', 'An invalid result must never leave a stale number');
  await invalid.locator('input').evaluate(input => { input.value = '2'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  check(await invalid.locator('.w-explore-result').textContent() === '0.5', 'Valid input must recover after an arithmetic error');
  check(await invalid.locator('[role=alert]').count() === 0, 'Recovered arithmetic errors must clear');
  await page.goto(base + '/explorable.html?view=read');
  await page.waitForFunction(() => window.Deck?.slides?.length === 2);
  check(await page.locator('.w-explore-result').first().textContent() === '40', 'A fresh article must start at the author values');
};
