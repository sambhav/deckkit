// The stable loader must find a new release without changing a consuming page.
async function verifyLatest(page, base) {
  const check = (value, message) => { if (!value) throw new Error(message); };
  const loader = base + '/latest.js';
  const html = '<!doctype html><html data-fonts="off"><head><meta name="viewport" content="width=device-width, initial-scale=1"><script src="' + loader + '"></script></head><body><script type="text/markdown">## First</script><section class="slide flow" data-id="custom"><div class="content"><h2>Custom</h2><div id="customStep"></div></div></section><script>Talkdown.onReady(Deck => { window.setupCalls = (window.setupCalls || 0) + 1; Deck.steps(document.getElementById("customStep"), 3, i => document.getElementById("customStep").textContent = i); });</script></body></html>';
  await page.route('**/latest-test.html*', r => r.fulfill({ contentType: 'text/html', body: html }));
  await page.goto(base + '/latest-test.html?view=present#custom');
  await page.waitForFunction(() => window.Deck?.slides.length === 2);
  check(await page.evaluate(() => window.setupCalls) === 1, 'Author setup must run exactly once');
  await page.keyboard.press('ArrowDown');
  check(await page.locator('#customStep').textContent() === '1', 'Author steppers must join navigation before startup');
  check(await page.locator('script[src*="/dist/deck."]').count() === 1, 'The loader must request a content-hashed script');
  check(await page.locator('link[rel=stylesheet][href*="/dist/deck."]').count() === 1, 'The loader must request content-hashed CSS');
  check(await page.evaluate(() => {
    const css = document.querySelector('link[href*="/dist/deck."]');
    const loader = document.querySelector('script[src$="/latest.js"]');
    return !!(css.compareDocumentPosition(loader) & Node.DOCUMENT_POSITION_FOLLOWING);
  }), 'Runtime CSS must remain before the author stylesheet position');

  const releases = await page.evaluate(async () => {
    const asset = async (source, extension) => {
      const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source)));
      const hex = [...hash].map(b => b.toString(16).padStart(2, '0')).join('');
      const integrity = 'sha256-' + btoa(String.fromCharCode(...hash));
      return { path: 'dist/deck.' + hex.slice(0, 16) + '.' + extension, integrity, source };
    };
    return await Promise.all(['A', 'B'].map(async version => ({ schema: 1,
      js: await asset('window.Deck = {release:"' + version + '"}; document.dispatchEvent(new CustomEvent("talkdown:setup", {detail: window.Deck}));', 'js'),
      css: await asset(':root { --loader-test: ' + version + '; }', 'css'),
    })));
  });
  let current = 0, failed = false;
  const checks = [];
  await page.route('**/latest.json*', r => {
    checks.push(r.request().url());
    const release = releases[current];
    return r.fulfill({ status: failed ? 503 : 200, contentType: 'application/json', body: JSON.stringify({ schema: 1, js: { path: release.js.path, integrity: release.js.integrity }, css: { path: release.css.path, integrity: release.css.integrity } }) });
  });
  await page.route('**/dist/deck.*', r => {
    for (const release of releases) for (const type of ['js', 'css']) {
      if (r.request().url().endsWith('/' + release[type].path)) return r.fulfill({ contentType: type === 'js' ? 'text/javascript' : 'text/css', body: release[type].source });
    }
    return r.fallback();
  });
  await page.route('**/latest-cache.html*', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><script src="' + loader + '"></script></head><body></body></html>' }));
  await page.goto(base + '/latest-cache.html');
  await page.waitForFunction(() => window.Deck?.release === 'A');
  check(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--loader-test').trim()) === 'A', 'First release must have matching CSS');
  current = 1;
  await page.reload();
  await page.waitForFunction(() => window.Deck?.release === 'B');
  check(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--loader-test').trim()) === 'B', 'A new visit must load the new matched pair');
  check(checks.length === 2 && checks[0] !== checks[1], 'Each visit must bypass stale manifest caches without editing the page');
  failed = true;
  await page.reload();
  await page.getByRole('alert').waitFor();
  check(await page.evaluate(() => !window.Deck), 'A failed release check must not silently fall back to stale runtime code');
  return { releases: 2, uniqueManifestRequests: checks.length, customSetup: 'passed', failureDiagnostic: 'passed' };
}
module.exports = verifyLatest;
