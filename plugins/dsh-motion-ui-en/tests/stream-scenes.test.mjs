import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { previewDocument } from '../lib/stream.js';
import { validateDocument, evaluate, fallbackText } from '../lib/protocol.js';
import { sceneExamples, calculatorExample } from '../lib/catalog.js';
import { StreamingPreview, ToolView, ValidatedView } from '../src/view.js';
test('JSON-string wire fields wait for the whole string and remain disabled previews',()=>{const raw=JSON.stringify({document:JSON.stringify(calculatorExample)});assert.equal(previewDocument(raw.slice(0,-3)),null);assert.equal(previewDocument(raw).title,calculatorExample.title);assert.equal(previewDocument(JSON.stringify({document:'"nested"'})),null);});

test('all six scene examples validate, retain text semantics and render accessible components', () => {
  assert.equal(new Set(sceneExamples.map(d => d.presentation.layout)).size, 6);
  for (const example of sceneExamples) {
    const doc = validateDocument(example); assert.match(fallbackText(doc), /示例/);
    const html = renderToStaticMarkup(React.createElement(ValidatedView, { raw: { version: 1, documentId: 'test', callId: 'test', document: doc }, sessionId: 's' }));
    assert.match(html, new RegExp(`data-layout="${doc.presentation.layout}"`));
    if (doc.presentation.layout === 'guide') assert.match(html, /<ol[^>]+dgui-steps/);
    if (doc.presentation.layout === 'status') assert.match(html, /<progress[^>]+aria-label="示例处理进度"/);
  }
});
test('scene vocabulary rejects arbitrary style, invalid progress states and malformed steps', () => {
  const base = sceneExamples[4];
  for (const presentation of [{ layout: 'unknown' }, { accent: '#fff' }, { density: 'tiny' }, { css: 'x' }])
    assert.throws(() => validateDocument({ ...base, presentation }));
  const node = base.nodes[2];
  for (const changes of [{ value: -1 }, { value: 101 }, { max: 0 }, { max: '100' }])
    assert.throws(() => validateDocument({ ...base, nodes: [{ ...node, ...changes }] }));
  assert.throws(() => validateDocument({ ...base, nodes: [{ id: 's', type: 'steps', items: [{ title: 'x', status: 'running' }] }] }));
  assert.throws(() => validateDocument({ ...base, nodes: [{ id: 's', type: 'details', title: 'x', children: [], open: 'yes' }] }));
  const dynamic = validateDocument({ ...base, state: { n: { type: 'number', default: 1, min: 0, max: 200, step: 1 } }, nodes: [{ ...node, value: { ref: 'state.n' } }] });
  assert.throws(() => evaluate(dynamic, { n: 101 }), /progress/);
});
test('every JSON prefix previews only whole valid top-level nodes, including escaped text', () => {
  const source = { ...calculatorExample, actions: calculatorExample.actions, nodes: [...calculatorExample.nodes, { id: 'escaped', type: 'text', text: '引号"、反斜线\\、换行\n与括号 },]。' }] };
  const raw = JSON.stringify({ document: source }); let previous = 0, previews = 0;
  for (let i = 0; i <= raw.length; i++) {
    const doc = previewDocument(raw.slice(0, i));
    if (!doc) continue;
    validateDocument(doc); previews++; assert.ok(doc.nodes.length >= previous); previous = doc.nodes.length;
    for (const node of doc.nodes) assert.deepEqual(node, source.nodes.find(n => n.id === node.id));
  }
  assert.ok(previews > 100); assert.equal(previous, source.nodes.length);
  assert.deepEqual(previewDocument(raw), validateDocument(source));
});
test('prefix parser waits for whole containers, handles forward references and stays bounded', () => {
  const base = { version: 1, title: 'stream', fallback: 'text', nodes: [{ id: 'a', type: 'text', text: 'complete' }, { id: 'b', type: 'metric', label: 'late', value: { ref: 'derived.n' } }], derived: { n: { const: 12 } } };
  const raw = JSON.stringify({ document: base });
  const beforeDerived = raw.indexOf(',"derived"'); assert.equal(previewDocument(raw.slice(0, beforeDerived)).nodes.length, 1);
  assert.equal(previewDocument(raw).nodes.length, 2);
  const card = JSON.stringify({ document: { version: 1, title: 'x', fallback: 'x', nodes: [{ id: 'card', type: 'card', children: [{ id: 'text', type: 'text', text: 'whole' }] }] } });
  assert.equal(previewDocument(card.slice(0, card.indexOf('whole') + 3)), null);
  for (const bad of ['{broken', '{"document":', '{"document":{"__proto__":{}}}', ' '.repeat(131073), '{"document":' + '['.repeat(50), '{"document":{},"document":{}}']) assert.equal(previewDocument(bad), null);
});
test('stream preview is disabled and error/settled phases cannot preserve preview actions', () => {
  const raw = JSON.stringify({ document: calculatorExample });
  const html = renderToStaticMarkup(React.createElement(StreamingPreview, { raw, callId: 'one', sessionId: 's' }));
  assert.match(html, /data-preview="true"/); assert.match(html, /aria-busy="true"/);
  assert.match(html, /生成预览/); for (const control of html.match(/<(?:input|button|select)\b[^>]*>/g)) assert.match(control, /disabled/);
  const failed = renderToStaticMarkup(React.createElement(ToolView, { phase: 'result', block: { isError: true, content: [{ type: 'text', text: 'interrupted' }] } }));
  assert.doesNotMatch(failed, /data-preview|<input|<button/); assert.match(failed, /interrupted/);
});
