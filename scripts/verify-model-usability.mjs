import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,readdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {zstdDecompressSync} from 'node:zlib';
import {dshHomePath} from '@deepseek-ai/dsh-home-paths';
import {BUILD_INFO} from '../lib/build-info.js';

// Explicit opt-in live evaluation: consumes the selected configured model.
// Browser element checks are bounded; model completion is deliberately unbounded.
const model=process.env.MOTION_MODEL??'MiniMax-M3.1-Flash-Preview';
const workspace=process.env.MOTION_WORKSPACE??'测试结果';
const cwd=process.env.MOTION_WORKSPACE_DIR??'J:\\测试结果';
const output=process.env.MOTION_MODEL_OUTPUT??'test-output/usability-model';
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
 for(const {name}of files){const r=JSON.parse(await readFile(join(dir,name),'utf8')),v=r.record?.rows?.modelSelection?.val,m=v?.pending??v?.lastUsed;if(r.record?.identity?.cwd===cwd&&m?.model===model){sessionId=name.replace(/\.json$/,'');return}}
 throw Error('Test session not found in the dedicated workspace');
}
async function settings(){await page.goto(url);await page.getByRole('button',{name:'插件',exact:true}).click();await page.getByRole('button',{name:'查看 dsh-motion-ui',exact:true}).click();await page.getByRole('combobox',{name:'设计模式'}).waitFor();}
async function newSession(){
 sessionId=undefined;const since=Date.now();await page.goto(url);await page.getByText(workspace,{exact:true}).first().click();await page.getByRole('button',{name:'在“'+workspace+'”中新建会话',exact:true}).click();await page.getByRole('button',{name:/选择模型，当前/}).click();await page.getByRole('menuitem',{name:/模型/}).click();await page.getByRole('menuitemradio',{name:model,exact:true}).click();return since;
}
const flatten=nodes=>nodes.flatMap(n=>[n,...flatten(n.children??[])]);
function records(rows){const found=new Map();for(const e of rows){const r=e.data?.meta?.dshGenerativeUi??e.data?.meta?.dshGenerativeUiPatch;if(r&&(!found.has(r.documentId)||(found.get(r.documentId).documentRevision??0)<=(r.documentRevision??0)))found.set(r.documentId,r)}return[...found.values()];}
async function run(name,prompt,{fresh=true,verify}={}){
 const since=fresh?await newSession():Date.now(),before=(await events()).length,result={name,prompt,passed:false};let firstVisibleMs=null,watch,watching=false;
 try{
  const edit=page.locator('[contenteditable=true]').first();await edit.click();await page.keyboard.insertText(prompt);await page.keyboard.type(' ');const sent=Date.now();await page.getByRole('button',{name:'发送消息',exact:true}).click();await page.getByRole('button',{name:'停止生成',exact:true}).waitFor();
  if(fresh)watch=setInterval(async()=>{if(watching||firstVisibleMs!==null)return;watching=true;try{if(await page.locator('[data-dsh-generative-ui]').count())firstVisibleMs=Date.now()-sent}catch{}finally{watching=false}},500);
  // Deliberately no timeout/cancel/max_tokens/reasoning override on inference.
  await page.getByRole('button',{name:'发送消息',exact:true}).waitFor({timeout:0});clearInterval(watch);await page.waitForTimeout(800);await discover(since);const all=await events(),delta=all.slice(before),uiRecords=records(all);
  result.sessionId=sessionId;result.elapsedMs=Date.now()-sent;result.firstVisibleMs=firstVisibleMs;result.toolCalls=delta.filter(e=>e.type==='tool/call').map(e=>e.data.name);result.toolErrors=delta.filter(e=>e.type==='tool/result'&&e.data.message?.isError).map(e=>e.data.message.content.map(x=>x.text??'').join('\n'));result.renderAttempts=result.toolCalls.filter(n=>/^render_/.test(n)).length;result.documentIds=uiRecords.map(r=>r.documentId);result.documents=uiRecords.map(r=>({documentId:r.documentId,revision:r.documentRevision??0,title:r.document.title}));result.visibleUiCount=await page.locator('[data-dsh-generative-ui]:not([data-preview])').count();
  const currentHeaders=delta.filter(e=>e.type==='request/header');const headers=(currentHeaders.length?currentHeaders:all.filter(e=>e.type==='request/header').slice(-1)).map(e=>e.data.header.config);result.requestConfig=headers.map(h=>({model:h.model,reasoningEffort:h.reasoningEffort,maxTokens:h.maxTokens}));assert.ok(headers.length&&headers.every(h=>h.model===model),'Actual request model must match selection');
  result.text=delta.filter(e=>e.type==='assistant/message').flatMap(e=>e.data.message.content.filter(c=>c.type==='text').map(c=>c.text)).join('\n');
  await verify?.(result,uiRecords,all);result.passed=true;
 }catch(e){result.failure=String(e.message).replace(/https?:\/\/\S+/g,'[URL]').slice(0,1000)}finally{clearInterval(watch);await page.screenshot({path:join(output,name+'.png'),fullPage:true}).catch(()=>{});report.cases.push(result);await persist();console.log(JSON.stringify({name,passed:result.passed,elapsedMs:result.elapsedMs,firstVisibleMs:result.firstVisibleMs,tools:result.toolCalls,toolErrors:result.toolErrors,failure:result.failure}));}
 return result;
}
let budgetId,peopleNode,peopleKey,preEditCount,preEditRevision;
try{
 await settings();originalMode=await page.getByRole('combobox',{name:'设计模式'}).inputValue();originalStyle=await page.getByRole('radiogroup',{name:'视觉风格'}).getByRole('radio',{checked:true}).getAttribute('data-style');report.originalSettings={mode:originalMode,style:originalStyle};
 if(originalMode!=='guided'){await page.getByRole('combobox',{name:'设计模式'}).selectOption('guided');await page.getByText('模式已保存；从下一次请求开始生效。',{exact:true}).waitFor()}
 await run('plain-fact','1 GiB 等于多少字节？只给一句纯文字，不要界面，不要联网。',{verify:async r=>{assert.equal(r.documentIds.length,0);assert.equal(r.visibleUiCount,0);assert.ok(!r.toolCalls.some(n=>/^render_/.test(n)));assert.match(r.text,/1[,，\s]?073[,，\s]?741[,，\s]?824/);}});
 await run('proactive-flow','我准备第一次把自己的小项目发布到 GitHub。代码已经写好，从整理文件到发布第一个版本，抓住最重要的五步让我一眼看懂先后顺序，每步只解释一句。不要联网或创建文件。',{verify:async(r,docs)=>{assert.equal(docs.length,1,'One requested flow must not become two replacement documents');assert.equal(r.visibleUiCount,1);assert.ok(r.toolCalls.some(n=>/^render_/.test(n)));assert.ok(docs.some(d=>flatten(d.document.nodes).some(n=>n.type==='steps'&&n.items.length===5)));}});
 const multiple=await run('multiple-and-budget','用两个独立的 Motion UI 展示内容。第一块是简短方案对比：轻便方案偏向便携，性能方案偏向性能，不虚构跑分或价格。第二块是可调整的假设旅行预算：3 人、入住3晚、每房每晚600元、每人交通800元，两位成人合住一间房，房间数向上取整。人数变化后总计和各项费用同步变化，注明只含住宿和交通。保持紧凑，不联网、不创建文件。',{verify:async(r,docs)=>{
  assert.equal(docs.length,2,'Exactly two independent documents requested');assert.equal(r.visibleUiCount,2);const budget=docs.find(d=>flatten(d.document.nodes).some(n=>typeof n.label==='string'&&n.label.includes('人数')&&n.bind));assert.ok(budget,'A native editable people control must exist');budgetId=budget.documentId;peopleNode=flatten(budget.document.nodes).find(n=>n.label?.includes('人数')&&n.bind);peopleKey=peopleNode.bind.slice(6);const ui=page.locator('[data-dsh-generative-ui="'+budgetId+'"]:not([data-preview])');assert.equal(await ui.count(),1);await ui.locator('[data-ui-node="'+peopleNode.id+'"] input').first().fill('5');await ui.getByText(/9,400(?:\.00)?/).first().waitFor();await page.waitForTimeout(650);preEditCount=docs.length;preEditRevision=budget.documentRevision??0;r.interaction={people:5,total:9400,roomCount:3};
 }});
 if(multiple.passed)await run('targeted-followup','保留刚才的两块界面和我当前调整的所有参数。只把预算界面中「总计」的标签改为「本次预算」，并设为成功色。请修改原界面，不要新增界面；说明一句即可。',{fresh:false,verify:async(r,docs)=>{assert.equal(docs.length,preEditCount);assert.equal(r.visibleUiCount,preEditCount);assert.ok(r.toolCalls.includes('inspect_ui'));assert.ok(r.toolCalls.some(n=>n==='patch_ui'||n==='update_ui'));assert.ok(!r.toolCalls.some(n=>/^render_/.test(n)));const updated=docs.find(d=>d.documentId===budgetId);assert.ok(updated&&updated.documentRevision>preEditRevision);const node=flatten(updated.document.nodes).find(n=>n.label==='本次预算');assert.equal(node?.tone,'success');const ui=page.locator('[data-dsh-generative-ui="'+budgetId+'"]:not([data-preview])');await ui.getByText('本次预算',{exact:true}).waitFor();assert.equal(await ui.locator('[data-ui-node="'+peopleNode.id+'"] input').first().inputValue(),'5');await ui.getByText(/9,400(?:\.00)?/).first().waitFor();await page.reload();await ui.getByText('本次预算',{exact:true}).waitFor();assert.equal(await ui.locator('[data-ui-node="'+peopleNode.id+'"] input').first().inputValue(),'5');r.parametersRetained=true;r.reloadRetained=true;}});
 else report.cases.push({name:'targeted-followup',passed:false,skipped:true,failure:'Multiple UI case did not produce a passing native budget; no inference cancellation.'});
 report.passed=report.cases.length===4&&report.cases.every(c=>c.passed)&&report.pageErrors.length===0;
}finally{
 try{if(originalMode){await settings();if(await page.getByRole('combobox',{name:'设计模式'}).inputValue()!==originalMode){await page.getByRole('combobox',{name:'设计模式'}).selectOption(originalMode);await page.getByText('模式已保存；从下一次请求开始生效。',{exact:true}).waitFor()}report.settingsRestored=(await page.getByRole('combobox',{name:'设计模式'}).inputValue()===originalMode)&&(await page.getByRole('radiogroup',{name:'视觉风格'}).getByRole('radio',{checked:true}).getAttribute('data-style')===originalStyle);}}finally{report.finishedAt=new Date().toISOString();await persist();await browser.close()}
}
console.log(JSON.stringify({passed:report.passed,output,settingsRestored:report.settingsRestored}));if(!report.passed)process.exitCode=1;
