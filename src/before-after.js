// Native range semantics plus direct dragging on the wipe; no image requests beyond the authored pair.
export function beforeAfter(box, steps) {
  const figures = [...box.children];
  if (figures.length !== 2 || !figures.every(f => f.matches('figure') && f.querySelector('img'))) return;
  box.classList.add('w', 'w-before-after');
  const doc = box.ownerDocument;
  const stage = doc.createElement('div'); stage.className = 'w-compare-stage';
  // Article figures stay complete and independent of the presentation clipping.
  const pictures = figures.map(f => f.querySelector('img').cloneNode(true));
  pictures.forEach(p => { p.alt = ''; p.setAttribute('aria-hidden', 'true'); stage.append(p); });
  stage.setAttribute('role', 'img');
  stage.setAttribute('aria-label', `Before image: ${figures[0].querySelector('img').alt}. After image: ${figures[1].querySelector('img').alt}.`);
  const divider = doc.createElement('span'); divider.className = 'w-compare-divider'; stage.append(divider);
  const label = doc.createElement('label'); label.className = 'w-compare-control';
  const text = doc.createElement('span'); text.textContent = 'Reveal after image';
  const input = doc.createElement('input'); input.type = 'range'; input.min = '0'; input.max = '100'; input.step = '1';
  const output = doc.createElement('span'); output.className = 'w-compare-value'; output.setAttribute('aria-hidden', 'true');
  label.append(text, input, output);
  box.prepend(stage, label);
  const captions = doc.createElement('div'); captions.className = 'w-compare-captions';
  figures.forEach(f => { const c = f.querySelector('figcaption').cloneNode(true); captions.append(c); });
  box.insertBefore(captions, figures[0]);
  function show(value) {
    const v = Math.max(0, Math.min(100, Number(value)));
    input.value = String(v); output.textContent = v + '%';
    input.setAttribute('aria-valuetext', v + '% after image revealed');
    box.style.setProperty('--compare-position', v + '%');
  }
  const st = steps(box, 3, i => show(i * 50));
  function pick(v) { st.go(v < 25 ? 0 : v < 75 ? 1 : 2); show(v); }
  input.addEventListener('input', () => pick(+input.value));
  // Preserve native arrow/Home/End/Page behaviour without also navigating the deck.
  input.addEventListener('keydown', e => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', ' '].includes(e.key)) e.stopPropagation();
  });
  function drag(e) {
    const rect = stage.getBoundingClientRect();
    if (rect.width) pick(Math.max(0, Math.min(100, Math.round((e.clientX - rect.left) / rect.width * 100))));
  }
  stage.addEventListener('pointerdown', e => {
    if (!e.isPrimary || e.button !== 0) return;
    input.focus({ preventScroll: true }); stage.setPointerCapture(e.pointerId); drag(e);
  });
  stage.addEventListener('pointermove', e => { if (stage.hasPointerCapture(e.pointerId)) drag(e); });
  const release = e => { if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId); };
  stage.addEventListener('pointerup', release); stage.addEventListener('pointercancel', release);
}
