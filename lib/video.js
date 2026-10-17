import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile,stat,access,unlink,copyFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {Readable} from 'node:stream';
import {join,isAbsolute,extname,dirname,resolve,basename} from 'node:path';
import {randomUUID} from 'node:crypto';
import {standaloneCanvas} from './canvas-export.js';
import {archiveProject} from './project-archive.js';

const executable=name=>process.env['DSH_MOTION_'+name.toUpperCase()] || name;
export const VIDEO_STAGE_CSS='html,body,#canvas{margin:0!important;padding:0!important;width:100%!important;height:100%!important;overflow:hidden!important}#canvas :not(#stage):not(#stage *){visibility:hidden!important}#stage{visibility:visible!important;position:fixed!important;inset:0!important;margin:0!important;max-width:none!important;max-height:none!important;aspect-ratio:auto!important;border-radius:0!important}*,*::before,*::after{animation:none!important;transition:none!important}';
const finite=(value,label,min,max)=>{if(!Number.isFinite(value)||value<min||value>max)throw Error(`Motion video: ${label} must be ${min}..${max}`);return value};
export function videoSpec(args={}) {
 const width=finite(args.width??1920,'width',160,3840),height=finite(args.height??1080,'height',160,2160),fps=finite(args.fps??30,'fps',1,60),duration=finite(args.duration,'duration',.1,600);
 if(!Number.isInteger(width)||!Number.isInteger(height)||width%2||height%2||!Number.isInteger(fps))throw Error('Motion video: dimensions must be even integers; fps must be an integer');
 if(duration*fps>36000)throw Error('Motion video: composition exceeds 36000 frames; split into chapters, never silently truncate');
 return {width,height,fps,duration,frames:Math.ceil(duration*fps)};
}
export function runMedia(command,args,{signal,cwd}={}) {
 // A local playlist must not silently turn an offline media task into network
 // access. Apply the input protocol allowlist to every FFmpeg input/probe.
 if(args.includes('-show_streams')||args.includes('-show_frames'))args=['-protocol_whitelist','file,pipe,data',...args];
 else if(args.includes('-i'))args=args.flatMap(arg=>arg==='-i'?['-protocol_whitelist','file,pipe,data',arg]:[arg]);
 return new Promise((resolve,reject)=>{
  signal?.throwIfAborted();let stdout='',stderr='',settled=false;
  const child=spawn(command,args,{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe'],signal,cwd});
  const fail=e=>{if(!settled){settled=true;reject(e)}};
  child.on('error',e=>fail(Error(`Motion video: ${command} ${e.code==='ENOENT'?'is unavailable; install/configure this local executable':e.message}`)));
  child.stdout.on('data',c=>{stdout+=c;if(stdout.length>2*1024*1024){child.kill();fail(Error('Motion video: process output is too large'))}});
  child.stderr.on('data',c=>{stderr=(stderr+c).slice(-12000)});
  child.on('close',code=>{if(settled)return;settled=true;code===0?resolve(stdout):reject(Error(`Motion video: ${command} exited ${code}: ${stderr.slice(-4000)}`))});
 });
}
function frameEncoder(spec,directory,signal){
 const child=spawn(executable('ffmpeg'),['-v','error','-nostdin','-y','-f','image2pipe','-framerate',String(spec.fps),'-protocol_whitelist','file,pipe,data','-i','pipe:0','-frames:v',String(spec.frames),'-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart','silent.mp4'],{cwd:directory,signal,windowsHide:true,shell:false,stdio:['pipe','ignore','pipe']});
 let error,stderr='';child.stderr.on('data',b=>stderr=(stderr+b).slice(-4000));
 const done=new Promise((resolve,reject)=>{child.on('error',e=>{error=e;reject(e)});child.on('close',code=>{if(code===0)resolve();else{error=Error('Motion video: frame encoder exited '+code+': '+stderr);reject(error)}})});done.catch(()=>{});
 child.stdin.on('error',e=>{error=e});
 return {async write(png){signal?.throwIfAborted();if(error)throw error;await new Promise((resolve,reject)=>child.stdin.write(png,e=>e?reject(e):resolve()));if(error)throw error},async finish(){child.stdin.end();await done},async stop(){child.stdin.destroy();child.kill();await done.catch(()=>{})}};
}
export async function localMediaPath(path) {
 if(typeof path!=='string'||!isAbsolute(path)||path.includes('\0')||/^(\\\\|\/\/)/.test(path))throw Error('Motion video: input must be an absolute local file path, not a URL or network share');
 const info=await stat(path);if(!info.isFile())throw Error('Motion video: input is not a regular file');return path;
}
export async function probeVideo(path,signal) {
 await localMediaPath(path);
 const value=JSON.parse(await runMedia(executable('ffprobe'),['-v','error','-show_format','-show_streams','-of','json',path],{signal}));
 const video=value.streams?.find(s=>s.codec_type==='video'),audio=value.streams?.filter(s=>s.codec_type==='audio')??[];
 const duration=Number(value.format?.duration??video?.duration);
 if(!video||!Number.isFinite(duration)||duration<=0)throw Error('Motion video: file has no valid video stream/duration');
 return {path,duration,videoDuration:Number(video.duration)||duration,startTime:Number(value.format?.start_time)||0,width:video.width,height:video.height,codec:video.codec_name,frameRate:video.avg_frame_rate,frames:Number(video.nb_frames)||null,audio:audio.map(a=>({codec:a.codec_name,channels:a.channels,sampleRate:Number(a.sample_rate)})),bytes:Number(value.format?.size)||0};
}
export async function videoCapabilities(){
 const result={ffmpeg:false,ffprobe:false,browser:false,requirements:'Local FFmpeg/FFprobe and Chrome/Edge or Playwright Chromium. Configure DSH_MOTION_FFMPEG, DSH_MOTION_FFPROBE, DSH_MOTION_BROWSER if needed; no automatic binary download.'};
 for(const name of ['ffmpeg','ffprobe'])try{await runMedia(executable(name),['-version']);result[name]=true}catch(e){result[name+'Error']=e.message}
 try{const {chromium}=await import('playwright-core');result.browser=await browserOptions(chromium)}catch(e){result.browserError=e.message}
 return result;
}
async function browserOptions(chromium){
 if(process.env.DSH_MOTION_BROWSER){await access(process.env.DSH_MOTION_BROWSER);return {executablePath:process.env.DSH_MOTION_BROWSER}}
 try{await access(chromium.executablePath());return {}}catch{}
 const candidates=process.platform==='win32'?[
  join(process.env.ProgramFiles??'C:/Program Files','Google/Chrome/Application/chrome.exe'),
  join(process.env['ProgramFiles(x86)']??'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe'),
  join(process.env.LOCALAPPDATA??'','Google/Chrome/Application/chrome.exe')
 ]:process.platform==='darwin'?['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']:['/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome'];
 for(const path of candidates)try{await access(path);return {executablePath:path}}catch{}
 throw Error('Motion video: no local Chromium/Chrome/Edge detected; configure DSH_MOTION_BROWSER');
}
function walk(nodes){return nodes.flatMap(n=>[n,...walk(n.children??[])])}
export function findVideoCanvas(document,nodeId){
 const nodes=walk(document.nodes??[]).filter(n=>n.type==='sandbox');
 if(!nodeId&&nodes.length!==1)throw Error('Motion video: specify nodeId when the document has multiple/no canvases');
 const node=nodeId?nodes.find(n=>n.id===nodeId):nodes[0];if(!node)throw Error('Motion video: sandbox nodeId not found');return node;
}
export function captionSrt(captions,duration){
 if(!Array.isArray(captions)||captions.length>500)throw Error('Motion video: captions must be an array of at most 500 exact timed cues');
 const stamp=t=>{const ms=Math.round(t*1000);return [Math.floor(ms/3600000),Math.floor(ms/60000)%60,Math.floor(ms/1000)%60].map(n=>String(n).padStart(2,'0')).join(':')+','+String(ms%1000).padStart(3,'0')};
 let end=0;return captions.map((c,i)=>{if(!c||typeof c.text!=='string'||!c.text.trim()||c.text.length>3000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(c.text)||c.text.includes('-->'))throw Error('Motion video: invalid caption text');finite(c.start,'caption.start',0,duration);finite(c.end,'caption.end',0,duration);if(c.end<=c.start||c.start<end)throw Error('Motion video: captions must have ordered non-overlapping start/end');end=c.end;return `${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text.replace(/\r/g,'').replace(/\n{2,}/g,'\n')}\n`}).join('\n');
}
export function audioTrackSpec(tracks,duration){
 if(!Array.isArray(tracks)||!tracks.length||tracks.length>4)throw Error('Motion video: audioTracks requires 1..4 tracks');
 return tracks.map(t=>{if(!t||typeof t.path!=='string'||!['voice','music','effect'].includes(t.role??'music')||typeof (t.loop??false)!=='boolean')throw Error('Motion video: invalid audio track path/role/loop');return {path:t.path,role:t.role??'music',volume:finite(t.volume??(t.role==='voice'?1:.15),'track.volume',0,2),offset:finite(t.offset??0,'track.offset',0,duration),fadeIn:finite(t.fadeIn??0,'track.fadeIn',0,duration),fadeOut:finite(t.fadeOut??0,'track.fadeOut',0,duration),loop:t.loop??false}});
}
export class VideoStudio {
 constructor(directory){this.directory=directory;this.busy=false}
 async job(sessionId,kind){if(typeof sessionId!=='string'||!sessionId)throw Error('Motion video: conversation required');const id=randomUUID(),directory=join(this.directory,id);await mkdir(directory,{recursive:true});return {id,directory,sessionId,kind,createdAt:new Date().toISOString(),status:'preparing',files:[]}}
 async save(job){if(job.recipe){await writeFile(join(job.directory,'recipe.json'),JSON.stringify(job.recipe,null,2),'utf8');if(!job.files.includes('recipe.json'))job.files.push('recipe.json')}await writeFile(join(job.directory,'manifest.json'),JSON.stringify(job,null,2),'utf8');return job}
 async exclusive(task){if(this.busy)throw Error('Motion video: another media job is running; wait for its real result before retrying');this.busy=true;try{return await task()}finally{this.busy=false}}
 async prepareAudio(job,args,signal){
  if(args.audioTracks&&args.audioPath)throw Error('Motion video: choose audioTracks or legacy audioPath, not both');
  if(!args.audioTracks)return args;
  const tracks=audioTrackSpec(args.audioTracks,job.spec.duration),cmd=['-v','error','-nostdin','-y'],filters=[];
  const saved=[];
  for(let i=0;i<tracks.length;i++){
   const t=tracks[i];await localMediaPath(t.path);
   const probe=JSON.parse(await runMedia(executable('ffprobe'),['-v','error','-show_format','-show_streams','-of','json',t.path],{signal}));
   const seconds=Number(probe.format?.duration);if(!probe.streams?.some(s=>s.codec_type==='audio')||!Number.isFinite(seconds)||seconds<=0)throw Error('Motion video: audio track has no decodable duration/audio');
   if(t.role==='voice'&&(t.loop||t.offset+seconds>job.spec.duration+.1))throw Error('Motion video: composition would truncate/repeat narration; extend timeline to fit measured voice duration');
   const ext=extname(t.path).toLowerCase();if(!['.wav','.mp3','.m4a','.aac','.ogg','.flac'].includes(ext))throw Error('Motion video: unsupported audio track extension');
   const file=`audio-${i}${ext}`;await copyFile(t.path,join(job.directory,file));job.files.push(file);saved.push({...t,path:file,duration:seconds});
   const voiceId=basename(dirname(t.path));
   if(t.role==='voice'&&basename(t.path)==='narration.mp3'&&/^[a-f0-9-]{36}$/.test(voiceId)&&resolve(dirname(t.path))===resolve(this.directory,voiceId)){
    const sourceJob=JSON.parse(await readFile(join(dirname(t.path),'manifest.json'),'utf8'));
    if(sourceJob.kind==='voice'&&sourceJob.status==='completed'&&sourceJob.sessionId===job.sessionId){
     for(const [source,suffix]of [['narration.txt','.txt'],['timings.json','-timings.json'],['subtitles.raw.json','-subtitles.json']]){const target=`voice-${i}${suffix}`;await copyFile(join(dirname(t.path),source),join(job.directory,target));job.files.push(target)}
    }
   }
   if(t.loop)cmd.push('-stream_loop','-1');cmd.push('-i',file);
   filters.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${t.volume},adelay=${Math.round(t.offset*1000)}:all=1,apad,atrim=duration=${job.spec.duration}${t.fadeIn?`,afade=t=in:st=${t.offset}:d=${t.fadeIn}`:''}${t.fadeOut?`,afade=t=out:st=${job.spec.duration-t.fadeOut}:d=${t.fadeOut}`:''}[a${i}]`);
  }
  filters.push(tracks.map((_,i)=>`[a${i}]`).join('')+`amix=inputs=${tracks.length}:normalize=0:duration=longest,alimiter=limit=0.95:level=false[mix]`);
  cmd.push('-filter_complex',filters.join(';'),'-map','[mix]','-t',String(job.spec.duration),'-c:a','pcm_s16le','soundtrack.wav');
  await runMedia(executable('ffmpeg'),cmd,{signal,cwd:job.directory});job.audioTracks=saved;
  return {...args,audioPath:join(job.directory,'soundtrack.wav'),audioVolume:1};
 }
 async render({record,state,nodeId,...args},{signal}={}){return this.exclusive(async()=>{
  const preview=Object.hasOwn(args,'previewTimes'),spec=videoSpec({...args,...(preview?{fps:30}:{})}),node=findVideoCanvas(record.document,nodeId),job=await this.job(record.sessionId,preview?'preview':'render');
  job.spec=spec;job.documentId=record.documentId;job.documentRevision=record.documentRevision;job.nodeId=node.id;
  const theme=args.theme??{scheme:'light',bg:'#fff',soft:'#eef5ff',ink:'#182537',muted:'#526174',line:'#cbd5e1',accent:'#527ef7'};
  let browser,encoder;const warnings=[];job.files=['source.html','document.json'];
  await writeFile(join(job.directory,'source.html'),standaloneCanvas(record.document,node,state,theme));await writeFile(join(job.directory,'document.json'),JSON.stringify({document:record.document,state,theme},null,2));await this.save(job);
  try{
  if(args.captions?.length)captionSrt(args.captions,spec.duration);
  args=await this.prepareAudio(job,args,signal);let soundtrack;
  if(args.audioPath){await localMediaPath(args.audioPath);const ext=extname(args.audioPath).toLowerCase();if(!['.wav','.mp3','.m4a','.aac','.ogg','.flac'].includes(ext))throw Error('Motion video: soundtrack must be WAV/MP3/M4A/AAC/OGG/FLAC');const file='soundtrack'+ext;if(args.audioPath!==join(job.directory,file))await copyFile(args.audioPath,join(job.directory,file));soundtrack={file,volume:finite(args.audioVolume??.3,'audioVolume',0,1)}}
  const source=standaloneCanvas(record.document,node,state,theme,soundtrack,args.captions);
  await writeFile(join(job.directory,'source.html'),source);await writeFile(join(job.directory,'document.json'),JSON.stringify({document:record.document,state},null,2));
  job.files.push(...(soundtrack?[soundtrack.file]:[]));if(soundtrack)job.soundtrack=soundtrack;job.recipe={duration:spec.duration,width:spec.width,height:spec.height,fps:spec.fps,theme,captions:args.captions??[],...(soundtrack?{soundtrack}:{}),...(job.audioTracks?{audioTracks:job.audioTracks}:{})};await this.save(job);
   signal?.throwIfAborted();await runMedia(executable('ffmpeg'),['-version'],{signal});
   const {chromium}=await import('playwright-core');browser=await chromium.launch({...await browserOptions(chromium),headless:true,chromiumSandbox:true});
   const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},deviceScaleFactor:1,serviceWorkers:'block',reducedMotion:'no-preference'});
   const abort=()=>{void browser?.close().catch(()=>{})};signal?.addEventListener('abort',abort,{once:true});
   try{
    await context.route('**/*',route=>route.abort());await context.addInitScript(()=>{window.__DSHMotionRender=true});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')warnings.push(m.text())});
    const capture=await context.newCDPSession(page);await capture.send('Runtime.enable');
    const invalidPreview=async diagnostic=>{job.complete=false;job.samples=[];job.diagnostics=[diagnostic];job.repair='Patch the saved documentId/documentRevision using patch_ui (canvas source fields) or update_ui. source.html is an editable snapshot; editing that file alone does NOT update the saved canvas used by render_video.';job.warnings=[...new Set(warnings)].slice(0,8).map(message=>({kind:'browser-resource',message:message.slice(0,1200)}));job.status='completed';job.observation='Initialization diagnostics only; no valid frame, MP4 or audio review. Fix the reported source and preview again.';return this.save(job)};
    // Compile only, never execute authored code in the parent/Host context.
    // Chromium reports author-source coordinates, unlike append(script)'s
    // bootstrap stack or a later generic timeline-readiness timeout.
    const compiled=await capture.send('Runtime.compileScript',{expression:node.script??'',sourceURL:'motion-canvas.js',persistScript:false});
    if(compiled.exceptionDetails){const e=compiled.exceptionDetails,line=e.lineNumber+1,column=e.columnNumber+1,lines=(node.script??'').split('\n'),diagnostic={kind:'script-syntax',line,column,message:(e.exception?.description??e.text).slice(0,1200),excerpt:lines.slice(Math.max(0,line-2),line+1).map((s,i)=>`${Math.max(1,line-1)+i}: ${s}`).join('\n').slice(0,1800)};if(preview)return await invalidPreview(diagnostic);throw Error(`Motion video: script syntax at line ${line}, column ${column}: ${diagnostic.message}\n${diagnostic.excerpt}`)}
    // setContent's parent lifecycle wait can race srcdoc/data-image startup.
    // This wrapper is generated by us; authored code stays in its opaque frame.
    // Readiness is checked explicitly below (#stage, timeline, fonts, images,
    // layout/paint), rather than relying on the parent's DOMContentLoaded.
    await page.evaluate(html=>{document.open();document.write(html);document.close()},source);
    try{await page.frameLocator('iframe').locator('#stage').waitFor({state:'attached',timeout:15000})}catch(e){if(preview)return await invalidPreview({kind:'missing-stage',message:errors[0]??'Define exactly one #stage as the video composition.'});throw e}const frame=page.frames().find(f=>f!==page.mainFrame());
    if(!frame)throw Error('Motion video: source iframe unavailable');
    if(preview&&errors.length)return await invalidPreview({kind:'script-initialization',message:errors[0]});
    try{await frame.waitForFunction(()=>window.__DSHMotionCapture?.list().length>0,{},{timeout:15000})}catch(e){if(preview)return await invalidPreview({kind:'missing-timeline',message:errors[0]??'No timeline registered. Initialize DSHUI.timeline({id:"main",duration,draw}) synchronously; do not wait for clicks or an unavailable resource.'});throw e}
    const timelines=await frame.evaluate(()=>window.__DSHMotionCapture.list()),main=timelines.find(t=>t.id==='main');
    if(!main||timelines.length!==1||Math.abs(main.duration-spec.duration)>.001){const message='Motion video: exactly one timeline id main is required and duration must match export duration';if(preview)return await invalidPreview({kind:'timeline-contract',message,timelines});throw Error(message)}
    const stage=frame.locator('#stage');if(await stage.count()!==1)throw Error('Motion video: define exactly one #stage as the video composition');
    // Freeze browser-driven clocks; each output frame is explicitly sought.
    await frame.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode().catch(()=>{})))});await page.addStyleTag({content:'body{margin:0!important;padding:0!important}main{max-width:none!important}main>h1,main>p,main>details{display:none!important}iframe{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;border:0!important}'});
    // Keep ancestor nodes: authors may legitimately wrap #stage in a themed
    // container. Hiding every root sibling used to hide the stage's ancestor.
    await stage.evaluate(el=>{for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement){p.style.setProperty('transform','none','important');p.style.setProperty('filter','none','important');p.style.setProperty('perspective','none','important');p.style.setProperty('contain','none','important')}});
    await frame.addStyleTag({content:VIDEO_STAGE_CSS});
    // Staging changes iframe size. Let resize/ResizeObserver handlers settle
    // before seeking: otherwise the first surface can still contain the old
    // 1100px export preview and transient markup from its previous layout.
    await frame.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    job.warnings=await frame.evaluate(()=>[...document.querySelectorAll('[style]')].filter(el=>el.namespaceURI==='http://www.w3.org/1999/xhtml'&&/url\(\s*["']?#/.test(el.style.backgroundImage)).slice(0,12).map(el=>({kind:'html-background-svg-paint',target:el.id?'#'+el.id:el.tagName.toLowerCase(),message:'HTML background-image cannot use a local SVG paint server url(#id). Use CSS linear-gradient()/radial-gradient() for HTML, or SVG fill=url(#id) on SVG geometry.'})));
    job.status='rendering';await this.save(job);
    if(preview){
     const chapters=[...main.chapters].sort((a,b)=>a.time-b.time);
     const times=args.previewTimes??[...new Set([0,...(chapters.length?chapters.slice(0,10).map((c,i)=>Math.min(spec.duration-.001,c.time+Math.min(1.5,((chapters[i+1]?.time??spec.duration)-c.time)/2))):[spec.duration*.1,spec.duration*.5,spec.duration*.9]),spec.duration-.001])];
     if(!Array.isArray(times)||!times.length||times.length>12)throw Error('Motion video: preview times requires 1..12 timestamps');
     for(const t of times)finite(t,'preview time',0,spec.duration-.001);
     job.samples=[];job.diagnostics=[];if(errors.length)job.diagnostics.push({time:0,phase:'mount',message:errors.join('; ').slice(0,1800)});
     let validCount=0;for(const time of times){
      signal?.throwIfAborted();errors.length=0;
      try{
       await frame.evaluate(t=>window.__DSHMotionCapture.seek('main',t),time);
       await frame.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
       if(errors.length)throw Error(errors[0]);
       const file=`sample-${validCount}.png`,shot=await capture.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false,optimizeForSpeed:true});await writeFile(join(job.directory,file),Buffer.from(shot.data,'base64'));validCount++;job.files.push(file);job.samples.push({time,file,valid:true});
      }catch(e){signal?.throwIfAborted();job.diagnostics.push({time,chapter:[...chapters].reverse().find(c=>c.time<=time)?.label,message:e.message.slice(0,1800)});job.samples.push({time,valid:false,error:e.message.slice(0,1200)})}
     }
     if(validCount){await runMedia(executable('ffmpeg'),['-v','error','-y','-i','sample-%d.png','-vf',`scale=480:270:out_range=pc,tile=3x${Math.ceil(validCount/3)},format=yuvj420p`,'-frames:v','1','contact.jpg'],{signal,cwd:job.directory});job.files.push('contact.jpg')}job.chapters=main.chapters;job.status='completed';job.observation='Fast source-frame preview only. Invalid samples have NO image and are explicitly labelled valid=false. complete=false requires fixing diagnostics before final export. No MP4 or audio review was performed.';
    }else{
    encoder=frameEncoder(spec,job.directory,signal);
    for(let i=0;i<spec.frames;i++){
     signal?.throwIfAborted();await frame.evaluate(t=>window.__DSHMotionCapture.seek('main',t),i/spec.fps);
     await frame.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
     if(errors.length)throw Error('Motion video: canvas runtime error: '+errors[0]);
     const status=await page.locator('#status').textContent();if(status?.startsWith('画布运行异常'))throw Error('Motion video: '+status);
     // A legitimate transparent first frame must not fail a visibility wait.
     // Same lossless viewport PNG, but skip Playwright's redundant animation/
     // stability waits: all clocks have already been frozen and explicitly sought.
     const shot=await capture.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false,optimizeForSpeed:true});
     await encoder.write(Buffer.from(shot.data,'base64'));
     if(i%Math.max(30,spec.fps*2)===0){job.progress={frames:i+1,totalFrames:spec.frames,seconds:(i+1)/spec.fps};await this.save(job)}
    }
    await encoder.finish();encoder=null;
    }
   }finally{signal?.removeEventListener('abort',abort);await browser.close();browser=null}
   job.warnings=[...(job.warnings??[]),...[...new Set(warnings)].slice(0,8).map(message=>({kind:'browser-resource',message:message.slice(0,1200)}))];
   if(preview){job.complete=job.diagnostics.length===0&&job.warnings.length===0;job.repair=job.complete?'Source frame checks passed; final MP4/audio review remains.':'Patch the saved documentId/documentRevision with patch_ui/update_ui, then preview again. Editing an exported snapshot alone does not change the saved canvas.';return await this.save(job)}
   job.status='encoding';job.progress={frames:spec.frames,totalFrames:spec.frames,seconds:spec.duration};await this.save(job);await this.finishVideo(job,join(job.directory,'silent.mp4'),args,signal);
   const projectFiles=job.files.filter(f=>!['video.mp4','poster.jpg'].includes(f));
   // Shareable projects contain relative asset names, never internal session
   // ownership, absolute profile paths or runtime job manifests.
   await writeFile(join(job.directory,'project.json'),JSON.stringify({format:'dsh-motion-project',version:1,composition:spec,source:'source.html',document:'document.json',recipe:'recipe.json',files:projectFiles},null,2));job.files.push('project.json');
   await this.save(job);await archiveProject(job.directory,[...projectFiles,'project.json']);job.files.push('project.zip');
   await unlink(join(job.directory,'silent.mp4'));
   return await this.save(job);
  }catch(e){job.status='failed';job.error=e.message;await this.save(job);throw Error(`${e.message}; editable source retained: ${join(job.directory,'source.html')}; manifest: ${join(job.directory,'manifest.json')}`)}finally{await encoder?.stop();await browser?.close().catch(()=>{})}
 })}
 async finishVideo(job,input,args,signal){
  const output=join(job.directory,'video.mp4'),cmd=['-v','error','-nostdin','-y','-i',input],filters=[];
  if(args.audioPath){await localMediaPath(args.audioPath);finite(args.audioVolume??.3,'audioVolume',0,1);cmd.push('-i',args.audioPath);filters.push(`[1:a]volume=${args.audioVolume??.3},apad,atrim=duration=${job.spec.duration}[sound]`)}
  if(args.captions?.length){await writeFile(join(job.directory,'captions.srt'),captionSrt(args.captions,job.spec.duration));job.files.push('captions.srt');filters.push("[0:v]subtitles=captions.srt:force_style='FontSize=13,Outline=0.7,Shadow=0,MarginV=14,Alignment=2'[v]")}
  if(filters.length)cmd.push('-filter_complex',filters.join(';'));
  cmd.push('-map',args.captions?.length?'[v]':'0:v:0','-map',args.audioPath?'[sound]':'0:a?','-t',String(job.spec.duration),'-c:v',args.captions?.length?'libx264':'copy','-c:a','aac','-pix_fmt','yuv420p','-movflags','+faststart',output);
  await runMedia(executable('ffmpeg'),cmd,{signal,cwd:job.directory});
  const probe=await probeVideo(output,signal);
  const [rateNum,rateDen]=probe.frameRate.split('/').map(Number);
  if(probe.width!==job.spec.width||probe.height!==job.spec.height||Math.abs(rateNum/rateDen-job.spec.fps)>.01||Math.abs(probe.duration-job.spec.duration)>Math.max(.15,2/job.spec.fps))throw Error('Motion video: encoded output dimensions/fps/duration do not match the composition');
  if(args.audioPath&&!probe.audio.length)throw Error('Motion video: requested soundtrack was not encoded');
  await runMedia(executable('ffmpeg'),['-v','error','-nostdin','-i',output,'-f','null','-'],{signal});
  await runMedia(executable('ffmpeg'),['-v','error','-nostdin','-y','-ss',String(Math.min(job.spec.duration*.5,job.spec.duration-1/job.spec.fps)),'-i',output,'-frames:v','1','-vf','scale=out_range=pc,format=yuvj420p','-pix_fmt','yuvj420p','-color_range','pc','poster.jpg'],{signal,cwd:job.directory});
  job.files.push('video.mp4','poster.jpg');job.output=probe;job.audio=job.audioTracks?'mixed voice/music/effects':args.audioPath?'supplied soundtrack replaces original audio':probe.audio.length?'original clip audio':'silent';job.status='completed';
 }
 async inspect({path,times=[]},{sessionId,signal}={}){
  const probe=await probeVideo(path,signal);if(!Array.isArray(times)||times.length>12)throw Error('Motion video: times must contain at most 12 sample timestamps');
  for(const time of times)finite(time,'sample time',0,Math.max(0,probe.duration-.001));
  const job=await this.job(sessionId,'inspect');job.input=probe;job.samples=[];await this.save(job);
  try{
   const [n,d]=probe.frameRate.split('/').map(Number),fps=n/d,step=Number.isFinite(fps)&&fps>0?1/fps:.05;
   let lastFrame;
   for(let i=0;i<times.length;i++){
    signal?.throwIfAborted();const requestedTime=times[i],file=`sample-${i}.jpg`;let time=Math.min(requestedTime,Math.max(0,probe.videoDuration-step-.000001));
    const capture=async()=>runMedia(executable('ffmpeg'),['-v','error','-nostdin','-y','-ss',String(time),'-i',path,'-frames:v','1','-vf','scale=960:540:force_original_aspect_ratio=decrease:out_range=pc,pad=960:540:(ow-iw)/2:(oh-ih)/2,format=yuvj420p','-pix_fmt','yuvj420p','-color_range','pc',file],{signal,cwd:job.directory});
    await capture();
    if(!await stat(join(job.directory,file)).then(s=>s.size>0,()=>false)){
     // VFR/long final-frame holds cannot be located from average FPS alone.
     // Ask the decoder for actual tail timestamps, never invent a last image.
     if(lastFrame===undefined){const tail=JSON.parse(await runMedia(executable('ffprobe'),['-v','error','-read_intervals',`${Math.max(0,probe.duration-1)}%`,'-select_streams','v:0','-show_frames','-show_entries','frame=best_effort_timestamp_time','-of','json',path],{signal}));lastFrame=Math.max(...(tail.frames??[]).map(f=>Number(f.best_effort_timestamp_time)-probe.startTime).filter(Number.isFinite))}
     if(!Number.isFinite(lastFrame)||lastFrame<0)throw Error('Motion video: no decodable frame at requested sample time '+requestedTime);
     time=Math.max(0,lastFrame-.000001);await capture();
    }
    if(!await stat(join(job.directory,file)).then(s=>s.size>0,()=>false))throw Error('Motion video: decoder produced no sample image at '+requestedTime);
    job.files.push(file);job.samples.push({time,requestedTime,file,boundaryAdjusted:Math.abs(time-requestedTime)>.00001});
   }
   if(times.length>1){await runMedia(executable('ffmpeg'),['-v','error','-nostdin','-y','-i','sample-%d.jpg','-vf',`scale=320:180:out_range=pc,tile=3x${Math.ceil(times.length/3)},format=yuvj420p`,'-frames:v','1','-pix_fmt','yuvj420p','-color_range','pc','contact.jpg'],{signal,cwd:job.directory});job.files.push('contact.jpg')}
   job.status='completed';job.observation='Metadata and sparse frames only, not ASR/full-video understanding. time is the actual seek position; decoded frame PTS may be slightly later. requestedTime is preserved; near-EOF samples adjust to a decodable video frame.';return this.save(job);
  }catch(e){job.status='failed';job.error=e.message;await this.save(job);throw e}
 }
 async process(args,{sessionId,signal}={}){return this.exclusive(async()=>{
  if(!Array.isArray(args.clips)||!args.clips.length||args.clips.length>20)throw Error('Motion video: clips must contain 1..20 local videos');
  const clips=[];for(const c of args.clips){const probe=await probeVideo(c.path,signal),start=c.start??0,end=c.end??probe.duration;finite(start,'clip.start',0,probe.duration);finite(end,'clip.end',0,probe.duration);if(end<=start)throw Error('Motion video: clip end must follow start');clips.push({...c,start,end,probe})}
  const duration=clips.reduce((n,c)=>n+c.end-c.start,0),spec=videoSpec({...args,duration}),job=await this.job(sessionId,'process');job.spec=spec;job.clips=clips.map(({probe,...c})=>c);job.recipe={...args,clips:job.clips};await this.save(job);
  try{
   args=await this.prepareAudio(job,args,signal);if(job.audioTracks)job.recipe.audioTracks=job.audioTracks;
   const anyAudio=clips.some(c=>c.probe.audio.length);
   for(let i=0;i<clips.length;i++){
    const c=clips[i],seconds=c.end-c.start,cmd=['-v','error','-nostdin','-y','-ss',String(c.start),'-i',c.path];
    if(anyAudio&&!c.probe.audio.length)cmd.push('-f','lavfi','-i','anullsrc=r=48000:cl=stereo');
    cmd.push('-map','0:v:0');if(anyAudio)cmd.push('-map',c.probe.audio.length?'0:a:0':'1:a:0');cmd.push('-t',String(seconds),'-vf',`scale=${spec.width}:${spec.height}:force_original_aspect_ratio=decrease,pad=${spec.width}:${spec.height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${spec.fps}`,'-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-ac','2',`clip-${i}.mp4`);
    await runMedia(executable('ffmpeg'),cmd,{signal,cwd:job.directory});
   }
   // Only generated constant filenames enter the concat list.
   await writeFile(join(job.directory,'clips.txt'),clips.map((_,i)=>`file 'clip-${i}.mp4'`).join('\n'));
   await runMedia(executable('ffmpeg'),['-v','error','-nostdin','-y','-f','concat','-safe','1','-i','clips.txt','-c','copy','joined.mp4'],{signal,cwd:job.directory});
   await this.finishVideo(job,join(job.directory,'joined.mp4'),args,signal);
   for(let i=0;i<clips.length;i++)await unlink(join(job.directory,`clip-${i}.mp4`));await unlink(join(job.directory,'joined.mp4'));await unlink(join(job.directory,'clips.txt'));
   return this.save(job);
  }catch(e){job.status='failed';job.error=e.message;await this.save(job);throw Error(`${e.message}; retained job manifest: ${join(job.directory,'manifest.json')}`)}
 })}
}
export function mediaResult(job){
 const base='/api/plugins/dsh-generative-ui/media?assetId='+job.id+'&sessionId='+encodeURIComponent(job.sessionId)+'&file=';
 // The Host requires lossless JSON, not merely a JSON.stringify-able object.
 // Optional internal undefined properties must be omitted from tool output.
 return JSON.parse(JSON.stringify({...job,files:job.files.map(file=>({name:file,path:join(job.directory,file),url:base+encodeURIComponent(file)})),manifestPath:join(job.directory,'manifest.json')},(_key,value)=>{if(typeof value==='number'&&!Number.isFinite(value))throw Error('Motion video: non-finite result metadata');return value}));
}
export function mediaRoute(studio){return async request=>{
 try{
  const url=new URL(request.url),id=url.searchParams.get('assetId'),file=url.searchParams.get('file');
  if(!/^[a-f0-9-]{36}$/.test(id??'')||!file||!/^([\w-]+\.(mp4|html|json|jpg|png|srt|wav|mp3|m4a|aac|ogg|flac|zip|txt))$/.test(file))return new Response('Invalid media asset',{status:400});
  const job=JSON.parse(await readFile(join(studio.directory,id,'manifest.json'),'utf8'));
  if(job.sessionId!==url.searchParams.get('sessionId'))return new Response('Media belongs to another conversation',{status:403});
  if(!job.files.includes(file))return new Response('Unknown media file',{status:404});
  const path=join(studio.directory,id,file),info=await stat(path),type=file.endsWith('.mp4')?'video/mp4':file.endsWith('.jpg')?'image/jpeg':file.endsWith('.png')?'image/png':'application/octet-stream';
  const headers={'Content-Type':type,'Content-Length':String(info.size),'X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'Cache-Control':'private, no-cache','Accept-Ranges':'bytes'};
  if(!['video/mp4','image/jpeg','image/png'].includes(type))headers['Content-Disposition']=`attachment; filename="${file}"`;
  const range=request.headers.get('range');let start=0,end=info.size-1,status=200;
  if(range){const match=/^bytes=(\d+)-(\d*)$/.exec(range);if(!match)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${info.size}`}});start=Number(match[1]);end=match[2]?Math.min(end,Number(match[2])):end;if(start>end||start>=info.size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${info.size}`}});status=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;headers['Content-Length']=String(end-start+1)}
  return new Response(request.method==='HEAD'?null:Readable.toWeb(createReadStream(path,{start,end})),{status,headers});
 }catch(e){return new Response(e.code==='ENOENT'?'Media not found':'Media unavailable',{status:e.code==='ENOENT'?404:500})}
}}
