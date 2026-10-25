/* Stable entry point: discover fresh metadata, then cache a matched immutable release. */
(() => {
  if (window.Talkdown) return;
  const entry = document.currentScript;
  const base = new URL('.', entry.src);
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
  document.addEventListener('talkdown:setup', event => {
    runtime = event.detail;
    resolve(runtime);
    for (const callback of pending.splice(0)) callback(runtime);
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
  (async () => {
    const url = new URL('latest.json', base);
    // A unique URL avoids intermediary caches too; no-store alone only controls the browser.
    url.searchParams.set('check', Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
    const response = await fetch(url, { cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error('Could not check the latest Talkdown release (HTTP ' + response.status + ')');
    const release = await response.json();
    if (release.schema !== 1) throw new Error('Unsupported Talkdown release metadata');
    const cssURL = asset(release.css, 'css'), jsURL = asset(release.js, 'js');
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = cssURL; css.integrity = release.css.integrity; css.crossOrigin = 'anonymous';
    await load(css);
    const js = document.createElement('script');
    js.src = jsURL; js.integrity = release.js.integrity; js.crossOrigin = 'anonymous';
    await load(js);
  })().catch(error => {
    reject(error);
    const report = () => {
      const message = document.createElement('p');
      message.setAttribute('role', 'alert');
      message.style.cssText = 'margin:24px;padding:16px;border:1px solid currentColor;font:16px/1.5 system-ui';
      message.textContent = 'Talkdown could not load its latest release. Check your connection and reload. ' + error.message;
      document.body.prepend(message);
    };
    if (document.body) report(); else document.addEventListener('DOMContentLoaded', report, { once: true });
  });
})();
