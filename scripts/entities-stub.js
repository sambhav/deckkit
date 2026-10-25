// markdown-it only needs decodeHTMLStrict for one "&name;" or "&#123;" reference at a time.
// The browser already knows every HTML entity, so decode through a <textarea> instead of
// bundling the 22KB entity table. Without a DOM (the Node parser tests), numeric references
// still decode and named ones are left as written.
let area;
export function decodeHTMLStrict(text) {
  const n = text.match(/^&#(x[0-9a-f]+|\d+);$/i);
  if (n) {
    const code = n[1][0].toLowerCase() === 'x' ? parseInt(n[1].slice(1), 16) : +n[1];
    return code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff) ? String.fromCodePoint(code) : '�';
  }
  if (typeof document === 'undefined' || !document.createElement) return text;
  area ||= document.createElement('textarea');
  area.innerHTML = text;
  return area.value;
}
