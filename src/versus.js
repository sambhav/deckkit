// ::: versus — 2-4 heading-led outputs side by side, an optional leading > prompt quote and a closing ### Verdict.
const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function versus(tokens, options, classes, render) {
  const fail = message => `<p class="td-error" role="alert">versus: ${escape(message)}</p>${render(tokens)}`;
  if (classes.length || Object.keys(options).length) return fail('takes no options.');
  const heads = []; let containers = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'td_container') containers += token.content ? 1 : -1;
    if (!containers && token.type === 'heading_open' && token.tag === 'h3' && token.level === 0) heads.push(i);
  }
  const lead = tokens.slice(0, heads[0] ?? 0);
  const quote = lead.length && lead[0].type === 'blockquote_open' && lead.at(-1).type === 'blockquote_close' && lead.findIndex(t => t.type === 'blockquote_close' && t.level === 0) === lead.length - 1;
  if (!heads.length || lead.length && !quote) return fail('start with an optional > prompt quote, then a ### heading per model.');
  const sections = heads.map((start, k) => ({ title: tokens[start + 1]?.content.trim(), body: tokens.slice(start + 3, heads[k + 1] ?? tokens.length) }));
  const verdict = /^verdict$/i.test(sections.at(-1).title) ? sections.pop() : null;
  if (sections.length < 2 || sections.length > 4) return fail('use 2 to 4 model headings, plus an optional final ### Verdict.');
  if (sections.some(s => !s.title || !s.body.length) || verdict && !verdict.body.length) return fail('every heading needs a title and content.');
  const column = s => `<section class="w-versus-col"><h3>${escape(s.title)}</h3>${render(s.body)}</section>`;
  return `<div class="w w-versus" style="--n:${sections.length}">${lead.length ? `<div class="w-versus-prompt">${render(lead)}</div>` : ''}<div class="w-versus-cols">${sections.map(column).join('')}</div>${verdict ? `<section class="w-versus-verdict"><h3>${escape(verdict.title)}</h3>${render(verdict.body)}</section>` : ''}</div>`;
}
