import assert from'node:assert/strict';import{createRequire}from'node:module';import{readFile,writeFile}from'node:fs/promises';import{resolve}from'node:path';import{pathToFileURL}from'node:url';
import{evaluate}from'../lib/protocol.js';import{canvasSnapshot}from'../lib/sandbox.js';
import{UiStore}from'../lib/store.js';
const resultPath=process.env.DSH_REPLAY_RESULT;assert.ok(resultPath);const result=JSON.parse(await readFile(resultPath,'utf8')),base=resultPath.replace(/\/results.json$/,'');
const record=JSON.parse(await readFile('C:/Users/15403/.dsh/plugins/dsh-generative-ui/'+result.cases[0].documentId+'.json','utf8'));assert.equal(record.sessionId,result.sessionId);
const cache=JSON.parse(await readFile('C:/Users/15403/.dsh/storages/session_projcache/sessions/'+record.sessionId+'.json','utf8'));assert.equal(cache.record.identity.cwd,'J:\\测试结果');
const url=(await readFile('test-output/openintelligent-fast.stdout.log','utf8')).match(/http:\/\/127\.0\.0\.1:3082\/\S*/)?.[0];assert.ok(url);
const require=createRequire(import.meta.url),{chromium}=require(process.env.DSH_PLAYWRIGHT??'playwright'),browser=await chromium.launch({headless:true,channel:'msedge'}),report={passed:false,checks:[],exports:[],errors:[],noModelRequestsSubmitted:true};
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}});page.on('pageerror',e=>report.errors.push(e.message));await page.goto(url,{waitUntil:'domcontentloaded'});const row=page.locator('[data-row-key="session:'+record.sessionId+'"]');
 for(let i=0;i<10&&!await row.isVisible();i++){const group=page.getByText('测试结果',{exact:true}).first();if(await group.isVisible())await group.click();for(const more of await page.getByText(/^展开其余 \d+ 个会话$/).all())if(await more.isVisible())await more.click();await page.waitForTimeout(300)}await row.click();
 const ui=page.locator('[data-dsh-generative-ui="'+record.documentId+'"]:not([data-preview=true])').last();await ui.getByText('已恢复保存的参数',{exact:true}).waitFor();
 const nodes=record.document.nodes.flatMap(function flatten(n){return[n,...(n.children??[]).flatMap(flatten)]}).filter(n=>n.type==='sandbox');assert.ok(nodes.length,'model must generate a canvas for canvas-export acceptance');
 for(const node of nodes){
  const surface=ui.locator('[data-ui-node="'+node.id+'"]'),frame=surface.frameLocator('iframe');await surface.locator('[data-canvas-phase=ready]').or(surface).waitFor();await frame.locator('#canvas').waitFor();const live=await frame.locator('body').evaluate(()=>DSHUI.snapshot);
  const state=(await new UiStore('C:/Users/15403/.dsh/plugins/dsh-generative-ui').readState(record.documentId,record.sessionId)).state;
  await surface.locator('.dgui-canvas-options>summary').click();const waiting=page.waitForEvent('download');await surface.getByRole('button',{name:'导出独立 HTML'}).click();const download=await waiting,path=resolve(base,'export-'+node.id+'.html');await download.saveAs(path);
  const exported=await browser.newPage({viewport:{width:1920,height:1080}}),network=[];exported.on('pageerror',e=>report.errors.push(e.message));exported.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});await exported.goto(pathToFileURL(path).href);const offline=exported.frameLocator('iframe');await offline.locator('#canvas').waitFor();await offline.locator('body').evaluate(()=>DSHUI.snapshot.state);
  await exported.waitForFunction(()=>!!document.querySelector('iframe'));let exportedSnapshot;for(let i=0;i<100;i++){exportedSnapshot=await offline.locator('body').evaluate(()=>DSHUI.snapshot);if(JSON.stringify(exportedSnapshot.state)===JSON.stringify(live.state))break;await exported.waitForTimeout(100)}
  assert.deepEqual(exportedSnapshot.state,live.state);assert.deepEqual(exportedSnapshot.derived,live.derived);assert.deepEqual(network,[]);const entry={nodeId:node.id,path,state:exportedSnapshot.state,derived:exportedSnapshot.derived};
  const slider=offline.locator('input[type=range]').first();if(await slider.count()){
   const current=Number(await slider.inputValue()),min=Number(await slider.getAttribute('min')??0),max=Number(await slider.getAttribute('max')??100),step=Number(await slider.getAttribute('step')??1),next=current+step<=max?current+step:Math.max(min,current-step);await slider.fill(String(next));
   for(let i=0;i<100;i++){exportedSnapshot=await offline.locator('body').evaluate(()=>DSHUI.snapshot);if(JSON.stringify(exportedSnapshot.state)!==JSON.stringify(live.state))break;await exported.waitForTimeout(100)}assert.notDeepEqual(exportedSnapshot.state,live.state);const fullState={...state,...exportedSnapshot.state};assert.deepEqual(exportedSnapshot.derived,canvasSnapshot(node,fullState,record.document.data,evaluate(record.document,fullState).derived,false,{}).derived);entry.afterInteraction={state:exportedSnapshot.state,derived:exportedSnapshot.derived};
  }
  await exported.screenshot({path:base+'/export-'+node.id+'-1920.png'});report.exports.push(entry);await exported.close();
 }
 report.checks.push('model-authored canvas exports current state/derived and recalculates offline without external requests');assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.message;throw e}finally{await writeFile(base+'/export-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close()}
