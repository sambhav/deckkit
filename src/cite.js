// ::: cite: a share / cite box. The container validates its few options; the runtime fills the rest from the page
// (<title>, <meta name="author">, <meta name="date">, canonical link) and builds the copyable formats from them.
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
}
export function validUrl(value) {
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password && !/[\s\u0000-\u001f\u007f]/.test(value); }
  catch { return false; }
}

export function citeHTML(body, options, classes, render) {
  const fail = message => `<p class="td-error" role="alert">cite: ${escape(message)}</p>` + render(body);
  const bad = Object.keys(options).find(k => !['title', 'author', 'date', 'url'].includes(k));
  if (bad) return fail(`unknown option "${bad}"; use title, author, date and url, plus the present flag.`);
  const flag = classes.find(c => c !== 'present');
  if (flag) return fail(`unknown flag "${flag}"; the only flag is present.`);
  if (body.length) return fail('leave the block empty; set title, author, date or url as options.');
  if (Object.values(options).some(v => !v.trim())) return fail('options cannot be empty.');
  if (options.date && !validDate(options.date)) return fail('date must be a real YYYY-MM-DD date.');
  if (options.url && !validUrl(options.url)) return fail('url must be an absolute HTTP(S) URL without credentials or whitespace.');
  const data = Object.entries(options).map(([k, v]) => ` data-${k}="${escape(v)}"`).join('');
  const line = [options.author, options.title && `"${options.title}"`, options.date, options.url].filter(Boolean).join('. ');
  return `<div class="w w-cite${classes.length ? ' w-cite-present' : ''}"${data}><p class="w-cite-fallback">${escape(line || 'Cite this page')}</p></div>`;
}

// Everything the box offers to copy, from { title, author, date, url }.
const mdText = s => s.replace(/([\\[\]])/g, '\\$1');
const bib = s => s.replace(/\\/g, '\\textbackslash{}').replace(/([{}&%$#_])/g, '\\$1');
export function citeFormats({ title, author = '', date = '', url }) {
  const [year, month] = date.split('-');
  const surname = author.split(/\s+and\s+/)[0].trim().split(/\s+/).pop() || '';
  const key = (surname + (year || '') + (title.split(/\s+/)[0] || '')).normalize('NFD').replace(/[^A-Za-z0-9]/g, '').toLowerCase() || 'talkdown';
  const fields = [['title', bib(title)], author && ['author', bib(author)], year && ['year', year], month && ['month', null, MONTHS[month - 1]], ['url', url]].filter(Boolean)
    .map(([k, v, macro]) => `  ${k} = ${macro || '{' + v + '}'},`);
  return {
    link: url,
    markdown: `[${mdText(title)}](${url})`,
    bibtex: `@online{${key},\n${fields.join('\n')}\n}`,
    text: [author, date && `(${date})`].filter(Boolean).join(' ') + (author || date ? '. ' : '') + title + '.',
  };
}
