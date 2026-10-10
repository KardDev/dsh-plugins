import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { BUILD_INFO } from '../lib/build-info.js';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
const require=createRequire(import.meta.url),{chromium}=require(process.env.DSH_PLAYWRIGHT??'playwright');
const url=(await readFile('J:/Workspace/output/dsh-ui-web.stdout.log','utf8')).match(/http:\/\/127\.0\.0\.1:3080\/\S*/)?.[0];assert.ok(url);
const browser=await chromium.launch({headless:true,channel:'msedge'}),checks=[],errors=[];
try{
 for(const slug of ['mimo-v2-5','ling-3-1-flash','step-5-preview-free']){
  const page=await browser.newPage({viewport:{width:1365,height:1200}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForLoadState('networkidle');
  const result=JSON.parse(await readFile('test-output/model-matrix/'+slug+'/results.json','utf8'));
  assert.equal(result.cwd,'J:\\测试结果');assert.equal(result.modelIdentityVerified,true);
  const row=page.locator('[data-row-key="session:'+result.sessionId+'"]');
  for(const group of ['测试结果','未分组']){
   if(await row.isVisible())break;
   const header=page.getByRole('treeitem').filter({has:page.getByText(group,{exact:true})}).first();if(await header.isVisible()&&await header.getAttribute('aria-expanded')!=='true'){await header.click();await page.waitForTimeout(300)}
   for(let i=0;i<8&&!await row.isVisible();i++){let expanded=false;for(const more of await page.getByText(/^展开其余 \d+ 个会话$/).all())if(await more.isVisible()){await more.click();expanded=true}if(!expanded)break}
  }
  await row.click();
  for(const c of result.cases.filter(c=>c.passed&&['calculator','creative'].includes(c.name))){
   const ui=page.locator('[data-dsh-generative-ui="'+c.documentId+'"]:not([data-preview=true])');await ui.waitFor();
   assert.equal(await ui.getAttribute('data-dgui-build'),BUILD_INFO.id);
   await ui.getByText('已恢复保存的参数',{exact:true}).waitFor();
   if(c.name==='calculator'){await ui.getByText('25.15 GiB',{exact:true}).waitFor();}
   else{assert.equal(await ui.getByRole('slider').inputValue(),'2');assert.equal(await ui.getByRole('checkbox').isChecked(),false);await ui.locator('[data-canvas-phase=ready]').waitFor();if(result.cases.find(c=>c.name==='refinement')?.passed){await ui.getByText('已修订：数学动画示意，非真实物理仿真。',{exact:true}).waitFor();const record=JSON.parse(await readFile(dshHomePath('plugins','dsh-generative-ui',c.documentId+'.json'),'utf8'));assert.equal(await ui.getAttribute('data-document-revision'),String(record.documentRevision));}}
   assert.ok(await ui.locator('.dgui-status').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=12));
   if(c.name==='creative'){await page.setViewportSize({width:390,height:1200});await page.evaluate(()=>document.body.setAttribute('data-ds-dark-theme',''));await page.waitForTimeout(1200);await ui.screenshot({path:'test-output/model-matrix/'+slug+'/installed-mobile.png'});await page.setViewportSize({width:1365,height:1200});}
   checks.push({model:result.model,case:c.name,documentId:c.documentId,build:BUILD_INFO.id});
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);await writeFile('test-output/model-matrix/installed-replay.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close()}
