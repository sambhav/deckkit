// ```regex fence: a pattern line plus optional "test: text" lines. Parses common syntax into labelled parts
// (anchors, classes, groups, quantifiers) and runs the tests with the browser's RegExp.
const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const q = s => `“${s}”`;
const CLASSES = { d: 'a digit', D: 'anything but a digit', w: 'a word character (letter, digit or _)', W: 'anything but a word character', s: 'whitespace', S: 'anything but whitespace' };
const CHARS = { n: 'a newline', t: 'a tab', r: 'a carriage return', f: 'a form feed', v: 'a vertical tab', 0: 'a null character' };

function quantifier(s, i) {
  const c = s[i];
  let src = '', text = '';
  if (c === '*') { src = c; text = 'zero or more times'; }
  else if (c === '+') { src = c; text = 'one or more times'; }
  else if (c === '?') { src = c; text = 'optional'; }
  else {
    const m = c === '{' && s.slice(i).match(/^\{(\d+)(?:(,)(\d*))?\}/);
    if (!m) return null;
    src = m[0];
    const [a, comma, b] = [m[1], m[2], m[3]], times = n => `${n} time${n === '1' ? '' : 's'}`;
    text = !comma ? `exactly ${times(a)}` : b === '' ? `${a} or more times` : `${a} to ${times(b)}`;
  }
  if (s[i + src.length] === '?') { src += '?'; text += ' (as few as possible)'; }
  return { src, text };
}

// Describe one escape such as \d, \. or \1. Returns [length, kind, label].
function escape(s, i, inClass) {
  const c = s[i + 1];
  if (c === undefined) throw new Error('pattern ends with a lone backslash');
  if (CLASSES[c]) return [2, 'class', CLASSES[c]];
  if (!inClass && c === 'b') return [2, 'anchor', 'a word boundary'];
  if (!inClass && c === 'B') return [2, 'anchor', 'not a word boundary'];
  if (inClass && c === 'b') return [2, 'literal', 'a backspace'];
  if (c in CHARS && !(c === '0' && /\d/.test(s[i + 2] || ''))) return [2, 'literal', CHARS[c]];
  let m;
  if ((m = s.slice(i).match(/^\\x[0-9a-fA-F]{2}|^\\u\{[0-9a-fA-F]+\}|^\\u[0-9a-fA-F]{4}/))) return [m[0].length, 'literal', `the character with hex code ${m[0].slice(2).replace(/[{}]/g, '').toUpperCase()}`];
  if ((m = s.slice(i).match(/^\\[pP]\{[^}]*\}/))) return [m[0].length, 'class', `${c === 'p' ? 'a' : 'not a'} Unicode property ${q(m[0].slice(3, -1))}`];
  if (!inClass && (m = s.slice(i).match(/^\\k<([^>]+)>/))) return [m[0].length, 'ref', `the same text as group ${q(m[1])}`];
  if (!inClass && (m = s.slice(i).match(/^\\([1-9]\d*)/))) return [m[0].length, 'ref', `the same text as group ${m[1]}`];
  return [2, 'literal', `the literal character ${q(c)}`];
}

function charClass(s, i) {
  let j = i + 1; const negate = s[j] === '^'; if (negate) j++;
  const items = []; 
  const one = () => {
    if (s[j] === '\\') { const [len, , label] = escape(s, j, true); const t = s.slice(j, j + len); j += len; return { t, label: label.replace(/^the literal character /, '').replace(/^a /, '') }; }
    const t = String.fromCodePoint(s.codePointAt(j)); j += t.length; return { t, label: q(t) };
  };
  while (j < s.length && s[j] !== ']') {
    const a = one();
    if (s[j] === '-' && s[j + 1] !== ']' && j + 1 < s.length && !CLASSES[a.t[1]]) {
      j++; const b = one();
      items.push(`${a.label} to ${b.label}`);
    } else items.push(a.label);
  }
  if (j >= s.length) throw new Error('unterminated character class');
  if (!items.length) return { end: j + 1, label: negate ? 'any character, including a newline' : 'nothing (an empty class never matches)' };
  return { end: j + 1, label:`any one character ${negate ? 'except ' : 'from '}${items.join(', ')}` };
}

function parseSeq(s, i, flags, st, nested) {
  const nodes = []; let run = null;
  const flush = () => { if (run) { nodes.push({ kind: 'literal', src: run, label: `the ${[...run].length > 1 ? 'text' : 'character'} ${q(run)}` }); run = null; } };
  while (i < s.length) {
    const c = s[i];
    if (c === ')') { if (!nested) throw new Error('unmatched )'); break; }
    let node, len;
    if (!'\\[(|.^$*+?'.includes(c) && !(c === '{' && quantifier(s, i))) {
      const ch = String.fromCodePoint(s.codePointAt(i));
      if (!quantifier(s, i + ch.length)) { run = (run || '') + ch; i += ch.length; continue; }
      flush(); node = { kind: 'literal', src: ch, label: `the character ${q(ch)}` }; len = ch.length;
    } else {
      flush();
      if (c === '|') { nodes.push({ kind: 'alt', src: '|', label: 'or (match either side)' }); i++; continue; }
      if (c === '^') { node = { kind: 'anchor', src: c, label: flags.includes('m') ? 'start of a line' : 'start of the text' }; len = 1; }
      else if (c === '$') { node = { kind: 'anchor', src: c, label: flags.includes('m') ? 'end of a line' : 'end of the text' }; len = 1; }
      else if (c === '.') { node = { kind: 'class', src: c, label: flags.includes('s') ? 'any character' : 'any character except a newline' }; len = 1; }
      else if (c === '\\') { const [l, kind, label] = escape(s, i); node = { kind, src: s.slice(i, i + l), label }; len = l; }
      else if (c === '[') { const cc = charClass(s, i); node = { kind: 'class', src: s.slice(i, cc.end), label: cc.label }; len = cc.end - i; }
      else if (c === '(') {
        const head = s.slice(i).match(/^\(\?(?:[a-z]*(?:-[a-z]+)?:|=|!|<=|<!|<[A-Za-z_$][\w$]*>)?/)?.[0] || '(';
        const name = head.match(/^\(\?<([^=!].*)>$/)?.[1];
        const label = head === '(' ? `capture group ${++st.n}` : name ? `capture group ${(st.names[++st.n] = name, st.n)}, named ${q(name)}`
          : head === '(?:' ? 'non-capturing group' : head === '(?=' ? 'lookahead: must be followed by' : head === '(?!' ? 'negative lookahead: must not be followed by'
          : head === '(?<=' ? 'lookbehind: must be preceded by' : head === '(?<!' ? 'negative lookbehind: must not be preceded by' : `group with flags ${q(head.slice(2, -1))}`;
        const inner = parseSeq(s, i + head.length, flags, st, true);
        if (s[inner.end] !== ')') throw new Error('missing )');
        node = { kind: /^\(\?<?[=!]/.test(head) ? 'anchor' : 'group', head, src: s.slice(i, inner.end + 1), label, children: inner.nodes }; len = inner.end + 1 - i;
      }
      else throw new Error(`unexpected ${q(c)}`);
    }
    i += len;
    const quant = quantifier(s, i);
    if (quant) { node.quant = quant; node.src += quant.src; i += quant.src.length; }
    nodes.push(node);
  }
  flush();
  return { nodes, end: i };
}

export function parsePattern(source, flags = '') {
  const st = { n: 0, names: [] }, nodes = parseSeq(source, 0, flags, st, false).nodes;
  nodes.names = st.names; // capture group number to name
  return nodes;
}

const withQuant = n => n.quant ? `${n.label}, ${n.quant.text}` : n.label;
function patternHtml(n, i) {
  const inner = n.children ? `<span class="rx-paren">${esc(n.head)}</span>${n.children.map(c => patternHtml(c)).join('')}<span class="rx-paren">)</span>` : esc(n.src.slice(0, n.src.length - (n.quant?.src.length || 0)));
  return `<span class="rx rx-${n.kind}"${i ? ` data-i="${i}"` : ''}>${inner}${n.quant ? `<span class="rx-q">${esc(n.quant.src)}</span>` : ''}</span>`;
}
function listHtml(n, i) {
  const kids = n.children?.length ? `<ul>${n.children.map(c => listHtml(c)).join('')}</ul>` : '';
  return `<li class="rx-part"${i ? ` data-i="${i}"` : ''}><code class="rx rx-${n.kind}">${esc(n.src)}</code> <span class="rx-label">${esc(withQuant(n))}</span>${kids}</li>`;
}

function testHtml(re, text, names) {
  const m = re.exec(text);
  const shown = text === '' ? '<span class="rx-empty">(empty)</span>' : esc(text);
  if (!m) return `<li class="rx-test is-miss"><code>${shown}</code><span class="rx-result"><span aria-hidden="true">✗ </span>No match</span></li>`;
  const hit = m[0] === '' ? '' : `${esc(text.slice(0, m.index))}<mark>${esc(m[0])}</mark>${esc(text.slice(m.index + m[0].length))}`;
  const groups = m.slice(1).map((g, k) => `<li><b>${esc(names[k + 1] ?? k + 1)}</b> ${g === undefined ? '<i>unmatched</i>' : `<code>${esc(g)}</code>`}</li>`);
  return `<li class="rx-test is-match"><code>${hit || shown}</code><span class="rx-result"><span aria-hidden="true">✓ </span>Match${m[0] === '' ? ' (empty)' : ''}</span>${groups.length ? `<ul class="rx-groups">${groups.join('')}</ul>` : ''}</li>`;
}

export function regexBlock(source, escapeHtml = esc) {
  const fail = message => `<p class="td-error" role="alert">regex: ${escapeHtml(message)}</p><pre class="code"><code>${escapeHtml(source)}</code></pre>`;
  const tests = [], pats = [];
  for (const l of source.split(/\r?\n/)) { const t = l.match(/^test:(?: |$)(.*)$/); if (t) tests.push(t[1]); else if (l.trim()) pats.push(l.trim()); }
  if (tests.some(t => t.length > 200)) return fail('test strings are limited to 200 characters.');
  if (pats.length !== 1) return fail(pats.length ? 'use one pattern line, then "test: text" lines.' : 'add a pattern line.');
  const [, pattern, flags] = pats[0].match(/^\/(.+)\/([a-z]*)$/) || [0, pats[0], ''];
  let re, nodes;
  try { re = new RegExp(pattern, flags.replace(/[gy]/g, '')); nodes = parsePattern(pattern, flags); } catch (e) { return fail(e.message); }
  return `<div class="w w-regex" data-parts="${nodes.length}" style="--rx-rows:${Math.ceil(nodes.length / 2)}"><p class="rx-head"><code class="rx-pattern" aria-label="Pattern ${esc(pattern)}">${nodes.map((n, i) => patternHtml(n, i + 1)).join('')}</code>${flags ? `<span class="rx-flags">flags: ${esc(flags)}</span>` : ''}</p>`
    + `<ol class="rx-parts">${nodes.map((n, i) => listHtml(n, i + 1)).join('')}</ol>${tests.length ? `<ul class="rx-tests">${tests.map(t => testHtml(re, t, nodes.names)).join('')}</ul>` : ''}</div>`;
}
