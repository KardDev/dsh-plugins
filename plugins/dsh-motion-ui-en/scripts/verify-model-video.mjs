import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,readdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {zstdDecompressSync} from 'node:zlib';
import {dshHomePath} from '@deepseek-ai/dsh-home-paths';
import {BUILD_INFO} from '../lib/build-info.js';

// Explicit opt-in live evaluation: consumes the selected configured model.
// Browser element checks are bounded; model completion is deliberately unbounded.
const promo=process.env.MOTION_PROMO_TEST==='1';
const musicOnly=process.env.MOTION_PROMO_AUDIO_MODE==='music';
const requestedMode=process.env.MOTION_DESIGN_MODE??'guided';assert.ok(['guided','free'].includes(requestedMode));
const existingSession=process.env.MOTION_EXISTING_SESSION;
const model=process.env.MOTION_MODEL??'MiniMax-M3.1-Flash-Preview';
const workspace=process.env.MOTION_WORKSPACE??'测试结果';
const cwd=process.env.MOTION_WORKSPACE_DIR;assert.ok(cwd,'Set MOTION_WORKSPACE_DIR to the dedicated test workspace directory');
const output=process.env.MOTION_MODEL_OUTPUT??'test-output/video-model';
assert.notEqual(workspace,'Workspace','Use a dedicated test workspace');
let url=process.env.MOTION_TEST_URL;
if(!url){assert.ok(process.env.MOTION_WEB_LOG,'Set MOTION_WEB_LOG to a private Web startup log or MOTION_TEST_URL');const log=(await readFile(process.env.MOTION_WEB_LOG,'utf8')).replace(/\u001b\[[0-9;]*m/g,'');url=log.match(/http:\/\/(?:127\.0\.0\.1|localhost):\d+\/\S*/)?.[0];}
assert.ok(url,'Authenticated startup URL not found');
await mkdir(output,{recursive:true});
const {chromium}=createRequire(import.meta.url)(process.env.DSH_PLAYWRIGHT??'playwright');
const browser=await chromium.launch({headless:true,channel:process.env.MOTION_BROWSER??'msedge'});
const page=await browser.newPage({viewport:{width:1920,height:1080}});
const report={model,build:BUILD_INFO,workspace,startedAt:new Date().toISOString(),waitPolicy:'Natural completion; no model cancellation, no changes to reasoning/output limits',cases:[],pageErrors:[]};
page.on('pageerror',e=>report.pageErrors.push(e.message));
let sessionId,originalMode,originalStyle;
const persist=()=>writeFile(join(output,'results.json'),JSON.stringify(report,null,2)+'\n');
async function events(){
 if(!sessionId)return[];
 for(const root of await readdir(dshHomePath('sessions'),{withFileTypes:true})){if(!root.isDirectory())continue;let b;try{b=await readFile(join(dshHomePath('sessions'),root.name,sessionId,'session.v4.jsonl.zstd'))}catch{continue}
  const rows=[];while(b.length){const r=zstdDecompressSync(b,{info:true});assert.ok(r.engine.bytesWritten);rows.push(...r.buffer.toString().trim().split('\n').filter(Boolean).map(JSON.parse));b=b.subarray(r.engine.bytesWritten)}return rows;
 }throw Error('Session event file not found');
}
async function discover(since){
 const dir=dshHomePath('storages','session_projcache','sessions'),files=(await Promise.all((await readdir(dir)).map(async name=>({name,time:(await stat(join(dir,name))).mtimeMs})))).filter(f=>f.time>=since).sort((a,b)=>b.time-a.time);
 for(const {name}of files){const r=JSON.parse(await readFile(join(dir,name),'utf8')),v=r.record?.rows?.modelSelection?.val,m=v?.pending??v?.lastUsed;if(r.record?.identity?.createdAt>=since&&r.record?.identity?.cwd===cwd&&m?.model===model){sessionId=name.replace(/\.json$/,'');return}}
 throw Error('Test session not found in the dedicated workspace');
}
async function settings(){await page.goto(url);await page.getByRole('button',{name:'插件',exact:true}).click();await page.getByRole('button',{name:'查看 dsh-motion-ui',exact:true}).click();await page.getByRole('combobox',{name:'设计模式'}).waitFor();}
async function newSession(){
 sessionId=undefined;const since=Date.now();if(existingSession){sessionId=existingSession;const cached=JSON.parse(await readFile(dshHomePath('storages','session_projcache','sessions',sessionId+'.json'),'utf8'));assert.equal(cached.record.identity.cwd,cwd);const title=cached.record.rows.title.val;await page.goto(url);const item=page.getByText(title,{exact:true}).first();if(!await item.isVisible())await page.getByText(workspace,{exact:true}).first().click();await item.click();await page.getByRole('button',{name:'发送消息',exact:true}).waitFor();return since}await page.goto(url);await page.getByText(workspace,{exact:true}).first().click();await page.getByRole('button',{name:'在“'+workspace+'”中新建会话',exact:true}).click();await page.getByRole('button',{name:/选择模型，当前/}).click();await page.getByRole('menuitem',{name:/模型/}).click();await page.getByRole('menuitemradio',{name:model,exact:true}).click();return since;
}
const flatten=nodes=>nodes.flatMap(n=>[n,...flatten(n.children??[])]);
function records(rows){const found=new Map();for(const e of rows){const r=e.data?.meta?.dshGenerativeUi??e.data?.meta?.dshGenerativeUiPatch;if(r&&(!found.has(r.documentId)||(found.get(r.documentId).documentRevision??0)<=(r.documentRevision??0)))found.set(r.documentId,r)}return[...found.values()];}
async function run(name,prompt,{fresh=true,verify}={}){
 const since=fresh?await newSession():Date.now(),before=(await events()).length,result={name,prompt,passed:false};let firstVisibleMs=null,watch,watching=false;
 try{
  const edit=page.locator('[contenteditable=true]').first();await edit.click();await page.keyboard.insertText(prompt);await page.keyboard.type(' ');const sent=Date.now();await page.getByRole('button',{name:'发送消息',exact:true}).click();await page.getByRole('button',{name:'停止生成',exact:true}).waitFor();
  if(fresh)watch=setInterval(async()=>{if(watching||firstVisibleMs!==null)return;watching=true;try{if(await page.locator('[data-dsh-generative-ui]').count())firstVisibleMs=Date.now()-sent}catch{}finally{watching=false}},500);
  // Deliberately no timeout/cancel/max_tokens/reasoning override on inference.
  await page.getByRole('button',{name:'发送消息',exact:true}).waitFor({timeout:0});clearInterval(watch);await page.waitForTimeout(800);if(!existingSession)await discover(since);const all=await events(),delta=all.slice(before),uiRecords=records(all);
  result.sessionId=sessionId;result.elapsedMs=Date.now()-sent;result.firstVisibleMs=firstVisibleMs;result.toolCalls=delta.filter(e=>e.type==='tool/call').map(e=>e.data.name);result.toolErrors=delta.filter(e=>e.type==='tool/result'&&e.data.message?.isError).map(e=>e.data.message.content.map(x=>x.text??'').join('\n'));result.renderAttempts=result.toolCalls.filter(n=>/^render_/.test(n)).length;result.documentIds=uiRecords.map(r=>r.documentId);result.documents=uiRecords.map(r=>({documentId:r.documentId,revision:r.documentRevision??0,title:r.document.title}));result.visibleUiCount=await page.locator('[data-dsh-generative-ui]:not([data-preview])').count();
  const currentHeaders=delta.filter(e=>e.type==='request/header');const headers=(currentHeaders.length?currentHeaders:all.filter(e=>e.type==='request/header').slice(-1)).map(e=>e.data.header.config);result.requestConfig=headers.map(h=>({model:h.model,reasoningEffort:h.reasoningEffort,maxTokens:h.maxTokens}));assert.ok(headers.length&&headers.every(h=>h.model===model),'Actual request model must match selection');
  result.text=delta.filter(e=>e.type==='assistant/message').flatMap(e=>e.data.message.content.filter(c=>c.type==='text').map(c=>c.text)).join('\n');
  await verify?.(result,uiRecords,all);result.passed=true;
 }catch(e){result.failure=String(e.message).replace(/https?:\/\/\S+/g,'[URL]').slice(0,1000)}finally{clearInterval(watch);await page.screenshot({path:join(output,name+'.png'),fullPage:true}).catch(()=>{});report.cases.push(result);await persist();console.log(JSON.stringify({name,passed:result.passed,elapsedMs:result.elapsedMs,firstVisibleMs:result.firstVisibleMs,tools:result.toolCalls,toolErrors:result.toolErrors,failure:result.failure}));}
 return result;
}
let firstVideo;
async function mediaJobs(){const root=dshHomePath('plugins','dsh-generative-ui','media'),jobs=[];for(const id of await readdir(root)){try{const job=JSON.parse(await readFile(join(root,id,'manifest.json'),'utf8'));if(job.sessionId===sessionId)jobs.push(job)}catch{}}return jobs.sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))}
try{
 await settings();originalMode=await page.getByRole('combobox',{name:'设计模式'}).inputValue();originalStyle=await page.getByRole('radiogroup',{name:'视觉风格'}).getByRole('radio',{checked:true}).getAttribute('data-style');report.originalSettings={mode:originalMode,style:originalStyle};
 if(originalMode!==requestedMode){await page.getByRole('combobox',{name:'设计模式'}).selectOption(requestedMode);await page.getByText('模式已保存；从下一次请求开始生效。',{exact:true}).waitFor()}
 const made=await run(existingSession?'final-export-regression':'make-video',(process.env.MOTION_VIDEO_PROMPT_FILE?await readFile(process.env.MOTION_VIDEO_PROMPT_FILE,'utf8'):process.env.MOTION_VIDEO_PROMPT)??'请制作一段 6 秒横屏短片，1280×720、15fps，用简洁的动态图解讲清「输入 → 处理 → 输出」，三个阶段的文字要留出阅读时间，使用当前选定的视觉风格。不要配音、配乐，不联网、不安装工具或创建外部工程。请用插件交付可修改源码和真正的 MP4 文件，不要只给制作计划。',{verify:async(r,docs)=>{assert.ok(r.toolCalls.includes('render_video'));assert.deepEqual(r.toolErrors,[],'Video delivery must not require tool-error recovery');assert.equal(docs.length,1);const jobs=await mediaJobs();firstVideo=jobs.find(j=>j.kind==='render'&&j.status==='completed');assert.ok(firstVideo,'Actual completed media job required');const {probeVideo}=await import('../lib/video.js');const probe=await probeVideo(join(firstVideo.directory,'video.mp4'));if(promo){assert.equal(probe.width,1920);assert.equal(probe.height,1080);assert.equal(probe.frameRate,'30/1');assert.ok(probe.duration>=Number(process.env.MOTION_PROMO_MIN_SECONDS??25)&&probe.duration<=Number(process.env.MOTION_PROMO_MAX_SECONDS??90));assert.ok(probe.audio.length>0);if(!existingSession&&!musicOnly)assert.ok(r.toolCalls.includes('synthesize_voice'));assert.ok(r.toolCalls.includes('preview_video'));assert.ok(r.toolCalls.includes('read_image'));assert.ok(r.toolCalls.includes('inspect_video'));assert.ok(firstVideo.files.includes('project.zip'));r.captionMode=firstVideo.files.includes('captions.srt')?'burned-SRT':'authored-in-canvas; verify timing/display separately';if(!musicOnly)assert.ok(firstVideo.audioTracks?.some(t=>t.role==='voice'));assert.ok(firstVideo.audioTracks?.some(t=>t.role==='music'));r.voiceJob=jobs.find(j=>j.kind==='voice'&&j.status==='completed')?.id;if(!musicOnly)assert.ok(r.voiceJob)}else{assert.equal(probe.width,1280);assert.equal(probe.height,720);assert.ok(Math.abs(probe.duration-6)<.15);}assert.ok(firstVideo.files.includes('source.html'));r.video={directory:firstVideo.directory,probe};}});
 if(made.passed&&!promo)await run('inspect-and-edit-video','用插件处理刚才的视频：先检查元数据，并查看第 0.5 秒、3 秒、5.5 秒的画面，简单确认三个阶段。然后取前 2 秒和最后 2 秒，顺序拼成一段 4 秒短片，沿用 1280×720、15fps。第一句字幕「建立输入」在输出的 0 到 1.5 秒显示，第二句「观察结果」在 2 到 3.5 秒显示，中间留空；不要配音或配乐。保留原片，给我新 MP4。',{fresh:false,verify:async(r,docs)=>{assert.ok(r.toolCalls.includes('inspect_video'));assert.ok(r.toolCalls.includes('process_video'));assert.deepEqual(r.toolErrors,[],'Editing must not require tool-error recovery');assert.equal(docs.length,1);const jobs=await mediaJobs(),edited=jobs.find(j=>j.kind==='process'&&j.status==='completed');assert.ok(edited);const {probeVideo}=await import('../lib/video.js');const probe=await probeVideo(join(edited.directory,'video.mp4'));assert.ok(Math.abs(probe.duration-4)<.15);assert.equal(probe.width,1280);assert.equal(edited.clips.length,2);r.video={directory:edited.directory,probe};}});
 report.passed=report.cases.length===(promo?1:2)&&report.cases.every(c=>c.passed)&&report.pageErrors.length===0;}finally{
 try{if(originalMode){await settings();if(await page.getByRole('combobox',{name:'设计模式'}).inputValue()!==originalMode){await page.getByRole('combobox',{name:'设计模式'}).selectOption(originalMode);await page.getByText('模式已保存；从下一次请求开始生效。',{exact:true}).waitFor()}report.settingsRestored=(await page.getByRole('combobox',{name:'设计模式'}).inputValue()===originalMode)&&(await page.getByRole('radiogroup',{name:'视觉风格'}).getByRole('radio',{checked:true}).getAttribute('data-style')===originalStyle);}}finally{report.finishedAt=new Date().toISOString();await persist();await browser.close()}
}

console.log(JSON.stringify({passed:report.passed,output,settingsRestored:report.settingsRestored}));if(!report.passed)process.exitCode=1;
