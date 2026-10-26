// Exercise the shipped gallery and assets, not a source-only mock renderer.
async function verifyVisualCharts(page, base) {
  const check = (ok, message) => { if (!ok) throw Error(message); };
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/gallery.html?view=present');
  await page.evaluate(() => Talkdown.ready.then(() => {}));
  check(await page.locator('.w-chart-box').count() === 12, 'Gallery must mount all twelve chart types');
  check(await page.locator('.w-visual-svg').count() === 8, 'Gallery must load the eight native SVG charts from built assets');
  check(await page.locator('.w-chart-box [role=alert]').count() === 0, 'Gallery charts must not report schema errors');
  const types = await page.locator('.w-chart-box').evaluateAll(boxes => boxes.map(b => b.querySelector('.w-chart').className));
  for (const [width, height] of [[1440,900], [768,1024], [390,844], [320,740], [844,390]]) {
    await page.setViewportSize({ width, height });
    for (const view of ['present', 'read']) {
      await page.evaluate(view => Deck.setView(view), view);
      await page.evaluate(() => new Promise(requestAnimationFrame));
      for (let i = 0; i < 12; i++) {
        const box = page.locator('.w-chart-box').nth(i);
        await box.evaluate(box => {
          Deck.go(Deck.slides.indexOf(box.closest('.slide')), 999);
          box.scrollIntoView({ block: 'nearest' });
        });
        const dimensions = await box.evaluate(b => {
          const w = b.querySelector('.w-chart'), svg = w.querySelector('.w-visual-svg'), content = b.closest('.content');
          const bounds = b.getBoundingClientRect();
          const data = { pageFits: document.documentElement.scrollWidth <= innerWidth + 1,
            boxFits: bounds.left >= -1 && bounds.right <= innerWidth + 1,
            contentFits: content.scrollHeight <= content.clientHeight + 2 || getComputedStyle(content).overflowY === 'auto' };
          if (svg) {
            w.scrollLeft = 40; w.scrollTop = 20;
            data.canScroll = w.scrollWidth <= w.clientWidth + 1 || w.scrollLeft > 0;
            data.fontSize = 14 * svg.clientWidth / svg.viewBox.baseVal.width;
            const vb = svg.viewBox.baseVal;
            data.labelsFit = [...svg.querySelectorAll('text')].every(t => {
              const r = t.getBBox(); return r.x >= -1 && r.y >= -1 && r.x + r.width <= vb.width + 1 && r.y + r.height <= vb.height + 1;
            });
          }
          return data;
        });
        const context = `${types[i]} at ${width}px in ${view}: ${JSON.stringify(dimensions)}`;
        check(dimensions.pageFits && dimensions.boxFits && dimensions.contentFits, 'Clipped chart: ' + context);
        if (dimensions.fontSize) check(dimensions.fontSize >= 14 && dimensions.canScroll && dimensions.labelsFit, 'Unreadable SVG: ' + context);
      }
    }
  }
  // A keyboard user can focus and scroll plots, switch to exact data, and export it.
  const box = page.locator('.w-chart-box').nth(1);
  await box.scrollIntoViewIfNeeded();
  await box.locator('select').selectOption('chart');
  const plot = box.locator('.w-visual-chart');
  await plot.focus();
  check(await plot.evaluate(el => document.activeElement === el), 'SVG plot must be keyboard focusable');
  await box.locator('select').selectOption('table');
  check(!(await plot.isVisible()) && await box.locator('.w-chart-table').isVisible(), 'SVG table view must work');
  await box.locator('select').selectOption('both');
  check(await plot.isVisible() && await box.locator('.w-chart-table').isVisible(), 'SVG both view must work');
  const download = page.waitForEvent('download');
  await box.locator('.w-csv-download').click();
  check((await download).suggestedFilename() === 'latency-vs-throughput.csv', 'SVG CSV export must work');
  // Any chart opens full screen for a closer look, and goes back where it was.
  await box.locator('select').selectOption('chart');
  await plot.click();
  await page.locator('#zoom.on .z-chart .w-visual-svg').waitFor();
  check(await page.locator('#zoom .z-title').textContent() === await box.locator('figcaption').textContent(), 'The chart viewer must show the chart title');
  await page.keyboard.press('Escape');
  check(await box.locator('.w-visual-svg').count() === 1 && !(await page.locator('#zoom.on').count()), 'Closing the viewer must return the chart to its slide');
  await page.evaluate(() => { document.documentElement.dataset.mode = 'dark'; });
  check(await plot.locator('svg').isVisible(), 'SVG chart must remain visible in dark mode');
  return { chartTypes: 12, svgTypes: 8, widths: [1440,768,390,320,844], views: ['present','read'] };
}
module.exports = verifyVisualCharts;
