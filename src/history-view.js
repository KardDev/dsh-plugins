import React,{useState}from'react';
import{publishDocument}from'./current-document.js';
import{UiView}from'./view.js';
import{validateDocument}from'../lib/protocol.js';
const h=React.createElement;
export function HistoryView({record,sessionId}){
  const [versions,setVersions]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[preview,setPreview]=useState(null);
  const url='/api/plugins/dsh-generative-ui/history?'+new URLSearchParams({documentId:record.documentId,sessionId});
  async function request(options){const r=await fetch(url,{credentials:'same-origin',...options}),value=await r.json();if(!r.ok)throw new Error(value.error??'历史读取失败');return value}
  async function load(){setBusy(true);setError('');try{setVersions(await request())}catch(e){setError(e.message)}finally{setBusy(false)}}
  async function restore(revision){setBusy(true);setError('');try{
    const next=await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documentRevision:record.documentRevision??0,targetRevision:revision})});
    publishDocument(next);setPreview(null);setVersions(await request());
  }catch(e){setError(e.message)}finally{setBusy(false)}}
  async function inspect(revision){setBusy(true);setError('');try{const r=await fetch(url+'&revision='+revision,{credentials:'same-origin'}),v=await r.json();if(!r.ok)throw new Error(v.error??'历史读取失败');setPreview({...v,document:validateDocument(v.document)})}catch(e){setError(e.message)}finally{setBusy(false)}}
  return h('details',{className:'dgui-fallback dgui-history',onToggle:e=>{if(e.currentTarget.open&&!versions&&!busy)load()}},
    h('summary',null,`版本历史 · v${record.documentRevision??0}`),
    h('p',null,'恢复会生成新版本，保留历史和已保存参数。'),
    h('button',{type:'button',className:'dgui-secondary',disabled:busy,onClick:load},busy?'正在读取…':'刷新历史'),
    versions?.versions.map(v=>h('div',{key:v.revision,className:'dgui-history-row'},h('span',null,`v${v.revision} · ${v.title}${v.restoredFrom!==null?` · 恢复自 v${v.restoredFrom}`:''}`),
      h('button',{type:'button',className:'dgui-secondary',disabled:busy,onClick:()=>inspect(v.revision)},`预览 v${v.revision}`),
      h('button',{type:'button',className:'dgui-secondary',disabled:busy||v.revision===(record.documentRevision??0),onClick:()=>restore(v.revision)},v.revision===(record.documentRevision??0)?'当前版本':`恢复 v${v.revision}`))),
    preview&&h('div',{className:'dgui-version-preview'},h('p',null,`v${preview.documentRevision??0} · 初始参数只读预览；画布脚本不执行。`),h('button',{type:'button',className:'dgui-secondary',onClick:()=>setPreview(null)},'关闭版本预览'),h(UiView,{record:preview,sessionId,preview:true})),
    versions?.truncated&&h('p',null,'显示最近 200 个版本。'),error&&h('p',{role:'alert'},error));
}
