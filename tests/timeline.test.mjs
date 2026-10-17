import test from 'node:test';
import assert from 'node:assert/strict';
import {createTimelineAPI} from '../lib/timeline.js';
import {craftCatalog,TIMELINE_CONTRACT} from '../lib/motion-craft.js';
import {validateDocument} from '../lib/protocol.js';
import {videoSpec,captionSrt,findVideoCanvas,localMediaPath,mediaResult} from '../lib/video.js';
import {refineDocument} from '../lib/refinement.js';
import {inspectRecord} from '../lib/inspection.js';
test('absolute clock can seek backwards, pause, chapter and stop; capture never advances',()=>{
 let tick,stopped=0,drawn=[];const runtime=createTimelineAPI(fn=>{tick=fn;return()=>stopped++});
 const t=runtime.timeline({duration:6,draw:v=>drawn.push(v),chapters:[{time:2,label:'传递'}]});
 tick({delta:1,visible:true});assert.equal(t.state().time,1);t.pause();tick({delta:1});assert.equal(t.state().time,1);
 t.seek(5);t.seek(1);assert.equal(drawn.at(-1),1);t.chapter(0);assert.equal(t.state().time,2);assert.equal(t.state().playing,false);
 t.play();tick({delta:1,visible:false});tick({delta:1,reducedMotion:true});assert.equal(t.state().time,2);
 tick({delta:20});assert.equal(t.state().time,6);assert.equal(t.state().playing,false);t.replay();assert.equal(t.state().time,0);
 assert.throws(()=>t.seek(NaN),/finite/);assert.throws(()=>runtime.timeline({duration:1,draw(){}}),/unique/);
 t.dispose();t.dispose();assert.equal(stopped,1);assert.equal(runtime.capture.list().length,0);
 const capture=createTimelineAPI(fn=>{tick=fn;return()=>{}},true);capture.timeline({duration:2,draw:v=>drawn.push(v)});tick({delta:1});assert.equal(capture.capture.list()[0].time,0);capture.capture.seek('main',1.2);assert.equal(drawn.at(-1),1.2);
});
test('motion references are short targeted valid documents with absolute timelines',()=>{
 for(const r of craftCatalog().recipes){const item=craftCatalog(r.id);assert.doesNotThrow(()=>validateDocument(item.document));assert.match(item.document.nodes[0].script,/DSHUI.timeline/)}
 assert.match(TIMELINE_CONTRACT,/ABSOLUTE/);assert.equal(craftCatalog('missing'),null);
});
test('capture can seek away from a failed draw instead of re-rendering the failed time first',()=>{
 const c=createTimelineAPI(()=>()=>{},true);c.timeline({duration:6,draw(t){if(t===3)throw Error('bad model frame')}});
 assert.equal(c.capture.seek('main',1).time,1);assert.throws(()=>c.capture.seek('main',3),/bad model/);assert.equal(c.capture.seek('main',5).time,5);
});
test('video spec and captions reject ambiguous or invalid output without truncation',async()=>{
 assert.equal(videoSpec({duration:2,width:640,height:360,fps:15}).frames,30);
 assert.throws(()=>videoSpec({duration:1,width:641}),/even/);assert.throws(()=>videoSpec({duration:NaN}),/duration/);
 assert.throws(()=>captionSrt([{start:0,end:2,text:'first'},{start:1,end:3,text:'overlap'}],4),/non-overlapping/);
 assert.equal(captionSrt([{start:.1,end:1.2,text:'文字'}],2),'1\n00:00:00,100 --> 00:00:01,200\n文字\n');
 assert.throws(()=>findVideoCanvas({nodes:[]}),/specify nodeId/);assert.throws(()=>findVideoCanvas({nodes:[{id:'a',type:'sandbox'},{id:'b',type:'sandbox'}]}),/specify nodeId/);
 await assert.rejects(()=>localMediaPath('https://example.com/a.mp4'),/absolute local/);
});
test('provider singleton edit wrappers preserve strict node identity and opaque source',()=>{
 const document=craftCatalog('timeline').document,css='/* item:{id,props} remains literal source */';
 assert.equal(refineDocument(document,{item:{id:'canvas',props:{css}}}).nodes[0].css,css);
 assert.equal(refineDocument(document,{item:[{id:'canvas',props:{height:500}}]}).nodes[0].height,500);
 assert.throws(()=>refineDocument(document,{item:{id:'canvas',props:{css}},extra:true}),/node edits/);
 assert.throws(()=>refineDocument(document,{item:{id:'canvas',props:{id:'changed'}}}),/identity/);
 assert.equal(refineDocument(document,{id:'canvas',props:{css}}).nodes[0].css,css);
 assert.equal(refineDocument(document,{canvas:{css}}).nodes[0].css,css);
 const merged=refineDocument(document,{item:[{id:'canvas',props:{css}},{id:'canvas',props:{height:500}}]});assert.equal(merged.nodes[0].css,css);assert.equal(merged.nodes[0].height,500);
 assert.throws(()=>refineDocument(document,[{id:'canvas',props:{height:500}},{id:'canvas',props:{height:600}}]),/conflicting edits/);
 assert.throws(()=>refineDocument(document,[{id:'canvas',props:{css}},{id:'canvas',props:JSON.parse('{"__proto__":{"polluted":true}}')}]),/identity/);assert.equal({}.polluted,undefined);
});
test('media tool results are lossless JSON across the real Host boundary',()=>{
 const job={id:'job',sessionId:'conversation',directory:'/tmp/media/job',files:['source.html'],soundtrack:undefined,recipe:{soundtrack:undefined}};
 const result=mediaResult(job);assert.deepEqual(result,JSON.parse(JSON.stringify(result)));assert.equal(Object.hasOwn(result,'soundtrack'),false);assert.deepEqual(result.recipe,{});
 assert.throws(()=>mediaResult({...job,output:{duration:NaN}}),/non-finite/);
});
test('empty parent-field leakage in typed edit items is lossless and nonempty extras stay strict',()=>{
 const doc=craftCatalog('timeline').document,script='const literal = {changes:""};';
 for(const changes of ['',null,[]])assert.equal(refineDocument(doc,[{changes,id:'canvas',props:{script}}]).nodes[0].script,script);
 assert.throws(()=>refineDocument(doc,[{changes:[{id:'other'}],id:'canvas',props:{script}}]),/unknown edit field changes/);
 assert.throws(()=>refineDocument(doc,[{other:'',id:'canvas',props:{script}}]),/unknown edit field other/);
 assert.throws(()=>refineDocument(doc,[{changes:'',id:'foreign',props:{script}}]),/existing node id/);
});
test('inspection accepts unambiguous provider list envelopes without selecting foreign IDs',()=>{
 const record={document:craftCatalog('timeline').document,documentId:'doc',documentRevision:0};
 for(const nodeIds of [{item:'canvas'},{item:['canvas']},'canvas','["canvas"]'])assert.equal(inspectRecord(record,{}, {}, [],{detail:'nodes',nodeIds}).nodes[0].id,'canvas');
 assert.throws(()=>inspectRecord(record,{}, {}, [],{detail:'nodes',nodeIds:{item:'stage'}}),/existing IDs/);
 assert.throws(()=>inspectRecord(record,{}, {}, [],{detail:'nodes',nodeIds:{item:'canvas',extra:true}}),/existing IDs/);
});
