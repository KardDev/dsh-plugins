import test from 'node:test';import assert from 'node:assert/strict';import{mkdtemp,rm}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';
import{registerFenceFeedback}from'../lib/fence-feedback.js';import{diagnoseDelivery,resolveSourceFence}from'../lib/delivery.js';import{SCENES,sceneCatalog}from'../lib/scene-library.js';import{UiStore}from'../lib/store.js';import{diagnosticsRoute}from'../lib/diagnostics-route.js';import{visualDefaults}from'../lib/visual-defaults.js';
const source=items=>({title:'测试',items});
test('canonical delivery retains partial diagnostics and rejects discarded critical controls',()=>{
 assert.equal(diagnoseDelivery({version:1,title:'混排',fallback:'混排',nodes:[{id:'curve',type:'plot',series:[{expr:'a*sin(x)',params:[{name:'a',value:1,min:0,max:3}]}]},{id:'values',type:'table',columns:[{key:0,label:'值'}],rows:[[1],[2]]}]}).complete,true);
 assert.equal(diagnoseDelivery(source([{type:'heading',text:'兼容标题'}])).complete,true);
 const report=diagnoseDelivery(source([{type:'text',content:'保留'},{type:'stat'}]));assert.equal(report.valid,true);assert.equal(report.complete,false);assert.deepEqual(diagnoseDelivery(report.document).diagnostics,report.diagnostics);
 const critical=diagnoseDelivery(source([{type:'text',content:'保留'},{type:'quiz',question:'缺失选项'}]));assert.equal(critical.valid,false);assert.match(critical.diagnostics[0].message,/critical component/);
 assert.equal(resolveSourceFence('{"title":"测试","items":[{"type":"text","content":"完整"},]}').valid,true);
 assert.equal(resolveSourceFence('{"items":[{"type":"text","content":"截断').valid,false);
 assert.deepEqual(visualDefaults({items:[{type:'select',id:'pick',options:['A','B'],selected:1}]}),{pick:'B'});
 assert.equal(resolveSourceFence('00000000-0000-4000-8000-000000000000').marker,true);
});
test('fence feedback is same-turn, deduplicated, replayable, cancellable and does not stop inference',()=>{
 const handlers=new Map(),ctx={on:(type,fn)=>handlers.set(type,fn)},notices=[],history=[],session={id:'test',header:{version:4},snapshotEvents:()=>history};
 const agent={session,steer:message=>{notices.push(message);observe({type:'user/message',data:message})}};
 registerFenceFeedback(ctx);const observe=event=>{history.push(event);handlers.get('session/event')(session,event)},stop=()=>handlers.get('agent/turn-stopping')({agent,turn:1,signal:new AbortController().signal});
 observe({type:'turn/start',data:{turn:1}});observe({type:'assistant/message',data:{step:0,message:{content:[{type:'reasoning',text:'```dsh-ui\nBAD\n```'},{type:'text',text:'```dsh-ui\n{"items":[}\n```'}]}}});stop();stop();assert.equal(notices.length,1);assert.match(notices[0].content[0].text,/Invalid JSON/);
 observe({type:'assistant/message',data:{step:1,message:{content:[{type:'text',text:'```dsh-ui\n{"items":[{"type":"quiz"}]}\n```'}]}}});stop();assert.equal(notices.length,2);
 observe({type:'assistant/message',data:{step:2,message:{content:[{type:'text',text:'```dsh-ui\nBAD AGAIN\n```'}]}}});stop();assert.equal(notices.length,2);
 const restored=new Map();registerFenceFeedback({on:(k,fn)=>restored.set(k,fn)});restored.get('agent/turn-stopping')({agent,turn:1,signal:new AbortController().signal});assert.equal(notices.length,2);
 observe({type:'turn/start',data:{turn:2}});observe({type:'assistant/message',data:{step:0,message:{content:[{type:'text',text:'```dsh-ui\nBAD\n```'}]}}});const aborted=new AbortController();aborted.abort();handlers.get('agent/turn-stopping')({agent,turn:2,signal:aborted.signal});assert.equal(notices.length,2);
 session.header.parentSession='parent';handlers.get('agent/turn-stopping')({agent,turn:2,signal:new AbortController().signal});assert.equal(notices.length,2);
 assert.equal(registerFenceFeedback({}).available,false);
});
test('scene catalog returns eight valid short examples and targeted retrieval',()=>{assert.equal(sceneCatalog().scenes.length,8);for(const scene of SCENES){const result=sceneCatalog(scene.id);assert.equal(diagnoseDelivery(result.document).complete,true);assert.ok(JSON.stringify(result).length<6000)}assert.throws(()=>sceneCatalog('missing'),/Unknown scene/)});
test('document update is atomic, idempotent, session-owned and retains compatible input values',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'motion-update-'));try{const store=new UiStore(dir);const first=await store.create(source([{type:'input',id:'goal',label:'目标'}]),{sessionId:'A',callId:'first'});await store.saveState(first.documentId,'A',0,{visual_visual:{fields:{goal:'保留'}}});
 const operation={mode:'append',document:source([{type:'text',content:'新说明'}])};const next=await store.update(first.documentId,'A',0,'append-note',operation);assert.equal(next.document.nodes[0].spec.items.length,2);assert.equal(next.documentRevision,1);assert.equal((await store.readState(first.documentId,'A')).state.visual_visual.fields.goal,'保留');
 assert.equal((await store.update(first.documentId,'A',0,'append-note',operation)).documentRevision,1);assert.equal((await store.update(first.documentId,'A',0,'append-note',{document:operation.document,mode:operation.mode})).documentRevision,1);
 await assert.rejects(()=>store.update(first.documentId,'A',1,'append-note',{...operation,mode:'replace'}),e=>e.status===409);
 await assert.rejects(()=>store.update(first.documentId,'B',1,'foreign',operation),e=>e.status===403);
 await assert.rejects(()=>store.update(first.documentId,'A',0,'stale',operation),e=>e.status===409);
 const replace={mode:'replace',targetId:'visual',document:source([{type:'input',id:'goal',label:'更新标签'},{type:'text',content:'替换说明'}])};await store.update(first.documentId,'A',1,'replace-view',replace);assert.equal((await store.readState(first.documentId,'A')).state.visual_visual.fields.goal,'保留');
 await store.update(first.documentId,'A',2,'replace-root',{mode:'replace',document:source([{type:'input',id:'goal',label:'保留参数'},{type:'card',title:'说明',children:[{type:'heading',text:'新标题'}]}])});assert.equal((await store.readState(first.documentId,'A')).state.visual_visual.fields.goal,'保留');assert.equal((await store.history(first.documentId,'A')).versions.length,4);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('new native inputs get defaults while old saved state remains valid',async()=>{const dir=await mkdtemp(join(tmpdir(),'motion-defaults-'));try{const store=new UiStore(dir),first=await store.create({version:1,title:'参数',fallback:'参数',state:{a:{type:'number',default:1,min:0,max:10,step:1}},nodes:[{id:'a',type:'slider',label:'A',bind:'state.a'}]},{sessionId:'A'});await store.saveState(first.documentId,'A',0,{a:7});await store.update(first.documentId,'A',0,'append-input',{mode:'append',document:{version:1,title:'新增',fallback:'新增',state:{b:{type:'number',default:2,min:0,max:10,step:1}},nodes:[{id:'b',type:'slider',label:'B',bind:'state.b'}]}});assert.deepEqual((await store.readState(first.documentId,'A')).state,{a:7,b:2})}finally{await rm(dir,{recursive:true,force:true})}});
test('diagnostics expose asset health without profile paths or credentials',async()=>{const response=await diagnosticsRoute({available:true})();assert.equal(response.status,200);const value=await response.json();assert.ok(value.assets.every(x=>x.available));assert.equal(value.feedbackHookRegistered,true);assert.doesNotMatch(JSON.stringify(value),/C:\\|token|cookie|apiKey/i)});
