import test from 'node:test';import assert from 'node:assert/strict';
import {streamUiDefinition as d} from '../src/stream-history.js';
import {previewText,previewDocument} from '../lib/stream.js';
test('stream projection keeps UI calls across reasoning and steps; errors and end clear previews',()=>{
 let state=d.start({},{event:{data:{turn:4}}});
 const delta=(step,index,id,name,argumentsDelta)=>({type:'assistant/chunk',data:{turn:4,step,chunk:{type:'tool-call-delta',index,id,name,argumentsDelta}}});
 let event=delta(1,0,'a','render_text','{"blocks":["第一段",');
 assert.equal(d.match(event).role,'update');state=d.update({state},{event});assert.equal(previewText(state.calls[0].raw).nodes[0].text,'第一段');
 assert.equal(d.match({type:'assistant/chunk',data:{chunk:{type:'reasoning-delta'}}}),null);
 state=d.update({state},{event:delta(1,0,'a',undefined,'"第二段"]}')});assert.equal(previewText(state.calls[0].raw).nodes.length,2);
 state=d.update({state},{event:delta(2,0,'b','render_canvas','{}')});assert.equal(state.calls.length,2);
 assert.equal(d.buildLocationData({state},'turn').turn,4);
 state=d.update({state},{event:{type:'tool/result',data:{callId:'a',message:{isError:true}}}});assert.equal(state.calls.length,1);
 state=d.update({state},{event:{type:'turn/end'}});assert.equal(state.calls.length,0);assert.equal(state.settled,true);
});
test('partial text accepts only whole valid blocks and never guesses unfinished strings',()=>{
 assert.equal(previewText('{"blocks":["unfinished'),null);
 assert.equal(previewText('{"blocks":["done","unfinished').nodes.length,1);
 assert.equal(previewText('{"blocks":[{"type":"button","text":"run","action":"missing"}]}'),null);
 assert.equal(previewDocument('{"document":{"nodes":['),null);
});
test('packed host tool chunks and retries use the same bounded projection',()=>{
 let state=d.start({},{event:{data:{turn:9}}});
 const event={type:'chunkrow/tool-call-chunks',data:{turn:9,step:2,index:0,id:'packed',name:'render_text',args:['{"blocks":[','"packed"]}']}};
 assert.equal(d.match(event).role,'update');state=d.update({state},{event});assert.equal(previewText(state.calls[0].raw).nodes[0].text,'packed');
 state=d.update({state},{event:{type:'llm/retry',data:{turn:9,step:2}}});assert.equal(state.calls.length,0);
});
test('live overlay and durable call preserve a stable materialized node through rebase/end',()=>{
 let state=d.start({},{event:{data:{turn:1}}});const context=()=>({key:'ui:1',id:'1',state,start:{event:{seq:1},location:{kind:'turn'}}});
 assert.equal(d.buildViewNode(context()).visibility,'hidden');
 const event={type:'assistant/live-chunk',seq:3,data:{turn:1,step:1,chunk:{type:'tool-call-delta',index:0,id:'live',name:'render_text',argumentsDelta:'{"blocks":["hello"]}'}}};
 assert.equal(d.match(event).role,'update');state=d.update({state},{event});assert.equal(d.buildViewNode(context()).visibility,'visible');
 state=d.start({},{event:{data:{turn:1}}});assert.equal(d.buildViewNode(context()).key,'ui:1');
 const landed={type:'tool/call',seq:8,data:{turn:1,step:1,callId:'live',name:'render_text',arguments:'{"blocks":["hello"]}'}};
 assert.equal(d.match(landed).role,'update');state=d.update({state},{event:landed});assert.equal(state.calls[0].callId,'live');assert.equal(d.buildViewNode(context()).visibility,'visible');
 state=d.update({state},{event:{type:'turn/end'}});assert.equal(d.buildViewNode(context()).visibility,'hidden');assert.equal(d.buildViewNode(context()).key,'ui:1');
});
