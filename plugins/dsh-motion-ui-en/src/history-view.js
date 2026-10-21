import React,{useState}from'react';
import{publishDocument}from'./current-document.js';
import{UiView}from'./view.js';
import{validateDocument}from'../lib/protocol.js';
const h=React.createElement;
export function HistoryView({record,sessionId}){
  const [versions,setVersions]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[preview,setPreview]=useState(null);
  const url='/api/plugins/dsh-generative-ui/history?'+new URLSearchParams({documentId:record.documentId,sessionId});
  async function request(options){const r=await fetch(url,{credentials:'same-origin',...options}),value=await r.json();if(!r.ok)throw new Error(value.error??'Failed to load history');return value}
  async function load(){setBusy(true);setError('');try{setVersions(await request())}catch(e){setError(e.message)}finally{setBusy(false)}}
  async function restore(revision){setBusy(true);setError('');try{
    const next=await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documentRevision:record.documentRevision??0,targetRevision:revision})});
    publishDocument(next);setPreview(null);setVersions(await request());
  }catch(e){setError(e.message)}finally{setBusy(false)}}
  async function inspect(revision){setBusy(true);setError('');try{const r=await fetch(url+'&revision='+revision,{credentials:'same-origin'}),v=await r.json();if(!r.ok)throw new Error(v.error??'Failed to load history');setPreview({...v,document:validateDocument(v.document)})}catch(e){setError(e.message)}finally{setBusy(false)}}
  return h('details',{className:'dgui-fallback dgui-history',onToggle:e=>{if(e.currentTarget.open&&!versions&&!busy)load()}},
    h('summary',null,`Version history · v${record.documentRevision??0}`),
    h('p',null,'Restoring creates a new revision and keeps history and saved parameters.'),
    h('button',{type:'button',className:'dgui-secondary',disabled:busy,onClick:load},busy?'Loading…':'Refresh history'),
    versions?.versions.map(v=>h('div',{key:v.revision,className:'dgui-history-row'},h('span',null,`v${v.revision} · ${v.title}${v.restoredFrom!==null?` · Restored from v${v.restoredFrom}`:''}`),
      h('button',{type:'button',className:'dgui-secondary',disabled:busy,onClick:()=>inspect(v.revision)},`Preview v${v.revision}`),
      h('button',{type:'button',className:'dgui-secondary',disabled:busy||v.revision===(record.documentRevision??0),onClick:()=>restore(v.revision)},v.revision===(record.documentRevision??0)?'Current revision':`Restore v${v.revision}`))),
    preview&&h('div',{className:'dgui-version-preview'},h('p',null,`v${preview.documentRevision??0} · Read-only preview of initial parameters; canvas scripts do not run.`),h('button',{type:'button',className:'dgui-secondary',onClick:()=>setPreview(null)},'Close revision preview'),h(UiView,{record:preview,sessionId,preview:true})),
    versions?.truncated&&h('p',null,'Showing the 200 most recent revisions.'),error&&h('p',{role:'alert'},error));
}
