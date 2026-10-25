const { buildSync } = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const notices = ['markdown-it', 'mdurl', 'uc.micro', 'punycode.js'].map(name => {
  let dir = path.dirname(require.resolve(name));
  while (!fs.existsSync(path.join(dir, 'package.json')) || JSON.parse(fs.readFileSync(path.join(dir, 'package.json'))).name !== name) {
    const parent = path.dirname(dir); if (parent === dir) throw new Error('Cannot locate license for ' + name); dir = parent;
  }
  const license = fs.readdirSync(dir).find(file => /^licen[sc]e(?:-MIT)?(?:\.txt|\.md)?$/i.test(file));
  if (!license) throw new Error('Missing license for ' + name);
  return '/* ' + name + '\n' + fs.readFileSync(path.join(dir, license), 'utf8').replace(/\*\//g, '* /') + '\n*/';
}).join('\n');
// Authors link the committed deck.js and deck.css directly; only deck.js is built.
buildSync({
  entryPoints: ['src/deck.js'], outfile: 'deck.js', bundle: true,
  // Smaller stand-ins: linkify is off (about 11KB), and the browser decodes entities itself (about 22KB).
  alias: { 'linkify-it': './scripts/linkify-stub.js', entities: './scripts/entities-stub.js' },
  platform: 'browser', format: 'iife', target: 'es2022', minify: true,
  legalComments: 'inline', charset: 'utf8',
  banner: { js: '/* talkdown 0.2 — bundled runtime; edit src/deck.js, then npm run build. */\n' + notices },
});

// Old content-hashed assets stay available for cached manifests and pinned decks.
fs.mkdirSync('dist', { recursive: true });
const release = { schema: 1 };
for (const type of ['js', 'css']) {
  const bytes = fs.readFileSync('deck.' + type);
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  const file = 'dist/deck.' + hash + '.' + type;
  fs.writeFileSync(file, bytes);
  release[type] = { path: file, integrity: 'sha256-' + createHash('sha256').update(bytes).digest('base64') };
}
fs.writeFileSync('latest.json', JSON.stringify(release, null, 2) + '\n');

