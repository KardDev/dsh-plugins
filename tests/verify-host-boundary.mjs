import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {CSS} from '../src/styles.js';
import {HOST_BOUNDARY_CSS} from '../src/host-boundary.js';

const out='test-output/issue-3';
await fs.mkdir(out,{recursive:true});
const radii={editorial:0,soft:30,technical:10,expressive:20,prismframe:24,aurora:28};
const presets=['reading','minimal','comparison','list','scorecard','flow','callout','brief'];
// Generic third-party resets reproduce the reported symptom, without claiming
// these rules are the reporter's unavailable custom orca-link stylesheet.
const skin=`[data-chat-flow] section{border-radius:0!important;corner-shape:bevel}
[data-chat-flow]>div{border:2px solid red!important;padding:18px!important;background:rgb(250,210,210)!important;box-shadow:4px 6px red!important}`;
const browser=await chromium.launch({headless:true,channel:'msedge'});
const report={passed:false,cases:0,baseline:null};
try{
 const page=await browser.newPage({viewport:{width:1365,height:1080},deviceScaleFactor:1.5});
 await page.setContent('<!doctype html><style>body{font:16px system-ui;padding:32px;background:#f7f8fc}main{max-width:960px;margin:auto}body[data-ds-dark-theme]{background:#16171a;--dsw-alias-bg-layer-1:#202124;--dsw-alias-label-primary:#fafafa;--dsw-alias-label-secondary:#b7bcc7}</style><style id="skin"></style><style id="plugin"></style><main data-chat-flow><div class="dgui-marker" data-dgui-marker="fixture"><section class="dgui-root" data-preset="brief" data-visual-style="prismframe"><div class="dgui-content"><p class="dgui-copy">文档外壳保持所选风格的圆角。</p><div class="dgui-card">内部卡片</div><div class="dgui-canvas-stage"><iframe title="authored canvas" srcdoc="<style>body{background:#172439;color:white}button{border-radius:3px}</style><button>模型画布</button>"></iframe></div></div></section></div></main>');
 await page.locator('#plugin').evaluate((e,css)=>e.textContent=css,CSS.replace(HOST_BOUNDARY_CSS,''));
 await page.locator('#skin').evaluate((e,css)=>e.textContent=css,skin);
 report.baseline=await page.locator('.dgui-root').evaluate(e=>getComputedStyle(e).borderRadius);
 assert.equal(report.baseline,'0px','same generic reset breaks the pre-fix boundary');
 await page.locator('#plugin').evaluate((e,css)=>e.textContent=css,CSS);
 const frame=page.frameLocator('iframe');
 await frame.getByRole('button').waitFor();
 for(const width of[1920,1365,480]){
  await page.setViewportSize({width,height:1080});
  for(const order of['skin-first','skin-last']){
   await page.evaluate(order=>{
    const plugin=document.getElementById('plugin'),skin=document.getElementById('skin');
    order==='skin-last'?plugin.after(skin):plugin.before(skin);
   },order);
   for(const dark of[false,true]){
    await page.evaluate(dark=>document.body.toggleAttribute('data-ds-dark-theme',dark),dark);
    for(const [style,radius] of Object.entries(radii))for(const preset of presets){
     await page.locator('.dgui-root').evaluate((e,{style,preset})=>{e.dataset.visualStyle=style;e.dataset.preset=preset},{style,preset});
     const actual=await page.locator('.dgui-root').evaluate(e=>{
      const s=getComputedStyle(e),m=getComputedStyle(e.parentElement),card=getComputedStyle(e.querySelector('.dgui-card'));
      return {radius:s.borderRadius,corner:s.cornerShape,shadow:s.boxShadow,padding:s.paddingTop,background:s.backgroundColor,cardRadius:card.borderRadius,cardShadow:card.boxShadow,marker:{border:m.borderTopWidth,padding:m.paddingTop,background:m.backgroundColor,shadow:m.boxShadow}};
     });
     const unframed=['reading','minimal'].includes(preset);
     assert.equal(actual.radius,(unframed?0:radius)+'px',JSON.stringify({style,preset,dark,width,order,actual}));
     assert.equal(actual.marker.border,'0px');assert.equal(actual.marker.padding,'0px');
     assert.equal(actual.marker.background,'rgba(0, 0, 0, 0)');assert.equal(actual.marker.shadow,'none');
     if(unframed){assert.equal(actual.shadow,'none');assert.equal(actual.background,'rgba(0, 0, 0, 0)');assert.equal(actual.padding,'0px')}
     if(style==='prismframe'){assert.equal(actual.cardRadius,'20px');assert.notEqual(actual.cardShadow,'none')}
     report.cases++;
    }
   }
  }
 }
 assert.equal(await frame.getByRole('button').evaluate(e=>getComputedStyle(e).borderRadius),'3px','authored iframe content stays untouched');
 await page.setViewportSize({width:1365,height:1080});
 await page.locator('.dgui-root').evaluate(e=>{e.dataset.visualStyle='prismframe';e.dataset.preset='brief'});
 await page.screenshot({path:out+'/boundary-fixed.png',fullPage:true});
 await page.locator('.dgui-root').evaluate(e=>e.removeAttribute('data-visual-style'));
 assert.equal(await page.locator('.dgui-root').evaluate(e=>getComputedStyle(e).borderRadius),'16px','free-mode native default remains available');
 await page.locator('.dgui-root').evaluate(e=>{e.classList.add('dgui-style-preview');e.dataset.visualStyle='prismframe'});
 await page.locator('#skin').evaluate(e=>e.textContent='');
 assert.equal(await page.locator('.dgui-root').evaluate(e=>getComputedStyle(e).borderRadius),'24px','settings previews keep their own stylesheet');
 report.passed=true;
}finally{
 await browser.close();await fs.writeFile(out+'/boundary-verification.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}
