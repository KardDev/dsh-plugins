import React,{useEffect,useRef,useState}from'react';
import{createPortal}from'react-dom';
import{ValidatedView}from'./view.js';
import{rememberUi,useUiRegistry,markerLocation,subscribeUi,notifyUi}from'./presentation-store.js';
import{startUiMarkers}from'./markers.js';
import{usePresentationOwner}from'./presentation-owner.js';
import{useViewDetails}from'./view-settings.js';
const h=React.createElement,scanners=new WeakMap(),focused=new Map();
export function PresentationView({raw,sessionId,sendPrompt,openFile,scope}){
  const showDetails=useViewDetails();
  const anchor=useRef(null),records=useUiRegistry(),host=markerLocation(raw.documentId);
  const owner=usePresentationOwner(anchor,raw.documentId,sessionId);
  useEffect(()=>{rememberUi(raw,sessionId,sendPrompt,openFile)},[raw,sessionId,sendPrompt,openFile]);
  useEffect(()=>{
    const root=anchor.current?.closest('[data-conversation-scroll]');if(!root)return;
    let entry=scanners.get(root);if(entry&&entry.sessionId!==sessionId){entry.stop();scanners.delete(root);entry=null}
    if(!entry){entry={sessionId,count:0,stop:startUiMarkers(root,sessionId)};scanners.set(root,entry)}
    entry.count++;return()=>{if(--entry.count===0){entry.stop();scanners.delete(root)}};
  },[sessionId]);
  useEffect(()=>{const block=host?.uiMarkerBlock;if(!block||!owner)return;const previous=block.style.display;block.style.display='none';return()=>{block.style.display=previous}},[host,owner]);
  const content=h(ValidatedView,{raw,fallback:raw.document.fallback,sessionId,sendPrompt,openFile,replaceExportedCanvases:true});
  return h('div',{ref:anchor,'data-dgui-presentation':raw.documentId},
    owner&&(host?createPortal(content,host):content),
    showDetails&&owner&&!host&&h('small',{className:'dgui-copy'},'No body marker was provided; the interface is shown below the answer.'));
}
export function UiPanel({sessionId,sendPrompt}){
  const registry=useUiRegistry().filter(r=>r.sessionId===sessionId),[selected,setSelected]=useState(focused.get(sessionId));
  const [remote,setRemote]=useState(null);
  // The registry is in-memory only, so after a host restart it is empty until
  // an interface renders inline again. Rehydrate this session from the store.
  useEffect(()=>{
    if(registry.length){setRemote(null);return}
    let alive=true;
    fetch('/api/plugins/dsh-generative-ui/documents?sessionId='+encodeURIComponent(sessionId),{credentials:'same-origin',cache:'no-store'})
      .then(r=>r.json())
      .then(v=>{if(alive&&Array.isArray(v.items))setRemote(v.items.map(raw=>({raw,sessionId,sendPrompt})))})
      .catch(()=>{});
    return()=>{alive=false};
  },[sessionId,registry.length]);
  useEffect(()=>subscribeUi(()=>setSelected(focused.get(sessionId))),[sessionId]);
  const records=registry.length?registry:(remote??[]);
  const record=records.find(r=>r.raw.documentId===selected)??records.at(-1);
  return h('div',{className:'dgui-panel'},h('div',{className:'dgui-root'},h('label',null,'Session interface',h('select',{'aria-label':'Session interface',value:record?.raw.documentId??'',onChange:e=>{focused.set(sessionId,e.target.value);setSelected(e.target.value)}},records.map(r=>h('option',{key:r.raw.documentId,value:r.raw.documentId},r.raw.document.title))))),
    record?h(ValidatedView,{key:record.raw.documentId,raw:record.raw,sessionId,sendPrompt:sendPrompt??record.sendPrompt,openFile:record.openFile}):h('p',null,'No interface has been generated in this session yet.'));
}
export function focusUi(id,sessionId){focused.set(sessionId,id);notifyUi()}
