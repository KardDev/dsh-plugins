// Self-contained visual acceptance harness. Uses real recorded planner data, isolated in-memory state.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.DSH_PLAYWRIGHT ?? 'playwright');
const planner=JSON.parse(await readFile('C:/Users/15403/.dsh/plugins/dsh-generative-ui/4b1dcdb6-d63b-415f-adfc-de8fe5cac5a2.json','utf8'));
const entry=`import React from 'react'; import {createRoot} from 'react-dom/client'; import {ValidatedView} from './src/view.js'; import {CSS} from './src/styles.js'; import {calculatorExample,comparisonExample,budgetExample} from './lib/catalog.js';
const style=document.createElement('style');style.textContent=CSS;document.head.append(style);
const mode=new URLSearchParams(location.search).get('view')??'planner';
const fixture={version:1,title:'组件与状态',fallback:'演示用数据。',state:{},derived:{},data:{negative:[{name:'A',value:-5},{name:'B',value:0},{name:'C',value:10}],zero:[{name:'A',value:0},{name:'B',value:0}]},nodes:[{id:'r',type:'row',children:['neutral','accent','success','warning','danger'].map((tone,i)=>({id:'m'+i,type:'metric',label:tone,value:12.34,unit:'GiB',tone,icon:'database'}))},{id:'t',type:'text',tone:'warning',text:'颜色只表示作者声明的语义，条件结论仍应通过文案明确表达。'},{id:'ch',type:'chart',kind:'bar',rows:{ref:'data.negative'},labelKey:'name',valueKey:'value',label:'正负与零值'},{id:'line',type:'chart',kind:'line',rows:{ref:'data.negative'},labelKey:'name',valueKey:'value',label:'趋势'},{id:'z',type:'chart',kind:'bar',rows:{ref:'data.zero'},labelKey:'name',valueKey:'value',label:'全部为零'}]};
const raw=mode==='planner'?${JSON.stringify(planner)}:{version:1,documentId:'fixture-'+mode,sessionId:'preview',callId:'preview',document:mode==='calculator'?calculatorExample:mode==='comparison'?comparisonExample:mode==='budget'?budgetExample:fixture};
createRoot(document.getElementById('app')).render(React.createElement(ValidatedView,{raw,sessionId:'preview',sendPrompt:async p=>{window.capturedPrompt=p}}));`;
const bundle=(await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'js'},bundle:true,write:false,format:'iife',platform:'browser'})).outputFiles[0].text;
const state=new Map();
const server=createServer(async(req,res)=>{
  if(req.url.startsWith('/api/')) {
    if(req.method==='GET'){const id=new URL(req.url,'http://x').searchParams.get('documentId');const saved=state.get(id);const doc=id===planner.documentId?planner.document:(await import('../lib/catalog.js'))[id==='fixture-budget'?'budgetExample':'calculatorExample'];res.setHeader('Content-Type','application/json');res.end(JSON.stringify(saved??{revision:0,state:Object.fromEntries(Object.entries(id?.startsWith('fixture-')&&id!=='fixture-calculator'&&id!=='fixture-budget'?{}:doc.state??{}).map(([k,v])=>[k,v.default]))}));}
    else {let body='';for await(const chunk of req)body+=chunk;const v=JSON.parse(body);const saved={revision:v.revision+1,state:v.state};state.set(v.documentId,saved);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(saved));}
    return;
  }
  if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle);return;}
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#f3f5f9;padding:32px;font-family:system-ui}#app{max-width:760px;margin:auto}body[data-ds-dark-theme]{background:#141923;--dsw-alias-bg-layer-1:#1c2330;--dsw-alias-bg-layer-2:#242d3c;--dsw-alias-label-primary:#e2e8f3;--dsw-alias-label-secondary:#a4b1c5;--dsw-alias-border-l2:#354155}@media(max-width:480px){body{padding:12px}}</style><div id="app"></div><script src="/bundle.js"></script>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,channel:'msedge'});
const results=[];
try {
 const page=await browser.newPage({viewport:{width:1000,height:900}}); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const view of ['planner','calculator','comparison','budget','tones']) {
   await page.goto('http://127.0.0.1:'+server.address().port+'/?view='+view);await page.locator('.dgui-status').getByText('使用初始参数',{exact:true}).waitFor();
   await page.screenshot({path:'test-output/design-'+view+'-light.png',fullPage:true});
   await page.evaluate(()=>document.body.setAttribute('data-ds-dark-theme',''));
   await page.screenshot({path:'test-output/design-'+view+'-dark.png',fullPage:true});
   await page.setViewportSize({width:390,height:844});
   const bounds=await page.locator('[data-dsh-generative-ui]').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow');
   await page.screenshot({path:'test-output/design-'+view+'-mobile.png',fullPage:true});
   await page.setViewportSize({width:1000,height:900}); results.push(view);
 }
 await page.goto('http://127.0.0.1:'+server.address().port+'/?view=planner');
 await page.getByText('使用初始参数',{exact:true}).waitFor();
 const toggle=page.getByRole('checkbox');await toggle.uncheck();assert.equal(await toggle.isChecked(),false);
 const select=page.getByRole('combobox');await select.selectOption({index:1});
 await page.getByText('参数已保存',{exact:true}).waitFor();
 await page.goto('http://127.0.0.1:'+server.address().port+'/?view=budget'); await page.getByText('使用初始参数',{exact:true}).waitFor(); await page.getByText('在纯权重理论预算内；仍需另计运行开销。',{exact:true}).waitFor(); await page.getByRole('slider',{name:'假设有效位宽 bit',exact:true}).fill('8'); await page.getByText('超过纯权重理论预算；请降低位宽或提高预算。',{exact:true}).waitFor(); assert.deepEqual(errors,[]);
 await writeFile('test-output/design-verification.json',JSON.stringify({views:results,checks:['light/dark/390px renders','no document overflow','planner toggle/select usable'],errors},null,2));console.log(JSON.stringify({views:results,errors}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}

