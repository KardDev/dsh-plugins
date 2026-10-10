import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
import { BUILD_INFO } from '../lib/build-info.js';
const require = createRequire(import.meta.url), { chromium } = require(process.env.DSH_PLAYWRIGHT ?? 'playwright');
const url = (await readFile(process.env.DSH_WEB_LOG, 'utf8')).match(/http:\/\/127\.0\.0\.1:3080\/\S*/)?.[0]; assert.ok(url);
const title = '发布候选验收 · 交互单摆', checks = [], errors = [];
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 1300 } }); page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type()==='error' && m.text().includes('subscriber failed')) errors.push(m.text()); });
  await page.goto(url); await page.waitForLoadState('networkidle');
  if(process.env.DSH_CREATIVE_RESUME) await page.getByText(process.env.DSH_CREATIVE_SESSION_TITLE,{exact:true}).first().click();
  else {
    const edit=page.locator('[contenteditable=true]').first();await edit.click();
    await page.keyboard.insertText('发布候选版原创生成验收。仅使用 ui_catalog 与 render_ui，不使用其他工具。先调用 ui_catalog({topic:"canvas"}) 阅读最新设计和动画接口，再从文字要求自行设计教学单摆，不复制示例源码。document.title 必须为“'+title+'”。创作一个主体突出的 SVG 单摆，主 SVG 的 id 为 pendulumStage；标注“周期运动数学示意，非真实物理仿真”。重要参数 document.state.amplitude:number default20 min5 max45 step5（度）；frequency:number default1 min0.5 max2 step0.5（Hz）；running:boolean defaultfalse。外部按振幅、频率顺序放两个标准 slider 和一个 toggle。sandbox 用 DSHUI.subscribe 读取参数，用 DSHUI.animate 管理动画（使用 delta 秒积分；不要额外起 requestAnimationFrame）；遵循 reducedMotion/visible，暂停时保持当前角度。参数和当前说明同步，主题适配、手机可读、标签与文字回退完整。不使用远程资源或工具动作。界面可有你自己的布局与配色处理，优先清楚、美观、留白适当。成功后简短回复。');
    await page.keyboard.type(' ');await page.getByRole('button',{name:'发送消息',exact:true}).click();console.log('Submitted original pendulum with targeted design catalog and animation lifecycle API');
  }
  const ui=page.locator('[data-dsh-generative-ui]:not([data-preview=true])[aria-label="'+title+'"]');await ui.waitFor({timeout:240000});await ui.locator('[data-canvas-phase=ready]').waitFor({timeout:30000});
  assert.equal(await ui.getAttribute('data-dgui-build'),BUILD_INFO.id);
  const documentId=await ui.getAttribute('data-dsh-generative-ui'),record=JSON.parse(await readFile(join(dshHomePath('plugins','dsh-generative-ui'),documentId+'.json'),'utf8'));
  const flat=list=>list.flatMap(n=>[n,...flat(n.children??[])]),nodes=flat(record.document.nodes),canvas=nodes.find(n=>n.type==='sandbox');assert.match(canvas.script,/DSHUI\.animate\s*\(/);assert.doesNotMatch(canvas.script,/requestAnimationFrame\s*\(/);
  const slider=key=>ui.locator('[data-ui-node="'+nodes.find(n=>n.bind==='state.'+key).id+'"] input[type=range]');
  const frame=ui.frameLocator('iframe'),stage=frame.locator('#pendulumStage');await stage.waitFor();
  if(process.env.DSH_CREATIVE_RESUME){await slider('amplitude').fill('25');await ui.getByRole('checkbox').uncheck();await ui.getByText('参数已保存',{exact:true}).waitFor();}
  await slider('amplitude').fill('30');await slider('frequency').fill('1.5');await ui.getByRole('checkbox').check();await ui.getByText('参数已保存',{exact:true}).waitFor();
  await page.mouse.move(1200,10);const before=await stage.screenshot();await page.waitForTimeout(150);const after=await stage.screenshot();assert.ok(!before.equals(after),'authored SVG moves');
  checks.push('current configured model authors an original canvas using DSHUI.animate and the installed build');
  await ui.getByRole('checkbox').uncheck();await ui.getByText('参数已保存',{exact:true}).waitFor();const frozen=await stage.screenshot();await page.waitForTimeout(150);assert.ok(frozen.equals(await stage.screenshot()),'user pause freezes SVG');
  await ui.getByRole('checkbox').check();await ui.getByText('参数已保存',{exact:true}).waitFor();await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(150);const reduced=await stage.screenshot();await page.waitForTimeout(150);assert.ok(reduced.equals(await stage.screenshot()),'reduced motion is static');
  checks.push('native sliders share parameters; pause and reduced motion stop visual movement');
  for(const [theme,width,label]of[['light',1365,'desktop'],['dark',1365,'dark'],['dark',768,'tablet'],['dark',390,'mobile']]){
    await page.evaluate(t=>t==='dark'?document.body.setAttribute('data-ds-dark-theme',''):document.body.removeAttribute('data-ds-dark-theme'),theme);await page.setViewportSize({width,height:1300});const box=await ui.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);assert.ok(await frame.locator('html').evaluate(el=>el.scrollWidth<=innerWidth));await ui.screenshot({path:'test-output/release-creative-'+label+'.png'});
  }
  assert.equal(await ui.locator('.dgui-canvas-issue').count(),0);
  await page.reload();await ui.getByText('已恢复保存的参数',{exact:true}).waitFor();await ui.locator('[data-canvas-phase=ready]').waitFor();assert.equal(await slider('amplitude').inputValue(),'30');assert.equal(await slider('frequency').inputValue(),'1.5');assert.ok(await ui.getByRole('checkbox').isChecked());
  checks.push('light/dark/390/768/desktop and refresh replay preserve parameters');assert.deepEqual(errors,[]);
  await writeFile('test-output/release-creative-document.json',JSON.stringify(record.document,null,2));await writeFile('test-output/release-creative-verification.json',JSON.stringify({build:BUILD_INFO,documentId,checks,errors},null,2));console.log(JSON.stringify({build:BUILD_INFO.id,documentId,checks,errors}));
}finally{await browser.close()}
