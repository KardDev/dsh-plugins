import {expandedBudget} from './fixtures/expanded-travel-budget.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {validateDocument,evaluate,initialState} from '../lib/protocol.js';
import {compileExpression} from '../lib/author-expression.js';
import {travelBudget} from './fixtures/travel-budget.mjs';
test('complete travel budget uses simple inline reactive rows and exact ceil rooms',()=>{
 const doc=validateDocument(travelBudget),base=initialState(doc),chart=doc.nodes.find(n=>n.type==='chart');
 const initial=evaluate(doc,base);assert.equal(initial.derived.total,4620);assert.equal(initial.derived.perPerson,2310);assert.deepEqual(initial.resolveValue(chart.rows).map(r=>r.value),[1000,1600,1600,420]);
 for(let people=1;people<=12;people++)for(const days of[1,5,15]){const state={...base,people,days};const result=evaluate(doc,state),rooms=Math.ceil(people/2),expected=people*days*100+rooms*(days-1)*400+people*800;assert.equal(result.derived.rooms,rooms);assert.equal(result.derived.total,expected+expected/10);assert.equal(result.resolveValue(chart.rows).reduce((a,r)=>a+r.value,0),result.derived.total)}
 assert.deepEqual(travelBudget.derived.rooms,{expr:'ceil(state.people / 2)'});
});
test('formula cells work in chart and table without reinterpreting literal data',()=>{
 const raw=structuredClone(travelBudget),chart=raw.nodes.find(n=>n.type==='chart');chart.rows[0].value={expr:'state.people * state.days * state.meal'};raw.nodes.push({id:'table',type:'table',columns:[{key:'text',label:'说明'},{key:'value',label:'数值'}],rows:[{text:'{ref:"state.people"}',value:{expr:'ceil(state.people / 2)'}},{text:'负数取整',value:{expr:'floor(-2.5)'}}]});raw.data={literal:[{value:{ref:'state.people'}}]};
 const doc=validateDocument(raw),result=evaluate(doc,initialState(doc));assert.equal(result.resolveValue(doc.nodes.find(n=>n.type==='chart').rows)[0].value,1000);assert.deepEqual(result.resolveValue(doc.nodes.at(-1).rows),[{text:'{ref:"state.people"}',value:1},{text:'负数取整',value:-3}]);assert.deepEqual(result.resolveValue({ref:'data.literal'}),raw.data.literal);
 for(const formula of['ceil(1,2)','floor()','ceil(globalThis.x)','Math.ceil(1)'])assert.throws(()=>validateDocument({...travelBudget,derived:{x:{expr:formula}}}));
 for(const source of['ceil(-2.5)','floor(-2.5)'])assert.ok(compileExpression(source));
});
test('missing roots, nested children and chart cells report precise repair locations',()=>{
 const absent=structuredClone(travelBudget);delete absent.nodes;assert.throws(()=>validateDocument(absent),/document.nodes.*SAME complete document/);
 assert.throws(()=>validateDocument({data:{rows:[]},derived:{}}),/document.version is missing.*not a partial patch/);
 const bad=structuredClone(travelBudget);bad.nodes[2].children[0].children={};assert.throws(()=>validateDocument(bad),/nodes\[2\].children\[0\].children must be an array/);
 const broken=structuredClone(travelBudget);broken.data={comp:[{k:'m',n:'餐饮'}]};broken.nodes.find(n=>n.type==='chart').rows={ref:'data.comp'};assert.throws(()=>validateDocument(broken),/node.chart.rows\[0\].*missing field\(s\) label, value.*Available keys: k, n/);
 for(const value of[{ref:'derived.missing'},{op:'eval',args:[]},{expr:'state.people;alert(1)'},{map:{source:'data.rows',fields:{}}}]){const input=structuredClone(travelBudget);input.nodes.find(n=>n.type==='chart').rows[0].value=value;assert.throws(()=>validateDocument(input))}
});


test('expanded formulas and positional table cells deliver losslessly in one call',()=>{
 const doc=validateDocument(expandedBudget),state=initialState(doc),computed=evaluate(doc,state),table=doc.nodes.find(n=>n.type==='table');assert.equal(computed.derived.totalCost,4620);const rows=computed.resolveValue(table.rows);assert.deepEqual(rows[0],{item:'餐饮',rule:'人数 × 天数 × 每人每天餐饮',amount:1000});assert.equal(rows.at(-1).amount,4620);
 assert.equal(evaluate(doc,{...state,people:3}).derived.rooms,2);assert.equal(evaluate(doc,{...state,people:3}).derived.totalCost,7810);
 const malformed=structuredClone(expandedBudget);malformed.nodes.find(n=>n.type==='table').rows[0].pop();assert.throws(()=>validateDocument(malformed));
});
test('deduplicated validation still enforces scope, unique complexity and runtime budgets',()=>{
 const base={version:1,title:'预算',fallback:'预算',nodes:[{id:'t',type:'text',text:'测试'}]};
 const roots={};for(let i=0;i<64;i++)roots['x'+i]={op:'add',args:[{const:i},{const:i+1000},{const:i+2000}]};assert.throws(()=>validateDocument({...base,derived:roots}),/expression limit/);
 const fields=Object.fromEntries(Array.from({length:16},(_,i)=>['x'+i,{ref:'item.x'}]));assert.throws(()=>validateDocument({...base,data:{samples:Array.from({length:500},()=>({x:1}))},derived:{rows:{map:{source:'data.samples',fields}}}}),/calculation budget/);
 assert.throws(()=>validateDocument({...base,data:{a:[{x:1}],b:[{y:2}]},derived:{a:{map:{source:'data.a',fields:{v:{ref:'item.x'}}}},b:{map:{source:'data.b',fields:{v:{ref:'item.x'}}}}}}),/item/);
});
