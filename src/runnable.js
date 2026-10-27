// Runnable code: ```js {run} and ::: live. Both run author code in one kind of sandbox, an <iframe sandbox="allow-scripts">
// without allow-same-origin, so the code can run scripts but cannot reach the page, its cookies or its storage.
const TIMEOUT = 5000;
const lines = text => Math.max(2, String(text).split('\n').length);

// Run JavaScript in a hidden sandbox; out(kind, text) gets each console line (kind: log, warn, error) and done() ends the run.
// Top-level await works. A run that has not finished after 5 seconds is stopped (a tight synchronous loop cannot be interrupted).
function execute(code, out, done) {
  const id = Math.random().toString(36).slice(2), frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts'); frame.setAttribute('aria-hidden', 'true'); frame.tabIndex = -1; frame.style.display = 'none';
  let ended = false, timer, late;
  const stop = () => { clearTimeout(timer); clearTimeout(late); removeEventListener('message', onMessage); frame.remove(); };
  const finish = () => { if (ended) return; ended = true; clearTimeout(timer); done(); late = setTimeout(stop, 2000); };   // late timers may still log for a moment
  function onMessage(e) {
    if (e.source !== frame.contentWindow || e.data?.td !== id) return;
    if (e.data.t === 'done') finish(); else out(e.data.t, String(e.data.x));
  }
  addEventListener('message', onMessage);
  timer = setTimeout(() => { out('error', 'Stopped: still running after 5 seconds'); finish(); stop(); }, TIMEOUT);
  const body = `const id=${JSON.stringify(id)},send=(t,x)=>parent.postMessage({td:id,t,x},'*');
const fmt=v=>{if(typeof v==='string')return v;if(v instanceof Error)return v.stack||String(v);if(v instanceof Map)v=Object.fromEntries(v);else if(v instanceof Set)v=[...v];
try{const s=JSON.stringify(v);return s===undefined?String(v):s}catch{return String(v)}};
for(const [k,t] of [['log','log'],['info','log'],['debug','log'],['warn','warn'],['error','error']])console[k]=(...a)=>send(t,a.map(fmt).join(' '));
addEventListener('error',e=>send('error',e.message));addEventListener('unhandledrejection',e=>send('error','Uncaught (in promise) '+fmt(e.reason)));
(async()=>{try{await new (Object.getPrototypeOf(async function(){}).constructor)(${JSON.stringify(code).replace(/</g, '\\u003c')})()}catch(e){send('error',fmt(e))}send('done')})();`;
  frame.srcdoc = `<!doctype html><meta charset="utf-8"><script>${body}</script>`;
  document.body.append(frame);
  return stop;
}

// ```js {run}: an editable cell with a Run button and the console output beneath. ↓ runs it, ↑ clears the output.
export function runCell(w, { steps, reading, widgetId }) {
  const code = w.querySelector('pre code')?.textContent ?? '';
  const id = `td-run-${widgetId()}`;
  w.innerHTML = `<div class="w-run-bar"><span class="w-run-lang">JavaScript</span><button type="button" class="w-run-btn">Run</button></div>
<textarea class="w-run-src" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="JavaScript code, editable" rows="${lines(code)}"></textarea>
<pre class="w-run-out" role="log" aria-live="polite" aria-label="Output" tabindex="0"></pre>`;
  const src = w.querySelector('textarea'), out = w.querySelector('.w-run-out'), button = w.querySelector('button');
  src.value = code; out.id = id;
  button.setAttribute('aria-controls', id);
  let stop = () => {};
  const clear = () => { stop(); button.disabled = false; out.replaceChildren(); out.classList.remove('ran', 'empty'); };
  const run = () => {
    clear(); out.classList.add('ran'); button.disabled = true;
    const emit = (kind, text) => { const line = document.createElement('span'); line.className = 'w-run-line ' + kind; line.textContent = text + '\n'; out.append(line); };
    stop = execute(src.value, emit, () => { button.disabled = false; out.classList.toggle('empty', !out.firstChild); });
  };
  const st = steps(w, 2, i => { if (i) run(); else clear(); });
  button.addEventListener('click', () => (reading() || st.i ? run() : st.go(1)));
  src.addEventListener('input', () => { src.rows = lines(src.value); });
  // typing, Space and Enter belong to the editor and button, not to slide navigation
  w.addEventListener('keydown', e => { if (e.key !== 'Escape' && e.target.closest('textarea, button, pre')) e.stopPropagation(); });
}

// ::: live: html, css and js fences become editors beside a rendered preview that redraws a moment after each edit.
export function liveCode(w, { root }) {
  const panes = [...w.querySelectorAll(':scope > .w-live-pane')];
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts'); frame.title = 'Rendered output'; frame.className = 'w-live-out';
  const fields = {};
  const editors = document.createElement('div'); editors.className = 'w-live-editors';
  for (const pane of panes) {
    const lang = pane.dataset.lang, code = pane.querySelector('code').textContent, label = { html: 'HTML', css: 'CSS', js: 'JavaScript' }[lang];
    const area = document.createElement('textarea');
    Object.assign(area, { value: code, spellcheck: false, rows: lines(code) }); area.setAttribute('aria-label', `${label} code, editable`);
    area.autocapitalize = 'off'; area.autocomplete = 'off';
    area.addEventListener('input', () => { area.rows = lines(area.value); redraw(); });
    fields[lang] = area;
    const box = document.createElement('div'); box.className = 'w-live-edit'; box.dataset.lang = lang;
    box.innerHTML = `<span class="w-live-lang">${label}</span>`; box.append(area); editors.append(box);
  }
  const view = document.createElement('div'); view.className = 'w-live-view'; view.append(frame);
  w.replaceChildren(editors, view);
  const draw = () => {
    const cs = getComputedStyle(root), v = k => cs.getPropertyValue(k).trim();
    const base = `html{color-scheme:${root.dataset.mode === 'dark' ? 'dark' : 'light'}}body{margin:16px;color:${v('--fg')};background:${v('--bg')};font:16px/1.5 ${v('--sans') || 'system-ui,sans-serif'}}`;
    const js = fields.js?.value.replace(/<\/script/gi, '<\\/script');
    frame.srcdoc = `<!doctype html><meta charset="utf-8"><style>${base}</style>${fields.css ? `<style>${fields.css.value.replace(/<\/style/gi, '<\\/style')}</style>` : ''}${fields.html?.value ?? ''}${js ? `<script>${js}</script>` : ''}`;
  };
  let queued; const redraw = () => { clearTimeout(queued); queued = setTimeout(draw, 300); };
  new MutationObserver(redraw).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-mode'] });
  draw();
  w.addEventListener('keydown', e => { if (e.key !== 'Escape' && e.target.closest('textarea')) e.stopPropagation(); });
}
