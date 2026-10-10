import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {BUILD_INFO} from '../lib/build-info.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.DSH_PLAYWRIGHT??'playwright');
const url=(await readFile(process.env.DSH_WEB_LOG??'test-output/motion-release.stdout.log','utf8')).match(/http:\/\/127\.0\.0\.1:\d+\/\S*/)?.[0];assert.ok(url);
const result=JSON.parse(await readFile('test-output/natural-models/guided-deepseek-v4-1-flash-fast-proactive-resistor-openintelligent-20261010/results.json','utf8'));
const browser=await chromium.launch({headless:true,channel:'msedge'}),report={passed:false,build:BUILD_INFO.id,checks:[],errors:[]};
try{
 const p=await browser.newPage({viewport:{width:1920,height:1080},acceptDownloads:true});p.on('pageerror',e=>report.errors.push(e.message));await p.goto(url,{waitUntil:'networkidle'});
 const notice=p.getByRole('button',{name:'继续',exact:true});if(await notice.isVisible())await notice.click();
 await p.getByRole('button',{name:'插件',exact:true}).click();await p.getByRole('button',{name:'查看 dsh-motion-ui',exact:true}).click();
 const mode=p.getByRole('combobox',{name:'设计模式',exact:true});await mode.waitFor();await p.waitForFunction(()=>!document.getElementById('dgui-design-mode')?.disabled);
 const original=await mode.inputValue();await mode.selectOption(original==='guided'?'free':'guided');await p.getByText('模式已保存；从下一次请求开始生效。',{exact:true}).waitFor();await mode.selectOption(original);await p.getByText('模式已保存；从下一次请求开始生效。',{exact:true}).waitFor();
 await p.screenshot({path:'test-output/motion-release-settings.png'});report.checks.push('renamed plugin owns live saved configuration under Home Plugins');
 if(process.env.DSH_VERIFY_MISSING_MARKER==='1'){await p.getByRole('combobox',{name:'界面展示位置',exact:true}).selectOption('inline');await p.getByText('展示设置已保存；正文定位指导从下一次请求开始生效。',{exact:true}).waitFor()}
 // Return to conversation browser before replaying a previously generated UI.
 await p.goto(url,{waitUntil:'networkidle'});
 const row=p.locator('[data-row-key="session:'+result.sessionId+'"]');
 for(let i=0;i<10&&!await row.isVisible();i++){const group=p.getByText('测试结果',{exact:true}).first();if(await group.isVisible())await group.click();for(const more of await p.getByText(/^展开其余 \d+ 个会话$/).all())if(await more.isVisible())await more.click();await p.waitForTimeout(300)}await row.click();
 const ui=p.locator('[data-dsh-generative-ui="'+result.cases[0].documentId+'"]:not([data-preview=true])').last();await ui.getByText('已恢复保存的参数',{exact:true}).waitFor();assert.equal(await ui.getAttribute('data-dgui-build'),BUILD_INFO.id);
 assert.equal(await p.locator('[data-dsh-generative-ui="'+result.cases[0].documentId+'"]:not([data-preview=true])').count(),1);
 if(process.env.DSH_VERIFY_MISSING_MARKER==='1'){await p.getByText('未提供正文标记，界面显示在回答下方。',{exact:true}).waitFor();report.checks.push('native inline mode without model marker shows exactly one answer-area UI')}
 const slider=ui.getByRole('slider'),saved=await slider.inputValue();
 try{await slider.fill('6');await ui.getByText('参数已保存',{exact:true}).waitFor();await ui.locator('[data-ui-node=mP]').filter({hasText:'3.60'}).waitFor();await p.reload();await ui.getByText('已恢复保存的参数',{exact:true}).waitFor();assert.equal(await slider.inputValue(),'6');}finally{await slider.fill(saved);await ui.getByText('参数已保存',{exact:true}).waitFor()}
 report.checks.push('legacy model-generated UI replays with renamed client; calculations, persistence and reload pass');
 const surface=ui.locator('[data-ui-node=chart]');await surface.frameLocator('iframe').locator('#canvas').waitFor();await surface.locator('.dgui-canvas-options>summary').click();const download=p.waitForEvent('download');await surface.getByRole('button',{name:'导出独立 HTML'}).click();const file=resolve('test-output/motion-release-export.html');await(await download).saveAs(file);
 const offline=await browser.newPage();await offline.goto(pathToFileURL(file).href);await offline.getByText(/DSH Motion UI · 独立副本/).waitFor();await offline.frameLocator('iframe').locator('#canvas').waitFor();await offline.close();report.checks.push('actual standalone download carries Motion UI branding and activates offline');
 await p.screenshot({path:'test-output/motion-release-replay.png'});assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.message;throw e}finally{await writeFile(process.env.DSH_RELEASE_REPORT??'test-output/motion-release-smoke.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close()}
