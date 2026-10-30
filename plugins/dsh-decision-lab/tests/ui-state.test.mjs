import test from 'node:test';
import assert from 'node:assert/strict';

test('priority change is immutable and rejects an all-zero state', async () => {
  const ui = await import('../lib/ui-state.js').catch(() => null);
  assert.equal(typeof ui?.changeWeight, 'function', 'changeWeight must exist');
  const original = { speed: 80, cost: 20 };
  assert.deepEqual(ui.changeWeight(original, 'cost', 50), { speed: 80, cost: 50 });
  assert.deepEqual(original, { speed: 80, cost: 20 });
  assert.throws(() => ui.changeWeight({ speed: 0, cost: 1 }, 'cost', 0), /positive/);
  for (const value of [NaN, Infinity, -1, 101, '20']) assert.throws(() => ui.changeWeight(original, 'speed', value), /weight/);
  assert.throws(() => ui.changeWeight(original, 'missing', 20), /criterion/);
});
