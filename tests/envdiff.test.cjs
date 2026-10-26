const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = () => import('../src/envdiff.js');

test('environment differences compare all environment text without changing it', async () => {
  const { environmentDifferences } = await load();
  const rows = [['POOL', '5', '20', '200'], ['TIMEOUT', '30s', '30s', '5s'], ['SAME', ' info ', 'info', 'info'], ['EMPTY', '', '', ''], ['CASE', 'Info', 'info', 'info'], ['UNICODE', '東京', '東京', '大阪']];
  const snapshot = JSON.stringify(rows);
  assert.deepEqual(environmentDifferences(['Key', 'dev', 'staging', 'prod'], rows), [true, true, false, false, true, true]);
  assert.equal(JSON.stringify(rows), snapshot);
  assert.deepEqual(environmentDifferences(['Key', 'a', 'b'], [['x', '', 'set']]), [true]);
});

test('environment diff rejects missing environments, headers, rows and keys', async () => {
  const { environmentDifferences: diff } = await load();
  for (const headers of [[], ['Key', 'dev'], ['Key', '', 'prod']]) assert.throws(() => diff(headers, [['x', '1', '2']]), /named environments/);
  assert.throws(() => diff(['Key', 'a', 'b'], []), /configuration row/);
  for (const row of [['', '1', '2'], ['x', '1'], ['x', '1', '2', '3']]) assert.throws(() => diff(['Key', 'a', 'b'], [row]), /rows need a key/);
});
