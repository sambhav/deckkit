// Arithmetic grammar only: numbers, local identifiers, parentheses and + - * / %.
// There is no property lookup, function call, global scope or executable JavaScript.
export function arithmetic(source, values) {
  if (source.length > 500) throw new Error('expression is too long');
  const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[A-Za-z_]\w*|[^\s]/gi) || [];
  let pos = 0, depth = 0;
  const finite = n => { if (!Number.isFinite(n)) throw new Error('expression must have a finite result'); return n; };
  function atom() {
    if (++depth > 50) throw new Error('expression is too deeply nested');
    const t = tokens[pos++]; let n;
    if (t === '+' || t === '-') n = (t === '-' ? -1 : 1) * atom();
    else if (t === '(') { n = sum(); if (tokens[pos++] !== ')') throw new Error('missing closing parenthesis'); }
    else if (/^(?:\d|\.\d)/.test(t || '')) n = Number(t);
    else if (t && Object.hasOwn(values, t)) n = values[t];
    else throw new Error(`unknown value or symbol: ${t || 'end of expression'}`);
    depth--; return finite(n);
  }
  function product() { let n = atom(); while (['*', '/', '%'].includes(tokens[pos])) { const op = tokens[pos++], b = atom(); n = finite(op === '*' ? n * b : op === '/' ? n / b : n % b); } return n; }
  function sum() { let n = product(); while (['+', '-'].includes(tokens[pos])) { const op = tokens[pos++], b = product(); n = finite(op === '+' ? n + b : n - b); } return n; }
  const n = sum(); if (pos !== tokens.length) throw new Error(`unexpected symbol: ${tokens[pos]}`); return n;
}
export const displayNumber = n => String(Number(n.toPrecision(10)));
const number = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?';
const declaration = new RegExp(`^\\[([A-Za-z_]\\w*)=(${number})\\]\\{range=(${number})\\.\\.(${number})(?: step=(${number}))?\\}`, 'i');
export function explorableInline(state, silent) {
  if (!state.env.explorable) return false;
  const text = state.src.slice(state.pos), variable = text.match(declaration), expression = text.match(/^\{([^{}\n]+)\}/);
  if (!variable && !expression) return false;
  const match = variable || expression;
  if (!silent) {
    const token = state.push('html_inline', '', 0);
    token.meta = variable ? { explore: 'variable', name: variable[1], value: +variable[2], min: +variable[3], max: +variable[4], step: +(variable[5] || 1) } : { explore: 'expression', expression: expression[1] };
    token.content = match[0];
  }
  state.pos += match[0].length; return true;
}
export function explorable(tokens, options, classes, md, escape, env) {
  const fallback = md.renderer.render(tokens, md.options, env);
  try {
    if (Object.keys(options).length || classes.length) throw new Error('no container options are supported');
    if (tokens.some(t => !['paragraph_open', 'paragraph_close', 'inline', 'bullet_list_open', 'bullet_list_close', 'ordered_list_open', 'ordered_list_close', 'list_item_open', 'list_item_close'].includes(t.type))) throw new Error('use prose or lists; put code and nested widgets outside the container');
    const copy = tokens.map(t => ({ ...t, children: t.children }));
    const markers = [], values = Object.create(null);
    for (const token of copy) if (token.type === 'inline') {
      const parsed = []; md.inline.parse(token.content, md, { ...env, explorable: true }, parsed); token.children = parsed;
      markers.push(...parsed.filter(t => t.meta?.explore));
      // Incomplete declarations should be visible errors instead of silently inert text.
      if (parsed.some(t => t.type === 'text' && /\{range=/.test(t.content))) throw new Error('invalid range declaration; use [name=10]{range=1..100 step=1}');
    }
    for (const { meta: m } of markers.filter(t => t.meta.explore === 'variable')) {
      if (Object.hasOwn(values, m.name)) throw new Error(`duplicate variable ${m.name}`);
      if (![m.value, m.min, m.max, m.step].every(Number.isFinite) || m.min >= m.max || m.value < m.min || m.value > m.max || m.step <= 0 || !Number.isFinite(m.max - m.min)) throw new Error(`invalid range for ${m.name}`);
      const offset = (m.value - m.min) / m.step;
      if (Math.abs(offset - Math.round(offset)) > 1e-7 || !Number.isFinite(offset)) throw new Error(`${m.name} must start on its step grid`);
      values[m.name] = m.value;
    }
    if (!Object.keys(values).length) throw new Error('add a value such as [qps=1000]{range=100..10000}');
    for (const token of markers) {
      const m = token.meta;
      token.content = m.explore === 'variable'
        ? `<label class="w-explore-control"><span>${escape(m.name)} = <output>${displayNumber(m.value)}</output></span><input type="range" aria-label="${escape(m.name)}" data-name="${escape(m.name)}" min="${m.min}" max="${m.max}" step="${m.step}" value="${m.value}"><span class="w-explore-bounds">${displayNumber(m.min)}–${displayNumber(m.max)}</span></label>`
        : `<output class="w-explore-result" data-expression="${escape(m.expression)}" aria-label="${escape(m.expression)}">${displayNumber(arithmetic(m.expression, values))}</output>`;
    }
    return `<div class="w w-explore">${md.renderer.render(copy, md.options, env)}<p class="w-explore-hint">Adjust the sliders or use their arrow keys to explore.</p></div>`;
  } catch (error) { return `<p class="td-error" role="alert">explorable: ${escape(error.message)}</p>${fallback}`; }
}
export function activateExplorable(box) {
  const inputs = [...box.querySelectorAll('input[data-name]')], results = [...box.querySelectorAll('[data-expression]')];
  const error = document.createElement('p'); error.className = 'td-error'; error.setAttribute('role', 'alert');
  const update = () => {
    const values = Object.create(null);
    inputs.forEach(input => { values[input.dataset.name] = +input.value; input.closest('label').querySelector('output').textContent = displayNumber(+input.value); });
    error.remove();
    results.forEach(output => { try { output.textContent = displayNumber(arithmetic(output.dataset.expression, values)); } catch (e) { output.textContent = 'undefined'; error.textContent = 'explorable: ' + e.message; box.append(error); } });
  };
  box.addEventListener('input', update);
  // Let native slider keys work without the deck interpreting them as navigation.
  box.addEventListener('keydown', event => { if (event.target.matches('input') && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) event.stopPropagation(); });
}
