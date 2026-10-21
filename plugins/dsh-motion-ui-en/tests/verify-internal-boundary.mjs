import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {CSS} from '../src/styles.js';
import {INTERNAL_BOUNDARY_CSS} from '../src/host-boundary.js';
import {COPY_BLOCK_CSS} from '../src/copy-block.js';
const fullCSS=CSS+COPY_BLOCK_CSS;

const out='test-output/issue-3-internals';
await fs.mkdir(out,{recursive:true});
const supplied=process.env.MOTION_HOST_SKIN;
const skin=supplied?await fs.readFile(supplied,'utf8'):':root{--dsw-alias-bg-layer-1:#fffcf69e;--dsw-alias-label-primary:#11151b}body[data-ds-dark-theme]{--dsw-alias-bg-layer-1:#0e141ed6;--dsw-alias-label-primary:#eef4ff}';
const selectors=['.dgui-card','.dgui-row .dgui-card:nth-child(2)','.dgui-metric','.dgui-row .dgui-metric','.dgui-control','.dgui-chart','.dgui-table-wrap','.dgui-control input','.dgui-control select','iframe'];
selectors.push('.dgui-steps li','.dgui-callout','.dgui-step-dot','.dgui-button','.dgui-badge','.dgui-heading-icon','.dgui-control output','.dgui-toggle','.dgui-segmented','.dgui-segment-indicator','.dgui-segmented button','.dgui-stepper','.dgui-stepper>button','.dgui-action-orb','.dgui-tag','.dgui-details','.dgui-progress','.dgui-progress progress','.dgui-menu-trigger','.dgui-menu-content','.dgui-menu-content button','.dgui-canvas-spinner','.dgui-card>.dgui-section-title');
const reset=`[data-chat-flow] .dgui-root :is(.dgui-card,.dgui-metric,.dgui-control,.dgui-chart,.dgui-table-wrap,input,select,iframe){border-radius:0!important;border-bottom-right-radius:0!important;corner-shape:bevel}`;
const patchesReset='html[data-dsh-skin="orca-link"] [data-chat-flow] *, html[data-dsh-skin="orca-link"] [data-chat-flow] ::before, html[data-dsh-skin="orca-link"] [data-chat-flow] ::after{border-radius:0px!important}';
const styles=['editorial','soft','technical','expressive','prismframe','aurora'];
const presets=['brief','reading','minimal','comparison','list','scorecard','flow','callout'];
selectors.push('.motion-copy-block','.motion-copy-button');
const base=fullCSS.replace(INTERNAL_BOUNDARY_CSS,'');
const b=await chromium.launch({headless:true,channel:'msedge'}),report={passed:false,cases:0,suppliedSkin:!!supplied,skinHash:createHash('sha256').update(skin).digest('hex')};
try{
 const p=await b.newPage({viewport:{width:1365,height:1080},deviceScaleFactor:1.5});
 await p.setContent('<!doctype html><style>body{font:16px system-ui;padding:24px}main{max-width:960px;margin:auto}</style><style id="plugin"></style><style id="skin"></style><main data-chat-flow><div class="dgui-marker" data-dgui-marker="test"><section class="dgui-root" data-preset="brief" data-visual-style="prismframe"><div class="dgui-content"><div class="dgui-card">独立卡片</div><div class="dgui-row"><div class="dgui-card">左卡片</div><div class="dgui-card">右卡片</div></div><div class="dgui-metric">123</div><div class="dgui-row"><div class="dgui-metric">456</div><div class="dgui-metric">789</div></div><div class="dgui-control"><label>输入</label><input type="number" value="3"><select><option>示例</option></select></div><div class="dgui-chart">图表</div><div class="dgui-table-wrap"><table><tr><td>表格</td></tr></table></div><div class="dgui-canvas-stage"><iframe title="unchanged canvas" srcdoc="<style>button{border-radius:3px}</style><button>画布</button>"></iframe></div></div></section></div></main>');
 await p.evaluate(()=>document.documentElement.dataset.dshSkin='orca-link');
 await p.locator('.dgui-content').evaluate(e=>e.insertAdjacentHTML('beforeend','<ol class="dgui-steps"><li><span class="dgui-step-dot">1</span><strong>准备文件</strong></li></ol><p class="dgui-copy dgui-callout">提示块保留左侧直角</p><button class="dgui-button">继续</button><span class="dgui-badge">徽标</span><span class="dgui-heading-icon">图标</span><div class="dgui-segmented"><i class="dgui-segment-indicator"></i><button>选项</button></div><div class="dgui-stepper"><button>+</button></div><span class="dgui-action-orb">→</span><span class="dgui-tag">标签</span><details class="dgui-details"><summary>详细信息</summary></details><div class="dgui-progress"><progress value="50" max="100"></progress></div><button class="dgui-menu-trigger">菜单</button><div class="dgui-menu-content"><button>复制</button></div><span class="dgui-canvas-spinner"></span>'));
 await p.locator('.dgui-card').first().evaluate(e=>e.insertAdjacentHTML('afterbegin','<h4 class="dgui-section-title">标题</h4>'));
 await p.locator('.dgui-control').evaluate(e=>e.insertAdjacentHTML('beforeend','<output>3</output><input type="checkbox" class="dgui-toggle">'));
 await p.locator('.dgui-content').evaluate(e=>e.insertAdjacentHTML('beforeend','<div class="motion-copy-block"><button class="motion-copy-button">复制</button><div class="motion-copy-body">文本</div></div>'));
 const geometry=()=>p.locator('.dgui-root').evaluate((e,selectors)=>selectors.map(s=>{const el=e.querySelector(s),c=getComputedStyle(el);return[c.borderTopLeftRadius,c.borderTopRightRadius,c.borderBottomRightRadius,c.borderBottomLeftRadius]}),selectors);
 await p.locator('#plugin').evaluate((e,s)=>e.textContent=s,base);
 await p.locator('#skin').evaluate((e,s)=>e.textContent=s,skin+reset);
 assert.equal((await geometry())[0].join(' '),'0px 0px 0px 0px','pre-fix inner card reproduces the reset');
 report.prismframeBefore=await geometry();
 await p.locator('#skin').evaluate((e,s)=>e.textContent=s,skin+patchesReset);
 assert.equal((await geometry())[0].join(' '),'0px 0px 0px 0px','reported skin-center patches rule reproduces the pre-fix reset');
 report.reportedPatchReproduced=true;
 assert.deepEqual((await geometry()).slice(10,12),[['0px','0px','0px','0px'],['0px','0px','0px','0px']],'reported steps and callout reset reproduced');
 for(const width of[1920,1365,480]){
  await p.setViewportSize({width,height:1080});
  for(const dark of[false,true]){
   await p.evaluate(d=>document.body.toggleAttribute('data-ds-dark-theme',d),dark);
   for(const style of styles)for(const preset of presets){
    await p.locator('.dgui-root').evaluate((e,{style,preset})=>{e.dataset.visualStyle=style;e.dataset.preset=preset},{style,preset});
    await p.locator('#plugin').evaluate((e,s)=>e.textContent=s,base);
    await p.locator('#skin').evaluate((e,s)=>e.textContent=s,skin);
    const expected=await geometry();
    for(const order of['skin-first','skin-last']){
     await p.locator('#plugin').evaluate((e,s)=>e.textContent=s,fullCSS);
     await p.evaluate(order=>{const a=document.getElementById('skin'),b=document.getElementById('plugin');order==='skin-first'?b.before(a):b.after(a)},order);
     for(const hostile of['none','radius','legacy','reported-patches']){
      await p.locator('#skin').evaluate((e,s)=>e.textContent=s,skin+(hostile==='none'?'':hostile==='reported-patches'?patchesReset:reset)+(hostile==='legacy'?'[data-chat-flow] .dgui-root{--du-radius:0px!important;--du-radius-inner:0px!important}':''));
      assert.deepEqual(await geometry(),expected,JSON.stringify({width,dark,style,preset,order,hostile}));
      report.cases++;
     }
    }
   }
  }
 }
 await p.setViewportSize({width:1365,height:1080});
 await p.locator('.dgui-root').evaluate(e=>{e.dataset.visualStyle='prismframe';e.dataset.preset='brief'});
 report.prismframeAfter=await geometry();
 assert.deepEqual(report.prismframeAfter[0],['20px','20px','20px','20px']);
 assert.deepEqual(report.prismframeAfter[4],['16px','16px','16px','16px']);
 assert.deepEqual(report.prismframeAfter[10],['18px','18px','18px','18px'],'steps preserve the prismframe design');
 assert.deepEqual(report.prismframeAfter[11],['0px','10px','10px','0px'],'callout preserves intentional left square corners');
 report.toggleThumbRadius=await p.locator('.dgui-toggle').evaluate(e=>getComputedStyle(e,'::before').borderRadius);
 assert.equal(report.toggleThumbRadius,'50%','skin pseudo-element resets cannot flatten the toggle thumb');
 const frame=p.frameLocator('iframe');await frame.getByRole('button').waitFor();
 assert.equal(await frame.getByRole('button').evaluate(e=>getComputedStyle(e).borderRadius),'3px');
 await p.screenshot({path:out+'/internals-fixed.png',fullPage:true});
 await p.locator('.dgui-root').evaluate(e=>e.removeAttribute('data-visual-style'));
 await p.locator('#skin').evaluate((e,s)=>e.textContent=s,skin);
 await p.locator('#plugin').evaluate((e,s)=>e.textContent=s,base);const free=await geometry();
 await p.locator('#plugin').evaluate((e,s)=>e.textContent=s,fullCSS);
 await p.locator('#skin').evaluate((e,s)=>e.textContent=s,skin+patchesReset);
 assert.deepEqual(await geometry(),free,'free native geometry is preserved');
 assert.deepEqual(free.at(-2),['24px','24px','24px','24px'],'free copy blocks keep their desktop radius');
 await p.setViewportSize({width:480,height:1080});
 assert.deepEqual((await geometry()).at(-2),['20px','20px','20px','20px'],'free copy blocks retain responsive radius under the reported reset');
 await p.setViewportSize({width:1365,height:1080});
 await p.locator('.dgui-root').evaluate(e=>{e.classList.add('dgui-style-preview');e.dataset.visualStyle='soft'});
 await p.locator('#skin').evaluate((e,s)=>e.textContent=s,skin);
 await p.locator('#plugin').evaluate((e,s)=>e.textContent=s,base);const preview=await geometry();
 await p.locator('#plugin').evaluate((e,s)=>e.textContent=s,fullCSS);
 assert.deepEqual(await geometry(),preview,'settings previews are unchanged');
 report.componentProbes=selectors.length;
 report.passed=true;
}finally{await b.close();await fs.writeFile(out+'/internals-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))}
