// ::: venn — two or three ### set headings, then "- A & B: label" list items for each overlap (or "- A: label" for one set alone).
const escape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// circle centres and region label anchors (percent of a 400 x 320 box), keyed by the sets in the region
const SHAPES = {
  2: { r: 30, circles: [[36, 50], [64, 50]], spots: { 0: [20, 50], 1: [80, 50], '0,1': [50, 50] } },
  3: { r: 25, circles: [[37.5, 37.5], [62.5, 37.5], [50, 64]], spots: { 0: [26, 30], 1: [74, 30], 2: [50, 83], '0,1': [50, 22], '0,2': [38, 54], '1,2': [62, 54], '0,1,2': [50, 44] } },
};
export function venn(tokens, options, classes) {
  const fail = message => { throw new Error('Venn: ' + message); };
  if (classes.length || Object.keys(options).length) fail('it takes no options.');
  const names = [];
  let i = 0;
  while (tokens[i]?.type === 'heading_open' && tokens[i].tag === 'h3') {
    const name = tokens[i + 1]?.content.trim();
    if (!name || name.includes('&')) fail('each ### heading needs a set name without "&".');
    if (names.some(n => n.toLowerCase() === name.toLowerCase())) fail(`the set "${name}" appears twice.`);
    names.push(name); i += 3;
  }
  if (names.length < 2 || names.length > 3) fail('start with two or three ### set headings.');
  const regions = new Map();
  while (i < tokens.length) {
    if (tokens[i].type !== 'bullet_list_open') fail('after the headings, use a list of "A & B: label" lines.');
    i++;
    while (tokens[i]?.type !== 'bullet_list_close') {
      const item = tokens.slice(i, i + 5);
      if (item.map(t => t.type).join(',') !== 'list_item_open,paragraph_open,inline,paragraph_close,list_item_close') fail('regions must be single-line list items: A & B: label.');
      const m = item[2].content.match(/^(.+?)\s*:\s+(.+)$/);
      if (!m) fail('each region needs "A & B: label".');
      const ids = m[1].split('&').map(s => names.findIndex(n => n.toLowerCase() === s.trim().toLowerCase()));
      if (ids.includes(-1)) fail(`"${m[1].trim()}" names a set that has no ### heading.`);
      const key = [...new Set(ids)].sort().join(',');
      if (new Set(ids).size !== ids.length) fail(`"${m[1].trim()}" repeats a set.`);
      if (regions.has(key)) fail(`the region "${m[1].trim()}" is listed twice.`);
      regions.set(key, { ids: key.split(',').map(Number), text: m[2].trim(), html: escape(m[2].trim()) });
      i += 5;
    }
    i++;
  }
  const shape = SHAPES[names.length];
  const circles = shape.circles.map(([x, y], n) => `<span class="w-venn-circle c${n}" style="left:${x - shape.r}%;top:${y - shape.r * 1.25}%;width:${shape.r * 2}%;height:${shape.r * 2.5}%"></span>`).join('');
  // each set's own name sits in its exclusive region; a single-set item adds its text beneath the name
  const labels = [];
  names.forEach((n, k) => {
    const own = regions.get(String(k));
    labels.push({ spot: shape.spots[k], html: `<b>${escape(n)}</b>` + (own ? `<span>${own.html}</span>` : ''), own: !!own, ids: [k] });
  });
  for (const [key, r] of regions) if (r.ids.length > 1) labels.push({ spot: shape.spots[key], html: `<span>${r.html}</span>`, own: true, ids: r.ids });
  const stepped = labels.filter(l => l.own && (l.ids.length > 1 || l.html.includes('<span>')));
  const order = new Map(stepped.map((l, n) => [l, n + 1]));
  const spots = labels.map(l => `<div class="w-venn-label" style="left:${l.spot[0]}%;top:${l.spot[1]}%"${order.has(l) ? ` data-region="${order.get(l)}"` : ''}>${l.html}</div>`).join('');
  const list = [...regions.values()].map(r => `<li><strong>${r.ids.map(k => escape(names[k])).join(' &amp; ')}</strong>: ${r.html}</li>`).join('');
  return `<figure class="w w-venn" data-sets="${names.length}" data-regions="${stepped.length}" role="img" aria-label="${escape('Venn diagram of ' + names.join(', ') + [...regions.values()].map(r => '. ' + r.ids.map(k => names[k]).join(' and ') + ': ' + r.text).join(''))}"><div class="w-venn-plot" aria-hidden="true">${circles}${spots}</div><ul class="w-venn-list">${list || names.map(n => `<li>${escape(n)}</li>`).join('')}</ul></figure>`;
}
