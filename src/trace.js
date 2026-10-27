// ```trace fence: "name  start  duration" per line (ms); indentation nests spans. Rendered as a waterfall plus a span table.
const escape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = ms => ms >= 1000 ? +(ms / 1000).toFixed(2) + ' s' : +ms.toFixed(1) + ' ms';
export function trace(raw, info) {
  const fail = message => `<p class="td-error" role="alert">${escape('trace: ' + message)}</p><pre class="code"><code>${escape(raw)}</code></pre>`;
  if (info.replace(/^trace/, '').trim()) return fail('this block takes no options.');
  const lines = raw.replace(/\n$/, '').split('\n').filter(l => l.trim()), spans = [], stack = [];
  if (!lines.length) return fail('the block is empty.');
  for (const [n, line] of lines.entries()) {
    if (/\t/.test(line.match(/^\s*/)[0])) return fail(`line ${n + 1} indents with a tab; use spaces.`);
    const m = line.match(/^( *)(\S.*?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/);
    if (!m) return fail(`line ${n + 1} should be "name  start  duration" with times in ms.`);
    const indent = m[1].length;
    while (stack.length && stack.at(-1).indent >= indent) stack.pop();
    if (!stack.length && indent && spans.length === 0) return fail(`line ${n + 1} is indented but has no parent span.`);
    const span = { name: m[2], start: +m[3], dur: +m[4], depth: stack.length, indent };
    if (![span.start, span.dur].every(Number.isFinite)) return fail(`line ${n + 1} has a time that is too large.`);
    spans.push(span); stack.push(span);
  }
  const total = Math.max(...spans.map(s => s.start + s.dur)) || 1, pct = v => +(v / total * 100).toFixed(3);
  const rows = spans.map((s, i) => `<button type="button" class="w-trace-row" data-span="${i}" style="--depth:${s.depth}" aria-label="${escape(`${s.name}: starts ${fmt(s.start)}, lasts ${fmt(s.dur)}`)}"><span class="w-trace-name">${escape(s.name)}</span><span class="w-trace-track"><span class="w-trace-bar" style="left:${pct(s.start)}%;width:${Math.max(pct(s.dur), .6)}%"></span></span><span class="w-trace-dur">${fmt(s.dur)}</span></button>`).join('');
  const table = spans.map(s => `<tr><td style="padding-left:${.6 + s.depth * 1.2}em">${escape(s.name).replace(/([._\/-])/g, "$1<wbr>")}</td><td>${fmt(s.start)}</td><td>${fmt(s.dur)}</td><td>${fmt(s.start + s.dur)}</td></tr>`).join('');
  return `<figure class="w w-trace" data-source="${escape(raw)}" aria-label="Trace timeline, ${fmt(total)} total"><div class="w-trace-axis" aria-hidden="true"><span>0</span><span>${fmt(total / 2)}</span><span>${fmt(total)}</span></div><div class="w-trace-rows">${rows}</div><p class="w-trace-detail" aria-live="polite"></p><table class="w-trace-table"><thead><tr><th>Span</th><th>Start</th><th>Duration</th><th>End</th></tr></thead><tbody>${table}</tbody></table></figure>`;
}
