module.exports = async function verifyEndpoint(page, base) {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const fixture = ['id: endpoint', '---', '## Endpoint', '::: endpoint GET /v1/users/{id}', 'Returns **one** user.', '| Param | Type | Notes |', '|---|---|---|', '| id | int | path |', ':::', '---', '## Repeated endpoint', '::: endpoint GET /v1/users/{id}', 'Another reference.', ':::', '---', '## Invalid endpoint', '::: endpoint get /users', 'Fallback description.', ':::'].join('\n');
  await page.route('**/endpoint-test.html*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html data-fonts="off" data-icons="off"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + fixture + '</script></body></html>' }));
  await page.goto(base + '/endpoint-test.html?view=present');
  await page.waitForFunction(() => window.Deck?.slides.length === 3);
  const endpoint = page.locator('.w-endpoint').first(), link = endpoint.locator('.w-endpoint-path');
  check(await endpoint.locator('.w-endpoint-method').textContent() === 'GET', 'Method badge is visible');
  check(await endpoint.locator('.w-endpoint-param').textContent() === '{id}', 'Path parameters are highlighted');
  check(await endpoint.locator('table').isVisible(), 'Present view exposes the complete parameter table');
  await page.keyboard.press('ArrowDown');
  check(await page.evaluate(() => Deck.cur) === 1, 'Static endpoint adds no hidden steps');
  await page.evaluate(() => Deck.go(0));
  await page.keyboard.press('s');
  check(await page.locator('#src').textContent().then(s => s.includes('::: endpoint GET /v1/users/{id}') && s.includes('| id | int | path |')), 'S retains the complete authored source');
  await page.keyboard.press('Escape');
  check(await page.locator('.td-error').textContent().then(s => s.includes('endpoint:')), 'Invalid endpoint fails visibly');
  check(await page.locator('.slide').nth(2).textContent().then(s => s.includes('Fallback description.')), 'Invalid endpoint preserves content');
  const ids = await page.locator('.w-endpoint-path').evaluateAll(links => links.map(a => a.getAttribute('href')));
  check(new Set(ids).size === 2 && ids[0] === '#endpoint', 'Permalinks reuse authored IDs and allocate unique slide destinations');
  for (const theme of ['clean', 'paper']) for (const mode of ['light', 'dark']) for (const width of [1440, 320, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(({theme, mode}) => { document.documentElement.dataset.theme = theme; document.documentElement.dataset.mode = mode; Deck.setView('read'); Deck.go(0); }, {theme, mode});
    check(await endpoint.locator('strong').first().isVisible() && await endpoint.locator('table').isVisible(), 'Article exposes description and params without interaction');
    check(await endpoint.evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1; }), 'Endpoint fits article width');
    await link.focus();
    check(await link.evaluate(el => el === document.activeElement), 'Permalink supports keyboard focus');
  }
  await link.click();
  check(await page.evaluate(() => Deck.cur) === 0, 'Article permalink navigates through the deck');
  // Opening a copied destination must select the owning slide in either view.
  for (const view of ['read', 'present']) for (let i = 0; i < ids.length; i++) {
    await page.goto(base + '/endpoint-test.html?view=' + view + ids[i]);
    await page.evaluate(() => Talkdown.ready.then(() => {}));
    check(await page.evaluate(() => Deck.cur) === i, 'Copied endpoint permalink survives reload in ' + view);
    check(await page.locator('.w-endpoint').nth(i).isVisible(), 'Linked endpoint is visible');
  }
};
