import { createServer } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { UiStore, stateRoute, documentRoute } from '../lib/store.js';
import { sceneExamples, calculatorExample } from '../lib/catalog.js';
const require = createRequire(import.meta.url), { chromium } = require(process.env.DSH_PLAYWRIGHT ?? 'playwright');
const directory = await mkdtemp(join(tmpdir(), 'dgui-scenes-')), store = new UiStore(directory), handler = stateRoute(store);
const records = await Promise.all([...sceneExamples, calculatorExample].map(document => store.create(document, { sessionId: 'test', callId: 'test' })));
const entry = `import './tests/diagnostic-fixture.js';import React from 'react';import{createRoot}from'react-dom/client';import{ValidatedView,ToolView}from'./src/view.js';import{CSS}from'./src/styles.js';
const records=${JSON.stringify(records)};const style=document.createElement('style');style.textContent=CSS;document.head.append(style);
const root=createRoot(document.getElementById('app')),view=new URLSearchParams(location.search).get('view');let snapshot='',listeners=new Set();
const usePartial=()=>React.useSyncExternalStore(cb=>{listeners.add(cb);return()=>listeners.delete(cb)},()=>snapshot);
window.stream=(raw,phase='preparing')=>{snapshot=raw;root.render(React.createElement(React.StrictMode,null,React.createElement(ToolView,{phase,callId:'stream',sessionId:'test',useToolCallArgumentsPartial:usePartial,block:phase==='result'?{isError:true,content:[{type:'text',text:'已取消生成'}]}:{argsRaw:raw}})));listeners.forEach(cb=>cb())};
window.commit=()=>root.render(React.createElement(ValidatedView,{raw:records[6],sessionId:'test',sendPrompt:async()=>{}}));
if(view==='stream')window.stream('');else root.render(React.createElement(React.StrictMode,null,view==='gallery'?React.createElement('div',{className:'gallery'},records.slice(0,6).map(raw=>React.createElement(ValidatedView,{key:raw.documentId,raw,sessionId:'test'}))):React.createElement(ValidatedView,{raw:records[Number(view)||0],sessionId:'test'})));`;
const bundle = (await build({ stdin: { contents: entry, resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife' })).outputFiles[0].text;
let stateRequests = 0;
const server = createServer(async (req, res) => {
  if(req.url.startsWith('/api/plugins/dsh-generative-ui/document?')){let body='';for await(const c of req)body+=c;const r=await documentRoute(store)(new Request('http://localhost'+req.url,{method:req.method,headers:req.headers,body:req.method==='POST'?body:undefined}));res.writeHead(r.status,{'Content-Type':'application/json'});res.end(await r.text());return;}
  if (req.url.startsWith('/api/')) {
    stateRequests++; let body = ''; for await (const chunk of req) body += chunk;
    const result = await handler(new Request('http://localhost' + req.url, { method: req.method, headers: req.headers, body: req.method === 'POST' ? body : undefined }));
    res.writeHead(result.status, { 'Content-Type': 'application/json' }); res.end(await result.text()); return;
  }
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle); return; }
  res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#f1f4f8;padding:28px;font-family:system-ui}#app{max-width:800px;margin:auto}body:has(.gallery) #app{max-width:1440px}.gallery{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}.gallery .dgui-root{margin:0}body[data-ds-dark-theme]{background:#141923;--dsw-alias-bg-layer-1:#1c2330;--dsw-alias-bg-layer-2:#242d3c;--dsw-alias-label-primary:#e2e8f3;--dsw-alias-label-secondary:#a4b1c5;--dsw-alias-border-l2:#354155}@media(max-width:480px){body{padding:12px}.gallery{grid-template-columns:1fr}}</style><div id="app"></div><script src="/bundle.js"></script>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true, channel: 'msedge' }), errors = [], checks = [];
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } }); page.on('pageerror', e => errors.push(e.message));
  const url = 'http://127.0.0.1:' + server.address().port;
  for (let i = 0; i < sceneExamples.length; i++) {
    await page.goto(url + '/?view=' + i); await page.locator('.dgui-content').waitFor();if(Object.keys(sceneExamples[i].state??{}).length)await page.getByText('使用初始参数', { exact: true }).waitFor();else assert.equal(await page.locator('.dgui-status').count(),0);
    const layout = sceneExamples[i].presentation.layout;
    await page.screenshot({ path: `test-output/scene-${layout}-light.png`, fullPage: true });
    await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''));
    await page.screenshot({ path: `test-output/scene-${layout}-dark.png`, fullPage: true });
    await page.setViewportSize({ width: 768, height: 1000 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), layout + ' tablet overflow');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), layout + ' mobile overflow');
    await page.screenshot({ path: `test-output/scene-${layout}-mobile.png`, fullPage: true });
    if (layout === 'workbench') {
      await page.getByRole('slider').fill('160'); await page.getByText('2.6 分钟', { exact: true }).waitFor();
      await page.getByText('参数已保存', { exact: true }).waitFor();
      await page.getByText('计算方式', { exact: true }).click(); assert.equal(await page.locator('[data-ui-node=detail]').getAttribute('open'), '');
    }
    checks.push(layout + ': light/dark/tablet/mobile'); await page.setViewportSize({ width: 1000, height: 1000 });
  }
  await page.setViewportSize({ width: 1500, height: 1200 }); await page.goto(url + '/?view=gallery'); await page.waitForFunction(()=>document.querySelectorAll('[data-dsh-generative-ui]').length===6);
  await page.screenshot({ path: 'test-output/scene-gallery.png', fullPage: true });
  await page.setViewportSize({ width: 1000, height: 1000 }); await page.goto(url + '/?view=stream'); const requestsBefore = stateRequests;
  const doc = { ...calculatorExample, actions: calculatorExample.actions, nodes: calculatorExample.nodes }, raw = JSON.stringify({ document: doc });
  const end = raw.indexOf('},{"id":"bits"') + 1; assert.ok(end > 1);
  await page.evaluate(s => window.stream(s), raw.slice(0, end)); await page.locator('[data-preview=true] [data-ui-node=parameters]').waitFor();
  assert.equal(await page.locator('[data-ui-node=bits]').count(), 0);
  await page.evaluate(() => window.firstNode = document.querySelector('[data-ui-node=parameters]'));
  await page.evaluate(s => window.stream(s), raw);
  await page.locator('[data-preview=true] [data-ui-node=bits]').waitFor();
  assert.ok(await page.evaluate(() => window.firstNode === document.querySelector('[data-ui-node=parameters]')), 'stable node DOM identity');
  for (const control of await page.locator('[data-preview=true] input,[data-preview=true] button').all()) assert.ok(await control.isDisabled());
  assert.equal(stateRequests, requestsBefore, 'preview cannot read/save state');
  await page.screenshot({ path: 'test-output/stream-preview.png', fullPage: true });
  await page.evaluate(s => window.stream(s, 'result'), raw); await page.getByText('已取消生成', { exact: true }).waitFor(); assert.equal(await page.locator('[data-preview=true]').count(), 0);
  await page.evaluate(() => window.commit()); await page.getByText('使用初始参数', { exact: true }).waitFor(); assert.ok(await page.getByRole('slider').isEnabled());
  checks.push('progressive complete nodes, stable DOM IDs, disabled preview, zero preview state requests, cancellation clears preview, committed UI activates');
  assert.deepEqual(errors, []); await writeFile('test-output/scenes-stream-verification.json', JSON.stringify({ checks, errors }, null, 2)); console.log(JSON.stringify({ checks, errors }));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); }
