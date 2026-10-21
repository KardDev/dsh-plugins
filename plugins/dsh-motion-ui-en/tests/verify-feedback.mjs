// Click the installed UI, intercepting its submission before it reaches the model.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.DSH_PLAYWRIGHT ?? 'playwright');
const url=(await readFile(process.env.DSH_WEB_LOG,'utf8')).match(/http:\/\/127\.0\.0\.1:3080\/\S*/)?.[0];
assert.ok(url,'Web ready URL');
const browser=await chromium.launch({headless:true,channel:'msedge'});
try {
  const page=await browser.newPage({viewport:{width:1365,height:900}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url); await page.waitForLoadState('networkidle');
  await page.getByText('理论权重体积计算器UI验收',{exact:true}).first().click();
  const first=page.locator('[data-dsh-generative-ui]').first();
  await first.getByText('已恢复保存的参数',{exact:true}).waitFor();
  assert.equal(await first.getByRole('slider').inputValue(),'8');
  const stateless=page.locator('[data-dsh-generative-ui]').nth(1);
  await stateless.getByText('原始文字说明',{exact:true}).click();
  assert.equal(await stateless.locator('.dgui-fallback pre').count(),0);
  assert.doesNotMatch(await stateless.locator('.dgui-fallback').innerText(),/\{\}|初始参数/);
  let payload;
  const captured=new Promise(resolve=>{payload=resolve;});
  await page.route('**/api/**',async route=>{
    const request=route.request(); const body=request.postData() ?? '';
    if(request.method()==='POST' && body.includes('UI 参数快照')) { payload(body); await route.abort('aborted'); }
    else await route.continue();
  });
  await first.getByRole('button',{name:'按当前参数继续分析',exact:true}).click();
  const body=await Promise.race([captured,new Promise((_,reject)=>setTimeout(()=>reject(new Error('No follow-up request')),10000))]);
  function find(value) {
    if(typeof value==='string' && value.includes('UI 参数快照：\n')) return value;
    if(value && typeof value==='object') for(const v of Object.values(value)) {const match=find(v); if(match)return match;}
  }
  const text=find(JSON.parse(body)); assert.ok(text);
  const snapshot=JSON.parse(text.split('UI 参数快照：\n')[1]);
  assert.equal(snapshot.state.bits,8);
  assert.equal(snapshot.derived.weightGiB,27e9*8/8589934592);
  assert.equal(snapshot.derived.weightGiB.toFixed(2),'25.15');
  assert.equal(snapshot.viewedSessionId,snapshot.sourceSessionId);
  assert.deepEqual(errors,[]);
  const result={version:'0.1.3',checks:['actual button submission includes current derived at full precision','derived matches visible rounded metric','state and session provenance retained','stateless explanation has no empty parameters'],modelRequestIntercepted:true,errors};
  await writeFile('test-output/feedback-verification.json',JSON.stringify(result,null,2)); console.log(JSON.stringify(result));
} finally {await browser.close();}
