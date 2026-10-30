import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';

test('browser build registers a DSH module and uses host React', async () => {
  const mod = await import('../scripts/build.mjs').catch(() => null);
  assert.equal(typeof mod?.buildClient, 'function', 'buildClient must exist');
  const dir = await mkdtemp(join(tmpdir(), 'decision-build-'));
  try {
    const entry = join(dir, 'entry.jsx');
    const out = join(dir, 'client.js');
    await writeFile(entry, "import React from 'react'; export const inject=['slots']; export const identity=React; export function apply() { return 'ready'; }");
    await mod.buildClient(entry, out);
    let registration;
    const react = { sentinel: true };
    vm.runInNewContext(await readFile(out, 'utf8'), { window: { __ModuleLoader__: { load(value) { registration = value; } } } });
    assert.equal(registration.id, 'dsh-decision-lab');
    const plugin = registration.factory(name => { assert.equal(name, 'react'); return react; });
    assert.equal(plugin.identity, react);
    assert.equal(plugin.apply(), 'ready');
    assert.deepEqual(Array.from(plugin.inject), ['slots']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
