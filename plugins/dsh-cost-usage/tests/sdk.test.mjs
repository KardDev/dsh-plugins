import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { Context } from '@deepseek-ai/cordis';
import ProjectionRegistry from '@deepseek-ai/dsh-session-projection';
import * as plugin from '../lib/index.js';

// Resolve the session value types from the projection service's peer graph.
const sdk = createRequire(import.meta.resolve('@deepseek-ai/dsh-session-projection'));
const { Session, SessionId } = await import(pathToFileURL(sdk.resolve('@deepseek-ai/dsh-session')));
const { createAssistantMessage } = await import(pathToFileURL(sdk.resolve('@deepseek-ai/dsh-llm')));
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);

test('rc.5 projection replays token costs, follows committed events and unregisters on unload', async () => {
  assert.equal(sdk('@deepseek-ai/dsh-session-projection/package.json').version, '0.2.1-rc.5');
  const ctx = new Context();
  try {
    await ctx.plugin(ProjectionRegistry);
    const config = { currency: 'CAD$', pricing: { mock: { teacher: { input: 0.01, output: 0.02, cacheRead: 0.003, cacheWrite: 0.004 } } } };
    let fiber = ctx.plugin(plugin, config);
    await fiber;
    const session = Session.create(SessionId('cost-sdk-rc5'));
    const append = (model, usage) => session.append('assistant/message', {
      turn: 1, step: 1, stream: [], usage,
      message: createAssistantMessage({ source: { provider: 'mock', model }, content: [{ type: 'text', text: 'Fixture response' }] }),
    }, { surfaceOp: 'append' });
    // Historical events must fold exactly once on the first projection read.
    append('teacher', { inputTokens: 100, outputTokens: 10, cacheReadTokens: 20, cacheWriteTokens: 5 });
    const view = () => ctx.sessionProjections.snapshot(session).values.costUsage;
    near(view().totalCost, 1.28);
    near(view().totalInputCost, 1);
    near(view().totalOutputCost, 0.2);
    near(view().totalCacheReadCost, 0.06);
    near(view().totalCacheWriteCost, 0.02);
    assert.equal(view().currency, 'CAD$');
    near(view().routes['mock/teacher'].totalCost, 1.28);
    near(view().totalCost, 1.28); // Cached reads must not charge twice.

    const event = append('teacher', { inputTokens: 100, outputTokens: 0 });
    ctx.emit('session/event', session, event);
    near(view().totalCost, 2.28);
    append('unpriced', { inputTokens: 999, outputTokens: 999 });
    near(view().totalCost, 2.28);
    assert.deepEqual(Object.keys(view().routes), ['mock/teacher']);

    await fiber.dispose();
    assert.equal(view(), undefined);
    fiber = ctx.plugin(plugin, config);
    await fiber;
    near(view().totalCost, 2.28); // Reload rebuilds from the session log.
    await fiber.dispose();
    assert.equal(view(), undefined);
  } finally {
    await ctx.fiber.dispose();
  }
});
