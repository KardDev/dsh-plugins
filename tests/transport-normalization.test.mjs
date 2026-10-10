import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDocument,initialState,evaluate,validateState} from '../lib/protocol.js';
import {previewDocument} from '../lib/stream.js';
const base = () => ({version:1,title:'参数传输兼容',fallback:'演示，不是实测。',nodes:[{id:'note',type:'text',text:'001'}]});
const numeric = () => ({type:'number',default:'2',min:'1',max:'12',step:'1'});

test('typed transport values and nested list wrappers normalize without changing labels, data or canvas source',()=>{
  const source='const text="\\n"; // preserve backslashes';
  const input={...base(),version:'1',state:{people:numeric(),enabled:{type:'boolean',default:'false',options:{item:['false','true']}},choice:{type:'string',default:'002',options:{item:['001','002']}},payload:{type:'json',default:{item:['01','02']}}},data:{payload:{item:['01','02']},text:'123'},derived:{total:{op:'mul',args:{item:[{ref:'state.people'},{const:'2'}]}},same:{op:'eq',args:{item:[{const:'2'},{const:2}]}},display:{const:'002'},conditional:{op:'if',args:{item:[{const:'true'},{const:'yes'},{const:'no'}]}}},nodes:{item:[{id:'group',type:'card',children:{item:[{id:'slider',type:'slider',label:'人数',bind:'state.people'},{id:'metric',type:'metric',label:'编号',value:'002',decimals:'0'}]}},{id:'table',type:'table',columns:{item:[{key:'code',label:'编号'}]},rows:{item:[{code:'002'}]}},{id:'canvas',type:'sandbox',title:'示例',fallback:'代码保持原样',html:'<p>\\n</p>',css:'p{color:red}/*\\n*/',script:source,height:'200',stateKeys:{item:['people']}}]}};
  const doc=validateDocument(input);
  assert.equal(doc.version,1);assert.deepEqual(doc.state.people,{type:'number',default:2,min:1,max:12,step:1});
  assert.equal(doc.state.enabled.default,false);assert.deepEqual(doc.state.enabled.options,[false,true]);
  assert.equal(doc.state.choice.default,'002');assert.deepEqual(doc.state.payload.default,{item:['01','02']});assert.deepEqual(doc.data,input.data);
  assert.equal(doc.nodes[0].children[1].value,'002');assert.equal(doc.nodes[0].children[1].decimals,0);
  assert.deepEqual(doc.nodes[1].rows,[{code:'002'}]);assert.equal(doc.nodes[2].script,source);assert.equal(doc.nodes[2].html,input.nodes.item[2].html);assert.equal(doc.nodes[2].css,input.nodes.item[2].css);
  const computed=evaluate(doc,initialState(doc));assert.equal(computed.derived.total,4);assert.equal(computed.derived.same,false);assert.equal(computed.derived.display,'002');assert.equal(computed.derived.conditional,'yes');
  assert.equal(input.state.people.default,'2');assert.deepEqual(validateDocument(doc),doc);assert.deepEqual(previewDocument(JSON.stringify({document:input})),doc);
  assert.throws(()=>validateState(doc,{...initialState(doc),people:'2'}),/numeric range/);
});

test('state specification wrappers and one JSON object decode before validation without dropping extra or unsafe fields',()=>{
  for(const spec of [{item:numeric()},JSON.stringify(numeric())])assert.equal(validateDocument({...base(),state:{people:spec}}).state.people.default,2);
  for(const spec of [{item:numeric(),extra:true},JSON.stringify({...numeric(),extra:true})])assert.throws(()=>validateDocument({...base(),state:{people:spec}}),/unknown field state\.people/);
  for(const spec of ['{"type":"json","default":{"__proto__":{}}}','{"type":"json","default":{"constructor":{}}}'])assert.throws(()=>validateDocument({...base(),state:{people:spec}}),/unsafe property/);
  const deep={};let next=deep;for(let i=0;i<50;i++)next=next.a={};assert.throws(()=>validateDocument({...base(),state:{people:JSON.stringify({type:'json',default:deep})}}),/nesting is too deep/);
});

test('ambiguous values, missing bounds and missing operands receive exact errors instead of guessed repairs',()=>{
  for(const value of ['2 GiB','01','0x10','','Infinity','1e309','9007199254740993'])assert.throws(()=>validateDocument({...base(),state:{people:{...numeric(),default:value}}}),/state\.people\.default must be a finite JSON number/);
  assert.throws(()=>validateDocument({...base(),state:{people:{type:'number',default:'2'}}}),/state\.people\.min.*undefined/);
  assert.throws(()=>validateDocument({...base(),state:{people:{...numeric(),max:'1'}}}),/state\.people.*min < max/);
  assert.throws(()=>validateDocument({...base(),state:{choice:{type:'string',default:'a',options:{item:['a'],extra:true}}}}),/state\.choice\.options.*direct array/);
  assert.throws(()=>validateDocument({...base(),derived:{rooms:{op:'round',args:{item:{const:'1'}}}}}),/derived\.rooms.*argument count.*args must be a direct array/);
  assert.throws(()=>validateDocument({...base(),derived:{rooms:{op:'div',args:{item:[{const:'2'}]}}}}),/derived\.rooms.*2\.\.2.*1 arguments/);
  assert.throws(()=>validateDocument({...base(),derived:{rooms:{op:'mul',args:{item:[{const:'2'}],extra:true}}}}),/derived\.rooms.*argument count/);
  const doc=validateDocument({...base(),state:{people:numeric()},derived:{rooms:{expr:'round(state.people / 2 + 0.25)'}}});
  for(let people=1;people<=12;people++)assert.equal(evaluate(doc,{people}).derived.rooms,Math.ceil(people/2));
});
