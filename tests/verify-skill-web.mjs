import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { zstdDecompressSync } from 'node:zlib';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
import { BUILD_INFO } from '../lib/build-info.js';
import { UI_SKILL_SECTIONS } from '../lib/ui-skill.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.DSH_PLAYWRIGHT??'playwright');
const url=(await readFile(process.env.DSH_WEB_LOG,'utf8')).match(/http:\/\/127\.0\.0\.1:3080\/\S*/)?.[0];assert.ok(url);
const title='注入技能验收 · 雷达扫描',sessionTitle='请做一个可调速度、可暂停的';
const browser=await chromium.launch({headless:true,channel:'msedge'}),errors=[],checks=[];
try {
 const page=await browser.newPage({viewport:{width:1365,height:1200}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.waitForLoadState('networkidle');
 if(process.env.DSH_SKILL_RESUME)await page.getByText(sessionTitle,{exact:true}).first().click();
 else {
  // This is a fresh verification conversation; select reasoning for this session only.
  await page.getByRole('button',{name:/选择模型，当前/}).click();await page.getByRole('menuitem',{name:/推理等级/}).click();await page.getByRole('menuitemradio',{name:'Medium',exact:true}).click();await page.getByRole('button',{name:/推理等级 Medium/}).waitFor();
  const edit=page.locator('[contenteditable=true]').first();await edit.click();await page.keyboard.insertText('请做一个可调速度、可暂停的 SVG 雷达扫描示意，配标准滑块和开关。标题必须为“'+title+'”。标明数学动画示意，不是真实雷达探测。按你已获得的智能 UI 设计技能创作，兼顾手机文字大小和主题。不要调用 ui_catalog，也不要使用其他工具，只直接调用 render_ui。成功后简短回复。');await page.keyboard.type(' ');await page.getByRole('button',{name:'发送消息',exact:true}).click();console.log('Submitted fresh original radar request without catalog discovery.');
 }
 const ui=page.locator('[data-dsh-generative-ui]:not([data-preview=true])[aria-label="'+title+'"]');await ui.waitFor({timeout:240000});await ui.locator('[data-canvas-phase=ready]').waitFor({timeout:30000});assert.equal(await ui.getAttribute('data-dgui-build'),BUILD_INFO.id);
 const documentId=await ui.getAttribute('data-dsh-generative-ui'),record=JSON.parse(await readFile(join(dshHomePath('plugins','dsh-generative-ui'),documentId+'.json'),'utf8'));
 const flat=list=>list.flatMap(n=>[n,...flat(n.children??[])]),nodes=flat(record.document.nodes),canvas=nodes.find(n=>n.type==='sandbox');assert.ok(canvas);assert.match(canvas.script,/DSHUI\.animate\s*\(/);
 const sliderNode=nodes.find(n=>n.type==='slider'),toggleNode=nodes.find(n=>n.type==='toggle');assert.ok(sliderNode&&toggleNode);
 const slider=ui.locator('[data-ui-node="'+sliderNode.id+'"] input[type=range]'),toggle=ui.getByRole('checkbox'),frame=ui.frameLocator('iframe'),svg=frame.locator('svg').first();await svg.waitFor();await toggle.check();await page.mouse.move(1200,10);await page.emulateMedia({reducedMotion:'no-preference'});const before=await svg.screenshot();await page.waitForTimeout(150);assert.ok(!before.equals(await svg.screenshot()));await toggle.uncheck();await page.waitForTimeout(80);const frozen=await svg.screenshot();await page.waitForTimeout(150);assert.ok(frozen.equals(await svg.screenshot()));
 const spec=record.document.state[sliderNode.bind.slice(6)],value=spec.default===spec.min?spec.min+spec.step:spec.min;await slider.fill(String(value));await ui.getByText('参数已保存',{exact:true}).waitFor();
 checks.push('original radar generated directly without ui_catalog; shared native controls, DSHUI.animate and pause work');
 for(const [theme,width,label]of[['light',1365,'desktop'],['dark',1365,'dark'],['dark',768,'tablet'],['dark',390,'mobile']]){await page.evaluate(t=>t==='dark'?document.body.setAttribute('data-ds-dark-theme',''):document.body.removeAttribute('data-ds-dark-theme'),theme);await page.setViewportSize({width,height:1200});const box=await ui.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);assert.ok(await frame.locator('html').evaluate(el=>el.scrollWidth<=innerWidth));await ui.screenshot({path:'test-output/skill-radar-'+label+'.png'});}
 await page.reload();await ui.getByText('已恢复保存的参数',{exact:true}).waitFor();await ui.locator('[data-canvas-phase=ready]').waitFor();assert.equal(await slider.inputValue(),String(value));assert.equal(await toggle.isChecked(),false);
 // Inspect only this session's durable model request, never emit unrelated system content.
 const roots=await readdir(dshHomePath('sessions'),{withFileTypes:true});let sessionFile;
 for(const root of roots)if(root.isDirectory()){const path=join(dshHomePath('sessions'),root.name,record.sessionId,'session.v4.jsonl.zstd');try{await readFile(path);sessionFile=path;break}catch{}}
 assert.ok(sessionFile,'durable session exists');let compressed=await readFile(sessionFile),rows=[];
 while(compressed.length){const {buffer,engine}=zstdDecompressSync(compressed,{info:true});assert.ok(engine.bytesWritten>0);rows.push(...buffer.toString().trim().split('\n').filter(Boolean).map(s=>JSON.parse(s)));compressed=compressed.subarray(engine.bytesWritten);}
 const systemText=rows.filter(r=>r.type==='system/message').map(r=>{const c=r.data.message.content;return typeof c==='string'?c:c.map(b=>b.text??'').join('\n')}).at(-1)??'';
 const injection=UI_SKILL_SECTIONS.map(s=>({name:s.name,characters:s.text.length,present:systemText.includes(s.text)}));assert.ok(injection.every(s=>s.present),'all exact skill sections reach model-visible system message');
 const calls=rows.filter(r=>r.type==='tool/call').map(r=>r.data.name);assert.ok(calls.includes('render_ui'));assert.equal(calls.includes('ui_catalog'),false);
 checks.push('durable model-visible system message contains exact design skill, shared protocol and both examples; no catalog call');checks.push('light/dark/390/768/desktop bounds and refresh restore pass');assert.deepEqual(errors,[]);
 await writeFile('test-output/skill-injection-verification.json',JSON.stringify({build:BUILD_INFO,documentId,sessionId:record.sessionId,injection,calls,checks,errors},null,2));console.log(JSON.stringify({build:BUILD_INFO.id,documentId,injection,checks,errors}));
}finally{await browser.close()}
