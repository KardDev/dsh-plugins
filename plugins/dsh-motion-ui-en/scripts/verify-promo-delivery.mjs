import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,mkdir,copyFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {VideoStudio,probeVideo} from '../lib/video.js';
import {BUILD_INFO} from '../lib/build-info.js';
const evaluation=JSON.parse(await readFile(process.argv[2]??'test-output/promo-model/final/results.json','utf8'));
assert.ok(evaluation.passed&&evaluation.settingsRestored,'Final real-model evaluation must pass and restore settings');
const sample=evaluation.cases[0];assert.deepEqual(sample.toolErrors,[]);
for(const tool of ['synthesize_voice','preview_video','render_video','inspect_video','read_image'])assert.ok(sample.toolCalls.includes(tool),tool+' was not exercised');
const job=JSON.parse(await readFile(join(sample.video.directory,'manifest.json'),'utf8'));
assert.equal(job.status,'completed');assert.equal(job.kind,'render');
const probe=await probeVideo(join(job.directory,'video.mp4'));
assert.equal(probe.width,1920);assert.equal(probe.height,1080);assert.equal(probe.frameRate,'30/1');assert.ok(probe.audio.length);
assert.ok(job.files.includes('project.zip'));
let captionAudit;
if(!job.files.includes('captions.srt')){
 assert.ok(process.argv[4],'Source-authored captions require an explicit independent audit report');
 captionAudit=JSON.parse(await readFile(process.argv[4],'utf8'));
 assert.ok(captionAudit.passed&&captionAudit.cues?.length,'Authored caption audit must pass');
 const snapshot=JSON.parse(await readFile(join(job.directory,'document.json'),'utf8'));
 const scripts=[];const visit=nodes=>{for(const node of nodes??[]){if(typeof node.script==='string')scripts.push(createHash('sha256').update(node.script).digest('hex'));visit(node.children)}};visit(snapshot.document.nodes);
 assert.ok(scripts.includes(captionAudit.scriptSHA256),'Caption audit must match the delivered source');
}
assert.ok(job.files.some(f=>/^voice-\d\.txt$/.test(f)));
assert.ok(job.audioTracks.some(t=>t.role==='voice'));assert.ok(job.audioTracks.some(t=>t.role==='music'));
const output=resolve(process.argv[3]??'test-output/promo-delivery');await mkdir(output,{recursive:false});
for(const file of job.files){const target=file==='video.mp4'?'MotionUI-0.8.0-promo.mp4':file==='project.zip'?'MotionUI-0.8.0-project.zip':file;await copyFile(join(job.directory,file),join(output,target));assert.ok((await readFile(join(job.directory,file))).equals(await readFile(join(output,target))),'Copy mismatch '+file)}
const studio=new VideoStudio(resolve('test-output/promo-final-review'));
const review=await studio.inspect({path:join(output,'MotionUI-0.8.0-promo.mp4'),times:Array.from({length:12},(_,i)=>Math.min(probe.duration-.01,(i+.5)*probe.duration/12))},{sessionId:'promo-delivery-review'});
await copyFile(join(review.directory,'contact.jpg'),join(output,'scene-contact.jpg'));
const report={passed:true,build:BUILD_INFO,model:evaluation.model,sessionId:sample.sessionId,requestConfig:sample.requestConfig,elapsedMs:sample.elapsedMs,toolErrors:sample.toolErrors,tools:sample.toolCalls,probe,output,video:join(output,'MotionUI-0.8.0-promo.mp4'),project:join(output,'MotionUI-0.8.0-project.zip'),contact:join(output,'scene-contact.jpg'),sha256:createHash('sha256').update(await readFile(join(output,'MotionUI-0.8.0-promo.mp4'))).digest('hex'),reviewDirectory:review.directory,observation:'Real metadata/full decode was checked by renderer; this delivery rechecks metadata, copied bytes and twelve sparse frames. Sparse images do not constitute full audio/perceptual review. No model reasoning/output/time limit was changed.'};
await writeFile(join(output,'verification.json'),JSON.stringify(report,null,2));await writeFile('test-output/promo-media/final-delivery.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
