// Deterministic clock: counts only run for the active present slide's cue.
module.exports = async function verifyMeter(page, base) {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  // Freeze before navigation: RPC and parallel-suite latency must not advance
  // the animation between runFor calls or consume its intermediate state.
  await page.clock.install({ time: new Date('2030-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2030-01-01T01:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const source = '## Before\n---\nid: meter-test\n---\n## Migration\n::: meter value=72 max=100 label="Migration done" unit=%\n:::\n- **[1.2M]{count}** requests/day\n---\n## After';
  await page.route('**/meter-test.html*', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html data-fonts="off" data-highlight="off" data-icons="off"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + source + '</script></body></html>' }));
  await page.goto(base + '/meter-test.html');
  await page.waitForFunction(() => window.Deck?.slides.length === 3);
  const meter = page.locator('.w-meter strong'), count = page.locator('.w-countup > span');
  check(await meter.textContent() === '72%', 'Inactive meters must retain their final fallback');
  await page.evaluate(() => Deck.go(1, 0));
  check(await meter.textContent() === '0%', 'Entering the slide must prepare the baseline');
  await page.clock.runFor(1200);
  check(await meter.textContent() === '0%', 'Meters must wait for their cue');
  await page.keyboard.press('ArrowDown');
  await page.clock.runFor(400);
  const middle = parseFloat(await meter.textContent());
  check(middle > 0 && middle < 72, 'Meter must animate through intermediate values');
  check(await page.locator('[role=meter]').getAttribute('aria-valuenow') === '72', 'Assistive technology must receive the final value throughout');
  await page.clock.runFor(600);
  check(await meter.textContent() === '72%', 'Meter must finish exactly');
  await page.keyboard.press('ArrowDown');
  await page.clock.runFor(1000);
  check(await count.textContent() === '1.2M', 'Inline counts must preserve decimal precision and suffix');
  await page.evaluate(() => { Deck.go(1, 0); Deck.go(1, 1); Deck.go(2, 0); });
  await page.clock.runFor(1200);
  check(await meter.textContent() === '72%', 'Leaving must cancel animation and restore final values');
  await page.evaluate(() => { Deck.go(1, 0); Deck.go(1, 1); Deck.setView('read'); });
  check(await meter.textContent() === '72%' && await count.textContent() === '1.2M', 'Read view must show all final values immediately');
  await page.clock.runFor(1200);
  check(await meter.textContent() === '72%', 'No stale frame may overwrite read values');
  await page.evaluate(() => { Deck.setView('present'); Deck.go(1, 0); Deck.go(1, 1); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Media-query changes are delivered at a rendering opportunity; flush one
  // mocked frame, rather than waiting for the animation duration.
  await page.clock.runFor(16);
  check(await meter.textContent() === '72%', 'Enabling reduced motion mid-animation must finish immediately');
  await page.clock.runFor(1200);
  check(await meter.textContent() === '72%', 'Reduced motion must cancel pending animation frames');
  await page.evaluate(() => Deck.go(1, 0));
  check(await count.textContent() === '1.2M', 'Reduced motion must show final inline values');
  await page.keyboard.press('s');
  check((await page.locator('#src').textContent()).includes('[1.2M]{count}'), 'Source must preserve counter syntax');
  await page.keyboard.press('Escape');
  await page.evaluate(() => Deck.setView('read'));
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    // Resize fitting is scheduled on RAF; the frozen clock needs an explicit render.
    await page.clock.runFor(32);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Meter must fit at ' + width + 'px');
  }
};
