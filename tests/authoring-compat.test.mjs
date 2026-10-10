import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {toolJson} from '../lib/tool-json.js';
import {validateDocument,initialState,validateState,evaluate,fallbackText} from '../lib/protocol.js';
import {previewDocument} from '../lib/stream.js';
import {UiStore} from '../lib/store.js';
const base=()=>({version:1,title:'写法兼容',fallback:'示例，非实测',nodes:[]});

test('JSON transport accepts fences and trailing commas without rewriting strings or guessing code',()=>{
  const value={...base(),nodes:[{id:'说明',type:'text',text:'a,}\\"\n<script>not executed</script>'}]};
  const encoded='\uFEFF```json\n'+JSON.stringify(value).replace(/}$/,',}')+'\n```';
  assert.deepEqual(toolJson(encoded,'document'),value);
  assert.deepEqual(previewDocument(JSON.stringify({document:encoded})),validateDocument(value));
  for(const source of ['{a:1}',"{'a':1}",'"nested"','{"nodes":[','{"a":"unescaped\nnewline"}']){
    if(source==='"nested"')assert.equal(toolJson(source,'document'),'nested');
    else assert.throws(()=>toolJson(source,'document'),/valid JSON.*object directly/);
  }
  assert.throws(()=>toolJson('{"a":1}','document',2),/size limit/);
});

test('inline rows, table captions and verbatim metric strings render through the same canonical evaluator',()=>{
  const doc=validateDocument({...base(),nodes:[
    {id:'状态',type:'metric',label:'进展',value:'等待确认'},
    {id:'估算',type:'metric',label:'估算',value:'约 12 GiB'},
    {id:'tbl',type:'table',label:'方案比较',columns:[{key:'方案',label:'方案'}],rows:[{'方案':'A'}]},
    {id:'chart',type:'chart',kind:'bar',label:'示例',rows:[{项目:'A',分数:3}],labelKey:'项目',valueKey:'分数'}
  ]});
  const computed=evaluate(doc,{});
  assert.equal(computed.resolveValue(doc.nodes[1].value),'约 12 GiB');
  assert.deepEqual(computed.resolveValue(doc.nodes[2].rows),[{方案:'A'}]);
  assert.match(fallbackText(doc),/等待确认[\s\S]*约 12 GiB[\s\S]*方案比较/);
  const bad=structuredClone(doc);bad.nodes[3].rows[0].分数='3';assert.throws(()=>validateDocument(bad),/numeric/);
  bad.nodes[3].rows=[null];assert.throws(()=>validateDocument(bad),/array of objects/);
});

test('Unicode keys work in formulas, map fields, references and row shorthand without allowing property chains',()=>{
  const doc=validateDocument({...base(),state:{电压:{type:'number',default:6,min:1,max:12,step:1}},data:{采样:[{比例:2}]},derived:{功率:{expr:'state.电压 * 2'},结果:{map:{source:'data.采样',fields:{功率:{expr:'derived.功率 * item.比例'}}}}},nodes:[{id:'表',type:'table',columns:[{key:'功率',label:'功率'}],rows:'derived.结果'}]});
  assert.deepEqual(evaluate(doc,initialState(doc)).derived.结果,[{功率:24}]);
  for(const k of ['bad.key','bad key','bad-key','1bad'])assert.throws(()=>validateDocument({...base(),data:{[k]:1},nodes:[{id:'t',type:'text',text:'x'}]}),e=>e.message.includes(JSON.stringify(k))&&/invalid key in data/.test(e.message));
  for(const ref of ['data.constructor','data.采样.length','state.__proto__'])assert.throws(()=>validateDocument({...doc,derived:{bad:{ref}}}));
});

test('structured canvas state persists/reloads with validation, including the string/array authoring mismatch',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'dgui-author-'));
  try{
    const store=new UiStore(directory);
    const input={...base(),state:{checklist:{type:'string',default:[{label:'核对',done:false}]}},nodes:[{id:'canvas',type:'sandbox',title:'清单',fallback:'待核对',html:'<p>清单</p>',stateKeys:['checklist']}]};
    const record=await store.create(input,{sessionId:'s',callId:'c'});
    assert.equal(record.document.state.checklist.type,'json');assert.equal(input.state.checklist.type,'string');
    const state={checklist:[{label:'核对',done:true}]};
    await store.saveState(record.documentId,'s',0,state);
    assert.deepEqual((await new UiStore(directory).readState(record.documentId,'s')).state,state);
    for(const value of ['wrong',JSON.parse('{"__proto__":{}}'),{text:'x'.repeat(8193)},Array(501).fill(1),{a:'x'.repeat(8192),b:'y'.repeat(8192)}])assert.throws(()=>validateState(record.document,{checklist:value}));
    const native={...input,nodes:[{id:'i',type:'input',label:'清单',bind:'state.checklist'}]};assert.throws(()=>validateDocument(native),/structured state.*sandbox.*boolean/);
  }finally{await rm(directory,{recursive:true,force:true});}
});
