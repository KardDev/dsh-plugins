import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDocument} from '../lib/protocol.js';
import {previewDocument} from '../lib/stream.js';

const fixture=()=>({version:1,title:'Mixed controls',fallback:'Six editable values',state:Object.fromEntries(Array.from({length:6},(_,i)=>['p'+i,{type:'number',default:2,min:1,max:12,step:1}])),nodes:[{id:'canvas',type:'sandbox',title:'Chart',fallback:'A display',height:180,stateKeys:['p0'],html:'<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="3"/></svg>',css:'svg{width:100px}',script:'DSHUI.subscribe(s=>document.body.dataset.value=s.state.p0);'},...Array.from({length:6},(_,i)=>({id:'p'+i,type:i%2?'input':'slider',label:'Parameter '+i,bind:'state.p'+i}))]});
const reorder=(v,reverse=false)=>Array.isArray(v)?v.map(x=>reorder(x,reverse)):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort((a,b)=>reverse?b.localeCompare(a):a.localeCompare(b)).map(k=>[k,reorder(v[k],reverse)])):v;

test('mixed canvas and six controls validate independently of all object key order and node placement',()=>{
 const doc=fixture(),expected=validateDocument(doc);
 for(const reverse of [false,true]){
  const sorted=reorder(doc,reverse);assert.deepEqual(validateDocument(sorted),expected);
  assert.deepEqual(previewDocument(JSON.stringify({document:sorted})),expected);
  sorted.nodes.push(sorted.nodes.shift());assert.equal(validateDocument(sorted).nodes.length,7);
 }
 assert.equal(expected.nodes[1].id,Object.keys(expected.state)[0],'node ids and state keys may coincide');
});
test('missing, invalid and duplicate node ids identify exact nested locations without guessing ids',()=>{
 let doc=fixture();delete doc.nodes[0].id;assert.throws(()=>validateDocument(reorder(doc)),/nodes\[0\]\.id is missing.*sandbox.*field order does not matter/);
 doc=fixture();doc.nodes[0].id='bad-id';assert.throws(()=>validateDocument(doc),/nodes\[0\]\.id is invalid/);
 doc=fixture();doc.nodes.push({id:'group',type:'column',children:[{id:'p0',type:'text',text:'duplicate'}]});assert.throws(()=>validateDocument(doc),/nodes\[7\]\.children\[0\]\.id duplicates "p0" first declared at nodes\[1\]\.id/);
});
test('omitted canvas title and fallback inherit document values while explicit invalid values stay invalid',()=>{
 const doc=fixture();delete doc.nodes[0].title;delete doc.nodes[0].fallback;
 const result=validateDocument(doc);assert.equal(result.nodes[0].title,doc.title);assert.equal(result.nodes[0].fallback,doc.fallback);assert.equal(doc.nodes[0].title,undefined);
 for(const field of ['title','fallback'])for(const value of [null,'',42]){const bad=structuredClone(doc);bad.nodes[0][field]=value;assert.throws(()=>validateDocument(bad));}
 const bad=structuredClone(doc);bad.nodes[0].html={script:'',fallback:'misplaced'};assert.throws(()=>validateDocument(bad),/nodes\[0\]\.html must be a non-empty HTML string.*not inside it/);
});
