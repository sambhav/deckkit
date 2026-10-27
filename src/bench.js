// ```bench unit=ms: ranked benchmark bars with variance whiskers. Lines are "name  12.1 ± 0.4"; hyperfine --export-json also works.
import { csvDownload } from './data.js';
const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const NUM = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?';
const LINE = new RegExp(`^(.*?\\S)\\s+(${NUM})(?:\\s*(?:±|\\+/-|\\+-)\\s*(${NUM}))?\\s*$`, 'i');
const SECONDS = { s: 1, ms: 1e3, us: 1e6, µs: 1e6, ns: 1e9 };
const fmt = n => String(+n.toPrecision(4));
export function benchResults(source, info) {
  const parts = info.trim().split(/\s+/).slice(1), options = {};
  for (const part of parts) {
    const m = part.match(/^(unit|better)=(.+)$/);
    if (!m || m[1] in options) throw new Error('supported options are unit=<text> and better=lower|higher.');
    options[m[1]] = m[2];
  }
  if ('better' in options && !['lower', 'higher'].includes(options.better)) throw new Error('better must be lower or higher.');
  if ('unit' in options && (options.unit.length > 12 || /[<>"]/.test(options.unit))) throw new Error('unit must be short plain text.');
  const json = source.trimStart().startsWith('{'), rows = [];
  let unit = options.unit || '';
  if (json) {
    let data; try { data = JSON.parse(source); } catch { throw new Error('the JSON is not valid.'); }
    if (!Array.isArray(data?.results) || !data.results.length) throw new Error('hyperfine JSON needs a non-empty "results" array.');
    unit = unit || 's';
    const scale = SECONDS[unit.toLowerCase()];
    if (!scale) throw new Error('hyperfine JSON is in seconds; use unit=s, ms, us or ns.');
    for (const r of data.results) {
      if (typeof r?.command !== 'string' || !Number.isFinite(r.mean)) throw new Error('each result needs a "command" and a numeric "mean".');
      rows.push({ name: r.command, value: r.mean * scale, spread: Number.isFinite(r.stddev) ? r.stddev * scale : 0 });
    }
  } else {
    source.split('\n').forEach((line, i) => {
      if (!line.trim()) return;
      const m = line.match(LINE);
      if (!m) throw new Error(`line ${i + 1} needs "name  value ± spread".`);
      rows.push({ name: m[1], value: Number(m[2]), spread: m[3] == null ? 0 : Math.abs(Number(m[3])) });
    });
  }
  if (!rows.length) throw new Error('add at least one result.');
  if (rows.length > 50) throw new Error('up to 50 results are supported.');
  if (rows.some(r => !Number.isFinite(r.value) || r.value <= 0 || !Number.isFinite(r.spread))) throw new Error('values must be positive finite numbers.');
  return { rows, unit, higher: options.better === 'higher' };
}
export function benchBlock(source, info) {
  try {
    const { rows, unit, higher } = benchResults(source, info);
    const ranked = rows.map(r => ({ ...r })).sort((a, b) => higher ? b.value - a.value : a.value - b.value);
    const best = ranked[0].value, top = Math.max(...rows.map(r => r.value + r.spread));
    const pct = v => Math.min(100, Math.max(0, v / top * 100)).toFixed(2);
    const factor = r => higher ? best / r.value : r.value / best;
    const word = higher ? 'lower' : 'slower', u = unit ? ' ' + escape(unit) : '';
    const label = (r, k) => k === 0 ? 'fastest' : `${fmt(factor(r))}× ${word}`;
    const bars = ranked.map((r, k) => {
      const lo = pct(Math.max(0, r.value - r.spread)), hi = pct(r.value + r.spread);
      return `<li class="w-bench-row${k === 0 ? ' best' : ''}"><span class="w-bench-name">${escape(r.name)}</span><span class="w-bench-track" aria-hidden="true"><span class="w-bench-bar" style="width:${pct(r.value)}%"></span>${r.spread ? `<span class="w-bench-whisker" style="left:${lo}%;width:${(hi - lo).toFixed(2)}%"></span>` : ''}</span><span class="w-bench-value">${fmt(r.value)}${r.spread ? ` ± ${fmt(r.spread)}` : ''}${u}</span><span class="w-bench-factor">${label(r, k)}</span></li>`;
    }).join('');
    const body = ranked.map((r, k) => `<tr><th scope="row">${escape(r.name)}</th><td>${fmt(r.value)}</td><td>${r.spread ? fmt(r.spread) : ''}</td><td>${label(r, k)}</td></tr>`).join('');
    const csv = csvDownload(['Name', `Mean${unit ? ' (' + unit + ')' : ''}`, 'Spread'], ranked.map(r => [r.name, fmt(r.value), r.spread ? fmt(r.spread) : '']));
    const aria = higher ? 'Benchmark results, higher is better' : 'Benchmark results, lower is better';
    return `<figure class="w w-bench" data-csv="${escape(csv)}"><ol class="w-bench-chart" aria-label="${aria}">${bars}</ol><div class="w-bench-table" tabindex="0" role="region" aria-label="Benchmark data"><table><thead><tr><th scope="col">Name</th><th scope="col">Mean${unit ? ' (' + escape(unit) + ')' : ''}</th><th scope="col">Spread</th><th scope="col">Relative</th></tr></thead><tbody>${body}</tbody></table></div><button type="button" class="w-bench-download">Download CSV</button></figure>`;
  } catch (e) {
    return `<p class="td-error" role="alert">${escape('bench: ' + e.message)}</p><pre class="code"><code>${escape(source)}</code></pre>`;
  }
}
