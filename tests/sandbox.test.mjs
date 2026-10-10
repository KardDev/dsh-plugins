import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDocument, fallbackText } from '../lib/protocol.js';
import { bicycleExample, oscillatorExample } from '../lib/canvas-example.js';
import { canvasPatch, canvasSnapshot, sandboxDocument } from '../lib/sandbox.js';
import { previewDocument } from '../lib/stream.js';
import { architectureExample, scatterExample } from '../lib/visual-examples.js';
test('freeform examples validate, retain source and project useful text without executable source', () => {
  for (const example of [bicycleExample, oscillatorExample, architectureExample, scatterExample]) {
    const doc = validateDocument(example), text = fallbackText(doc);
    assert.match(text, /示意|演示/); assert.doesNotMatch(text, /requestAnimationFrame|<svg/);
    assert.equal(doc.nodes.find(n => n.type === 'sandbox').script, example.nodes.find(n => n.type === 'sandbox').script);
    assert.ok(previewDocument(JSON.stringify({ document: example })));
  }
});
test('canvas scope, source size and height are bounded; arbitrary standard HTML stays rejected', () => {
  for (const patch of [{ stateKeys: ['missing'] }, { derivedKeys: ['missing'] }, { dataKeys: ['missing'] }, { stateKeys: ['focus', 'focus'] }, { height: 1001 }, { script: 'x'.repeat(49153) }, { src: 'https://example.com' }]) {
    const doc = structuredClone(bicycleExample); Object.assign(doc.nodes[1], patch); assert.throws(() => validateDocument(doc));
  }
  const doc = structuredClone(bicycleExample); doc.nodes[1].script = ' '.repeat(9000); assert.doesNotThrow(() => validateDocument(doc));
  doc.nodes[0].html = '<b>bad</b>'; assert.throws(() => validateDocument(doc), /unknown field/);
});
test('state bridge exposes only explicitly selected data and rejects undeclared patches', () => {
  const node = { stateKeys: ['focus'], dataKeys: ['public'], derivedKeys: ['phase'] };
  assert.deepEqual(canvasSnapshot(node, { focus: 'all', hidden: 9 }, { public: 1, private: 2 }, { phase: 'a', hidden: 'b' }, true, {}), { state: { focus: 'all' }, data: { public: 1 }, derived: { phase: 'a' }, disabled: true, theme: {} });
  assert.deepEqual(canvasPatch({ focus: 'frame' }, node), { focus: 'frame' });
  for (const patch of [[], null, {}, { hidden: 1 }, JSON.parse('{"__proto__":1}')]) assert.throws(() => canvasPatch(patch, node));
});
test('source cannot break out of bootstrap script; CSP denies remote resources and evaluation', () => {
  const result = sandboxDocument({ html: '</script><script>parent.evil()</script>', script: '</script><img src=x>', css: '' }, 'channel', 'nonce');
  assert.equal((result.match(/<script /g) ?? []).length, 1); assert.equal((result.match(/<\/script>/g) ?? []).length, 1);
  assert.match(result, /connect-src 'none'/); assert.match(result, /frame-src 'none'/); assert.doesNotMatch(result, /unsafe-eval|allow-same-origin/);
});
