// Keep coordinates in percentages of the image, never of the slide or its caption.
export function hotspotMarkup(tokens, options, classes, { inline, escape }) {
  if (Object.keys(options).length || classes.length) throw new Error('no options are supported.');
  const image = tokens[1]?.children?.[0];
  if (tokens[0]?.type !== 'paragraph_open' || tokens[0].tag !== 'figure' || image?.type !== 'image' || tokens[2]?.type !== 'paragraph_close' || tokens[1].children.some(t => t !== image && t.type !== 'html_inline')) {
    throw new Error('start with one Markdown image, followed by a bulleted list.');
  }
  const renderedImage = inline([image]);
  if (!renderedImage.startsWith('<img ')) throw new Error('use an image, not a video or recording.');
  const list = tokens.slice(3);
  if (list[0]?.type !== 'bullet_list_open' || list.at(-1)?.type !== 'bullet_list_close') throw new Error('add a bulleted list of [x%, y%] labels.');
  const items = [];
  for (let i = 1; i < list.length - 1; i += 5) {
    if (list.slice(i, i + 5).map(t => t.type).join(',') !== 'list_item_open,paragraph_open,inline,paragraph_close,list_item_close') throw new Error('each pin needs one paragraph: - [x%, y%] Label.');
    const children = list[i + 2].children;
    const match = children[0]?.type === 'text' && children[0].content.match(/^\[\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\s*\]\s+/);
    if (!match || +match[1] > 100 || +match[2] > 100) throw new Error('coordinates must be percentages from 0% to 100%: - [12%, 30%] Label.');
    const label = [{ ...children[0], content: children[0].content.slice(match[0].length) }, ...children.slice(1)];
    if (label.some(t => ['html_inline', 'image', 'softbreak', 'hardbreak'].includes(t.type)) || !label.some(t => t.content.trim())) throw new Error('each pin needs a text label; inline formatting and links are supported.');
    items.push({ x: +match[1], y: +match[2], label: inline(label), text: label.map(t => t.content).join('') });
  }
  if (!items.length) throw new Error('add at least one [x%, y%] label.');
  const caption = image.attrGet('title');
  return `<figure class="w w-hotspots"><div class="w-hotspots-image">${renderedImage}${items.map((p, i) => `<button type="button" class="w-hotspot-pin" style="left:${p.x}%;top:${p.y}%" aria-label="${escape(`${i + 1}. ${p.text}`)}" aria-pressed="false">${i + 1}</button>`).join('')}</div>${caption ? `<figcaption>${escape(caption)}</figcaption>` : ''}<ol class="w-hotspots-legend">${items.map((p, i) => `<li value="${i + 1}">${p.label}</li>`).join('')}</ol></figure>`;
}
