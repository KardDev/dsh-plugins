import test from 'node:test';
import assert from 'node:assert/strict';
import { turnUiDefinition as d } from '../src/history.js';
test('turn UI replays successful appended results and filters errors/replacements', () => {
  const start = { type: 'turn/start', data: { turn: 3 } };
  let state = d.start({}, { event: start });
  const event = { type: 'tool/result', surfaceOp: 'append', seq: 7, data: { turn: 3, message: { content: [{ type: 'text', text: 'fallback' }] }, meta: { dshGenerativeUi: { documentId: 'one' } } } };
  assert.equal(d.match(event).role, 'update');
  state = d.update({ state }, { event });
  assert.equal(state.records[0].fallback, 'fallback');
  assert.equal(state.records[0].displayReady,false);
  assert.equal(d.update({ state }, { event }), state);
  const location = d.buildLocationData({ state }, 'turn');
  assert.equal(location.key, 'dshGenerativeUi');
  assert.equal(location.key, d.kind, 'DSH requires definitions to publish only their owned key');
  assert.equal(d.buildLocationData({ state }, 'turn', location), location);
  assert.equal(d.match({ ...event, surfaceOp: 'replace' }), null);
  assert.equal(d.match({ ...event, data: { ...event.data, message: { isError: true } } }), null);
  assert.equal(d.buildLocationData({ state }, 'session'), null);
});

test('turn/end alone releases successful results, including interrupted/error turns and replay',()=>{
  for(const kind of ['completed','interrupted','error','max-tokens']){
    let state=d.start({},{event:{type:'turn/start',data:{turn:4}}});
    const result={type:'tool/result',surfaceOp:'append',seq:8,data:{turn:4,message:{content:[]},meta:{dshGenerativeUi:{documentId:'one'}}}};
    state=d.update({state},{event:result});assert.equal(state.records[0].displayReady,false);
    const end={type:'turn/end',seq:20,data:{turn:4,reason:{kind}}};assert.equal(d.match(end).role,'update');
    const before=d.buildLocationData({state},'turn');state=d.update({state},{event:end});
    assert.equal(state.records[0].displayReady,true);assert.notEqual(d.buildLocationData({state},'turn',before),before);
    assert.equal(d.update({state},{event:end}),state);
  }
});
