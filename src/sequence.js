// ```sequence — "A -> B: text" requests, "A --> B: text" replies, "note: text" or "note over A,B: text".
// Parsing is pure and the HTML is static; deck.js only reveals one step at a time.
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function parseSequence(source) {
  const people = [], steps = [];
  const who = name => { let i = people.indexOf(name); if (i < 0) i = people.push(name) - 1; return i; };
  const lines = source.split('\n');
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n].trim();
    if (!line || line.startsWith('#')) continue;
    const where = 'line ' + (n + 1) + ': ';
    const note = line.match(/^note(?:\s+over\s+([^:]+?))?\s*:\s*(.*)$/i);
    if (note) {
      if (!note[2].trim()) throw new Error(where + 'a note needs text.');
      const over = note[1] ? note[1].split(',').map(s => s.trim()) : null;
      if (over && (over.length > 2 || over.some(s => !s))) throw new Error(where + 'note over takes one or two participants.');
      const item = { note: note[2].trim(), over };
      if (over) over.forEach(who);
      // A bare note comments on the message before it and appears with it.
      if (!over && steps.length) steps.at(-1).notes.push(item); else steps.push({ notes: [item] });
      continue;
    }
    const m = line.match(/^([^:]+?)\s*(-->|->)\s*([^:]+?)\s*(?::\s*(.*))?$/);
    if (!m || !m[1].trim() || !m[3].trim()) throw new Error(where + 'use "Sender -> Receiver: message", "-->" for a reply, or "note: text".');
    steps.push({ from: who(m[1].trim()), to: who(m[3].trim()), reply: m[2] === '-->', text: (m[4] || '').trim(), notes: [] });
  }
  if (!steps.some(s => s.from != null)) throw new Error('add at least one message like "Browser -> Server: Hello".');
  return { people, steps };
}

export function sequenceHTML(source) {
  let seq;
  try { seq = parseSequence(source); }
  catch (e) { return `<p class="td-error" role="alert">sequence: ${esc(e.message)}</p><pre class="code"><code>${esc(source)}</code></pre>`; }
  const { people, steps } = seq, N = people.length;
  let count = 0, row = 0;
  const rows = steps.map((step, k) => {
    let html = '';
    if (step.from != null) {
      count++;
      const a = Math.min(step.from, step.to), b = Math.max(step.from, step.to);
      const label = `<span class="w-seq-num">${count}</span>${esc(step.text)}`;
      html += step.from === step.to
        ? `<div class="w-seq-self" style="grid-row:${++row};grid-column:${a + 1}/${N + 1};--span:${N - a}">${label}</div>`
        : `<div class="w-seq-msg" data-dir="${step.to > step.from ? 'ltr' : 'rtl'}"${step.reply ? ' data-reply' : ''} style="grid-row:${++row};grid-column:${a + 1}/${b + 2};--span:${b - a + 1}">${label}</div>`;
    }
    for (const n of step.notes) {
      const [a, b = a] = n.over ? n.over.map(p => people.indexOf(p)).sort((x, y) => x - y) : [0, N - 1];
      html += `<div class="w-seq-note" style="grid-row:${++row};grid-column:${a + 1}/${b + 2}">${esc(n.note)}</div>`;
    }
    return `<div class="w-seq-step" data-step="${k}">${html}</div>`;
  }).join('');
  const noteText = n => `Note: ${esc(n.note)}`;
  const list = steps.map(step => step.from != null
    ? `<li>${esc(people[step.from])} ${step.reply ? 'replies to' : 'to'} ${esc(people[step.to])}: ${esc(step.text) || '(no text)'}${step.notes.map(n => ` <em>(${noteText(n)})</em>`).join('')}</li>`
    : step.notes.map(n => `<li class="w-seq-note-item"><em>${noteText(n)}</em></li>`).join('')).join('');
  return `<div class="w w-seq" style="--n:${N}" role="group" aria-label="Sequence diagram"><div class="w-seq-head">${people.map(p => `<div class="w-seq-person">${esc(p)}</div>`).join('')}</div><div class="w-seq-body">${rows}</div><ol class="w-seq-list">${list}</ol></div>`;
}
