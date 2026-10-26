/* Stable entry point: discover fresh metadata, then cache a matched immutable release. */
(() => {
  if (window.Talkdown) return;
  const entry = document.currentScript;
  const base = new URL('.', entry.src);
  const root = document.documentElement;
  const pending = [];
  let runtime, resolve, reject;
  const ready = new Promise((yes, no) => { resolve = yes; reject = no; });
  ready.catch(() => {}); // Errors are also displayed when no author script awaits ready.
  window.Talkdown = {
    ready,
    onReady(callback) {
      if (typeof callback !== 'function') throw new TypeError('Talkdown.onReady expects a function');
      if (runtime) callback(runtime); else pending.push(callback);
    },
  };

  // Until the runtime paints, cover the page in the reader's mode: their saved choice or the author's, else the system's.
  // (mirrors the mode lookup at the top of src/deck.js, which has not loaded yet)
  const dark = (() => {
    const q = new URLSearchParams(location.search), t = q.get('theme');
    let mode = q.get('mode') || (/^(light|dark)$/.test(t) ? t : null);
    try { mode = mode || JSON.parse(localStorage.getItem('talkdown:mode') || localStorage.getItem('talkdown:theme')); } catch {}
    mode = /^(light|dark)$/.test(mode) ? mode : root.dataset.mode;
    return mode ? mode === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  })();
  const ink = dark ? { bg: '#111214', fg: '#E8E8EA', muted: '#9A9AA2', line: '#2A2B30' }
                   : { bg: '#F7F7F5', fg: '#1C1C1E', muted: '#6B6B70', line: '#E2E2DE' };
  const cover = document.createElement('style');
  cover.textContent = `
    html::before { content: ""; position: fixed; inset: 0; z-index: 2147483646; background: ${ink.bg}; transition: opacity .3s ease, visibility 0s .3s; }
    html::after { content: ""; position: fixed; top: 50%; left: 50%; width: 32px; height: 32px; margin: -16px 0 0 -16px; z-index: 2147483647;
      border-radius: 50%; background: conic-gradient(from 90deg, transparent 10%, ${ink.fg});
      -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3.5px), #000 calc(100% - 3px));
              mask: radial-gradient(farthest-side, transparent calc(100% - 3.5px), #000 calc(100% - 3px));
      animation: talkdown-spin .9s linear infinite, talkdown-in .4s ease .2s both; }
    html[data-talkdown-loaded]::before { opacity: 0; visibility: hidden; }
    html[data-talkdown-loaded]::after { display: none; }
    @keyframes talkdown-spin { to { transform: rotate(1turn); } }
    @keyframes talkdown-in { from { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { html::after { animation-duration: 2.4s, .4s; } }`;
  (document.head || root).append(cover);
  // Fade the cover once the runtime has laid out its first slide.
  const reveal = () => requestAnimationFrame(() => requestAnimationFrame(() => {
    root.dataset.talkdownLoaded = '';
    setTimeout(() => { cover.remove(); delete root.dataset.talkdownLoaded; }, 400);
  }));

  document.addEventListener('talkdown:setup', event => {
    runtime = event.detail;
    resolve(runtime);
    for (const callback of pending.splice(0)) callback(runtime);
    reveal();
  }, { once: true });

  const asset = (entry, extension) => {
    if (!entry || !new RegExp('^dist/deck\\.[a-f0-9]{16}\\.' + extension + '$').test(entry.path)
        || !/^sha256-[A-Za-z0-9+/]{43}=$/.test(entry.integrity)) throw new Error('Invalid Talkdown release metadata');
    return new URL(entry.path, base).href;
  };
  const load = element => new Promise((yes, no) => {
    element.onload = yes;
    element.onerror = () => no(new Error('Could not load Talkdown ' + (element.href || element.src)));
    if (element.tagName === 'LINK') {
      // Preserve the usual runtime-then-author stylesheet order even though loading is asynchronous.
      if (entry.parentNode === document.head) document.head.insertBefore(element, entry);
      else document.head.prepend(element);
    } else document.head.append(element);
  });
  // The runtime announces talkdown:setup when it starts and talkdown:error when it can't; an exception thrown
  // while its script runs means it never got that far.
  let fail, loaded = false;
  const outcome = new Promise((yes, no) => {
    fail = no;
    document.addEventListener('talkdown:setup', yes, { once: true });
    document.addEventListener('talkdown:error', event => no(event.detail), { once: true });
  });
  outcome.catch(() => {});   // reported below, once it is awaited
  let jsURL;
  const noteError = event => { if (event.filename === jsURL) fail(event.error || new Error(event.message)); };
  (async () => {
    const url = new URL('latest.json', base);
    // A unique URL avoids intermediary caches too; no-store alone only controls the browser.
    url.searchParams.set('check', Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
    const response = await fetch(url, { cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error('Could not check the latest Talkdown release (HTTP ' + response.status + ')');
    const release = await response.json();
    if (release.schema !== 1) throw new Error('Unsupported Talkdown release metadata');
    const cssURL = asset(release.css, 'css');
    jsURL = asset(release.js, 'js');
    // fetch the script while the stylesheet loads; it runs once the styles are in
    document.head.append(Object.assign(document.createElement('link'), { rel: 'preload', as: 'script', href: jsURL, integrity: release.js.integrity, crossOrigin: 'anonymous' }));
    await load(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: cssURL, integrity: release.css.integrity, crossOrigin: 'anonymous' }));
    addEventListener('error', noteError);
    await load(Object.assign(document.createElement('script'), { src: jsURL, integrity: release.js.integrity, crossOrigin: 'anonymous' }));
    loaded = true;
    await outcome;
  })().finally(() => removeEventListener('error', noteError)).catch(error => {
    reject(error);
    const report = () => {
      cover.remove();
      const screen = document.createElement('div'), box = document.createElement('div');
      screen.setAttribute('role', 'alert');
      screen.style.cssText = `position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;overflow:auto;
        background:${ink.bg};color:${ink.fg};font:16px/1.55 system-ui,-apple-system,sans-serif;color-scheme:${dark ? 'dark' : 'light'}`;
      box.style.maxWidth = '30em';
      box.innerHTML = `<p style="margin:0 0 6px;font-size:20px;font-weight:600">This deck couldn't load</p>
        <p style="margin:0;color:${ink.muted}">${loaded ? 'Talkdown hit an error while starting. Reload to try again.' : 'Check your connection and reload the page.'}</p>`;
      const detail = Object.assign(document.createElement('p'), { textContent: error.message || String(error) });
      detail.style.cssText = `margin:18px 0 22px;padding:10px 12px;border:1px solid ${ink.line};border-radius:8px;
        font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:${ink.muted};overflow-wrap:anywhere`;
      const reload = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Reload', onclick: () => location.reload() });
      reload.style.cssText = `font:inherit;font-weight:500;padding:8px 20px;border-radius:999px;cursor:pointer;border:0;background:${ink.fg};color:${ink.bg}`;
      box.append(detail, reload); screen.append(box);
      document.body.prepend(screen);
    };
    if (document.body) report(); else document.addEventListener('DOMContentLoaded', report, { once: true });
  });
})();
