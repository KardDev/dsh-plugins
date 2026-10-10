import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {curveExample} from '../lib/catalog.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.DSH_PLAYWRIGHT??'playwright');
const url=(await readFile(process.env.DSH_WEB_LOG,'utf8')).match(/http:\/\/127\.0\.0\.1:3080\/\S*/)?.[0];assert.ok(url,'Web ready');
const browser=await chromium.launch({headless:true,channel:'msedge'});let page;const errors=[],checks=[];
try{
 page=await browser.newPage({viewport:{width:1365,height:1500}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.waitForLoadState('networkidle');
 const edit=page.locator('[contenteditable=true]').first();await edit.click();
 await page.keyboard.insertText('这是 DSH Generative UI 0.3 动态曲线验收，只使用 ui_catalog 和 render_ui，不使用其他工具。先原生调用 ui_catalog，再直接原生调用 render_ui，参数是下方完整 document，不要改写。成功后只回复“动态曲线已生成”。\n'+JSON.stringify({document:curveExample}));await page.keyboard.type(' ');await page.getByRole('button',{name:'发送消息',exact:true}).click();console.log('Submitted native dynamic-curve task');
 const ui=page.locator('[data-dsh-generative-ui][aria-label="上下文与理论内存曲线"]');await ui.waitFor({timeout:180000});await ui.getByText('使用初始参数',{exact:true}).waitFor();
 await ui.getByText('14.86 GiB',{exact:true}).waitFor();checks.push('real model native render_ui creates mapped curve');
 const before=await ui.locator('.dgui-chart').innerText();await ui.getByRole('slider',{name:'最大上下文 K tokens',exact:true}).fill('64');
 await ui.getByText('16.36 GiB',{exact:true}).waitFor();assert.notEqual(await ui.locator('.dgui-chart').innerText(),before);
 await ui.getByText('参数已保存',{exact:true}).waitFor();assert.match(await ui.locator('table').last().innerText(),/64\s+16\.358/);checks.push('local curve/table/metric track updated context');
 await page.reload();await ui.getByText('已恢复保存的参数',{exact:true}).waitFor();assert.equal(await ui.getByRole('slider',{name:'最大上下文 K tokens',exact:true}).inputValue(),'64');await ui.getByText('16.36 GiB',{exact:true}).waitFor();checks.push('refresh restores generated curve from saved state');
 let resolve;const captured=new Promise(r=>resolve=r);await page.route('**/api/**',async route=>{const req=route.request(),body=req.postData()??'';if(req.method()==='POST'&&body.includes('UI 参数快照')){resolve(body);await route.abort('aborted');}else await route.continue();});
 await ui.getByRole('button',{name:'按当前曲线继续分析',exact:true}).click();const body=await captured;
 function find(v){if(typeof v==='string'&&v.includes('UI 参数快照：\n'))return v;if(v&&typeof v==='object')for(const value of Object.values(v)){const found=find(value);if(found)return found;}}
 const snapshot=JSON.parse(find(JSON.parse(body)).split('UI 参数快照：\n')[1]);assert.equal(snapshot.derived.curve.at(-1).contextK,64);assert.equal(snapshot.derived.curve.at(-1).totalGiB,snapshot.derived.totalGiB);checks.push('actual followup submission includes live generated rows (intercepted before model)');
 // Reload clears the deliberately aborted submission notice, retaining all saved values.
 await page.unroute('**/api/**');await page.reload();await ui.getByText('已恢复保存的参数',{exact:true}).waitFor();await page.mouse.move(1200,30);await ui.screenshot({path:'test-output/web-live-curve.png'});
 await page.setViewportSize({width:390,height:844});const box=await ui.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=391);checks.push('390px live UI stays in bounds');
 assert.deepEqual(errors,[]);const result={version:'0.3.0',checks,errors,documentId:await ui.getAttribute('data-dsh-generative-ui')};await writeFile('test-output/web-curve-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(e){if(page){await page.screenshot({path:'test-output/web-curve-failure.png',fullPage:true});console.log((await page.locator('body').innerText()).slice(-3000));}throw e;}finally{await browser.close();}
