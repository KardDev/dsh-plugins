import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { Context } from '@deepseek-ai/cordis';
import * as plugin from '../index.js';
import { calculatorExample } from '../lib/catalog.js';

const sdk = createRequire(import.meta.resolve('@deepseek-ai/dsh-tools'));
const { default: Tools } = await import(pathToFileURL(sdk.resolve('@deepseek-ai/dsh-tools')));
const { default: SystemPrompt } = await import(pathToFileURL(sdk.resolve('@deepseek-ai/dsh-system-prompt')));

test('rc.5 native registry renders durable UI, rejects bad inputs and disposes all tools/routes', async () => {
  assert.equal(sdk('@deepseek-ai/dsh-tools/package.json').version, '0.2.1-rc.5');
  const root = await mkdtemp(join(tmpdir(), 'motion-rc5-'));
  const previousHome = process.env.DSH_HOME;
  process.env.DSH_HOME = root;
  const ctx = new Context();
  const routes = new Map();
  try {
    // The authenticated HTTP carrier is outside this registry integration test.
    ctx.provide('connection', { fetch: { register(route) {
      routes.set(route.path, route);
      return () => routes.delete(route.path);
    } } });
    await ctx.plugin(SystemPrompt);
    await ctx.plugin(Tools);
    const fiber = ctx.plugin(plugin, { designMode: 'free', autoRepair: false });
    await fiber;
    const names = ctx.tools.schemas().map(tool => tool.name);
    assert.equal(names.length, 17);
    for (const name of ['render_ui', 'render_canvas', 'render_video', 'record_review', 'list_reviews']) assert.ok(names.includes(name));
    assert.ok(routes.has('/api/plugins/dsh-generative-ui/state'));
    const execute = arguments_ => ctx.tools.execute({ name: 'render_ui', callId: 'rc5', arguments: arguments_, signal: new AbortController().signal });
    const rendered = await execute({ document: calculatorExample });
    assert.equal(rendered.isError, false, JSON.stringify(rendered));
    assert.equal(rendered.value.document.title, calculatorExample.title);
    assert.equal(rendered.meta.dshGenerativeUi.documentId, rendered.value.documentId);
    assert.match(rendered.content[0].text, /12\.57/);
    const rejected = await execute({ document: { ...calculatorExample, version: 99 } });
    assert.equal(rejected.isError, true);
    assert.equal(rejected.meta, undefined);
    await fiber.dispose();
    assert.equal(ctx.tools.schemas().length, 0);
    assert.equal(routes.size, 0);
  } finally {
    await ctx.fiber.dispose();
    if (previousHome === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previousHome;
    if (resolve(dirname(root)) !== resolve(tmpdir()) || !basename(root).startsWith('motion-rc5-')) throw new Error('Unsafe test cleanup path');
    await rm(root, { recursive: true, force: true });
  }
});
