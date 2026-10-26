const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright-core');
const verify = require('./browser.cjs');
const verifySingleFile = require('./single-file.cjs');
function createStaticServer() {
  const root = path.resolve(__dirname, '..');
  return http.createServer(async (request, response) => {
    try {
      const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = path.resolve(root, '.' + (relative.endsWith('/') ? relative + 'index.html' : relative));
      if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
      const type = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream';
      const body = await fs.readFile(file);
      response.writeHead(200, { 'Content-Type': type }).end(body);
    } catch { response.writeHead(404).end(); }
  });
}
module.exports = createStaticServer;
if (require.main === module) (async () => {
  const server = createStaticServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const root = path.resolve(__dirname, '..');
  const read = file => fs.readFile(path.join(root, file), 'utf8');
  const files = { html: await read('examples/starter.html'), js: await read('deck.js'), css: await read('deck.css') };
  let browser;
  try {
    // The installed Google Chrome (preinstalled on GitHub runners), so no browser download.
    browser = await chromium.launch({ channel: 'chrome' });
    // Each newPage() has its own context, so the single-file check can go offline alone.
    const [served, singleFile] = await Promise.all([
      verify(await browser.newPage(), 'http://127.0.0.1:' + server.address().port),
      verifySingleFile(await browser.newPage(), files, fs, require('node:os')),
    ]);
    console.log({ ...served, singleFile });
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
