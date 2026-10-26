// Isolated fixture: tests lazy loading without a network dependency, alongside
// the same readable-TeX behaviour used when KaTeX is disabled or unavailable.
module.exports = async function verifyDerive(page, base) {
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const source = String.raw`id: equations
---
## Request time
$$ {steps}
T &= N \cdot t \\
  &= 10^6 \cdot 40\,\mu s \\
  &= 40\,s \quad \text{total time}
$$
---
## Invalid TeX
$$ {steps}
x &= \badcommand
$$
---
## Invalid structure
$$ {steps}
x &= {1
$$`;
  let loads = 0;
  await page.route('**/derive-katex.js', route => {
    loads++;
    return route.fulfill({ contentType: 'application/javascript', body: `window.katex = { render(source, el, options) {
      if (source.includes('badcommand')) throw Error('invalid TeX');
      el.dataset.tex = source; el.dataset.display = options.displayMode;
      const math = document.createElementNS('http://www.w3.org/1998/Math/MathML', 'math');
      const text = document.createElementNS(math.namespaceURI, 'mtext'); text.textContent = source; math.append(text); el.replaceChildren(math);
    }};` });
  });
  await page.route('**/derive-katex.css', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/derive-fixture.html*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body:
    '<!doctype html><html data-fonts="off" data-icons="off" data-highlight="off" data-math="' + (route.request().url().includes('off=1') ? 'off' : '/derive-katex.js') + '"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + source + '</script></body></html>' }));
  await page.goto(base + '/derive-fixture.html?view=present');
  await page.waitForFunction(() => window.Deck?.slides.length === 3 && document.querySelector('.w-derive math'));
  const box = page.locator('.w-derive').first(), rows = box.locator('tr');
  check(loads === 1, 'Derivations must reuse one lazy KaTeX request');
  check(await box.locator('[data-display="true"]').count() === 6, 'Every alignment cell must use display maths');
  check(await rows.nth(0).isVisible() && !(await rows.nth(1).isVisible()), 'Only first equation is revealed initially');
  check(await rows.nth(2).getAttribute('aria-hidden') === 'true', 'Unrevealed equations must be hidden from assistive technology');
  const height = await box.evaluate(el => el.offsetHeight);
  await page.keyboard.press('ArrowDown');
  check(await rows.nth(1).getAttribute('class') === 'current', 'Down must reveal and accent the second row');
  check(await rows.nth(0).isVisible(), 'Earlier equations remain visible');
  await box.getByRole('button', { name: 'Next equation' }).focus();
  await page.keyboard.press('Enter');
  check(await rows.nth(2).isVisible(), 'Keyboard activation must reveal the final explanation');
  check(await box.getByRole('button').isDisabled(), 'Next control must disable on final equation');
  check(await box.evaluate(el => el.offsetHeight) === height, 'Steps must preserve aligned layout and height');
  await page.evaluate(() => Deck.go(0, 0));
  await box.getByRole('button', { name: 'Next equation' }).focus();
  await page.keyboard.press('Space');
  check(await rows.nth(1).getAttribute('class') === 'current', 'Space reveals the next equation without navigating the slide');
  await page.evaluate(() => Deck.go(0, 0));
  await page.keyboard.press('s');
  check((await page.locator('#src').textContent()).includes('$$ {steps}'), 'Source view must preserve exact derivation syntax');
  await page.keyboard.press('Escape');
  await page.evaluate(() => Deck.setView('read'));
  check(await rows.nth(2).isVisible() && await rows.nth(2).getAttribute('aria-hidden') === 'false', 'Article must reveal every equation and explanation accessibly');
  check(!(await box.getByRole('button').isVisible()), 'Article needs no reveal controls');
  check((await page.locator('.slide').nth(1).locator('[role="alert"]').textContent()).includes('invalid TeX'), 'Invalid TeX must produce a visible diagnostic');
  check((await page.locator('.slide').nth(1).locator('.math').last().textContent()).includes('badcommand'), 'Invalid TeX must retain its fallback');
  check((await page.locator('.slide').nth(2).locator('[role="alert"]').textContent()).includes('unclosed'), 'Invalid structure must produce a visible diagnostic');
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Equations must fit the article viewport at ' + width);
    check(await box.locator('.w-derive-scroll').evaluate(el => getComputedStyle(el).overflowX === 'auto'), 'Long equations need local scrolling');
  }
  await page.goto(base + '/derive-fixture.html?view=present&off=1');
  await page.waitForFunction(() => window.Deck?.slides.length === 3);
  check(loads === 1, 'Disabled maths must not request KaTeX');
  check((await page.locator('.w-derive .math').first().textContent()) === 'T', 'Disabled maths keeps readable TeX');
  await page.evaluate(() => Deck.setView('read'));
  check((await page.locator('.w-derive').first().textContent()).includes('total time'), 'Disabled maths retains explanations in article view');
};
