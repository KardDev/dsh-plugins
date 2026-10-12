import { createServer } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { UiStore, stateRoute, documentRoute } from '../lib/store.js';
import { bicycleExample, oscillatorExample } from '../lib/canvas-example.js';
import { architectureExample, scatterExample } from '../lib/visual-examples.js';
import { SKILL_EXAMPLES } from '../lib/ui-skill.js';
const require = createRequire(import.meta.url), { chromium } = require(process.env.DSH_PLAYWRIGHT ?? 'playwright');
const directory = await mkdtemp(join(tmpdir(), 'dgui-canvas-')), store = new UiStore(directory), handler = stateRoute(store);
const bikeProbe = structuredClone(bicycleExample); bikeProbe.nodes[1].script += "\ntry{eval('1');document.body.dataset.evalBlocked='false'}catch{document.body.dataset.evalBlocked='true'}";
const failure = structuredClone(oscillatorExample); failure.nodes[0].script = "throw Error('intentional canvas failure')";
const records = await Promise.all([bikeProbe, oscillatorExample, failure, architectureExample, scatterExample, ...SKILL_EXAMPLES].map(document => store.create(document, { sessionId: 'canvas-test', callId: 'test' })));
const entry = `import './tests/diagnostic-fixture.js';import React from 'react';import{createRoot}from'react-dom/client';import{ValidatedView,StreamingPreview}from'./src/view.js';import{CSS}from'./src/styles.js';const records=${JSON.stringify(records)};const style=document.createElement('style');style.textContent=CSS;document.head.append(style);const root=createRoot(document.getElementById('app'));const params=new URLSearchParams(location.search);root.render(React.createElement(React.StrictMode,null,params.has('preview')?React.createElement(StreamingPreview,{raw:JSON.stringify({document:records[0].document}),sessionId:'canvas-test'}):React.createElement(ValidatedView,{raw:records[Number(params.get('view'))||0],sessionId:'canvas-test'})));`;
const bundle = (await build({ stdin: { contents: entry, resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife' })).outputFiles[0].text;
let stateRequests = 0, leakedRequests = 0;
const server = createServer(async (req, res) => {
  if(req.url.startsWith('/api/plugins/dsh-generative-ui/document?')){let body='';for await(const c of req)body+=c;const r=await documentRoute(store)(new Request('http://localhost'+req.url,{method:req.method,headers:req.headers,body:req.method==='POST'?body:undefined}));res.writeHead(r.status,{'Content-Type':'application/json'});res.end(await r.text());return;}
  if (req.url.startsWith('/api/')) {
    stateRequests++; let body = ''; for await (const chunk of req) body += chunk;
    const result = await handler(new Request('http://localhost' + req.url, { method: req.method, headers: req.headers, body: req.method === 'POST' ? body : undefined }));
    res.writeHead(result.status, { 'Content-Type': 'application/json' }); res.end(await result.text()); return;
  }
  if (req.url.startsWith('/leak')) { leakedRequests++; res.end('unexpected'); return; }
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle); return; }
  res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#f1f4f8;padding:24px;font-family:system-ui}#app{max-width:800px;margin:auto}body[data-ds-dark-theme]{background:#141923;--dsw-alias-bg-layer-1:#1c2330;--dsw-alias-bg-layer-2:#242d3c;--dsw-alias-label-primary:#e2e8f3;--dsw-alias-label-secondary:#a4b1c5;--dsw-alias-border-l2:#354155}@media(max-width:480px){body{padding:10px}}</style><div id="app"></div><script src="/bundle.js"></script>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true, channel: 'msedge' }), errors = [], checks = [];
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1100 } }); page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { window.canvasPhases=[];new MutationObserver(()=>{for(const el of document.querySelectorAll('[data-canvas-phase]'))if(!window.canvasPhases.includes(el.dataset.canvasPhase))window.canvasPhases.push(el.dataset.canvasPhase)}).observe(document,{subtree:true,childList:true,attributes:true}); });
  const url = 'http://127.0.0.1:' + server.address().port;
  await page.goto(url + '/?preview=1'); await page.getByText('生成预览 · 回复完成后启用交互').waitFor(); await page.frameLocator('iframe').locator('svg').waitFor(); assert.equal(await page.frameLocator('iframe').locator('body').evaluate(()=>typeof window.DSHUI),'undefined'); assert.equal(stateRequests, 0);
  checks.push('preview shows static SVG without generated scripts, state bridge or state requests');
  await page.goto(url); const frame = page.frameLocator('iframe'); await frame.getByRole('button', { name: '全部', exact: true }).waitFor();
  assert.ok((await page.evaluate(() => window.canvasPhases)).includes('loading')); await page.locator('[data-canvas-phase=ready]').waitFor();
  const actualFormatter=await page.locator('iframe').elementHandle().then(el=>el.contentFrame());
  assert.deepEqual(await actualFormatter.evaluate(()=>[DSHUI.formatNumber(4.225,2),DSHUI.formatNumber(-2.675,2),DSHUI.formatNumber(1000.5,2)]),['4.23','-2.68','1,000.50']);
  checks.push('opaque canvas formatter matches native metric and fallback decimal ties and grouping');
  assert.equal(await page.getByRole('button', { name: '重置画布', exact: true }).isVisible(), false);
  await frame.locator('body').evaluate(el => el.dataset.identity = 'stable-frame');
  assert.equal(await page.locator('iframe').getAttribute('sandbox'), 'allow-scripts');
  await page.getByRole('slider', { name: '拆解程度 %', exact: true }).fill('80');
  await frame.getByText('展开观察部件如何配合', { exact: true }).waitFor();
  assert.equal(await frame.locator('#rearWheel').getAttribute('transform'), 'translate(-38.400000000000006 12)');
  await frame.getByRole('button', { name: '传动', exact: true }).click();
  await page.waitForFunction(()=>document.querySelector('select')?.value==='3');
  assert.equal(await page.getByRole('combobox').inputValue(), '3');
  await frame.getByRole('heading', { name: '传动：把踩踏变为前进', exact: true }).waitFor();
  await page.getByRole('combobox').selectOption('1'); await frame.getByRole('heading', { name: '车架：让各系统成为整车', exact: true }).waitFor();
  assert.equal(await frame.locator('body').getAttribute('data-identity'), 'stable-frame');
  checks.push('native slider updates SVG and current derived; canvas buttons and native select share state');
  await frame.getByRole('button', { name: '播放轮转', exact: true }).click(); await page.waitForFunction(()=>document.querySelector('input[type=checkbox]')?.checked===true);
  const before = await frame.locator('[data-wheel=rear]').getAttribute('transform'); await page.waitForTimeout(80); assert.notEqual(await frame.locator('[data-wheel=rear]').getAttribute('transform'), before);
  await frame.getByRole('button', { name: '暂停轮转', exact: true }).click(); await page.getByText('参数已保存', { exact: true }).waitFor();
  await page.screenshot({ path: 'test-output/canvas-bicycle-light.png', fullPage: true });
  await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', '')); await frame.locator('html').evaluate(el => new Promise(resolve => { if(el.style.colorScheme==='dark')resolve();else new MutationObserver((_,o)=>{if(el.style.colorScheme==='dark'){o.disconnect();resolve()}}).observe(el,{attributes:true}); }));
  await page.screenshot({ path: 'test-output/canvas-bicycle-dark.png', fullPage: true });
  await page.setViewportSize({width:768,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.setViewportSize({ width: 390, height: 844 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.ok(await frame.locator('html').evaluate(el => el.scrollWidth <= innerWidth)); await page.screenshot({ path: 'test-output/canvas-bicycle-mobile.png', fullPage: true });
  await page.reload(); await page.getByText('已恢复保存的参数', { exact: true }).waitFor(); await frame.getByRole('heading', { name: '车架：让各系统成为整车', exact: true }).waitFor();
  assert.equal(await page.getByRole('slider').inputValue(), '80'); checks.push('animation, theme propagation, 390px bounds and reload restore');
  const actualFrame = await page.locator('iframe').elementHandle().then(el => el.contentFrame());
  const security = await actualFrame.evaluate(async target => {
    const result = {};
    for (const [k, fn] of Object.entries({ parent: () => parent.document.body.innerHTML, cookie: () => document.cookie, storage: () => localStorage.setItem('x','1') })) { try { fn(); result[k] = false; } catch { result[k] = true; } }
    // CDP evaluation bypasses unsafe-eval; run this probe as an actual page script instead.
    result.evaluate = document.body.dataset.evalBlocked === 'true';
    try { await fetch(target + '/leak-fetch'); result.fetch = false; } catch { result.fetch = true; }
    const image = new Image(); image.src = target + '/leak-image'; document.body.append(image);
    return result;
  }, url);
  assert.deepEqual(security, { parent: true, cookie: true, storage: true, evaluate: true, fetch: true }); await page.waitForTimeout(100); assert.equal(leakedRequests, 0);
  // A sender in the host window cannot impersonate the child even with its exact channel.
  await page.evaluate(() => { const src=document.querySelector('iframe').srcdoc, channel=src.match(/const channel="([^"]+)"/)[1];window.postMessage({dshCanvas:1,channel,type:'patch',payload:{explode:1}},'*'); });
  await page.waitForTimeout(50); assert.equal(await page.getByRole('slider').inputValue(), '80');
  await actualFrame.evaluate(() => DSHUI.setState({ explode: 1000, focus: 'all' })); await page.locator('.dgui-canvas-issue').waitFor(); await page.getByText('错误详情', { exact: true }).click(); await page.getByText(/outside its numeric range/).waitFor(); assert.equal(await page.getByRole('slider').inputValue(), '80'); assert.equal(await page.getByRole('combobox').inputValue(), '1');
  await actualFrame.evaluate(() => DSHUI.setState({ hidden: 'x' })); await page.getByText('Canvas state key is not declared', { exact: true }).waitFor();
  checks.push('opaque-origin parent/cookie/storage isolation; CSP blocks fetch/images/eval; forged sender and invalid state patches rejected');
  await page.getByRole('button', { name: '重置画布', exact: true }).click(); await frame.getByRole('heading', { name: '车架：让各系统成为整车', exact: true }).waitFor(); assert.equal(await page.getByRole('slider').inputValue(), '80');
  await page.getByText('说明与操作', { exact: true }).focus(); await page.keyboard.press('Enter'); assert.ok(await page.getByRole('button', { name: '停止画布', exact: true }).isVisible());
  await page.getByRole('button', { name: '停止画布', exact: true }).click(); assert.equal(await page.locator('iframe').count(), 0); await page.getByText('画布已停止。', { exact: true }).waitFor(); checks.push('reset retains host state; stop destroys frame');
  await page.goto(url + '/?view=1'); await page.frameLocator('iframe').getByText('x = 90 sin(2π × 1 × t)', { exact: true }).waitFor();
  await page.getByRole('slider', { name: '振幅 A（示意坐标单位）', exact: true }).fill('120'); await page.frameLocator('iframe').getByText('x = 120 sin(2π × 1 × t)', { exact: true }).waitFor();
  await page.screenshot({ path: 'test-output/canvas-oscillator.png', fullPage: true }); checks.push('second independent parameterized animation uses the same canvas API');
  const oscillator = await page.locator('iframe').elementHandle().then(el => el.contentFrame());
  await page.evaluate(() => document.getElementById('app').style.marginTop = '2200px');
  await oscillator.waitForFunction(() => DSHUI.snapshot.visible === false); const paused = await page.frameLocator('iframe').locator('#mass').getAttribute('cx'); await page.waitForTimeout(100); assert.equal(await page.frameLocator('iframe').locator('#mass').getAttribute('cx'), paused);
  await page.locator('iframe').scrollIntoViewIfNeeded(); await oscillator.waitForFunction(() => DSHUI.snapshot.visible === true); await page.waitForTimeout(80); assert.notEqual(await page.frameLocator('iframe').locator('#mass').getAttribute('cx'), paused);
  await page.evaluate(() => { Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange')); });
  await oscillator.waitForFunction(() => DSHUI.snapshot.visible === false); const hidden = await page.frameLocator('iframe').locator('#mass').getAttribute('cx'); await page.waitForTimeout(80); assert.equal(await page.frameLocator('iframe').locator('#mass').getAttribute('cx'), hidden);
  await page.evaluate(() => { delete document.hidden;document.dispatchEvent(new Event('visibilitychange')); });
  checks.push('animation helper pauses offscreen and on host visibility changes, resumes without recreating frame');
  await page.emulateMedia({ reducedMotion: 'reduce' }); await oscillator.waitForFunction(() => matchMedia('(prefers-reduced-motion: reduce)').matches && document.getElementById('mass').getAttribute('cx') === '250', null, {polling:50,timeout:5000}).catch(async e=>{console.log(JSON.stringify(await oscillator.evaluate(()=>({motion:matchMedia('(prefers-reduced-motion: reduce)').matches,cx:document.getElementById('mass').getAttribute('cx'),snapshot:DSHUI.snapshot,hidden:document.hidden}))));throw e});
  for (const [index, name] of [[3,'architecture'],[4,'scatter']]) {
    await page.setViewportSize({width:1100,height:1100}); await page.goto(url+'/?view='+index); const visual = page.frameLocator('iframe'); await page.locator('[data-canvas-phase=ready]').waitFor();
    if(index===3){await visual.getByRole('button',{name:'模型环节',exact:true}).focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('select')?.value==='3');assert.equal(await page.getByRole('combobox').inputValue(),'3');await page.getByRole('combobox').selectOption('4');await visual.getByRole('button',{name:'工具环节',exact:true}).getAttribute('aria-pressed').then(v=>assert.equal(v,'true'))}
    else{await page.getByRole('slider').fill('2');await visual.getByText('B · 120',{exact:true}).waitFor();assert.match(await page.locator('table').innerText(),/B\s+20\s+120/)}
    await page.getByText('参数已保存',{exact:true}).waitFor();
    for(const theme of ['light','dark']){
      await page.evaluate(t=>t==='dark'?document.body.setAttribute('data-ds-dark-theme',''):document.body.removeAttribute('data-ds-dark-theme'),theme);
      for(const [width,label]of[[1100,'desktop'],[768,'tablet'],[390,'mobile']]){
        await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' host overflow');assert.ok(await visual.locator('html').evaluate(el=>el.scrollWidth<=innerWidth),name+' canvas overflow');
        if(width===390)assert.ok(await visual.locator(index===3?'.diagram-scroll':'.scatter-scroll').evaluate(el=>el.scrollWidth>el.clientWidth),'wide diagram scrolls locally');
        await page.screenshot({path:'test-output/canvas-'+name+'-'+theme+'-'+label+'.png',fullPage:true});
      }
    }
    checks.push(name+': distinct composition, keyboard or derived-data interaction, light/dark/390/768/desktop, local plot scrolling');
  }
  await page.goto(url + '/?view=2'); await page.getByRole('alert').filter({hasText:'交互遇到问题'}).waitFor(); assert.equal(await page.getByText('intentional canvas failure', {exact:true}).isVisible(), false); await page.screenshot({path:'test-output/canvas-error.png',fullPage:true}); await page.getByText('错误详情',{exact:true}).click(); await page.getByText('intentional canvas failure',{exact:true}).waitFor(); await page.getByRole('button', { name: '停止画布', exact: true }).click(); assert.equal(await page.locator('iframe').count(), 0); await page.getByText('说明与操作', { exact: true }).click(); await page.locator('.dgui-canvas-options').getByText(/圆点沿水平轴做正弦运动/).waitFor();
  checks.push('state changes preserve frame identity, mixed invalid patches are atomic, reduced motion is honored, runtime errors retain fallback and stop controls');
  await page.setViewportSize({width:1100,height:1100});await page.goto(url+'/?view=5');await page.getByRole('slider').fill('4');await page.locator('.dgui-metric strong').filter({hasText:'48'}).waitFor();
  await page.emulateMedia({reducedMotion:'no-preference'});await page.goto(url+'/?view=6');const sample=page.frameLocator('iframe');await sample.getByText('暂停 · 速度 1 · 数学示意，非物理仿真',{exact:true}).waitFor();await page.getByRole('slider').fill('2');await page.getByRole('checkbox').check();await sample.getByText('运行 · 速度 2 · 数学示意，非物理仿真',{exact:true}).waitFor();const initial=await sample.locator('#dot').getAttribute('cx');await page.waitForTimeout(120);assert.notEqual(await sample.locator('#dot').getAttribute('cx'),initial);await page.getByRole('checkbox').uncheck();await sample.getByText('暂停 · 速度 2 · 数学示意，非物理仿真',{exact:true}).waitFor();const stopped=await sample.locator('#dot').getAttribute('cx');await page.waitForTimeout(120);assert.equal(await sample.locator('#dot').getAttribute('cx'),stopped);
  checks.push('both packaged interactive worked examples execute with correct calculation, shared controls, motion and pause');
  const expectedErrors = errors.filter(e => e.includes('intentional canvas failure')), unexpectedErrors = errors.filter(e => !e.includes('intentional canvas failure'));
  assert.deepEqual(unexpectedErrors, []); assert.ok(expectedErrors.length); await writeFile('test-output/canvas-verification.json', JSON.stringify({ checks, security, errors: unexpectedErrors, expectedErrors, stateRequests, leakedRequests }, null, 2)); console.log(JSON.stringify({ checks, errors: unexpectedErrors }));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); }
