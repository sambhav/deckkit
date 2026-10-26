// Normalized 2×2 matrix. Heading order: top-left, top-right, bottom-left, bottom-right.
const escape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function quadrant(tokens, options, classes) {
  const fail = message => { throw new Error('Quadrant: ' + message); };
  if (classes.length || Object.keys(options).some(k => !['x', 'y'].includes(k))) fail('use only x="Axis" and y="Axis" options.');
  const heads = [], points = [];
  let i = 0;
  while (tokens[i]?.type === 'heading_open' && tokens[i].tag === 'h3') {
    const label = tokens[i + 1]?.content.trim();
    if (!label) fail('each ### quadrant heading needs a label.');
    heads.push(label); i += 3;
  }
  if (heads.length !== 4) fail('start with four ### headings: top-left, top-right, bottom-left, bottom-right.');
  while (i < tokens.length) {
    if (!['bullet_list_open', 'ordered_list_open'].includes(tokens[i].type)) fail('after the four headings, use a list of Label [x, y] points.');
    const close = tokens[i++].type.replace('_open', '_close');
    while (tokens[i]?.type !== close) {
      const item = tokens.slice(i, i + 5);
      if (item.map(t => t.type).join(',') !== 'list_item_open,paragraph_open,inline,paragraph_close,list_item_close') fail('points must be single-line list items: Label [x, y].');
      const m = item[2].content.match(/^(.+?)\s+\[\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*\]\s*$/);
      if (!m || !m[1].trim() || [m[2], m[3]].some(n => !Number.isFinite(+n) || +n < 0 || +n > 1)) fail('each point needs Label [x, y] with coordinates from 0 to 1.');
      const x = +m[2], y = +m[3];
      points.push({ label: m[1].trim(), x, y, group: (y >= .5 ? 0 : 2) + (x >= .5 ? 1 : 0) }); i += 5;
    }
    i++;
  }
  const x = options.x || 'X', y = options.y || 'Y';
  const cells = heads.map((h, n) => `<div class="w-quadrant-cell" data-group="${n}"><strong>${escape(h)}</strong></div>`).join('');
  const dots = points.map((p, n) => `<span class="w-quadrant-point" data-point="${n}" style="left:${4 + p.x * 92}%;top:${92 - p.y * 84}%" aria-label="${escape(p.label + ': ' + p.x + ', ' + p.y)}">${n + 1}</span>`).join('');
  const groupList = heads.map((h, n) => `<section><h4>${escape(h)}</h4><ul>${points.flatMap((p, j) => p.group === n ? [`<li>${j + 1}. ${escape(p.label)} [${p.x}, ${p.y}]</li>`] : []).join('') || '<li>No points</li>'}</ul></section>`).join('');
  return `<figure class="w w-quadrant${points.length ? ' has-points' : ''}" aria-label="${escape(y + ' versus ' + x)}"><div class="w-quadrant-y">${escape(y)} ↑</div><div class="w-quadrant-plot"><div class="w-quadrant-grid">${cells}</div>${dots}</div><div class="w-quadrant-x">${escape(x)} →</div><ol class="w-quadrant-key">${points.map((p, n) => `<li data-point="${n}">${escape(p.label)} <span>[${p.x}, ${p.y}]</span></li>`).join('')}</ol><div class="w-quadrant-groups">${groupList}</div></figure>`;
}
