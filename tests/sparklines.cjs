// Isolated fixture: no fonts, highlighting, external libraries or chart loaders.
module.exports = async function verifySparklines(page, base) {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const source = ['id: trends', '---', '## Trends', '| Service | Trend |', '|---|---|', '| API | `spark:9,8,8,6,5,5` |', '| Flat | `spark:4,4,4` |', '', 'Sample `spark:5`.', '---', '## Invalid', '`spark:1,,2`'].join('\n');
  await page.route('**/sparklines.html*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body:
    '<!doctype html><html data-fonts="off" data-highlight="off"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + source + '</script></body></html>' }));
  await page.goto(base + '/sparklines.html?view=present');
  await page.waitForFunction(() => window.Deck?.slides.length === 2);
  check(await page.locator('.w-sparkline').count() === 3, 'All inline sparklines must render');
  check(await page.locator('td .w-sparkline').count() === 2, 'Sparklines must render in table cells');
  check(await page.locator('.w-sparkline').first().getAttribute('aria-label') === 'Sparkline values: 9, 8, 8, 6, 5, 5', 'Label must list full data');
  await page.locator('#srcBtn').click();
  check((await page.locator('#src code').textContent()).includes('| API | `spark:9,8,8,6,5,5` |'), 'Source must retain exact authored syntax');
  await page.keyboard.press('Escape');
  for (const view of ['present', 'read']) for (const width of [1440, 320]) for (const theme of ['clean', 'rose']) for (const mode of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(({ view, theme, mode }) => { Deck.setView(view); document.documentElement.dataset.theme = theme; document.documentElement.dataset.mode = mode; }, { view, theme, mode });
    const valid = await page.locator('.w-sparkline').evaluateAll(all => all.every(svg => {
      const box = svg.getBoundingClientRect(), drawing = svg.querySelector('polyline, circle');
      const style = getComputedStyle(drawing);
      return box.width > 0 && box.height > 0 && box.left >= 0 && box.right <= innerWidth + 1
        && (drawing.tagName === 'polyline' ? style.stroke : style.fill) === getComputedStyle(svg).color;
    }));
    check(valid, `Inline trends must fit and inherit colour: ${view}/${width}/${theme}/${mode}`);
  }
  check(await page.locator('.td-error[role=alert]').isVisible(), 'Malformed input must show a visible diagnostic in read view');
  check(await page.locator('.slide').last().locator('code').textContent() === 'spark:1,,2', 'Malformed input must retain literal data');
  return { sparklines: 3, source: true, themes: 2, modes: 2, phone: true };
};
