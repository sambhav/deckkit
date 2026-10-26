// Images stay in the article. The native modal supplies focus containment and an inert backdrop.
export function gallery(box, steps) {
  const images = [...box.querySelectorAll('img')];
  if (!images.length) {
    const error = document.createElement('p'); error.className = 'td-error'; error.setAttribute('role', 'alert');
    error.textContent = 'Gallery needs Markdown images.'; box.prepend(error); return;
  }
  box.classList.replace('gallery', 'w-gallery'); box.classList.add('w');
  const items = images.map((img, i) => {
    const figure = document.createElement('figure'), button = document.createElement('button'), caption = document.createElement('figcaption');
    button.type = 'button'; button.className = 'w-gallery-open';
    // Let native Space activation reach this button without advancing the deck.
    button.addEventListener('keydown', e => { if (e.key === ' ') e.stopPropagation(); });
    const label = img.alt.trim() || `Image ${i + 1}`;
    button.setAttribute('aria-label', `Open ${label}`); button.setAttribute('aria-haspopup', 'dialog');
    caption.textContent = label; button.append(img); figure.append(button, caption);
    const fail = () => {
      if (figure.querySelector('.td-error')) return;
      const error = document.createElement('span'); error.className = 'td-error'; error.setAttribute('role', 'alert');
      error.textContent = `Image unavailable: ${label}`; button.append(error); img.hidden = true;
    };
    img.addEventListener('error', fail); if (img.complete && !img.naturalWidth) fail();
    return { figure, button, img, label };
  });
  box.replaceChildren(...items.map(item => item.figure));
  steps(box, items.length, i => items.forEach((item, j) => {
    item.figure.classList.toggle('on', i === j);
    if (i === j) item.button.setAttribute('aria-current', 'true'); else item.button.removeAttribute('aria-current');
  }));
  let dialog;
  const open = index => {
    if (!dialog) {
      dialog = document.createElement('dialog'); dialog.className = 'w-gallery-lightbox'; dialog.setAttribute('aria-label', 'Image gallery');
      dialog.innerHTML = '<div class="w-gallery-toolbar"><button type="button" data-gallery="prev" aria-label="Previous image">←</button><span aria-live="polite"></span><button type="button" data-gallery="next" aria-label="Next image">→</button><button type="button" data-gallery="close">Close</button></div><figure></figure>';
      document.body.append(dialog);
    }
    const opener = items[index].button, figure = dialog.querySelector('figure'), status = dialog.querySelector('[aria-live]');
    const show = i => {
      index = (i + items.length) % items.length;
      const item = items[index], img = item.img.cloneNode(), caption = document.createElement('figcaption');
      img.hidden = false; caption.textContent = item.label;
      const fail = () => { img.hidden = true; caption.textContent = `Image unavailable: ${item.label}`; };
      img.addEventListener('error', fail); if (img.complete && !img.naturalWidth) fail();
      figure.replaceChildren(img, caption); status.textContent = `${index + 1} / ${items.length}`;
    };
    dialog.querySelector('[data-gallery=prev]').disabled = items.length === 1;
    dialog.querySelector('[data-gallery=next]').disabled = items.length === 1;
    dialog.onclick = e => {
      const action = e.target.closest('button')?.dataset.gallery;
      if (e.target === dialog || action === 'close') dialog.close();
      else if (action) show(index + (action === 'prev' ? -1 : 1));
    };
    dialog.onkeydown = e => {
      e.stopPropagation();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); show(index + (e.key === 'ArrowLeft' ? -1 : 1)); }
    };
    dialog.onclose = () => opener.focus({ preventScroll: true });
    show(index); dialog.showModal(); dialog.querySelector('[data-gallery=close]').focus();
  };
  items.forEach((item, i) => item.button.addEventListener('click', () => open(i)));
}
