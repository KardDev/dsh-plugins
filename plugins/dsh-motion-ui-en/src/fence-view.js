import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {extractUiFences} from '../lib/fences.js';
import {parsePartialGenuiSpec} from '../lib/visual-guard.js';
import {validateDocument} from '../lib/protocol.js';
import {UiView,UiBoundary} from './view.js';
import {rememberUi} from './presentation-store.js';
import {resolveSourceFence} from '../lib/delivery.js';
const h=React.createElement,roots=new WeakMap();
function FenceContent({document,sessionId,source,settled,sendPrompt}){
 const[record,setRecord]=useState(),[error,setError]=useState('');
 useEffect(()=>{if(!settled)return;let active=true;fetch('/api/plugins/dsh-generative-ui/fence',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({document,sessionId,source})}).then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error||'Failed to save interface');if(active){rememberUi(v,sessionId,sendPrompt);setRecord(v)}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[document,sessionId,source,settled]);
 return h(UiBoundary,{fallback:document.fallback},h(UiView,{record:record??{document,documentId:'fence-preview-'+source},sessionId,sendPrompt,preview:!record,replaceExportedCanvases:true}),error&&h('p',{role:'alert'},error));
}
function candidates(state){
 const steps=new Map();for(const b of state.blocks){if(!steps.has(b.step))steps.set(b.step,[]);steps.get(b.step).push(b)}
 const all=[];for(const[step,blocks]of steps){const text=blocks.sort((a,b)=>a.index-b.index).map(b=>b.text).join('\n');for(const[fence,index]of extractUiFences(text).map((f,i)=>[f,i])){
  // UUID markers belong to PresentationView, never to the source renderer.
  let spec;try{if(state.settled){const result=resolveSourceFence(fence.raw,{svg:fence.language==='svg'});if(result.marker)continue;all.push({key:`${state.turn}:${step}:${index}`,raw:fence.raw,document:result.document,error:result.valid?undefined:result.diagnostics.map(d=>d.message).join('; ')});continue}spec=fence.language==='svg'?fence.complete?{items:[{type:'svg',title:'SVG',code:fence.raw}]}:null:parsePartialGenuiSpec(fence.raw);if(!spec)continue;const document=validateDocument(spec);all.push({key:`${state.turn}:${step}:${index}`,raw:fence.raw,document})}catch{/* invalid prefixes remain source until final diagnostics */}
 }}return all;
}
function dispose(e){if(e.disposed)return;e.disposed=true;clearTimeout(e.timer);e.observer.disconnect();for(const v of e.views.values()){if(v.block)v.block.style.display=v.display;v.host.remove();queueMicrotask(()=>v.root.unmount())}e.views.clear();e.entries.delete(e.key)}
export function FenceNodeView({node,sessionId,sendPrompt}){
 const anchor=useRef(null),state=node.data;
 useLayoutEffect(()=>{
  const scroll=anchor.current?.closest('[data-conversation-scroll]');if(!scroll)return;let entries=roots.get(scroll);if(!entries){entries=new Map();roots.set(scroll,entries)}for(const e of entries.values())if(e.sessionId!==sessionId)dispose(e);
  const key=sessionId+':'+state.turn;let e=entries.get(key);if(!e){e={key,entries,sessionId,url:location.href,views:new Map(),scroll,seat:anchor.current.closest('[data-chat-turn]')??anchor.current};entries.set(key,e);e.scan=()=>{
    if(e.disposed)return;if(location.href!==e.url||!scroll.isConnected){dispose(e);return}
    const current=candidates(e.state),keys=new Set(current.map(c=>c.key));
    for(const[k,v]of e.views)if(e.state.settled&&!keys.has(k)||(e.state.invalidated??[]).includes(Number(k.split(':')[1]))&&!keys.has(k)){if(v.block)v.block.style.display=v.display;v.host.remove();queueMicrotask(()=>v.root.unmount());e.views.delete(k)}
    for(const candidate of current){
     let v=e.views.get(candidate.key);if(!v){const host=document.createElement('div');host.dataset.motionFence=candidate.key;(e.seat.isConnected?e.seat:scroll.lastElementChild??scroll).after(host);v={host,root:createRoot(host)};e.views.set(candidate.key,v)}
     const fingerprint=JSON.stringify(candidate.document)+':'+candidate.error+':'+e.state.settled;
     if(v.fingerprint!==fingerprint){v.fingerprint=fingerprint;v.root.render(candidate.error?h('p',{className:'dgui-tool-error',role:'alert'},'Interface incomplete: '+candidate.error):h(FenceContent,{document:candidate.document,source:candidate.key,sessionId,settled:e.state.settled,sendPrompt:e.sendPrompt}))}
     const block=[...scroll.querySelectorAll('div.md-code-block,.code-block,.code-block-small,pre')].find(b=>!b.closest('[data-dsh-generative-ui]')&&String(b.closest('[data-chat-turn]')?.dataset.chatTurn)===String(e.state.turn)&&(b.querySelector('code')?.textContent??b.querySelector('pre')?.textContent??(b.matches('pre')?b.textContent:'')).trim()===candidate.raw.trim());
     if(block){if(v.block!==block){if(v.block)v.block.style.display=v.display;v.block=block;v.display=block.style.display}if(e.state.settled&&v.host.nextSibling!==block)block.before(v.host);if(block.style.display!=='none')block.style.display='none'}
    }
   };e.queue=()=>{if(!e.timer&&!e.disposed)e.timer=setTimeout(()=>{e.timer=null;e.scan()},120)};e.observer=new MutationObserver(e.queue);e.observer.observe(document.body,{subtree:true,childList:true,characterData:true});}
  e.state=state;e.sendPrompt=sendPrompt;e.queue();
 },[state,sessionId,sendPrompt]);
 return h('span',{ref:anchor,hidden:true});
}
