import test from 'node:test';
import assert from 'node:assert/strict';
import {textDocument} from '../lib/text-document.js';
import {registerFenceFeedback,isUiDeliveryAnnouncement} from '../lib/fence-feedback.js';

test('mixed text vocabulary and typed object-row table retain content and presentation',()=>{
 const input={blocks:[{id:'note',type:'text',content:'速度更快',spans:{item:[{text:'速度',weight:'700'},{text:'更快'}]}},{id:'rows',type:'table',columns:{item:[{key:'name',label:'名称'},{key:'size',label:'体积',unit:'GB'}]},rows:{item:[{name:'A',size:'23.55'},{name:'B',size:'17.50'}]},types:{item:['text','num']}},{type:'callout',content:'示意数据'}]};
 const before=structuredClone(input),doc=textDocument(input);
 assert.deepEqual(input,before);assert.equal(doc.nodes[0].text,undefined);assert.equal(doc.nodes[0].spans[0].weight,700);
 assert.deepEqual(doc.nodes[1].spec.items[0],{type:'table',columns:['名称','体积 (GB)'],rows:[['A','23.55'],['B','17.50']],types:['text','num']});
 assert.equal(doc.nodes[2].text,'示意数据');assert.ok(doc.state.visual_rows);
 assert.throws(()=>textDocument({blocks:[{type:'text',text:'甲',content:'乙'}]}),/unknown field/);
 assert.throws(()=>textDocument({blocks:[{type:'text',content:'甲',spans:[{text:'乙'}]}]}),/text or spans/);
 assert.throws(()=>textDocument({blocks:[{type:'table',columns:[{key:'n',label:'数'}],rows:[{n:1}],types:['bogus']}]}),/unknown field/);
});

test('failed rendering followed by empty delivery queues one repair, never cuts off reasoning',()=>{
 const handlers=new Map(),history=[],notices=[],session={id:'failed',header:{version:4},snapshotEvents:()=>history};
 const agent={session,steer:m=>{notices.push(m);observe({type:'user/message',data:m})}};
 registerFenceFeedback({on:(k,f)=>handlers.set(k,f)});
 function observe(event){history.push(event);handlers.get('session/event')(session,event)}
 const stop=()=>handlers.get('agent/turn-stopping')({agent,turn:1,signal:new AbortController().signal});
 observe({type:'turn/start',data:{turn:1}});
 observe({type:'tool/call',data:{name:'render_text',callId:'bad'}});
 observe({type:'tool/result',data:{message:{toolCallId:'bad',isError:true,content:[{type:'text',text:'Error: unknown field content'}]}}});
 observe({type:'assistant/message',data:{step:2,message:{content:[{type:'reasoning',text:'I will call render_ui.'}]}}});
 assert.equal(notices.length,0);stop();stop();assert.equal(notices.length,1);assert.match(notices[0].content[0].text,/failed tool arguments/);
 const restored=new Map();registerFenceFeedback({on:(k,f)=>restored.set(k,f)});restored.get('agent/turn-stopping')({agent,turn:1});assert.equal(notices.length,1);
});

test('delivery repair leaves plain answers, successful UIs and unrelated tools alone',()=>{
 for(const scenario of ['plain','success','unrelated']){
  const handlers=new Map(),notices=[],session={id:scenario,header:{version:4}},agent={session,steer:m=>notices.push(m)};
  registerFenceFeedback({on:(k,f)=>handlers.set(k,f)});const observe=e=>handlers.get('session/event')(session,e);
  observe({type:'turn/start',data:{turn:1}});
  if(scenario!=='reasoning-only'){
   observe({type:'tool/call',data:{name:scenario==='unrelated'?'read':'render_ui',callId:'call'}});
   observe({type:'tool/result',data:{message:{toolCallId:'call',isError:scenario!=='success',content:[{type:'text',text:'result'}]}}});
  }
  observe({type:'assistant/message',data:{step:1,message:{content:[{type:scenario==='plain'?'text':'reasoning',text:'完整文字回答'}]}}});
  handlers.get('agent/turn-stopping')({agent,turn:1});assert.equal(notices.length,0,scenario);
 }
});

test('reasoning-only turn receives one completion reminder without requiring a UI',()=>{
 for(const scenario of ['empty','cancelled','silent','disabled','subagent','visible-fence']){
  const handlers=new Map(),history=[],notices=[],session={id:scenario,header:{version:4,...(scenario==='subagent'?{parentSession:'parent'}:{})},snapshotEvents:()=>history};
  const agent={session,steer:m=>{notices.push(m);observe({type:'user/message',data:m})}};
  registerFenceFeedback({on:(k,f)=>handlers.set(k,f)},()=>scenario!=='disabled');
  function observe(e){history.push(e);handlers.get('session/event')(session,e)}
  observe({type:'turn/start',data:{turn:1}});
  observe({type:'user/message',data:{source:{kind:'user'},content:[{type:'text',text:scenario==='silent'?'收到即可，不用回复。':'解释首次发布的五步。'}]}});
  observe({type:'assistant/message',data:{step:1,message:{content:[{type:scenario==='visible-fence'?'text':'reasoning',text:scenario==='visible-fence'?'```dsh-ui\n{"items":[{"type":"text","content":"完整"}]}\n```':'Let me write it.'}]}}});
  const controller=new AbortController();if(scenario==='cancelled')controller.abort();
  const stop=()=>handlers.get('agent/turn-stopping')({agent,turn:1,signal:controller.signal});stop();stop();
  assert.equal(notices.length,scenario==='empty'?1:0,scenario);
  if(scenario==='empty'){
   assert.match(notices[0].content[0].text,/otherwise answer in plain text/);
   const restored=new Map();registerFenceFeedback({on:(k,f)=>restored.set(k,f)});restored.get('agent/turn-stopping')({agent,turn:1});assert.equal(notices.length,1);
  }
 }
});

test('visible UI announcements without delivery are recovered conservatively',()=>{
 for(const text of ['这是一条固定顺序的流程线，用流程图看最清楚 —— 五步，每步一句。','抱歉，上一轮没真正出图。现在把组件补上。','我把这 9 档摊到一张图上看，差别就能看清。']){
  assert.equal(isUiDeliveryAnnouncement(text),true,text);
  const handlers=new Map(),notices=[],session={id:'promise',header:{version:4}},agent={session,steer:m=>notices.push(m)};
  registerFenceFeedback({on:(k,f)=>handlers.set(k,f)});const observe=e=>handlers.get('session/event')(session,e);
  observe({type:'turn/start',data:{turn:1}});observe({type:'assistant/message',data:{step:1,message:{content:[{type:'text',text}]}}});
  handlers.get('agent/turn-stopping')({agent,turn:1});handlers.get('agent/turn-stopping')({agent,turn:1});assert.equal(notices.length,1);
  observe({type:'tool/call',data:{name:'render_text',callId:'done'}});observe({type:'tool/result',data:{message:{toolCallId:'done',isError:false}}});
  handlers.get('agent/turn-stopping')({agent,turn:1});assert.equal(notices.length,1);
 }
 for(const text of ['1. 整理文件\n2. 提交代码','流程图表示步骤及先后关系。','一 GiB 等于 1073741824 字节。','```dsh-ui\n{"items":[]}\n```'])assert.equal(isUiDeliveryAnnouncement(text),false,text);
 assert.equal(isUiDeliveryAnnouncement('用流程图看最清楚。','什么时候用流程图更合适？'),false);
});
