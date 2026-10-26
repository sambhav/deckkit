// Absolute deadlines keep a countdown honest when a background tab is suspended.
export function timerDuration(text) {
  if (!/^(?:\d+h)?(?:\d+m)?(?:\d+s)?$/.test(text) || !text) return null;
  const parts = [...text.matchAll(/(\d+)([hms])/g)];
  const seconds = parts.reduce((n, [, value, unit]) => n + Number(value) * ({ h: 3600, m: 60, s: 1 }[unit]), 0);
  return Number.isSafeInteger(seconds) && seconds > 0 && seconds <= 86400 ? seconds * 1000 : null;
}
export function timerLabel(ms) {
  let seconds = ms / 1000;
  return [[3600, 'hour'], [60, 'minute'], [1, 'second']].flatMap(([size, unit]) => {
    const n = Math.floor(seconds / size); seconds %= size;
    return n ? [`${n} ${unit}${n === 1 ? '' : 's'}`] : [];
  }).join(' ');
}
export function timerRemaining(state, now = Date.now()) {
  return Math.max(0, state.deadline === null ? state.remaining : state.deadline - now);
}
