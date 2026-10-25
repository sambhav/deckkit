const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const isNumber = text => NUMBER.test(text) && Number.isFinite(Number(text));
// Legacy {.chart} tables read "42%", "$1,200" or "1,200" as their digits, as before.
const legacyNumber = text => String(parseFloat(String(text).replace(/[^\d.-]/g, '')) || 0);

// RFC 4180 CSV: quoted commas, doubled quotes, multiline cells, BOM, LF or CRLF.
export function parseCSV(source) {
  if (source.length > 1_000_000) throw new Error('CSV exceeds the 1 MB limit');
  const text = source.replace(/^\uFEFF/, ''), data = [];
  let row = [], cell = '', quoted = false, start = 0, line = 1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else { cell += ch; if (ch === '\n') line++; }
    } else if (ch === '"' && cell === '') { quoted = true; start = line; }
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); if (row.length > 1 || row[0] !== '') data.push(row);
      row = []; cell = ''; line++;
    } else cell += ch;
  }
  if (quoted) throw new Error(`CSV row ${start}: unclosed quoted field`);
  row.push(cell); if (row.length > 1 || row[0] !== '') data.push(row);
  return { headers: data[0] || [], rows: data.slice(1) };
}
// legacy: a {.chart} table keeps the pre-0.2 behaviour (lenient numbers, a donut
// plots its first column, more than six series cycle colours) so old decks still render.
export function chartDataset(headers, rows, kind = 'bar', selected, legacy = false) {
  if (headers.length < 2) throw new Error('A chart needs a label column and at least one numeric series');
  if (!rows.length) throw new Error('A chart needs at least one data row');
  if (rows.length > 1000 || headers.length > 51) throw new Error('Charts support up to 1,000 rows and 50 numeric columns');
  const names = headers.map(s => String(s).trim());
  if (names.some(s => !s) || new Set(names).size !== names.length) throw new Error('Column headers must be nonempty and unique');
  rows.forEach((row, i) => { if (row.length !== headers.length) throw new Error(`Row ${i + 2}: expected ${headers.length} columns, found ${row.length}`); });
  const series = names.slice(1).map((name, j) => ({ name, index: j + 1, values: rows.map((row, i) => {
    const raw = String(row[j + 1]).trim(), value = legacy ? legacyNumber(raw) : raw;
    if (!isNumber(value)) {
      throw new Error(`Row ${i + 2}, column “${name}”: expected a finite number, found ${JSON.stringify(value)}`);
    }
    return Number(value);
  }) }));
  let chosen = selected ? series.filter(s => s.name === selected) : series;
  if (!chosen.length) throw new Error(`Unknown numeric series: ${selected}`);
  if (legacy && kind === 'donut') chosen = chosen.slice(0, 1);
  if (chosen.length > 6 && !legacy) throw new Error('Plot up to six series, or select one with series="Column name"');
  if (kind === 'donut') {
    if (chosen.length !== 1) throw new Error('A donut needs one numeric series; set series="Column name"');
    if (chosen[0].values.some(v => v < 0) || !chosen[0].values.some(v => v > 0)) throw new Error('Donut values must be nonnegative with a positive total');
    if (!Number.isFinite(chosen[0].values.reduce((a,b) => a+b, 0))) throw new Error('Donut total is too large to plot');
  }
  const values = chosen.flatMap(s => s.values);
  if (!Number.isFinite(Math.max(...values) - Math.min(0, ...values))) throw new Error('Numeric range is too large to plot');
  return { headers, rows, labels: rows.map(row => row[0]), series: chosen };
}
export function csvDownload(headers, rows) {
  // Keep numeric negatives numeric; protect formula-like text for spreadsheets.
  const safe = value => {
    const text = String(value);
    return /^[=+\-@\t\r]/.test(text) && !isNumber(text.trim()) ? "'" + text : text;
  };
  const quote = value => /[",\r\n]|^\s|\s$/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
  return [headers, ...rows].map(row => row.map(value => quote(safe(value))).join(',')).join('\r\n');
}
