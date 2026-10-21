import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';
import {chromium} from 'playwright-core';
import {pathToFileURL} from 'node:url';
import {VideoStudio,VIDEO_STAGE_CSS} from '../lib/video.js';
import {craftCatalog} from '../lib/motion-craft.js';
const dir=resolve('test-output/motion-video'),studio=new VideoStudio(dir),document=craftCatalog('timeline').document;
const job=await studio.render({record:{document,documentId:'22222222-2222-4222-8222-222222222222',documentRevision:0,sessionId:'playback-test'},state:{},duration:6,width:640,height:360,fps:10,audioPath:join(dir,'tone.wav'),captions:[{start:0,end:1,text:'首句'},{start:3,end:4,text:'第二句'}]});
const server=createServer(async(req,res)=>{try{const name=basename(req.url.split('?')[0])||'source.html';if(!job.files.includes(name)){res.writeHead(404).end();return}res.setHeader('Content-Type',name.endsWith('.html')?'text/html; charset=utf-8':'audio/wav');const bytes=await readFile(join(job.directory,name));res.setHeader('Accept-Ranges','bytes');const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range??'');if(range){const start=Number(range[1]),end=range[2]?Math.min(bytes.length-1,Number(range[2])):bytes.length-1;res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${bytes.length}`,'Content-Length':end-start+1});res.end(bytes.subarray(start,end+1))}else{res.setHeader('Content-Length',bytes.length);res.end(bytes)}}catch{res.writeHead(500).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge',args:['--autoplay-policy=no-user-gesture-required']});
const report={passed:false,errors:[],checks:[],directory:job.directory};
try{
 const p=await browser.newPage({viewport:{width:960,height:720}});p.on('pageerror',e=>report.errors.push(e.message));await p.goto('http://127.0.0.1:'+server.address().port+'/source.html');
 const f=p.frames().find(f=>f!==p.mainFrame());await f.waitForFunction(()=>window.__DSHMotionCapture?.list().length===1);
 await f.evaluate(()=>window.__DSHMotionCapture.seek('main',.5));await p.getByText('首句',{exact:true}).waitFor();await f.evaluate(()=>window.__DSHMotionCapture.seek('main',2));await p.getByText('首句',{exact:true}).waitFor({state:'hidden'});report.checks.push('standalone captions disappear in measured silent gaps');const first=await f.locator('#stage').screenshot();
 await f.evaluate(()=>{window.__DSHMotionCapture.seek('main',5);window.__DSHMotionCapture.seek('main',2)});assert.deepEqual(await f.locator('#stage').screenshot(),first);report.checks.push('backward seeking produces identical actual pixels');
 await f.getByRole('button',{name:'播放',exact:true}).click();await p.getByRole('button',{name:'开启配乐',exact:true}).click();
 await p.waitForFunction(()=>document.querySelector('audio')?.paused===false);await f.getByRole('button',{name:'暂停',exact:true}).click();await p.waitForFunction(()=>document.querySelector('audio').paused);report.checks.push('real HTML audio follows source play and pause');
 await f.getByRole('slider',{name:'动画时间（秒）'}).fill('4');try{await p.waitForFunction(()=>Math.abs(document.querySelector('audio').currentTime-4)<.25,undefined,{timeout:3000})}catch(e){report.debug={audio:await p.evaluate(()=>({time:document.querySelector('audio').currentTime,paused:document.querySelector('audio').paused,ready:document.querySelector('audio').readyState})),timeline:await f.evaluate(()=>window.__DSHMotionCapture.list())};throw e};report.checks.push('source soundtrack follows seeking');
 await f.getByRole('button',{name:'播放',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('audio').paused);await p.emulateMedia({reducedMotion:'reduce'});await p.waitForFunction(()=>document.querySelector('audio').paused);report.checks.push('reduced motion pauses picture advancement and soundtrack');
 await p.emulateMedia({reducedMotion:'no-preference'});await p.waitForFunction(()=>!document.querySelector('audio').paused);
 await p.evaluate(()=>dispatchEvent(new Event('pagehide')));await p.waitForFunction(()=>document.querySelector('audio').paused);report.checks.push('pagehide handler stops sound');
 await p.goto(pathToFileURL(join(job.directory,'source.html')).href);const offline=p.frames().find(f=>f!==p.mainFrame());await offline.waitForFunction(()=>window.__DSHMotionCapture?.list().length===1);await offline.getByRole('button',{name:'播放',exact:true}).click();await p.getByRole('button',{name:'开启配乐',exact:true}).click();await p.waitForFunction(()=>document.querySelector('audio')?.paused===false);report.checks.push('downloaded file source plays offline with its bundled soundtrack');
 await offline.evaluate(()=>{const el=document.createElement('span');el.id='authored-hidden';el.style.visibility='hidden';el.textContent='隐藏内容';document.getElementById('stage').append(el)});await offline.addStyleTag({content:VIDEO_STAGE_CSS});assert.equal(await offline.locator('#authored-hidden').evaluate(el=>getComputedStyle(el).visibility),'hidden');assert.equal(await offline.locator('#stage').evaluate(el=>getComputedStyle(el).visibility),'visible');report.checks.push('capture keeps authored hidden descendants hidden');
 assert.equal(report.errors.length,0);report.passed=true;
}finally{await browser.close();await new Promise(r=>server.close(r));await writeFile(join(dir,'playback-verification.json'),JSON.stringify(report,null,2))}
console.log(JSON.stringify(report));
