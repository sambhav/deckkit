// Heading-led release notes. Keep validation independent of the DOM so malformed
// containers retain their ordinary Markdown and a useful diagnostic.
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function releaseHeading(text) {
  const match = text.trim().match(/^(.+?)\s*·\s*(\d{4}-\d{2}-\d{2})$/);
  if (!match || !match[1].trim()) throw new Error('use ### version · YYYY-MM-DD with a valid date.');
  if (!Number.isFinite(Date.parse(match[2] + 'T00:00:00Z')) || new Date(match[2] + 'T00:00:00Z').toISOString() !== match[2] + 'T00:00:00.000Z') throw new Error('use ### version · YYYY-MM-DD with a valid date.');
  return { version: match[1].trim(), date: match[2] };
}
export function changelogHTML(tokens, render, options = {}, classes = []) {
  if (Object.keys(options).length || classes.length) throw new Error('no options are supported.');
  const releases = [];
  let depth = 0;
  for (let i = 0; i < tokens.length;) {
    const token = tokens[i];
    if (token.type === 'td_container') depth += token.content ? 1 : -1;
    if (!depth && token.type === 'heading_open' && token.level === 0 && token.tag === 'h3') {
      releases.push({ ...releaseHeading(tokens[i + 1].content), body: [] }); i += 3;
    } else {
      if (!releases.length) throw new Error('start each release with ### version · YYYY-MM-DD.');
      releases.at(-1).body.push(token); i++;
    }
  }
  if (!releases.length) throw new Error('add at least one ### version · YYYY-MM-DD release.');
  return '<div class="w w-changelog">' + releases.map(({ version, date, body }) => {
    if (!body.length) throw new Error('each release needs release notes.');
    // Group labels are authored text; no category is assigned a fixed semantic colour.
    let nested = 0;
    for (let i = 0; i < body.length; i++) {
      if (body[i].type === 'td_container') nested += body[i].content ? 1 : -1;
      if (nested || body[i].type !== 'heading_open' || body[i].level !== 0) continue;
      if (body[i].tag !== 'h4' || !body[i + 1].content.trim()) throw new Error('use #### labels inside each release.');
      if (!body[i + 3] || body[i + 3].type === 'heading_open') throw new Error('each #### label needs release notes.');
    }
    const slug = version.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'release';
    return `<section class="w-release" data-release="${escape(slug)}"><h3><a class="w-release-link"><span class="w-release-version">${escape(version)}</span><time datetime="${date}">${date}</time><span class="w-release-anchor" aria-hidden="true">#</span></a></h3><div class="w-release-notes">${render(body)}</div></section>`;
  }).join('') + '</div>';
}
