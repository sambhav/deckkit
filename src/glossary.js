// Plain text definitions remain readable without the runtime. No HTML or network lookup.
export function parseGlossary(source) {
  const entries = [], seen = new Set();
  for (const line of source.split('\n').filter(line => line.trim())) {
    const match = line.match(/^([^:]+):\s*(.+)$/);
    if (!match || !match[1].trim() || !match[2].trim()) throw new Error('use one Term: Definition per line');
    const term = match[1].trim();
    if (seen.has(term)) throw new Error(`duplicate term "${term}"`);
    seen.add(term); entries.push([term, match[2].trim()]);
  }
  if (!entries.length) throw new Error('add at least one Term: Definition');
  return entries;
}

export function glossary(stage) {
  const blocks = [...stage.querySelectorAll('dl.w-glossary')];
  if (!blocks.length) return;
  const definitions = new Map();
  for (const block of blocks) {
    for (const term of block.querySelectorAll('dt')) {
      const definition = term.nextElementSibling.textContent;
      if (definitions.has(term.textContent)) {
        const error = document.createElement('p'); error.className = 'td-error'; error.setAttribute('role', 'alert');
        error.textContent = `Glossary: duplicate term "${term.textContent}"; the first definition is used.`;
        block.before(error);
      } else definitions.set(term.textContent, definition);
    }
    block.hidden = true;
  }
  const tip = document.createElement('div');
  tip.className = 'glossary-tooltip'; tip.id = 'td-glossary-tooltip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
  document.body.append(tip);
  let active, pinned = false;
  const close = () => { if (active) { active.setAttribute('aria-expanded', 'false'); active.removeAttribute('aria-describedby'); } active = null; pinned = false; tip.hidden = true; };
  const show = button => {
    close(); active = button; tip.textContent = definitions.get(button.textContent); tip.hidden = false;
    button.setAttribute('aria-expanded', 'true'); button.setAttribute('aria-describedby', tip.id);
    const rect = button.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(rect.left, innerWidth - tip.offsetWidth - 8)) + 'px';
    tip.style.top = Math.max(8, rect.bottom + tip.offsetHeight + 8 < innerHeight ? rect.bottom + 6 : rect.top - tip.offsetHeight - 6) + 'px';
  };
  const terms = [...definitions.keys()].sort((a, b) => b.length - a.length);
  const pattern = new RegExp('(?<![\\p{L}\\p{N}_])(' + terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![\\p{L}\\p{N}_])', 'gu');
  const annotate = () => {
  for (const slide of stage.querySelectorAll('.frame')) {
    const seen = new Set(), walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) if (!walker.currentNode.parentElement.closest('a, button, pre, code, kbd, samp, script, style, textarea, svg, math, .math, .w-glossary, .td-error, .notes, .article, .rh, [hidden], [contenteditable]')) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const fragment = document.createDocumentFragment(); let end = 0;
      for (const match of node.textContent.matchAll(pattern)) {
        if (seen.has(match[0])) continue;
        seen.add(match[0]); fragment.append(node.textContent.slice(end, match.index));
        const wrap = document.createElement('span'); wrap.className = 'glossary-term';
        const plain = document.createElement('span'); plain.className = 'glossary-plain'; plain.textContent = match[0];
        const button = document.createElement('button'); button.type = 'button'; button.className = 'glossary-button'; button.textContent = match[0]; button.setAttribute('aria-expanded', 'false');
        button.addEventListener('mouseenter', () => show(button));
        button.addEventListener('mouseleave', () => { if (document.activeElement !== button) close(); });
        button.addEventListener('focus', () => show(button)); button.addEventListener('blur', close);
        button.addEventListener('click', () => { if (active === button && pinned) close(); else { show(button); pinned = true; } });
        button.addEventListener('keydown', event => {
          if (['Enter', ' '].includes(event.key)) event.stopPropagation();
          if (event.key === 'Escape' && active === button) { event.stopPropagation(); event.preventDefault(); close(); }
        });
        wrap.append(plain, button); fragment.append(wrap); end = match.index + match[0].length;
      }
      if (end) { fragment.append(node.textContent.slice(end)); node.replaceWith(fragment); }
    }
  }
  };
  // The complete definition list is always expanded at the end of the article.
  const appendix = document.createElement('section'); appendix.className = 'slide md glossary-appendix'; appendix.dataset.present = 'hide'; appendix.dataset.name = 'Glossary';
  const content = document.createElement('div'); content.className = 'content';
  const heading = document.createElement('h2'); heading.textContent = 'Glossary';
  const list = document.createElement('dl'); list.className = 'w-glossary';
  for (const [term, definition] of definitions) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = term; dd.textContent = definition; list.append(dt, dd); }
  content.append(heading, list); appendix.append(content); stage.append(appendix);
  document.addEventListener('click', event => { if (!event.target.closest('.glossary-button')) close(); });
  addEventListener('resize', close); addEventListener('scroll', close, true);
  new MutationObserver(records => { if (active && records.some(record => record.target.matches('.slide') && !record.target.classList.contains('active'))) close(); }).observe(stage, { attributes: true, subtree: true, attributeFilter: ['class'] });
  new MutationObserver(close).observe(document.documentElement, { attributes: true, attributeFilter: ['data-view'] });
  return annotate;
}
