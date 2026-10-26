// Shared numeric grammar keeps counters, meters and their diagnostics consistent.
export function countValue(text) {
  const m = text.match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))([kKmMbB]?)(%?)$/);
  if (!m) throw new Error('count: use a finite number with optional k, M, B or %.');
  const value = Number(m[1]), scale = { k: 1e3, m: 1e6, b: 1e9 }[m[2].toLowerCase()] || 1;
  if (!Number.isFinite(value * scale)) throw new Error('count: value must be finite.');
  return { value, suffix: m[2] + m[3], precision: (m[1].split('.')[1] || '').length };
}
export function meterValue(options) {
  const unknown = Object.keys(options).find(k => !['value', 'max', 'label', 'unit'].includes(k));
  if (unknown) throw new Error(`meter: unsupported option "${unknown}".`);
  const number = s => typeof s === 'string' && /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(s) ? Number(s) : NaN;
  const value = number(options.value), max = number(options.max ?? '100');
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0 || value < 0 || value > max) throw new Error('meter: use finite values with 0 ≤ value ≤ max and max > 0.');
  if (!options.label?.trim()) throw new Error('meter: add a label.');
  if (options.unit != null && (!options.unit.trim() || options.unit.length > 24 || /[<>\n\r]/.test(options.unit))) throw new Error('meter: unit must be short plain text.');
  return { value, max };
}
