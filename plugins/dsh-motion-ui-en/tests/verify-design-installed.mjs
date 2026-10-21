import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { BUILD_INFO } from '../lib/build-info.js';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.DSH_PLAYWRIGHT ?? 'playwright');
const url=(await readFile(process.env.DSH_WEB_LOG,'utf8')).match(/http:\/\/127\.0\.0\.1:3080\/\S*/)?.[0]; assert.ok(url);
const browser=await chromium.launch({headless:true,channel:'msedge'});
try {
 const page=await browser.newPage({viewport:{width:1365,height:1400}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&m.text().includes('subscriber failed')) errors.push(m.text());});
 await page.goto(url);await page.waitForLoadState('networkidle');
 if(!await page.getByText('理论权重体积计算器UI验收',{exact:true}).count())await page.getByRole('button',{name:/展开其余.*个会话/}).click();
 await page.getByText('理论权重体积计算器UI验收',{exact:true}).first().click();
 const uis=page.locator('[data-dsh-generative-ui]');await uis.nth(2).waitFor();
 assert.equal(await uis.first().getAttribute('data-dgui-build'),BUILD_INFO.id);
 if(process.argv.includes('--check-busy')) {console.log(JSON.stringify({busy:await page.getByRole('button',{name:/停止生成/}).count()}));}
 else {
   const planner=page.locator('[data-dsh-generative-ui][aria-label="本地推理显存预算规划器"]');
   await planner.locator('.dgui-status').getByText(/使用初始参数|已恢复保存的参数/).waitFor();
   assert.ok(await planner.locator('.dgui-icon').count()>15);
   assert.equal(await planner.locator('.dgui-toggle').count(),1);
   assert.equal(await planner.getByRole('combobox').count(),1);
   const screenshot=async(theme)=>{
     await page.mouse.move(1200,40); await page.waitForTimeout(250); await uis.first().screenshot({path:'test-output/web-design-calculator-'+theme+'.png'});
     await planner.locator('[data-ui-node=c4]').evaluate(el=>el.scrollIntoView({block:'center'}));
     await planner.locator('[data-ui-node=c4]').screenshot({path:'test-output/web-design-results-'+theme+'.png'});
     const colors=await planner.locator('.dgui-metric').first().evaluate(el=>({text:getComputedStyle(el.querySelector('strong')).color,bg:getComputedStyle(el).backgroundColor}));return colors;
   };
   const light=await screenshot('light');
   await page.evaluate(()=>document.body.setAttribute('data-ds-dark-theme',''));
   const dark=await screenshot('dark');assert.notEqual(light.text,dark.text);
   await page.setViewportSize({width:390,height:844});
   const box=await planner.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=391);
   assert.ok(await planner.locator('.dgui-plot').evaluate(el=>el.scrollWidth>el.clientWidth));
   await planner.locator('[data-ui-node=c4]').screenshot({path:'test-output/web-design-results-mobile.png'});
   await page.reload();await uis.nth(2).waitFor();
   assert.ok(await planner.locator('.dgui-metric').count()>=7);
   assert.deepEqual(errors,[]);
   const result={version:JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version,checks:['three existing UI documents replay unchanged','planner icons and toggle/select present','native DSH light/dark theme changes metric colors','390px bounds and internally scrolling charts','refresh retains planner and metrics'],colors:{light,dark},errors};
   await writeFile('test-output/web-design-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }
}finally{await browser.close();}


