// ::: magnitude: values across many orders of magnitude, drawn on a log scale. Time units climb to min, h and d.
const SI = [[-12, 'p'], [-9, 'n'], [-6, 'µ'], [-3, 'm'], [0, ''], [3, 'k'], [6, 'M'], [9, 'G'], [12, 'T']];

export function formatMagnitude(value, unit = '') {
  if (!(value > 0) || !Number.isFinite(value)) return String(value);
  const sig = n => String(Number(n.toPrecision(3)));
  if (unit === 's' && value >= 60) {
    const [div, name] = value >= 86400 ? [86400, 'd'] : value >= 3600 ? [3600, 'h'] : [60, 'min'];
    return sig(value / div) + ' ' + name;
  }
  let e = Math.max(-12, Math.min(12, Math.floor(Math.log10(value) / 3) * 3)), scaled = Number((value / 10 ** e).toPrecision(3));
  if (scaled >= 1000 && e < 12) { e += 3; scaled = Number((value / 10 ** e).toPrecision(3)); }
  return sig(scaled) + ' ' + SI.find(([p]) => p === e)[1] + unit;
}

export function magnitudeModel(headers, rows, unit = '') {
  if (headers.length < 2) throw new Error('A magnitude table needs a label column and a value column');
  if (!rows.length) throw new Error('A magnitude table needs at least one row');
  const items = rows.map((row, i) => {
    const text = String(row[1] ?? '').trim(), value = Number(text);
    if (!text || !(value > 0) || !Number.isFinite(value)) throw new Error(`Row ${i + 2}: "${text}" is not a positive number (a log scale cannot show zero or negatives)`);
    return { label: String(row[0]), value, text: formatMagnitude(value, unit) };
  });
  const logs = items.map(item => Math.log10(item.value));
  const lo = Math.floor(Math.min(...logs)); let hi = Math.ceil(Math.max(...logs));
  if (hi === lo) hi = lo + 1;
  // a tick every decade, or every thousandfold (ns, µs, ms, s) once there are more than five
  const stride = hi - lo <= 5 ? 1 : Math.ceil((hi - lo) / 15) * 3, ticks = [];
  for (let d = Math.ceil(lo / stride) * stride; d <= hi; d += stride) ticks.push({ at: (d - lo) / (hi - lo), text: formatMagnitude(10 ** d, unit) });
  items.forEach((item, i) => { item.at = (logs[i] - lo) / (hi - lo); });
  return { items, ticks, decades: Math.round(Math.max(...logs) - Math.min(...logs)) };
}
