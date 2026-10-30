import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fixture } from './fixture.mjs';

async function client() {
  const entry = new URL('../src/client.jsx', import.meta.url);
  assert.ok(existsSync(entry), 'client implementation must exist');
  const { outputFiles } = await build({ entryPoints: [fileURLToPath(entry)], bundle: true, write: false, format: 'cjs', platform: 'browser', external: ['react'] });
  const module = { exports: {} };
  // DSH receives JSON and evaluates its client modules in the same browser realm.
  // Keep this SSR adapter in the same realm too; a separate vm.Context invents
  // foreign prototypes that the deliberately strict JSON validator must reject.
  vm.compileFunction(outputFiles[0].text, ['module', 'exports', 'require'])(module, module.exports, name => { assert.equal(name, 'react'); return React; });
  return module.exports;
}

test('client registers the keyed DSH tool slot and renders a safe comparison card', async () => {
  const mod = await client();
  let component;
  mod.apply({ slots: { inject(name, callback) { assert.equal(name, 'tool.call.toolview'); callback(); }, register(spec, view) { assert.equal(spec.key, 'decision_lab'); component = view; } } });
  assert.equal(typeof component, 'function');
  const decision = fixture();
  decision.title = '<img src=x onerror=alert(1)>';
  const markup = renderToStaticMarkup(React.createElement(component, { phase: 'result', block: { id: '1', meta: { decisionLab: { version: 1, decision } } } }));
  assert.match(markup, /What would change the result/);
  assert.match(markup, /Fast launch/);
  assert.match(markup, /type="range"/);
  assert.match(markup, /&lt;img/);
  assert.doesNotMatch(markup, /<img /);
});

test('client safely falls back for malformed historical metadata and error results', async () => {
  const { ToolView } = await client();
  const render = props => renderToStaticMarkup(React.createElement(ToolView, props));
  for (const decisionLab of [null, {}, { version: 99 }, { version: 1, decision: {} }, { version: 1, decision: { ...fixture(), options: [] } }]) {
    const text = render({ phase: 'result', block: { meta: { decisionLab }, content: [{ type: 'text', text: '<img src=x>' }] } });
    assert.match(text, /no compatible card data/);
    assert.match(text, /&lt;img/);
    assert.doesNotMatch(text, /type="range"/);
  }
  assert.match(render({ phase: 'result', block: { isError: true, content: [{ type: 'text', text: 'validation failed' }] } }), /role="alert"/);
  assert.match(render({ phase: 'start', block: {} }), /Preparing Decision Lab/);
  assert.match(render({ phase: 'preparing' }), /role="status"/);
  assert.match(render({ phase: 'result', block: {} }), /No result available/);
});
