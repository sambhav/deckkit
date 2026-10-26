// Development check: open the existing inline starter directly from disk with
// one classic script, one stylesheet, and the browser network disabled.
async function verifySingleFile(page, files, fs, os) {
  const dir = await fs.mkdtemp(os.tmpdir() + '/talkdown-single-file-');
  const errors = [], requests = [];
  const onError = e => errors.push(e.message);
  const onRequest = r => requests.push(r.url());
  page.on('pageerror', onError); page.on('request', onRequest);
  try {
    // Fonts are optional, and this test intentionally requests no web assets.
    const html = files.html.replace('<html lang="en"', '<html lang="en" data-fonts="off"').replaceAll('../deck.', 'deck.');
    await Promise.all([
      fs.writeFile(dir + '/index.html', html),
      fs.writeFile(dir + '/deck.js', files.js),
      fs.writeFile(dir + '/deck.css', files.css),
    ]);
    await page.context().setOffline(true);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('file://' + dir + '/index.html?view=present');
    await page.waitForFunction(() => window.Deck?.slides.length === 5);
    await page.keyboard.press('ArrowRight');
    if (await page.evaluate(() => Deck.cur) !== 1) throw new Error('Inline deck navigation failed');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    if (await page.locator('.w-tabs button.on').textContent() !== 'Option B') throw new Error('Inline deck widgets failed');
    await page.keyboard.press('r');
    if (await page.evaluate(() => document.documentElement.dataset.view) !== 'read') throw new Error('Inline deck read view failed');
    if (await page.locator('.frame > .prose').count() !== 3) throw new Error('Inline deck notes failed');
    if (await page.locator('#stage').evaluate(e => getComputedStyle(e).position) !== 'static') throw new Error('Linked CSS did not load');
    const csvSlide = '\n---\n## CSV stays inside the HTML\n::: chart type=line view=both\n```csv\nLabel,Value\n"A, B",1\nC,2\n```\n:::\n';
    await fs.writeFile(dir + '/csv.html', html.replace(/<\/script>\s*<\/body>/, csvSlide + '</script></body>'));
    await page.goto('file://' + dir + '/csv.html?view=present#6');
    await page.waitForFunction(() => window.Deck?.slides.length === 6);
    if (await page.locator('.slide.active .w-chart-box tbody tr').count() !== 2) throw new Error('Embedded CSV must load offline');
    if (await page.locator('.slide.active .w-chart-table th[scope=row]').first().textContent() !== 'A, B') throw new Error('Embedded CSV quoted labels failed');
    if (errors.length) throw new Error(errors.join('\n'));
    if (requests.some(url => !url.startsWith('file:'))) throw new Error('Unexpected remote dependency: ' + requests.join(', '));
    return { protocol: 'file:', starterSlides: 5, csvSlides: 6, scripts: 1, stylesheets: 1, network: 'offline', errors };
  } finally {
    await page.context().setOffline(false);
    page.off('pageerror', onError); page.off('request', onRequest);
    await fs.rm(dir, { recursive: true, force: true });
  }
}
module.exports = verifySingleFile;
if (require.main === module) {
  (async () => {
    const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
    const { chromium } = require('playwright-core');
    const root = path.join(__dirname, '..');
    const files = {
      html: await fs.readFile(path.join(root, 'examples/starter.html'), 'utf8'),
      js: await fs.readFile(path.join(root, 'deck.js'), 'utf8'),
      css: await fs.readFile(path.join(root, 'deck.css'), 'utf8'),
    };
    const browser = await chromium.launch({ channel: 'chrome' });
    try { console.log(await verifySingleFile(await browser.newPage(), files, fs, os)); }
    finally { await browser.close(); }
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
