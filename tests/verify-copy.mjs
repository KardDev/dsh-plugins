import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {build} from 'esbuild';
import {textDocument} from '../lib/text-document.js';
import {visualDocument} from '../lib/visual.js';
import {UiStore,stateRoute,documentRoute} from '../lib/store.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.DSH_PLAYWRIGHT??'playwright');
const dir=await mkdtemp(join(tmpdir(),'motion-copy-')),store=new UiStore(dir),errors=[];
const source='\tconst x = `<img src=x onerror="window.injected=1">`;\n  // 中文、反引号与缩进\n'+'x'.repeat(400),text='你好世界\n第二行';
const docs=[textDocument({blocks:[{type:'text',text:'普通讲解不加复制框'},{type:'text',title:'写作',copyable:true,spans:[{text:'你好',weight:700},{text:'世界\n第二行'}]},{type:'code',lang:'js',code:source}]}),visualDocument({items:[{type:'text',content:text,title:'扩展文案',copyable:true},{type:'code',lang:'js',code:source,title:'扩展代码',wrap:true}]})];
const records=await Promise.all(docs.map((doc,i)=>store.create(doc,{sessionId:'copy',callId:'copy'+i})));
const entry=`import React from'react';import{createRoot}from'react-dom/client';import{UiView}from'./src/view.js';import{CSS}from'./src/styles.js';import{VISUAL_CSS}from'./src/visual-styles.js';const st=document.createElement('style');st.textContent=CSS+VISUAL_CSS;document.head.append(st);const records=${JSON.stringify(records)},root=createRoot(document.getElementById('app'));window.paint=preview=>root.render(React.createElement(React.Fragment,null,...records.map((record,i)=>React.createElement('div',{key:i,'data-doc':i},React.createElement(UiView,{record,sessionId:'copy',preview})))));window.paint(false);`;
const bundle=(await build({stdin:{contents:entry,resolveDir:process.cwd()},bundle:true,write:false,format:'iife'})).outputFiles[0].text;
const server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');if(u.pathname.includes('/assets/')){const file=u.pathname.split('/assets/')[1];assert.match(file,/^[\w-]+\.(js|css)$/);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/css');res.end(await readFile('lib/assets/'+file));return}if(u.pathname.startsWith('/api/')){const response=await(u.pathname.endsWith('/state')?stateRoute(store):documentRoute(store))(new Request(u,{method:req.method,headers:req.headers}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return}res.setHeader('Content-Type',req.url==='/bundle.js'?'text/javascript':'text/html');res.end(req.url==='/bundle.js'?bundle:'<!doctype html><meta charset=utf-8><style>body{margin:32px;font:16px system-ui;background:white;color:#111}#app{max-width:960px;margin:auto}body[data-ds-dark-theme]{background:#171717;color:#eee;color-scheme:dark;--dsw-alias-bg-layer-1:#202020;--dsw-alias-bg-layer-2:#292929;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa}</style><div id=app></div><script src=/bundle.js></script>')}catch(e){res.statusCode=500;res.end(e.message)}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1920,height:1080},permissions:['clipboard-read','clipboard-write']}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:'+server.address().port);await p.waitForFunction(()=>document.querySelectorAll('.motion-copy-block').length===4&&!document.querySelector('[data-motion-visual] [inert]'));
 const panels=p.locator('.motion-copy-block');assert.equal(await p.locator('[data-doc="0"]').getByRole('button',{name:'复制文本',exact:true}).count(),1);
 for(const i of [0,1,2,3]){await panels.nth(i).getByRole('button').click();await panels.nth(i).locator('button[data-status=done]').waitFor();assert.equal((await p.evaluate(()=>navigator.clipboard.readText())).replaceAll("\r\n","\n"),i%2?source:text)}
 assert.equal(await p.evaluate(()=>window.injected),undefined);assert.equal(await p.locator('.motion-copy-block img').count(),0);
 await p.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied')}}});window.fallback=[];document.execCommand=()=>{window.fallback.push(document.activeElement.value);return true}});
 await panels.nth(1).getByRole('button').click();await panels.nth(1).locator('button[data-status=done]').waitFor();assert.deepEqual(await p.evaluate(()=>window.fallback),[source]);assert.equal(await p.locator('textarea').count(),0);
 await p.evaluate(()=>document.execCommand=()=>false);await panels.nth(0).getByRole('button').click();await panels.nth(0).getByRole('button',{name:'复制失败，请手动选择内容'}).waitFor();
 for(const dark of [false,true]){await p.evaluate(d=>document.body.toggleAttribute('data-ds-dark-theme',d),dark);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.screenshot({path:'test-output/copy-'+(dark?'dark':'light')+'.png',fullPage:true})}
 await p.evaluate(()=>window.paint(true));await p.waitForFunction(()=>document.querySelector('.motion-copy-button')?.disabled);assert.equal(await p.locator('[data-doc="0"] .motion-copy-button:not(:disabled)').count(),0);assert.ok(await p.locator('[data-doc="1"] [inert]').count());
 assert.deepEqual(errors,[]);const result={passed:true,checks:['native and extended exact clipboard text including whitespace and literal markup','successful clipboard API and denied-API fallback','failure feedback and temporary field cleanup','ordinary prose stays lightweight','light/dark PC fit; long code scrolls internally','stream previews disable copy'],errors};await writeFile('test-output/copy-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true})}
