const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

// Isolate the production lifecycle callback with a small deterministic RAF clock.
function setup() {
  const source = fs.readFileSync(require.resolve('../src/deck.js'), 'utf8');
  const fn = source.slice(source.indexOf('  function meter(w)'), source.indexOf('  function stats(box)'));
  const text = { textContent: '72%' }, fill = { style: {} }, owner = {};
  const w = { dataset: { value: '72', max: '100', precision: '0', suffix: '%' }, isConnected: true,
    classList: { contains: () => true }, closest: () => owner,
    querySelector: selector => selector === 'strong' ? text : fill };
  let cue, observe, change, active = owner, read = false, now = 0, next = 0;
  const frames = new Map(), motion = { matches: false, addEventListener: (_, f) => change = f }, handlers = { slide: [] };
  const context = { root: {}, handlers, performance: { now: () => now }, reading: () => read, slide: () => active,
    matchMedia: () => motion, MutationObserver: class { constructor(f) { observe = f; } observe() {} },
    requestAnimationFrame: fn => { frames.set(++next, fn); return next; }, cancelAnimationFrame: id => frames.delete(id),
    steps: (_, n, fn, options) => { assert.equal(n, 2); assert.equal(options.read, 'end'); cue = fn; fn(0); } };
  vm.runInNewContext(fn + '\nthis.mount = meter;', context); context.mount(w);
  return { text, fill, frames, w, cue: i => cue(i),
    tick(ms) { now += ms; const queue = [...frames.values()]; frames.clear(); queue.forEach(f => f(now)); },
    leave() { active = {}; handlers.slide.forEach(fn => fn()); },
    read() { read = true; observe(); }, reduce() { motion.matches = true; change(); } };
}
test('meter cue animates with a deterministic clock and stops exactly at its final value', () => {
  const m = setup(); assert.equal(m.text.textContent, '0%'); assert.equal(m.frames.size, 0);
  m.cue(1); m.tick(450); assert.equal(m.text.textContent, '63%');
  m.cue(1); m.tick(450); assert.equal(m.text.textContent, '72%'); assert.equal(m.frames.size, 0);
  assert.equal(m.fill.style.width, '72%');
});
test('leaving, reading, reducing motion and detaching stop pending meter frames', () => {
  for (const stop of ['leave', 'read', 'reduce']) {
    const m = setup(); m.cue(1); m.tick(200); assert.equal(m.frames.size, 1);
    m[stop](); assert.equal(m.frames.size, 0); assert.equal(m.text.textContent, '72%');
    m.tick(1000); assert.equal(m.text.textContent, '72%');
  }
  const m = setup(); m.cue(1); m.w.isConnected = false; m.tick(100); assert.equal(m.frames.size, 0);
});
