const assert = require('node:assert/strict');
module.exports = async function verifyCite(page, base) {
  const source = ['id: first', '---', '## Intro', '::: cite', ':::', '---', 'id: shown', '---', '## Shown', '::: cite present title="A [b] post" author="Ada Lovelace and Alan Turing" date=2026-10-26 url="https://example.com/post"', ':::'].join('\n');
  await page.route('**/cite-fixture.html*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body:
    '<!doctype html><html data-fonts="off" data-icons="off" data-highlight="off"><head><meta charset="utf-8"><title>Page title</title><meta name="author" content="Grace Hopper"><meta name="date" content="2026-01-02"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + source + '</script></body></html>' }));
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(base).origin }).catch(() => {});
  await page.goto(base + '/cite-fixture.html?view=present');
  await page.waitForFunction(() => window.Deck?.slides.length === 2);
  const boxes = page.locator('.w-cite');
  assert.equal(await boxes.nth(0).isVisible(), false, 'hidden on the stage by default');
  await page.evaluate(() => Deck.setView('read'));
  assert.equal(await boxes.nth(0).isVisible(), true);
  assert.equal(await boxes.nth(0).locator('.w-cite-text').textContent(), 'Grace Hopper (2026-01-02). Page title.');
  assert.equal(await boxes.nth(0).locator('.w-cite-link').getAttribute('href'), base + '/cite-fixture.html', 'view parameter is not part of the permalink');
  await page.evaluate(() => Deck.setView('present'));
  await page.evaluate(() => Deck.go(1));
  const shown = boxes.nth(1);
  assert.equal(await shown.isVisible(), true, 'the present flag keeps it on the stage');
  await shown.getByRole('button', { name: 'Copy BibTeX' }).focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('.w-cite-status')[1].textContent === 'Copied BibTeX');
  assert.equal(await page.evaluate(() => Deck.cur), 1, 'activating a button does not advance the slide');
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), '@online{lovelace2026a,\n  title = {A [b] post},\n  author = {Ada Lovelace and Alan Turing},\n  year = {2026},\n  month = oct,\n  url = {https://example.com/post},\n}');
  await shown.getByRole('button', { name: 'Copy Markdown' }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), '[A \\[b\\] post](https://example.com/post)');
  await page.keyboard.press('s');
  assert.match(await page.locator('#src').textContent(), /::: cite present/);
  await page.keyboard.press('Escape');
};
