// Runtime/platform, source access and responsive keycaps, without external requests.
module.exports = async function verifyKeyboardShortcuts(page, base) {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const source = 'id: keys\n---\n## Command palette\n\nPress [[Mod+Shift+P]] then [[Enter]].\n\nZoom with [[Ctrl+Plus]].\n\n[[Ctrl++P]]';
  await page.route('**/keyboard-shortcuts.html*', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html data-fonts="off" data-highlight="off"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + source + '</script></body></html>' }));
  await page.addInitScript(() => {
      const platform = new URL(location.href).searchParams.get('platform');
      Object.defineProperty(navigator, 'platform', { configurable: true, value: platform });
      Object.defineProperty(navigator, 'userAgentData', { configurable: true, value: undefined });
  });
  for (const platform of ['MacIntel', 'Win32', 'Linux x86_64']) {
    await page.goto(base + '/keyboard-shortcuts.html?view=present&platform=' + platform);
    await page.waitForFunction(() => window.Deck?.slides.length === 1);
    const chord = page.locator('.slide .w-kbd').first();
    const modifier = platform === 'MacIntel' ? 'Command' : 'Control';
    check(await chord.getAttribute('aria-label') === modifier + ' plus Shift plus P', 'Shortcut must expose resolved platform key names');
    check(await chord.locator('kbd').first().textContent() === (platform === 'MacIntel' ? '⌘' : 'Ctrl'), 'Mod must display the platform key');
    check(await page.locator('.slide .td-error').textContent().then(t => t.includes('[[Ctrl++P]]')), 'Invalid shortcut must keep its source in a visible diagnostic');
    await page.keyboard.press('s');
    check((await page.locator('#src code').textContent()).includes('[[Mod+Shift+P]]'), 'S must show the original shortcut source');
    await page.keyboard.press('Escape');
    for (const view of ['present', 'read']) {
      await page.evaluate(view => Deck.setView(view), view);
      for (const theme of ['clean', 'rose']) for (const mode of ['light', 'dark']) {
        await page.evaluate(({ theme, mode }) => { document.documentElement.dataset.theme = theme; document.documentElement.dataset.mode = mode; }, { theme, mode });
        await page.setViewportSize({ width: 320, height: 740 });
        check(await chord.isVisible(), 'Shortcut must remain readable in both views');
        check(await chord.evaluate(el => { const b = el.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth + 1; }), 'Phone keycaps must fit the text column');
      }
    }
  }
  return { platforms: 3, source: true, views: 2, themes: 2, modes: 2, phone: true };
};
