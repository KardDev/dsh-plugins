import React,{useEffect,useRef,useState}from'react';
import{createPortal}from'react-dom';
import{ValidatedView}from'./view.js';
import{rememberUi,useUiRegistry,usePresentation,markerLocation,openUiPanel,panelAvailable,subscribeUi,notifyUi}from'./presentation-store.js';
import{startUiMarkers}from'./markers.js';
const h=React.createElement,scanners=new WeakMap(),focused=new Map();
export function PresentationView({raw,sessionId,sendPrompt,scope}){
  const anchor=useRef(null),records=useUiRegistry(),mode=usePresentation(scope),host=markerLocation(raw.documentId);
  useEffect(()=>{rememberUi(raw,sessionId,sendPrompt)},[raw,sessionId,sendPrompt]);
  useEffect(()=>{
    const root=anchor.current?.closest('[data-conversation-scroll]');if(!root)return;
    let entry=scanners.get(root);if(entry&&entry.sessionId!==sessionId){entry.stop();scanners.delete(root);entry=null}
    if(!entry){entry={sessionId,count:0,stop:startUiMarkers(root,sessionId)};scanners.set(root,entry)}
    entry.count++;return()=>{if(--entry.count===0){entry.stop();scanners.delete(root)}};
  },[sessionId]);
  useEffect(()=>{const block=host?.uiMarkerBlock;if(!block)return;const previous=block.style.display;block.style.display=mode==='inline'?'none':previous;return()=>{block.style.display=previous}},[host,mode]);
  const available=panelAvailable();
  useEffect(()=>{if(mode==='sidebar'&&available)openUiPanel(raw.documentId,sessionId)},[mode,available,sessionId,raw.documentId]);
  const content=h(ValidatedView,{raw,fallback:raw.document.fallback,sessionId,sendPrompt});
  return h('div',{ref:anchor,'data-dgui-presentation':raw.documentId},
    available&&h('button',{type:'button',className:'dgui-secondary',onClick:()=>openUiPanel(raw.documentId,sessionId)},'在侧栏打开'),
    mode==='sidebar'&&available?h('p',{className:'dgui-copy'},`${raw.document.title} · 在侧栏中操作`):mode==='inline'&&host?createPortal(content,host):content,
    mode==='inline'&&!host&&h('small',{className:'dgui-copy'},'正文标记尚未出现，暂在回答下方显示。'));
}
export function UiPanel({sessionId,sendPrompt}){
  const records=useUiRegistry().filter(r=>r.sessionId===sessionId),[selected,setSelected]=useState(focused.get(sessionId));
  useEffect(()=>subscribeUi(()=>setSelected(focused.get(sessionId))),[sessionId]);
  const record=records.find(r=>r.raw.documentId===selected)??records.at(-1);
  return h('div',{className:'dgui-panel'},h('div',{className:'dgui-root'},h('label',null,'本会话界面',h('select',{'aria-label':'本会话界面',value:record?.raw.documentId??'',onChange:e=>{focused.set(sessionId,e.target.value);setSelected(e.target.value)}},records.map(r=>h('option',{key:r.raw.documentId,value:r.raw.documentId},r.raw.document.title))))),
    record?h(ValidatedView,{key:record.raw.documentId,raw:record.raw,sessionId,sendPrompt:sendPrompt??record.sendPrompt}):h('p',null,'当前会话还没有生成界面。'));
}
export function focusUi(id,sessionId){focused.set(sessionId,id);notifyUi()}
