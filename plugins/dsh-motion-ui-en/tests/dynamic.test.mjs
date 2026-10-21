import test from 'node:test';
import assert from 'node:assert/strict';
import { curveExample } from '../lib/catalog.js';
import { validateDocument, initialState, evaluate, followupPrompt, fallbackText } from '../lib/protocol.js';
const copy=()=>structuredClone(curveExample);
test('map diagnostics explain row references and distinguish internal keys from display labels',()=>{
 const inline=copy();inline.derived.curve.map.source=[{fraction:1}];
 assert.throws(()=>validateDocument(inline),/string such as "data.samples".*document.data.samples/);
 const labels=copy();labels.derived.curve.map.fields={'功率 W':{const:1}};
 assert.throws(()=>validateDocument(labels),/invalid map field "功率 W".*identifier/);
});
test('mapped chart/table rows recompute from state and match followup derived snapshot',()=>{
 const d=validateDocument(copy()), original=evaluate(d,initialState(d)).derived;
 const state={...initialState(d),contextK:64};const next=evaluate(d,state).derived;
 assert.deepEqual(original.curve.map(r=>r.contextK),[8,16,24,32]);
 assert.deepEqual(next.curve.map(r=>r.contextK),[16,32,48,64]);
 assert.equal(next.curve.at(-1).totalGiB,next.totalGiB);
 assert.equal(next.totalGiB-original.totalGiB,1.5);
 const snap=JSON.parse(followupPrompt(d,state,'analyze',{}).split('UI 参数快照：\n')[1]);assert.deepEqual(snap.derived.curve,next.curve);
 assert.match(fallbackText(d),/32: 14\.858/);
 assert.equal(d.data.samples[0].fraction,.25);
});
test('map scopes and inactive branches cannot escape validation',()=>{
 for(const mutate of [
  d=>d.derived.bad={ref:'item.fraction'},
  d=>d.derived.curve.map.source='derived.curve',
  d=>d.derived.curve.map.fields.contextK={ref:'item.missing'},
  d=>d.derived.curve.map.fields.contextK={ref:'derived.curve'},
  d=>d.derived.curve.map.fields.contextK={map:{source:'data.samples',fields:{x:{const:1}}}},
  d=>d.derived.curve.map.callback='eval',
  d=>d.derived.curve.map.fields.contextK={op:'if',args:[{const:true},{const:1},{ref:'derived.curve'}]}
 ]){const d=copy();mutate(d);assert.throws(()=>validateDocument(d));}
 const d=copy();d.data.samples=[];assert.equal(evaluate(validateDocument(d),initialState(d)).derived.curve.length,0);
});
test('maps enforce total generated rows, evaluation work, field and output size budgets',()=>{
 let d=copy();d.data.samples=Array.from({length:300},()=>({fraction:1}));d.derived.curve2=structuredClone(d.derived.curve);assert.throws(()=>validateDocument(d),/generated row|calculation budget/);
 d=copy();d.derived.curve.map.fields=Object.fromEntries(Array.from({length:17},(_,i)=>['k'+i,{const:1}]));assert.throws(()=>validateDocument(d),/fields/);
 d=copy();d.data.samples=Array.from({length:100},()=>({fraction:1}));d.derived.curve.map.fields={huge:{const:'x'.repeat(2000)}};assert.throws(()=>validateDocument(d),/output exceeds/);
 d=copy();d.derived.curve.map.fields.totalGiB={op:'div',args:[{const:1},{op:'sub',args:[{ref:'state.contextK'},{const:64}]}]};const doc=validateDocument(d);assert.throws(()=>evaluate(doc,{...initialState(doc),contextK:64}),/zero/);
});

test('current render values are checked when a conditional changes a chart cell type',()=>{
 const d=copy();d.derived.curve.map.fields.totalGiB={op:'if',args:[{op:'lt',args:[{ref:'state.contextK'},{const:64}]},{const:1},{const:'invalid numeric series'}]};
 const doc=validateDocument(d);assert.throws(()=>evaluate(doc,{...initialState(doc),contextK:64}),/finite numeric/);
 const x=copy();x.derived.curve.map.fields.contextK={op:'if',args:[{op:'lt',args:[{ref:'state.contextK'},{const:64}]},{const:1},{const:'bad x'}]};
 const xd=validateDocument(x);assert.throws(()=>evaluate(xd,{...initialState(xd),contextK:64}),/numeric x/);
});
