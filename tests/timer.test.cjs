const { test } = require('node:test');
const assert = require('node:assert/strict');
test('countdowns use deadlines rather than counting callback invocations', async () => {
  const { timerDuration, timerRemaining } = await import('../src/timer.js');
  assert.equal(timerDuration('24h'), 86400000);
  assert.equal(timerDuration('1m30s'), 90000);
  const running = { remaining: 60000, deadline: 61000 };
  assert.equal(timerRemaining(running, 1000), 60000);
  assert.equal(timerRemaining(running, 46000), 15000, 'a suspended tab catches up in one update');
  assert.equal(timerRemaining(running, 90000), 0, 'completion never goes negative');
  const paused = { remaining: timerRemaining(running, 46000), deadline: null };
  assert.equal(timerRemaining(paused, 90000), 15000, 'paused time is stable');
  assert.equal(timerRemaining({ ...paused, deadline: 105000 }, 95000), 10000, 'resume uses the preserved remainder');
});
