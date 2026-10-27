// `[@key]` cites an entry of a `::: references` list. Plain Markdown stays readable: the list is `- key: source`.
export function parseReferences(items) {
  const entries = [], seen = new Set();
  for (const item of items) {
    const match = item.match(/^([\w.:-]+):\s+(\S[^]*)$/);
    if (!match) throw new Error('use one "- key: Reference" per item');
    if (seen.has(match[1])) throw new Error(`duplicate key "${match[1]}"`);
    seen.add(match[1]); entries.push([match[1], match[2].trim()]);
  }
  if (!entries.length) throw new Error('add at least one "- key: Reference" item');
  return entries;
}

// Numbers citations by first use across the deck, links them to their entry, and orders each list to match.
export function citations(stage, open) {
  const cites = [...stage.querySelectorAll('a.cite-link')];
  if (!cites.length && !stage.querySelector('.w-references')) return;
  const entries = new Map(), numbers = new Map();
  for (const list of stage.querySelectorAll('ol.w-references')) {
    for (const li of [...list.children]) {
      const key = li.dataset.key;
      if (entries.has(key)) {
        li.hidden = true;
        const error = document.createElement('li'); error.className = 'td-error'; error.setAttribute('role', 'alert');
        error.textContent = `References: duplicate key "${key}"; the first entry is used.`; li.before(error); continue;
      }
      entries.set(key, li); li.id = 'td-ref-' + key;
    }
  }
  for (const link of cites) {
    const key = link.dataset.cite, entry = entries.get(key);
    if (!entry) {
      link.removeAttribute('href'); link.classList.add('td-error'); link.setAttribute('role', 'alert');
      link.textContent = `unknown reference "${key}"`; continue;
    }
    if (!numbers.has(key)) numbers.set(key, numbers.size + 1);
    link.textContent = numbers.get(key); link.href = '#' + entry.id; link.title = entry.textContent.trim();
    link.setAttribute('aria-label', `Reference ${numbers.get(key)}: ${entry.textContent.trim()}`);
  }
  let spare = numbers.size;
  for (const key of entries.keys()) if (!numbers.has(key)) numbers.set(key, ++spare);
  for (const list of stage.querySelectorAll('ol.w-references')) {
    const items = [...list.querySelectorAll(':scope > li[data-key]:not([hidden])')].sort((a, b) => numbers.get(a.dataset.key) - numbers.get(b.dataset.key));
    for (const li of items) { li.dataset.n = numbers.get(li.dataset.key); list.append(li); }
  }
  stage.addEventListener('click', event => {
    const link = event.target.closest('a.cite-link[href]');
    if (!link) return;
    event.preventDefault(); open(document.getElementById(link.getAttribute('href').slice(1)));
  });
}
