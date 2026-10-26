// Compare rendered cell text, preserving case, punctuation and meaningful whitespace.
// DOM nodes are never rewritten, so inline links, code and emphasis survive.
export function environmentDifferences(headers, rows) {
  if (headers.length < 3 || headers.some(h => !h.trim())) throw new Error('envdiff needs a key column and at least two named environments.');
  if (!rows.length) throw new Error('envdiff needs at least one configuration row.');
  if (rows.some(row => row.length !== headers.length || !row[0].trim())) throw new Error('envdiff rows need a key and a value for every environment (values may be empty).');
  return rows.map(row => new Set(row.slice(1).map(value => value.trim())).size > 1);
}
