// Integration acceptance: actual UiStore + real React renderer, isolated from user state and model billing.
import {createServer} from 'node:http';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {UiStore,stateRoute,documentRoute} from '../lib/store.js';
import {curveExample} from '../lib/catalog.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.DSH_PLAYWRIGHT??'playwright');
const dir=await mkdtemp(join(tmpdir(),'dgui-recovery-'));const store=new UiStore(dir);
const record=await store.create(curveExample,{sessionId:'test-session',callId:'test-call'}), handler=stateRoute(store);
const code=`import React from 'react';import{createRoot}from'react-dom/client';import{ValidatedView}from'./src/view.js';import{CSS}from'./src/styles.js';const s=document.createElement('style');s.textContent=CSS;document.head.append(s);window.prompts=[];createRoot(document.getElementById('app')).render(React.createElement(React.StrictMode,null,React.createElement(ValidatedView,{raw:${JSON.stringify(record)},sessionId:'test-session',sendPrompt:async p=>window.prompts.push(p)})));`;
const bundle=(await build({stdin:{contents:code,resolveDir:process.cwd()},bundle:true,write:false,format:'iife'})).outputFiles[0].text;
let failGet=2,failPost=0,ambiguous=0,delay=0,started=()=>{};const counts={get:0,post:0};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const server=createServer(async(req,res)=>{
 if(req.url.startsWith('/api/plugins/dsh-generative-ui/document?')){let body='';for await(const c of req)body+=c;const r=await documentRoute(store)(new Request('http://localhost'+req.url,{method:req.method,headers:req.headers,body:req.method==='POST'?body:undefined}));res.writeHead(r.status,{'Content-Type':'application/json'});res.end(await r.text());return;}
 if(req.url.startsWith('/api/')) {
  let body='';for await(const c of req)body+=c;
  if(req.method==='GET'){counts.get++;if(failGet-->0){res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"temporary read failure"}');return;}}
  else {counts.post++;started();if(delay){const ms=delay;delay=0;await pause(ms);}if(failPost-->0){res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"temporary write failure"}');return;}}
  const response=await handler(new Request('http://localhost'+req.url,{method:req.method,headers:req.headers,body:req.method==='POST'?body:undefined}));
  if(req.method==='POST'&&response.ok&&ambiguous-->0){res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"response lost after commit"}');return;}
  res.writeHead(response.status,{'Content-Type':'application/json'});res.end(await response.text());return;
 }
 if(req.url==='/bundle.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(bundle);return;}
 res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><meta charset="utf-8"><style>body{background:#f4f6fa;padding:24px;font-family:system-ui}#app{max-width:760px;margin:auto}</style><div id="app"></div><script src="/bundle.js"></script>');
});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,channel:'msedge'}),checks=[],errors=[];
const saved=async()=>await store.readState(record.documentId,'test-session');
async function until(predicate){const deadline=Date.now()+10000;while(!(await predicate())){if(Date.now()>deadline)throw new Error('condition timeout');await pause(20);}}
const debugPages=[];try{
 const a=await browser.newPage({viewport:{width:1100,height:1200}});debugPages.push(a);a.on('pageerror',e=>errors.push(e.message));await a.goto(url);
 await a.getByRole('button',{name:'重新读取参数',exact:true}).waitFor();assert.equal(await a.getByRole('slider').first().isDisabled(),true);
 await a.getByRole('button',{name:'重新读取参数',exact:true}).click();await a.getByText('使用初始参数',{exact:true}).waitFor();checks.push('failed restore can retry without enabling un-restored inputs');
 const curve=a.locator('.dgui-chart'),original=await curve.innerText();
 await a.getByRole('slider',{name:'最大上下文 K tokens',exact:true}).fill('64');await a.getByText('16.36 GiB',{exact:true}).waitFor();
 assert.notEqual(await curve.innerText(),original);assert.equal((await a.evaluate(()=>window.prompts)).length,0);
 await a.getByText('参数已保存',{exact:true}).waitFor();assert.equal((await saved()).state.contextK,64);checks.push('slider recomputes curve/table/metric locally');
 failPost=1;await a.getByRole('slider',{name:'假设有效位宽 bit',exact:true}).fill('5');await a.getByRole('button',{name:'重试保存',exact:true}).waitFor();
 assert.equal(await a.getByRole('slider',{name:'假设有效位宽 bit',exact:true}).inputValue(),'5');await a.getByRole('button',{name:'重试保存',exact:true}).click();
 await a.getByText('参数已保存',{exact:true}).waitFor();await a.reload();await a.getByText('已恢复保存的参数',{exact:true}).waitFor();assert.equal(await a.getByRole('slider',{name:'假设有效位宽 bit',exact:true}).inputValue(),'5');checks.push('save failure preserves edits and retry persists them');
 const b=await browser.newPage();debugPages.push(b);b.on('pageerror',e=>errors.push(e.message));await b.goto(url);await b.getByText('已恢复保存的参数',{exact:true}).waitFor();
 await a.getByRole('slider',{name:'最大上下文 K tokens',exact:true}).fill('96');await a.getByText('参数已保存',{exact:true}).waitFor();
 await b.getByRole('slider',{name:'最大上下文 K tokens',exact:true}).fill('128');await b.getByRole('button',{name:'使用已保存参数',exact:true}).waitFor();
 assert.equal(await b.getByRole('slider',{name:'最大上下文 K tokens',exact:true}).inputValue(),'128');assert.equal((await saved()).state.contextK,96);
 await b.getByRole('spinbutton').fill('');await b.getByRole('button',{name:'使用已保存参数',exact:true}).click();await b.getByText('已恢复保存的参数',{exact:true}).waitFor();
 assert.equal(await b.getByRole('slider',{name:'最大上下文 K tokens',exact:true}).inputValue(),'96');assert.equal(await b.getByRole('spinbutton').inputValue(),'27');checks.push('conflict preserves draft, explicit remote adoption resets invalid draft');
 await b.getByRole('slider',{name:'最大上下文 K tokens',exact:true}).fill('128');await b.getByText('参数已保存',{exact:true}).waitFor();
 await a.getByRole('slider',{name:'最大上下文 K tokens',exact:true}).fill('64');await a.getByRole('button',{name:'保留本页参数并重试',exact:true}).waitFor();
 await a.getByRole('button',{name:'保留本页参数并重试',exact:true}).click();await a.getByText('参数已保存',{exact:true}).waitFor();assert.equal((await saved()).state.contextK,64);checks.push('explicit keep-local rereads revision and saves with CAS');
 ambiguous=1;await a.getByRole('slider',{name:'假设有效位宽 bit',exact:true}).fill('5.25');await a.getByRole('button',{name:'重试保存',exact:true}).waitFor();await a.getByRole('button',{name:'重试保存',exact:true}).click();
 await a.getByRole('button',{name:'使用已保存参数',exact:true}).waitFor();await a.getByRole('button',{name:'使用已保存参数',exact:true}).click();await a.getByText('已恢复保存的参数',{exact:true}).waitFor();assert.equal(await a.getByRole('slider',{name:'假设有效位宽 bit',exact:true}).inputValue(),'5.25');checks.push('ambiguous committed write leads to conflict rather than blind overwrite');
 const postStarted=new Promise(resolve=>started=resolve);delay=500;await a.getByRole('slider',{name:'最大上下文 K tokens',exact:true}).fill('32');await postStarted;started=()=>{};
 await a.getByRole('slider',{name:'最大上下文 K tokens',exact:true}).fill('48');await until(async()=>(await saved()).state.contextK===48);await a.getByText('参数已保存',{exact:true}).waitFor();checks.push('edits during in-flight save persist after the earlier response');
 await a.getByRole('button',{name:'按当前曲线继续分析',exact:true}).click();await a.getByText('已加入当前会话队列',{exact:false}).waitFor();const prompts=await a.evaluate(()=>window.prompts);const snap=JSON.parse(prompts[0].split('UI 参数快照：\n')[1]);assert.equal(snap.derived.curve.at(-1).contextK,48);checks.push('followup carries current generated curve');
 await a.screenshot({path:'test-output/live-curve-desktop.png',fullPage:true});await a.setViewportSize({width:390,height:844});assert.ok(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await a.screenshot({path:'test-output/live-curve-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);await writeFile('test-output/recovery-verification.json',JSON.stringify({checks,counts,errors},null,2));console.log(JSON.stringify({checks,counts,errors}));
}catch(e){console.log('Acceptance failure: '+e.message);for(const p of debugPages){console.log((await p.locator('body').innerText()).slice(-2500));}console.log(JSON.stringify(counts));throw e;}
finally{await browser.close();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}






