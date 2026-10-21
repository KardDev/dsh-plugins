import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.DSH_PLAYWRIGHT??'playwright');
const profile=process.env.DSH_MODE_PROFILE??'free';
const log=profile==='web'?'J:/Workspace/output/dsh-ui-web.stdout.log':`test-output/preflight-${profile}.stdout.log`;
const url=(await readFile(log,'utf8')).match(/http:\/\/127\.0\.0\.1:\d+\/\S*/)[0];
const browser=await chromium.launch({headless:true,channel:'msedge'}),errors=[],checks=[];
try{
 const p=await browser.newPage({viewport:{width:1400,height:1100}});p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await p.waitForLoadState('networkidle');const notice=p.getByRole('button',{name:'继续',exact:true});if(await notice.isVisible())await notice.click();
 await p.getByRole('button',{name:'插件',exact:true}).click();await p.getByRole('button',{name:'查看 dsh-motion-ui',exact:true}).click();const toggle=p.getByRole('switch',{name:'启用 dsh-generative-ui',exact:true});
 if(await toggle.getAttribute('aria-checked')==='true'){await toggle.click();await p.waitForFunction(()=>document.querySelector('[role=switch][aria-label="启用 dsh-generative-ui"]')?.getAttribute('aria-checked')==='false');await p.waitForTimeout(500)}
 await toggle.click();await p.waitForFunction(()=>document.querySelector('[role=switch][aria-label="启用 dsh-generative-ui"]')?.getAttribute('aria-checked')==='true');await p.waitForTimeout(1000);await p.reload();await p.waitForLoadState('networkidle');
 await p.getByRole('button',{name:'插件',exact:true}).click();await p.getByRole('button',{name:'查看 dsh-motion-ui',exact:true}).click();const select=p.getByRole('combobox',{name:'设计模式',exact:true});await select.waitFor();await p.waitForFunction(()=>!document.getElementById('dgui-design-mode')?.disabled);const original=await select.inputValue();
 for(const mode of [original==='guided'?'free':'guided',original]){await select.selectOption(mode);await p.getByText('模式已保存；从下一次请求开始生效。',{exact:true}).waitFor();assert.equal(await select.inputValue(),mode);await p.waitForFunction(()=>!document.getElementById('dgui-design-mode')?.disabled)}
 await p.reload();await p.waitForLoadState('networkidle');await p.getByRole('button',{name:'插件',exact:true}).click();await p.getByRole('button',{name:'查看 dsh-motion-ui',exact:true}).click();await p.waitForFunction(()=>!document.getElementById('dgui-design-mode')?.disabled);assert.equal(await p.getByRole('combobox',{name:'设计模式',exact:true}).inputValue(),original);await p.getByRole('button',{name:'设置',exact:true}).click();assert.equal(await p.getByRole('dialog').getByText('智能 UI',{exact:true}).count(),0);await p.keyboard.press('Escape');
 checks.push('official plugin disable/enable remounts host and client','home plugin detail owns settings; no separate global settings entry','native settings switch guided/free and persist original mode after reload');assert.deepEqual(errors,[]);await p.screenshot({path:`test-output/mode-installed-${profile}.png`});await writeFile(`test-output/mode-installed-${profile}.json`,JSON.stringify({profile,original,checks,errors,passed:true},null,2));console.log(JSON.stringify({profile,original,checks,errors,passed:true}));
}finally{await browser.close()}
