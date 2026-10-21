import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatorExample, comparisonExample } from '../lib/catalog.js';
import { validateDocument, evaluate, initialState, validateState, fallbackText, followupPrompt } from '../lib/protocol.js';
const copy = x => structuredClone(x);

test('unknown-field errors identify the valid scope without accepting invented controls', () => {
  const root=copy(calculatorExample);root.control={type:'slider'};
  assert.throws(()=>validateDocument(root),e=>/unknown field document.control/.test(e.message)&&/allowed fields at document:.*nodes/.test(e.message)&&/belong in nodes/.test(e.message));
  const node=copy(calculatorExample);node.nodes[0].onchange='run()';
  assert.throws(()=>validateDocument(node),e=>/unknown field.*onchange/.test(e.message)&&/allowed fields/.test(e.message));
  assert.doesNotThrow(()=>validateDocument(calculatorExample));
});
test('calculator recomputes from current inputs and preserves an independent fallback', () => {
  const doc = validateDocument(calculatorExample), state = initialState(doc);
  assert.ok(Math.abs(evaluate(doc, state).derived.weightGiB - 12.5728547573) < 1e-8);
  state.bits = 8;
  assert.ok(Math.abs(evaluate(doc, state).derived.weightGiB - 25.1457095146) < 1e-8);
  assert.match(fallbackText(doc), /12\.57/);
  const prompt = followupPrompt(doc, state, 'analyze', { documentId: 'fixture', viewedSessionId: 'sessionB' });
  assert.match(prompt, /"bits": 8/); assert.match(prompt, /sessionB/); assert.doesNotMatch(prompt, /"bits": 4/);
});
test('comparison fallback retains all labels, values and units', () => {
  const doc = validateDocument(comparisonExample), result = fallbackText(doc);
  assert.match(result, /A: 12/); assert.match(result, /B: 18/); assert.match(result, /不是实测/);
});
test('rejects script/HTML escape hatches, unknown keys and components', () => {
  for (const mutation of [d => { d.nodes[0].onClick = 'alert(1)'; }, d => { d.nodes[0].type = 'html'; }, d => { d.nodes[0].style = {}; }, d => { d.url = 'javascript:alert(1)'; }, d => { d.derived.weightGiB = { op: 'eval', args: [] }; }]) {
    const doc = copy(calculatorExample); mutation(doc); assert.throws(() => validateDocument(doc), /DSH UI:/);
  }
  const doc = JSON.parse(JSON.stringify(calculatorExample).replace('"data":{}', '"data":{"__proto__":{}}'));
  assert.throws(() => validateDocument(doc), /unsafe/);
});
test('rejects duplicate IDs, missing refs, bad action keys and cycle in an inactive branch', () => {
  let d = copy(calculatorExample); d.nodes[1].id = d.nodes[0].id; assert.throws(() => validateDocument(d), /unique/);
  d = copy(calculatorExample); d.nodes[2].value.ref = 'state.absent'; assert.throws(() => validateDocument(d), /unknown reference/);
  d = copy(calculatorExample); d.actions.analyze.stateKeys.push('missing'); assert.throws(() => validateDocument(d), /stateKeys/);
  d = copy(calculatorExample); d.derived.weightGiB = { op: 'if', args: [{ const: true }, { const: 1 }, { ref: 'derived.weightGiB' }] }; assert.throws(() => validateDocument(d), /cyclic/);
});
test('step/range/type checks and arithmetic boundary failures', () => {
  const d = validateDocument(calculatorExample), state = initialState(d);
  for (const bits of [0, 17, 4.5, '4', NaN, Infinity]) assert.throws(() => validateState(d, { ...state, bits }), /DSH UI:/);
  assert.throws(() => validateState(d, { bits: 4 }), /state keys/);
  assert.throws(() => validateState(d, { ...state, extra: 1 }), /state keys/);
  const zero = copy(d); zero.derived.weightGiB = { op: 'div', args: [{ const: 1 }, { const: 0 }] }; assert.throws(() => validateDocument(zero), /division by zero/);
  const overflow = copy(d); overflow.derived.weightGiB = { op: 'mul', args: [{ const: 1e308 }, { const: 1e308 }] }; assert.throws(() => validateDocument(overflow), /non-finite/);
});
test('enforces resource limits and numeric chart values', () => {
  const d = copy(comparisonExample); d.data.results[0].value = '12'; assert.throws(() => validateDocument(d), /numeric values/);
  d.data.results = Array.from({ length: 501 }, () => ({ name: 'x', value: 1 })); assert.throws(() => validateDocument(d), /too many array/);
  const big = copy(calculatorExample); big.fallback = 'x'.repeat(8193); assert.throws(() => validateDocument(big), /8192/);
  const deep = copy(calculatorExample); let nodes = deep.nodes; for (let i = 0; i < 14; i++) { nodes.push({ id: `nest${i}`, type: 'column', children: [] }); nodes = nodes.at(-1).children; } assert.throws(() => validateDocument(deep), /depth/);
});
test('select options all satisfy their state type and numeric range', () => {
  for (const options of [[4, '8 GiB'], [4, 100], [4, 4.5]]) {
    const doc = copy(calculatorExample); doc.state.bits.options = options;
    assert.throws(() => validateDocument(doc));
  }
  const doc = copy(calculatorExample); doc.state.bits.options = [4, 8, 16];
  assert.doesNotThrow(() => validateDocument(doc));
  doc.state.bits.options = [4, '8', 16];
  assert.deepEqual(validateDocument(doc).state.bits.options, [4, 8, 16]);
});

test('followup snapshots current chained derived values with the renderer evaluator', () => {
  const input = copy(calculatorExample);
  input.derived.rounded = { op: 'round', args: [{ ref: 'derived.weightGiB' }] };
  input.derived.verdict = { op: 'if', args: [{ op: 'lt', args: [{ ref: 'derived.rounded' }, { const: 20 }] }, { const: 'fits' }, { const: 'over' }] };
  input.actions.analyze.stateKeys = ['bits'];
  const doc = validateDocument(input), state = { ...initialState(doc), bits: 8 };
  const prompt = followupPrompt(doc, state, 'analyze', { documentId: 'fixture' });
  const snapshot = JSON.parse(prompt.split('UI 参数快照：\n')[1]);
  assert.deepEqual(snapshot.state, { bits: 8 });
  assert.deepEqual(snapshot.derived, evaluate(doc, state).derived);
  assert.equal(snapshot.derived.rounded, 25);
  assert.equal(snapshot.derived.verdict, 'over');
  assert.equal(snapshot.derived.weightGiB.toFixed(2), '25.15');
  assert.throws(() => followupPrompt(doc, { ...state, bits: 100 }, 'analyze', {}));
});

test('stateless fallback omits empty initial parameters but retains the dataset', () => {
  const doc = validateDocument(comparisonExample);
  assert.doesNotMatch(fallbackText(doc), /初始参数|\{\}/);
  assert.match(fallbackText(doc), /B: 18/);
  assert.match(fallbackText(validateDocument(calculatorExample)), /初始参数：.*"bits":4/);
});

test('presentation vocabulary is bounded and legacy documents still validate', () => {
  assert.doesNotThrow(() => validateDocument(comparisonExample));
  for(const mutation of [d=>d.nodes[2].icon='<svg onload=alert(1)>',d=>d.nodes[2].tone='red',d=>d.nodes[0].icon='cpu']) {
    const d=copy(calculatorExample);mutation(d);assert.throws(()=>validateDocument(d));
  }
  const d=copy(calculatorExample);d.nodes[2].tone='success';d.nodes[2].icon='database';assert.doesNotThrow(()=>validateDocument(d));
});

test('conditional strings and comparison aliases reach the complete text projection', () => {
  const d=copy(calculatorExample);
  d.derived.exceeds={op:'gt',args:[{ref:'derived.weightGiB'},{const:20}]};
  d.derived.atLeast={op:'gte',args:[{ref:'state.bits'},{const:4}]};
  d.derived.changed={op:'neq',args:[{ref:'state.bits'},{const:4}]};
  d.derived.verdict={op:'if',args:[{ref:'derived.exceeds'},{const:'超过理论预算'},{const:'在理论预算内'}]};
  d.nodes.push({id:'section',type:'card',title:'结论与口径',children:[{id:'verdict',type:'text',text:{ref:'derived.verdict'}},{id:'dynamic',type:'text',text:{ref:'state.bits'}}]});
  const doc=validateDocument(d), original=evaluate(doc,initialState(doc)).derived;
  assert.equal(original.atLeast,true);assert.equal(original.changed,false);
  assert.match(fallbackText(doc),/结论与口径\n在理论预算内\n4/);
  assert.match(fallbackText(doc),/理论估算，不是实际 GGUF/);
  const next=evaluate(doc,{...initialState(doc),bits:8}).derived;
  assert.equal(next.exceeds,true);assert.equal(next.changed,true);assert.equal(next.verdict,'超过理论预算');
});
