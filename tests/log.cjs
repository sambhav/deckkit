// An isolated literal-log fixture; no loader globals or external highlighting are needed.
module.exports = async function verifyLogs(page, base) {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const raw = Array.from({ length: 36 }, (_, i) => `12:00:${String(i).padStart(2, '0')} ${i === 24 ? 'ERROR' : 'INFO '}  ${i === 24 ? '<failed> café' : 'request ' + i}`).join('\n') + '\n';
  const source = 'id: logs\n---\n## Incident\n```log {steps: 2 | 25-26}\n' + raw + '```\n---\n## Next';
  await page.route('**/log-fixture.html*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html data-fonts="off" data-highlight="off" data-icons="off"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + source + '</script></body></html>' }));
  await page.goto(base + '/log-fixture.html?view=present');
  await page.waitForFunction(() => window.Deck?.slides.length === 2);
  const log = page.locator('.w-log');
  check(await log.locator('.ln').count() === 36, 'Every log line must render');
  check(await log.evaluate(el => el.scrollHeight > el.clientHeight), 'Long logs need an internal stage viewport');
  check(await log.locator('.log-error').textContent() === 'ERROR', 'Severity must stay readable text');
  check(await log.locator('script').count() === 0, 'Log HTML must stay literal');
  await page.keyboard.press('ArrowDown');
  check(await log.locator('.ln.on').getAttribute('data-line') === '2', 'Down must highlight the first line group');
  await page.keyboard.press('ArrowDown');
  check(await log.locator('.ln.on').count() === 2, 'Down must highlight the next group');
  check(await log.evaluate(el => el.scrollTop > 0), 'A distant highlight must scroll into the log viewport');
  await page.evaluate(() => { window.copiedLog = ''; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedLog = text; } } }); });
  const copy = log.locator('.w-copy');
  await copy.focus();
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.copiedLog.length > 0);
  check(await page.evaluate(() => window.copiedLog) === raw, 'Copy must preserve exact raw whitespace, Unicode and trailing newline');
  check(await page.evaluate(() => Deck.cur) === 0, 'Space on Copy must not navigate the deck');
  check(await copy.evaluate(el => el === document.activeElement), 'Copy must keep keyboard focus after native activation');
  await page.evaluate(() => { window.copiedLog = ''; });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.copiedLog.length > 0);
  check(await copy.evaluate(el => el === document.activeElement), 'Enter must copy and retain focus');
  await page.locator('h2').first().click();
  await page.keyboard.press('s');
  check((await page.locator('#src').textContent()).includes('```log {steps: 2 | 25-26}'), 'Source must preserve fence options');
  await page.keyboard.press('Escape');
  await page.evaluate(() => Deck.setView('read'));
  check(await log.locator('.ln.on').count() === 3, 'Article must mark the union of all line groups');
  check(await log.evaluate(el => el.scrollHeight <= el.clientHeight + 1), 'Article must expand the complete log');
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['clean', 'nord']) for (const mode of ['light', 'dark']) {
      await page.evaluate(({ theme, mode }) => { document.documentElement.dataset.theme = theme; document.documentElement.dataset.mode = mode; }, { theme, mode });
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Log must fit article at ' + width + 'px');
    }
  }
  await page.evaluate(() => { Deck.setView('present'); Deck.go(0, 0); });
  check(await log.locator('.ln.on').count() === 0, 'Returning to the initial stage must clear article highlights');
  return { log: true };
};
