import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dshHomePath} from '@deepseek-ai/dsh-home-paths';
const directory='test-output/natural-models/guided-deepseek-v4-1-flash-fast-proactive-circuits-web-capacity';
const result=JSON.parse(await readFile(directory+'/results.json','utf8'));
const record=JSON.parse(await readFile(dshHomePath('plugins','dsh-generative-ui',result.cases[0].documentId+'.json'),'utf8'));
assert.equal(record.sessionId,result.sessionId);
assert.equal(JSON.parse(await readFile(dshHomePath('storages','session_projcache','sessions',record.sessionId+'.json'),'utf8')).record.identity.cwd,'J:\\测试结果');
const require=createRequire(import.meta.url),{chromium}=require(process.env.DSH_PLAYWRIGHT??'playwright');
const url=(await readFile('J:/Workspace/output/dsh-ui-web.stdout.log','utf8')).match(/http:\/\/127\.0\.0\.1:3080\/\S*/)[0];
const browser=await chromium.launch({headless:true,channel:'msedge'}),samples=[];
try{
 const p=await browser.newPage({viewport:{width:1920,height:1080}});await p.goto(url);await p.waitForLoadState('networkidle');await p.locator(`[data-row-key="session:${record.sessionId}"]`).click();
 const ui=p.locator(`[data-dsh-generative-ui="${record.documentId}"]:not([data-preview=true])`);await ui.getByText('已恢复保存的参数',{exact:true}).waitFor();
 const selector=ui.getByRole('combobox'),r1=ui.getByRole('slider',{name:'电阻 R₁（Ω）',exact:true}),original={mode:await selector.inputValue(),R1:await r1.inputValue()};
 const frame=ui.locator('[data-ui-node=circuit]').frameLocator('iframe');
 async function sample(mode,resistance){const changed=await selector.locator('option:checked').innerText()!==mode||Number(await r1.inputValue())!==resistance;await selector.selectOption({label:mode});await r1.fill(String(resistance));if(changed)await ui.getByText('参数已保存',{exact:true}).waitFor();const note=await frame.locator('#note').innerText();const entry={mode,R1:resistance,note};samples.push(entry);return note;}
 try{
  assert.match(await sample('串联',6),/8\.67/);
  assert.match(await sample('串联',12),/6\.50/);
  assert.match(await sample('并联',6),/2\.17.*1\.08/);
  assert.match(await sample('并联',12),/1\.08.*1\.08/);
 }finally{const changed=await selector.inputValue()!==original.mode||await r1.inputValue()!==original.R1;await selector.selectOption(original.mode);await r1.fill(original.R1);if(changed)await ui.getByText('参数已保存',{exact:true}).waitFor();}
 const report={passed:true,samples,restored:original,noModelRequestsSubmitted:true};await writeFile(directory+'/semantics.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close()}
