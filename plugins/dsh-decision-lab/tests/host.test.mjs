import test from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import Tools from '@deepseek-ai/dsh-tools';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import { fixture } from './fixture.mjs';

test('DSH registry executes the decision tool and emits replayable metadata', async () => {
  const plugin = await import('../index.js').catch(() => null);
  assert.equal(typeof plugin?.apply, 'function', 'host plugin must exist');
  const ctx = new Context();
  try {
    await ctx.plugin(SystemPrompt);
    await ctx.plugin(Tools);
    const fiber = ctx.plugin(plugin);
    await fiber;
    const schema = ctx.tools.schemas().find(s => s.name === 'decision_lab');
    assert.ok(schema, 'registered model-facing schema');
    const decision = fixture();
    const before = JSON.stringify(decision);
    const result = await ctx.tools.execute({ name: 'decision_lab', callId: 'test-1', arguments: { decision }, signal: new AbortController().signal });
    assert.equal(result.isError, false, JSON.stringify(result));
    assert.deepEqual(result.value.analysis.leaders, ['fast']);
    assert.deepEqual(result.meta.decisionLab, { version: 1, decision });
    assert.match(result.content[0].text, /Fast launch/);
    assert.equal(JSON.stringify(decision), before);
    await fiber.dispose();
    assert.equal(ctx.tools.schemas().some(s => s.name === 'decision_lab'), false, 'unload unregisters the tool');
  } finally { await ctx.fiber.dispose(); }
});

test('DSH registry refuses malformed decisions and pre-aborted calls without success metadata', async () => {
  const plugin = await import('../index.js');
  const ctx = new Context();
  try {
    await ctx.plugin(SystemPrompt); await ctx.plugin(Tools); await ctx.plugin(plugin);
    for (const decision of [null, {}, { ...fixture(), version: 2 }, { ...fixture(), options: [] }]) {
      const result = await ctx.tools.execute({ name: 'decision_lab', callId: 'invalid', arguments: { decision }, signal: new AbortController().signal });
      assert.equal(result.isError, true);
      assert.equal(result.meta, undefined);
      assert.equal(result.value, undefined);
    }
    const controller = new AbortController(); controller.abort();
    const result = await ctx.tools.execute({ name: 'decision_lab', callId: 'cancelled', arguments: { decision: fixture() }, signal: controller.signal });
    assert.equal(result.isError, true);
    assert.equal(result.meta, undefined);
    assert.equal(result.value, undefined);
  } finally { await ctx.fiber.dispose(); }
});
