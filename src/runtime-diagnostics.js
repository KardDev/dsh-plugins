import React,{useState} from 'react';
import {BUILD_INFO} from '../lib/build-info.js';
const h=React.createElement;
let activation={active:false,channel:'未激活',sidebar:false};
export function setRuntimeActivation(patch){activation={...activation,...patch}}
export function RuntimeDiagnostics(){const[report,setReport]=useState(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const check=async()=>{setBusy(true);setError('');try{const response=await fetch('/api/plugins/dsh-generative-ui/diagnostics',{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw Error('宿主诊断请求失败：HTTP '+response.status);const value=await response.json();const asset=await fetch('/api/plugins/dsh-generative-ui/assets/visual.css?rev='+BUILD_INFO.id,{credentials:'same-origin',cache:'no-store'});if(asset.body)await asset.body.cancel();setReport({...value,assetRouteOK:asset.ok});}catch(e){setError(e.message)}finally{setBusy(false)}};
 return h('section',{'aria-label':'运行状态'},h('h4',null,'运行状态'),h('p',null,'客户端：'+(activation.active?'已激活':'正在激活')+' · '+activation.channel),h('button',{className:'dgui-secondary',type:'button',disabled:busy,onClick:check},busy?'正在检查…':'检查运行状态'),report&&h(React.Fragment,null,h('p',null,'构建：'+report.build.id+(report.build.id===BUILD_INFO.id?' · 前后端一致':' · 前后端不同，请重启宿主并刷新')),h('p',null,'本地资源：'+(report.assets.every(a=>a.available)&&report.assetRouteOK?'正常':'有缺失或路由不可用')),h('p',null,'同轮修复接口：'+(report.feedbackHookRegistered?'已注册':'当前宿主不可用')+' · 原生侧栏：'+(activation.sidebar?'已接入':'当前宿主未提供')),h('p',null,'控件与模型脚本在整轮结束后启用；不改变宿主权限。')),error&&h('p',{role:'alert'},error));
}
