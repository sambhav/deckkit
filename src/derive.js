// Split only outer TeX alignment markers. Braces, escaped characters and nested
// environments (matrices, cases, …) keep their own & and \\ separators.
export function derivation(source) {
  const rows = [[]]; let cell = '', depth = 0, environments = [];
  const endCell = () => { rows.at(-1).push(cell.trim()); cell = ''; };
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '%') { const end = source.indexOf('\n', i); i = end < 0 ? source.length : end; cell += '\n'; continue; }
    if (ch === '\\') {
      const env = source.slice(i).match(/^\\(begin|end)\{([^}]+)\}/);
      if (env) {
        if (env[1] === 'begin') environments.push(env[2]);
        else if (environments.pop() !== env[2]) throw Error('Derivation has mismatched TeX environments.');
        cell += env[0]; i += env[0].length - 1; continue;
      }
      if (source[i + 1] === '\\' && !depth && !environments.length) {
        endCell(); rows.push([]); i++; continue;
      }
      cell += ch + (source[++i] || ''); continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') { if (--depth < 0) throw Error('Derivation has unmatched braces.'); }
    if (ch === '&' && !depth && !environments.length) endCell(); else cell += ch;
  }
  endCell();
  if (depth || environments.length) throw Error('Derivation has unclosed braces or TeX environments.');
  if (rows.length > 1 && rows.at(-1).every(x => !x)) rows.pop(); // conventional trailing \\
  if (!rows.length || rows.some(row => row.every(x => !x))) throw Error('Derivation needs a nonempty equation on every step.');
  return rows;
}
