const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = () => import('../src/visual-charts.js');

test('all native chart types render finite geometry from their documented schemas', async () => {
  const { visualTypes, visualChart } = await load();
  const samples = {
    heatmap: [['Day', 'Morning', 'Evening'], [['Mon', '0', '5'], ['Tue', '-2', '8']]],
    scatter: [['Name', 'X', 'Y'], [['A', '-2', '4'], ['B', '8', '10']]],
    bubble: [['Name', 'X', 'Y', 'Size'], [['A', '1', '2', '4'], ['B', '3', '4', '16']]],
    waterfall: [['Stage', 'Value', 'Kind'], [['Start', '100', 'total'], ['Saved', '-20', 'change'], ['End', '80', 'total']]],
    timeline: [['Task', 'Start', 'End'], [['Build', '2026-01-01', '2026-02-01'], ['Ship', '2026-02-02', '']]],
    sankey: [['Source', 'Target', 'Value'], [['A', 'B', '10'], ['B', 'C', '7'], ['A', 'C', '3']]],
    treemap: [['Path', 'Value'], [['Compute/GPU', '10'], ['Compute/CPU', '5'], ['Storage', '3']]],
    range: [['System', 'Min', 'Max', 'Median'], [['A', '-2', '10', '4']]],
  };
  for (const type of visualTypes) {
    const svg = visualChart(...samples[type], type);
    assert.match(svg, /<svg/); assert.match(svg, /viewBox="0 0 [\d.]+ [\d.]+"/);
    assert.doesNotMatch(svg, /(?:="|[ ,])(?:NaN|Infinity)(?:[ ,"<])/);
  }
});

test('bubble areas and Sankey widths are proportional to values', async () => {
  const { visualChart } = await load();
  const bubble = visualChart(['N','X','Y','Size'], [['A','1','1','4'], ['B','2','2','16'], ['Zero','3','3','0']], 'bubble');
  const radii = [...bubble.matchAll(/<circle[^>]+ r="([\d.]+)"/g)].map(m => +m[1]);
  assert.equal(radii[1] ** 2 / radii[0] ** 2, 4); assert.equal(radii[2], 0);
  const sankey = visualChart(['Source','Target','Value'], [['A','B','10'], ['A','C','30']], 'sankey');
  const widths = [...sankey.matchAll(/stroke-width="([\d.]+)"/g)].map(m => +m[1]);
  assert.equal(widths[1] / widths[0], 3);
});

test('invalid dates, column mappings, unsupported options and cyclic flows are diagnosed', async () => {
  const { visualChart } = await load();
  for (const date of ['2026-02-30', '2026-04-31', '2026-13-01', '2026-1-1']) {
    assert.throws(() => visualChart(['Task','Start'], [['A', date]], 'timeline'), /valid YYYY-MM-DD/);
  }
  assert.doesNotThrow(() => visualChart(['Task','Start'], [['A', '2028-02-29']], 'timeline'));
  assert.throws(() => visualChart(['N','X','Y','S'], [['A','1','2','3']], 'bubble', { size: 'Missing' }), /Missing column/);
  assert.throws(() => visualChart(['N','X','Y'], [['A','1','2']], 'bubble'), /Missing column/);
  assert.throws(() => visualChart(['N','X','Y'], [['A','1','2']], 'scatter', { group: 'N' }), /Unsupported/);
  assert.throws(() => visualChart(['N','X','Y'], [['A','1','2']], 'scatter', { size: 'Y' }), /Unsupported/);
  assert.throws(() => visualChart(['Source','Target','Value'], [['A','B','1'], ['B','A','1']], 'sankey'), /cycles/);
  assert.throws(() => visualChart(['Source','Target','Value'], [['A','B','0']], 'sankey'), /positive/);
  assert.throws(() => visualChart(['Source','Target','Value'], [['','B','1']], 'sankey'), /named/);
  assert.throws(() => visualChart(['N','Min','Max','Median'], [['A','1','2','3']], 'range'), /bounds/);
});

test('optional columns are selected by name rather than unrelated third columns', async () => {
  const { visualChart } = await load();
  assert.doesNotThrow(() => visualChart(['N','Value','Comment'], [['A','10','Opening']], 'waterfall'));
  assert.doesNotThrow(() => visualChart(['Task','Start','Owner'], [['A','2026-01-01','Sam']], 'timeline'));
  assert.doesNotThrow(() => visualChart(['N','Min','Max','Comment'], [['A','1','2','Sample']], 'range'));
});

test('treemap rejects overlapping paths in either order and duplicate zero leaves', async () => {
  const { visualChart } = await load();
  for (const rows of [
    [['A','2'], ['A/B','1']], [['A/B','1'], ['A','2']], [['A','0'], ['A','0']],
    [['A / B','1'], ['A/B','2']],
  ]) assert.throws(() => visualChart(['Path','Value'], rows, 'treemap'), /[Oo]verlapping|Duplicate/);
  assert.throws(() => visualChart(['Path','Value'], [['A','0']], 'treemap'), /positive total/);
});

test('constant domains, dense rows and hostile labels keep usable output', async () => {
  const { visualChart } = await load();
  assert.doesNotMatch(visualChart(['N','X','Y'], [['A','0','0']], 'scatter'), /NaN|Infinity/);
  const heatmap = visualChart(['Day','Hour'], Array.from({ length: 1000 }, (_, i) => ['Row ' + i, '1']), 'heatmap');
  assert.match(heatmap, /viewBox="0 0 340 34110"/);
  const svg = visualChart(['N','X','Y'], [['<img onerror="bad">','1','2']], 'scatter', { title: '"><script>bad</script>' });
  assert.doesNotMatch(svg, /<script>|<img/); assert.match(svg, /&lt;img/);
  assert.throws(() => visualChart(['N','X','Y'], [['A','-1e308','0'], ['B','1e308','1']], 'scatter'), /too large/);
});
