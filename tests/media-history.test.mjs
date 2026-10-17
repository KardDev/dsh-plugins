import test from 'node:test';import assert from 'node:assert/strict';
import {visibleMediaRecords,mediaRecord,mediaAssetUrl,mediaHistoryDefinition as d} from '../src/media-history.js';
const id='11111111-1111-4111-8111-111111111111',documentId='22222222-2222-4222-8222-222222222222';
const job={id,sessionId:'test session',kind:'render',status:'completed',documentId,nodeId:'film',files:[{name:'video.mp4',url:'https://untrusted.example/movie.mp4',path:'secret'},{name:'source.html'},{name:'project.zip'},{name:'private.json'}],output:{duration:32,width:1920,height:1080,audio:[{codec:'aac'}]}};
const message=j=>({content:[{type:'text',text:JSON.stringify(j)+'\n[video.mp4](ignored)'}]});
test('historical media results produce compact owned records and canonical local URLs',()=>{
 const r=mediaRecord(message(job));assert.equal(r.id,id);assert.equal(r.duration,32);assert.equal(r.hasAudio,true);assert.deepEqual(r.files,['video.mp4','source.html','project.zip']);
 assert.ok(!JSON.stringify(r).includes('secret'));assert.ok(!JSON.stringify(r).includes('untrusted'));
 assert.equal(mediaAssetUrl(r,'video.mp4'),'/api/plugins/dsh-generative-ui/media?assetId='+id+'&sessionId=test%20session&file=video.mp4');assert.equal(mediaAssetUrl(r,'private.json'),null);assert.equal(mediaAssetUrl({...r,id:'../outside'},'video.mp4'),null);
 for(const bad of [{...job,status:'failed'},{...job,kind:'preview'},{...job,id:'bad'},{...job,files:[]},{...job,sessionId:''}])assert.equal(mediaRecord(message(bad)),null);
 assert.equal(mediaRecord({...message(job),isError:true}),null);assert.equal(mediaRecord({content:[{type:'text',text:'not JSON'}]}),null);
});
test('durable media replay publishes immediately, replaces only same canvas, and keeps other films',()=>{
 let state=d.start({},{event:{type:'turn/start',data:{turn:3}}});
 const event=j=>({type:'tool/result',surfaceOp:'append',seq:7,data:{turn:3,message:message(j)}});
 assert.equal(d.match(event(job)).role,'update');state=d.update({state},{event:event(job)});assert.equal(state.records.length,1);
 assert.equal(d.update({state},{event:event(job)}),state);assert.equal(d.publication(),'immediate');
 const view=d.buildViewNode({key:'k',id:'3',state,start:{event:{seq:1},location:{kind:'turn',turn:3}}});assert.equal(view.visibility,'visible');assert.equal(view.anchorSeq,7);assert.equal(view.kind,'dshMotionMedia');
 const second={...job,id:'33333333-3333-4333-8333-333333333333'};state=d.update({state},{event:event(second)});assert.equal(state.records.length,1);assert.equal(state.records[0].id,second.id);
 state=d.update({state},{event:event({...job,id:'44444444-4444-4444-8444-444444444444',documentId:'55555555-5555-4555-8555-555555555555'})});assert.equal(state.records.length,2);
 state=d.update({state},{event:event({...job,id:'66666666-6666-4666-8666-666666666666',kind:'process'})});assert.equal(state.records.length,3);
 assert.equal(d.match({...event(job),surfaceOp:'replace'}),null);assert.equal(d.match({type:'assistant/message',data:{turn:3,message:message(job)}}),null);
});

test('completed assembly replaces only its input clips without leaking paths',()=>{
 const a=mediaRecord(message(job)),b=mediaRecord(message({...job,id:documentId}));
 const edit=mediaRecord(message({...job,id:'33333333-3333-4333-8333-333333333333',kind:'process',clips:[{path:'C:\\private\\media\\'+id+'\\video.mp4'},{path:'/media/'+documentId+'/video.mp4'}]}));
 assert.deepEqual(edit.inputAssetIds,[id,documentId]);
 assert.ok(!JSON.stringify(edit).includes('private'));
 const unrelated=mediaRecord(message({...job,id:'44444444-4444-4444-8444-444444444444'}));
 assert.deepEqual(visibleMediaRecords([a,b,edit,unrelated]).map(r=>r.id),[edit.id,unrelated.id]);
 const next=mediaRecord(message({...job,id:'55555555-5555-4555-8555-555555555555',kind:'process',clips:[{path:'/media/'+edit.id+'/video.mp4'}]}));
 assert.deepEqual(visibleMediaRecords([a,b,edit,next]).map(r=>r.id),[next.id]);
 assert.deepEqual(visibleMediaRecords([a,b]).map(r=>r.id),[id,documentId]);
});
