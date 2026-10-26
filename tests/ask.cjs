const assert = require('node:assert/strict');
module.exports = async function verifyAsk(page, base) {
  const url = 'https://example.com/questions?topic=Q%26A&from=talk';
  const source = ['id: questions', 'layout: center', '---', '## Questions?', '::: ask url="' + url + '"', ':::', '---', '## Invalid', '::: ask url="javascript:alert(1)"', 'Keep this feedback.', ':::'].join('\n');
  await page.route('**/ask-fixture.html*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body:
    '<!doctype html><html data-fonts="off" data-icons="off" data-highlight="off"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + source + '</script></body></html>' }));
  let mode = 'success', requests = 0;
  await page.route('**/qrcode-generator@*/**', route => {
    requests++;
    if (mode === 'blocked') return route.abort();
    return route.fulfill({ contentType: 'application/javascript', body: mode === 'throw'
      ? 'window.qrcode=()=>{throw new Error("QR capacity exceeded")}'
      : 'window.qrcode=()=>({addData(url){window.qrDestination=url},make(){},createSvgTag(){return \'<svg viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>\'}})' });
  });
  const open = async () => {
    await page.goto(base + '/ask-fixture.html?view=present');
    await page.waitForFunction(() => window.Deck?.slides.length === 2);
  };
  await open();
  const ask = page.locator('.w-ask');
  await ask.locator('svg').waitFor();
  assert.equal(await page.evaluate(() => window.qrDestination), url);
  assert.equal(await ask.locator('a').getAttribute('href'), url);
  assert.equal(requests, 1, 'one existing lazy QR library serves the component');
  assert.equal(await ask.locator('.w-qr-code').getAttribute('aria-hidden'), 'true');
  await ask.getByRole('link', { name: 'Ask a question', exact: true }).focus();
  assert.equal(await ask.locator('a').evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
  await ask.locator('a').evaluate(a => a.addEventListener('click', e => { e.preventDefault(); window.askActivated = true; }, { once: true }));
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => window.askActivated), true, 'Enter activates the native destination link');
  assert.equal(await page.evaluate(() => Deck.cur), 0, 'link activation does not advance the slide');
  await page.keyboard.press('s');
  assert.match(await page.locator('#src').textContent(), /::: ask url=/);
  await page.keyboard.press('Escape');
  for (const theme of ['clean', 'paper', 'synth']) {
    for (const mode of ['light', 'dark']) {
      await page.evaluate(([theme, mode]) => { document.documentElement.dataset.theme = theme; document.documentElement.dataset.mode = mode; }, [theme, mode]);
      for (const view of ['present', 'read']) {
        await page.evaluate(view => Deck.setView(view), view);
        for (const width of [320, 390, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          assert.equal(await ask.locator('a').isVisible(), true, `${theme}/${mode}/${view}/${width}: destination visible`);
          assert.equal(await ask.locator('.w-qr-code').isVisible(), view === 'present');
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no phone overflow');
        }
      }
    }
  }
  assert.equal(await ask.locator('a').innerText(), 'Ask a question', 'article shows a plain named link');
  assert.match(await page.locator('.td-error').innerText(), /ask:/);
  assert.match(await page.locator('#stage').textContent(), /Keep this feedback/);
  for (const fallback of ['blocked', 'throw']) {
    mode = fallback;
    await open();
    if (fallback === 'throw') await page.waitForFunction(() => document.querySelector('.w-ask')?.dataset.qr === 'unavailable');
    assert.equal(await ask.locator('a').getAttribute('href'), url, 'fallback keeps the usable destination');
    assert.equal(await ask.getByRole('link', { name: 'Ask a question', exact: true }).isVisible(), true);
    assert.equal(await ask.locator('svg').count(), 0);
  }
};
