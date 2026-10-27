// Byline frontmatter: author, date, tags, reading time and head meta.
module.exports = async function verifyByline(page, base) {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const fixture = ['layout: title', 'author: Ada <b>Lovelace</b>', 'date: 2026-10-25', 'tags: [edge, caching]', '---', '# Why we moved', '', '::: notes', 'Some prose for the article.', ':::', '---', 'date: soon', '---', '## Bad date'].join('\n');
  await page.route('**/byline-test.html*', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html data-fonts="off" data-icons="off"><head><title>Why</title><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="deck.css"><script src="deck.js"></script></head><body><script type="text/markdown">' + fixture + '</script></body></html>' }));
  await page.goto(base + '/byline-test.html?view=read');
  await page.waitForFunction(() => window.Deck?.slides.length === 2);
  const by = page.locator('.byline').first();
  check(await by.locator('.by b').textContent() === 'Ada <b>Lovelace</b>', 'Author is escaped text');
  check(await by.locator('time').getAttribute('datetime') === '2026-10-25', 'Date keeps ISO value');
  check(/October 25, 2026/.test(await by.locator('time').textContent()), 'Date is human readable');
  check(/^\d+ min read$/.test(await by.locator('.rt').textContent()), 'Reading time is filled in');
  check(await by.locator('.tag').count() === 2, 'Two tags');
  check(await page.evaluate(() => document.querySelector('h1').nextElementSibling.classList.contains('byline')), 'Byline sits under the title');
  check(await page.locator('meta[property="article:published_time"]').getAttribute('content') === '2026-10-25', 'Published time meta');
  check(await page.locator('meta[property="article:tag"]').count() === 2, 'Tag meta');
  check(await page.locator('meta[name=author]').getAttribute('content') === 'Ada <b>Lovelace</b>', 'Author meta');
  check(await page.locator('.td-error').count() === 1, 'A bad date fails visibly');
};
