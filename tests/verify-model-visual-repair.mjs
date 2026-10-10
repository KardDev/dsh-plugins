import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
const require=createRequire(import.meta.url),{chromium}=require(process.env.DSH_PLAYWRIGHT??'playwright');
const root='test-output/model-matrix/mimo-v2-5',matrix=JSON.parse(await readFile(root+'/results.json','utf8'));
assert.equal(matrix.cwd,'J:\\测试结果');assert.equal(matrix.modelIdentityVerified,true);
const id=matrix.cases.find(c=>c.name==='creative').documentId,recordPath=dshHomePath('plugins','dsh-generative-ui',id+'.json');
const record=JSON.parse(await readFile(recordPath,'utf8'));assert.equal(record.sessionId,matrix.sessionId);
const flat=list=>list.flatMap(n=>[n,...flat(n.children??[])]),canvas=flat(record.document.nodes).find(n=>n.type==='sandbox');
const url=(await readFile('J:/Workspace/output/dsh-ui-web.stdout.log','utf8')).match(/http:\/\/127\.0\.0\.1:3080\/\S*/)?.[0];assert.ok(url);
const browser=await chromium.launch({headless:true,channel:'msedge'}),report={model:matrix.model,sessionId:matrix.sessionId,cwd:matrix.cwd,documentId:id,beforeRevision:record.documentRevision,passed:false,errors:[]},start=Date.now();
try{
 const page=await browser.newPage({viewport:{width:1365,height:1200}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(url);await page.waitForLoadState('networkidle');if(!await page.getByText(matrix.sessionTitle,{exact:true}).first().isVisible())await page.getByText('测试结果',{exact:true}).first().click();await page.getByText(matrix.sessionTitle,{exact:true}).first().click();
 assert.match(await page.getByRole('button',{name:/选择模型，当前/}).getAttribute('aria-label'),/MiMo V2.5/);
 const ui=page.locator('[data-dsh-generative-ui="'+id+'"]:not([data-preview=true])');await ui.locator('[data-canvas-phase=ready]').waitFor();await ui.getByText('已恢复保存的参数',{exact:true}).waitFor();
 await page.setViewportSize({width:390,height:1200});await page.evaluate(()=>document.body.setAttribute('data-ds-dark-theme',''));await page.waitForTimeout(1200);
 const auditPath=dshHomePath('plugins','dsh-generative-ui',id+'-audit-mobile-dark.json'),before=JSON.parse(await readFile(auditPath,'utf8'));assert.equal(before.documentRevision,record.documentRevision);assert.ok(before.issues.some(i=>i.nodeId===canvas.id&&i.code==='smallText'));report.before=before;
 const edit=page.locator('[contenteditable=true]').first();await edit.click();await page.keyboard.insertText('继续当前轨道界面的显示优化。当前客户端为390px手机宽度，显示检查发现画布标签实际不足12px。请先inspect_ui读取最新文档、参数和报告，再patch_ui修正画布的字号/响应式排版，让所有SVG文字实际显示至少12px。保留画布动画功能、标准控件、state定义、speed=2、running=false和explanation节点说明；不要重新render_ui。只改已有画布的html/css/script中必要属性，修复后简短回复，不要声称未经观察的视觉检查已通过。');await page.keyboard.type(' ');await page.getByRole('button',{name:'发送消息',exact:true}).click();await page.getByRole('button',{name:'停止生成',exact:true}).waitFor({timeout:10000});await page.getByRole('button',{name:'发送消息',exact:true}).waitFor({timeout:240000});
 await page.waitForFunction(({id,rev})=>Number(document.querySelector('[data-dsh-generative-ui="'+id+'"]:not([data-preview=true])')?.dataset.documentRevision)>rev,{id,rev:record.documentRevision});await ui.locator('[data-canvas-phase=ready]').waitFor();await page.waitForTimeout(1200);
 const afterRecord=JSON.parse(await readFile(recordPath,'utf8')),after=JSON.parse(await readFile(auditPath,'utf8'));report.after=after;report.afterRevision=afterRecord.documentRevision;
 assert.equal(after.documentRevision,afterRecord.documentRevision);assert.ok(!after.issues.some(i=>i.nodeId===canvas.id&&i.code==='smallText'),'canvas small labels must be fixed');assert.equal(await ui.getByRole('slider').inputValue(),'2');assert.equal(await ui.getByRole('checkbox').isChecked(),false);assert.deepEqual(afterRecord.document.state,record.document.state);
 await ui.getByRole('checkbox').check();await ui.getByText('参数已保存',{exact:true}).waitFor();await page.mouse.move(0,0);const svg=ui.frameLocator('iframe').locator('svg').first(),shot=await svg.screenshot();await page.waitForTimeout(160);assert.ok(!shot.equals(await svg.screenshot()),'repaired animation must still move');await ui.getByRole('checkbox').uncheck();await ui.getByText('参数已保存',{exact:true}).waitFor();
 await ui.screenshot({path:root+'/visual-repair-mobile.png'});await page.reload();await ui.getByText('已恢复保存的参数',{exact:true}).waitFor();assert.equal(await ui.getByRole('slider').inputValue(),'2');assert.equal(await ui.getAttribute('data-document-revision'),String(afterRecord.documentRevision));report.passed=true;
}catch(e){report.failure=e.message;}finally{report.elapsedMs=Date.now()-start;await writeFile(root+'/visual-repair.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close()}

