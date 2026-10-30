import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ToolView, ValidatedView } from '../src/view.js';
import { calculatorExample, comparisonExample } from '../lib/catalog.js';
const h = React.createElement;
const record = document => ({ version: 1, documentId: '00000000-0000-4000-8000-000000000000', sessionId: 's1', callId: 'c1', document });
const render = (block, extra = {}) => renderToStaticMarkup(h(ToolView, { phase: 'result', sessionId: 's1', block, ...extra }));
test('preparing/running/error states cannot enable actions', () => {
  for (const phase of ['preparing', 'start']) assert.doesNotMatch(renderToStaticMarkup(h(ToolView, { phase })), /<button/);
  const failed = render({ isError: true, content: [{ type: 'text', text: 'Denied' }], meta: { dshGenerativeUi: record(calculatorExample) } });
  assert.match(failed, /Denied/); assert.doesNotMatch(failed, /<button/);
  assert.match(failed,/dgui-tool-error/);assert.doesNotMatch(failed,/dgui-root|<pre|<details/);
});

test('static steps render an ordered guide without invented task status',()=>{
  const doc={version:1,title:'五步流程',fallback:'规划说明',nodes:[{id:'flow',type:'steps',items:{item:[{title:'准备',description:'核对文件。'},{title:'提交'},{title:'发布',status:'active'}]}}]};
  const html=renderToStaticMarkup(h(ValidatedView,{raw:record(doc),sessionId:'s1'}));
  assert.match(html,/<ol[^>]+dgui-steps/);assert.equal((html.match(/class="dgui-step-state"/g)??[]).length,1);
  assert.doesNotMatch(html,/待进行|undefined/);assert.match(html,/Current step/);
});
test('missing, unsupported and malformed metadata retains plain text fallback', () => {
  for (const meta of [undefined, {}, { dshGenerativeUi: record({ ...calculatorExample, version: 2 }) }]) {
    const result = render({ isError: false, content: [{ type: 'text', text: '<script>evil()</script>' }], meta });
    assert.match(result, /&lt;script&gt;/); assert.doesNotMatch(result, /<script>/);
  }
});
test('calculator renders controls, computed values, accessible labels and a disabled initial followup', () => {
  const result = renderToStaticMarkup(h(ValidatedView, { raw: record(calculatorExample), sessionId: 's1', sendPrompt: async () => {} }));
  assert.match(result, /12\.57/); assert.match(result, /type="range"/); assert.match(result, /htmlFor|for=/); assert.match(result, /disabled/);
});
test('chart exposes a labelled SVG and exact data in an accessible table', () => {
  const result = renderToStaticMarkup(h(ValidatedView, { raw: record(comparisonExample), sessionId: 's1' }));
  assert.match(result, /role="img"/); assert.match(result, /Chart data/); assert.match(result, /B<\/td><td[^>]*>18<\/td>/);
});


test('stateless view keeps original explanation without an empty parameter block', () => {
  const result = renderToStaticMarkup(h(ValidatedView, { raw: record(comparisonExample), sessionId: 's1' }));
  assert.doesNotMatch(result, /原始文字说明|显示检查|版本历史/);
  assert.doesNotMatch(result, /原始文字说明与初始参数|<pre>\{\}<\/pre>/);
});


test('decorative icons keep accessible names and tone does not invent a verdict', () => {
  const doc=structuredClone(calculatorExample);doc.nodes[2].tone='warning';doc.nodes[2].icon='cpu';
  const result=renderToStaticMarkup(h(ValidatedView,{raw:record(doc),sessionId:'s1'}));
  assert.match(result,/data-tone="warning"/);
  assert.match(result,/aria-hidden="true"/);
  assert.match(result,/纯权重理论体积/);
  assert.doesNotMatch(result,/预算内|装得下/);
});

test('numeric line axis preserves unequal sampling distances', async () => {
  const {curveExample}=await import('../lib/catalog.js');
  const doc=structuredClone(curveExample);doc.data.samples=[{fraction:.25},{fraction:.5},{fraction:1}];
  const markup=renderToStaticMarkup(h(ValidatedView,{raw:record(doc),sessionId:'s1'}));
  const xs=markup.match(/points="([^"]+)"/)[1].split(' ').map(pair=>Number(pair.split(',')[0]));
  assert.deepEqual(xs,[44,224,584]);
});
