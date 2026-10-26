// Exercise authored data, keyboard/source access, layout and malformed fallback in a real browser.
module.exports = async function verifyLinkCards(page, base) {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const source = [
    'id: cards', '---', '## Further reading', '::: links',
    '- [**Talkdown**](https://github.com/sambhav/talkdown) Write `Markdown`.',
    '- [Next section](#next) Stay in this deck.', ':::',
    '---', 'id: next', '---', '## Next section',
    '---', '## Malformed', '::: links', '- Still readable without a link.', ':::',
  ].join('\n');
  const requests = [];
  page.on('request', r => { if (!r.url().startsWith(base)) requests.push(r.url()); });
  await page.route('**/link-cards.html*', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html data-fonts="off" data-highlight="off"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + source + '</script></body></html>' }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/link-cards.html?view=present');
  await page.waitForFunction(() => window.Deck?.slides.length === 3);
  const cards = page.locator('.w-links .w-link-card');
  check(await cards.count() === 2 && await cards.first().isVisible() && await cards.last().isVisible(), 'All cards must be visible when presenting');
  check(await cards.first().getAttribute('rel') === 'noopener' && await cards.first().getAttribute('target') === '_blank', 'External cards must use safe new tabs');
  check(await cards.first().locator('.w-link-domain').textContent() === 'github.com', 'Cards must display the destination domain');
  await cards.first().focus();
  check(await cards.first().evaluate(a => a === document.activeElement && getComputedStyle(a).outlineStyle !== 'none'), 'Card focus must be visible');
  await page.locator('#srcBtn').click();
  check((await page.locator('#src code').textContent()).includes('::: links\n- [**Talkdown**]'), 'Source must keep authored links intact');
  await page.keyboard.press('Escape');
  check(!(await page.locator('#src').evaluate(el => el.classList.contains('on'))), 'Escape must close the source overlay');
  await cards.last().click();
  check(await page.evaluate(() => Deck.cur) === 1, 'A #section card must use normal slide navigation');
  await page.evaluate(() => { Deck.go(0); Deck.setView('read'); });
  await page.setViewportSize({ width: 320, height: 740 });
  const positions = await cards.evaluateAll(all => all.map(a => { const b = a.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom }; }));
  check(positions[1].top >= positions[0].bottom && positions.every(b => b.left >= 0 && b.right <= 321), 'Phone article cards must stack without horizontal overflow');
  check(await page.locator('.td-error').textContent().then(t => t.startsWith('links:')), 'Malformed input must show a visible diagnostic');
  check(await page.locator('.slide').last().locator('li').textContent() === 'Still readable without a link.', 'Malformed input must retain its ordinary Markdown');
  check(requests.length === 0, 'Link cards must not fetch metadata or favicons: ' + requests.join(', '));
  return { cards: 2, source: true, keyboard: true, phone: true, metadataRequests: requests.length };
};
