const { buildSync } = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');
const notices = ['markdown-it', 'papaparse', 'mdurl', 'uc.micro', 'linkify-it', 'punycode.js', 'entities'].map(name => {
  let dir = path.dirname(require.resolve(name));
  while (!fs.existsSync(path.join(dir, 'package.json')) || JSON.parse(fs.readFileSync(path.join(dir, 'package.json'))).name !== name) {
    const parent = path.dirname(dir); if (parent === dir) throw new Error('Cannot locate license for ' + name); dir = parent;
  }
  const license = fs.readdirSync(dir).find(file => /^licen[sc]e(?:-MIT)?(?:\.txt|\.md)?$/i.test(file));
  if (!license) throw new Error('Missing license for ' + name);
  return '/* ' + name + '\n' + fs.readFileSync(path.join(dir, license), 'utf8').replace(/\*\//g, '* /') + '\n*/';
}).join('\n');
// Authors use the committed deck.js directly. This build is for maintainers.
buildSync({
  entryPoints: ['src/deck.js'], outfile: 'deck.js', bundle: true,
  platform: 'browser', format: 'iife', target: 'es2022', minify: true,
  legalComments: 'inline', charset: 'utf8',
  banner: { js: '/* talkdown 0.2 — bundled runtime; edit src/deck.js, then npm run build. */\n' + notices },
});
