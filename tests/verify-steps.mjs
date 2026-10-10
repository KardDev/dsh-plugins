import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {build} from 'esbuild';
import {UiStore,stateRoute,documentRoute} from '../lib/store.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.DSH_PLAYWRIGHT??'playwright');
const document={version:1,title:'第一次发布项目',fallback:'建议流程，尚未执行。',presentation:{layout:'guide',accent:'teal',density:'compact'},nodes:[{id:'flow',type:'steps',items:{item:['整理文件','本地提交','新建空仓库','连接并推送','发布版本'].map(title=>({title,description:'核对内容后再进行下一步。'}))}}]};
const directory=await mkdtemp(join(tmpdir(),'motion-steps-')),store=new UiStore(directory);
const record=await store.create(document,{sessionId:'steps-test',callId:'steps-call'});
const error='Error: DSH UI: node.flow.items requires 1..12 items; received 0. Split a longer guide into separate steps nodes';
const entry=`import React from'react';import{createRoot}from'react-dom/client';import{ValidatedView,ToolView}from'./src/view.js';import{CSS}from'./src/styles.js';const style=document.createElement('style');style.textContent=CSS;document.head.append(style);createRoot(document.getElementById('app')).render(React.createElement(React.Fragment,null,React.createElement(ValidatedView,{raw:${JSON.stringify(record)},sessionId:'steps-test',preview:true}),React.createElement(ToolView,{phase:'result',block:{isError:true,content:[{type:'text',text:${JSON.stringify(error)}}]}})));`;
const bundle=(await build({stdin:{contents:entry,resolveDir:process.cwd()},bundle:true,write:false,format:'iife'})).outputFiles[0].text;
const server=createServer(async(req,res)=>{
  if(req.url.startsWith('/api/')){let body='';for await(const c of req)body+=c;const route=req.url.includes('/document?')?documentRoute(store):stateRoute(store),response=await route(new Request('http://localhost'+req.url,{method:req.method,headers:req.headers,body:req.method==='POST'?body:undefined}));res.writeHead(response.status,{'Content-Type':'application/json'});res.end(await response.text());return;}
  res.setHeader('Content-Type',req.url==='/bundle.js'?'text/javascript':'text/html');res.end(req.url==='/bundle.js'?bundle:'<!doctype html><meta charset="utf-8"><style>body{font:16px system-ui;margin:24px;background:white;color:#26354b}body[data-ds-dark-theme]{background:#171b24;color:#e8eef8;--dsw-alias-bg-layer-1:#1c2330;--dsw-alias-bg-layer-2:#242d3c;--dsw-alias-label-primary:#e2e8f3;--dsw-alias-label-secondary:#a4b1c5;--dsw-alias-border-l2:#354155}#app{max-width:920px;margin:auto;display:grid;gap:16px}</style><div id="app"></div><script src="/bundle.js"></script>');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,channel:'msedge'}),errors=[],checks=[];
try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('.dgui-steps li').last().waitFor();
  for(const width of [1920,1365])for(const dark of [false,true]){
    await page.setViewportSize({width,height:1080});await page.locator('body').evaluate((el,value)=>el.toggleAttribute('data-ds-dark-theme',value),dark);
    assert.equal(await page.locator('.dgui-steps li').count(),5);assert.equal(await page.locator('.dgui-step-state').count(),0);
    assert.equal(await page.locator('.dgui-tool-error').innerText(),error);assert.equal(await page.locator('.dgui-tool-error pre,.dgui-tool-error details').count(),0);
    assert.ok((await page.locator('.dgui-tool-error').boundingBox()).height<90);
    assert.ok(await page.locator('#app').evaluate(el=>el.scrollWidth<=el.clientWidth));
    assert.equal(await page.locator('.dgui-document-warning,.dgui-recovery').count(),0);
    checks.push({width,dark,steps:5,errorCompact:true});
  }
  await mkdir('test-output',{recursive:true});await page.screenshot({path:'test-output/steps-repair-desktop.png',fullPage:true});
  assert.deepEqual(errors,[]);await writeFile('test-output/steps-verification.json',JSON.stringify({passed:true,checks,errors},null,2));console.log(JSON.stringify({passed:true,checks,errors}));
}finally{await browser.close();await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});}
