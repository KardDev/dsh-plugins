import {previewMechanism} from '../lib/mechanism-entry.js';
import React,{useLayoutEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {previewDocument,previewCanvas,previewText} from '../lib/stream.js';
import {UiView,UiBoundary} from './view.js';
import {CanvasPreview} from './canvas-preview.js';
const h=React.createElement,roots=new WeakMap();
export function StreamNodeView({node,sessionId}){return h(StreamSurface,{stream:node.data,sessionId})}
function dispose(entry){if(entry.disposed)return;entry.disposed=true;clearTimeout(entry.timer);entry.observer.disconnect();entry.host.remove();entry.entries.delete(entry.key);queueMicrotask(()=>entry.root.unmount())}
function publish(entry,calls,invalidated=[]){
  // Live overlays can temporarily omit an earlier call during durable rebase.
  // Absence is not failure: retire previews only on an explicit invalidation.
  for(const key of invalidated)entry.previews.delete(key);
  for(const call of calls){
    const doc=call.name==='render_mechanism'?previewMechanism(call.raw):call.name==='render_text'?previewText(call.raw):previewDocument(call.raw);
    const canvas=call.name==='render_canvas'?previewCanvas(call.raw):null;
    if(doc||canvas)entry.previews.set(call.callId,{call,doc,canvas});
  }
  entry.root.render(h(React.Fragment,null,[...entry.previews.values()].map(({call,doc,canvas})=>h(UiBoundary,{key:call.callId,fallback:doc?.fallback??canvas?.fallback},
    doc?h(UiView,{record:{document:doc,documentId:`preview-${call.callId}`},sessionId:entry.sessionId,preview:true}):h('div',{className:'dgui-root','data-preview':true},h(CanvasPreview,{node:canvas}))))));
}
// The independent preview root is a sibling of the Host's chat rows, never a
// child of a tool card or turn-tail seat. Subsequent reasoning can replace
// those seats without unmounting the preview iframe. No generated scripts run.
export function StreamSurface({stream,sessionId,committedIds=[]}){
  const anchor=useRef(null);
  useLayoutEffect(()=>{
    const scroll=anchor.current?.closest('[data-conversation-scroll]');if(!scroll)return;
    let entries=roots.get(scroll);if(!entries){entries=new Map();roots.set(scroll,entries)}
    for(const previous of entries.values())if(previous.sessionId!==sessionId)dispose(previous);
    const key=`${sessionId}:${stream.turn}`;let entry=entries.get(key);
    if(stream.settled){
      if(entry){
        clearTimeout(entry.timer);entry.timer=null;
        entry.finishing=()=>{
          const surfaces=[...scroll.querySelectorAll('[data-dsh-generative-ui]')].filter(el=>committedIds.includes(el.dataset.dshGenerativeUi)&&!el.hasAttribute('data-preview'));
          if(!committedIds.length||surfaces.length===committedIds.length&&surfaces.every(el=>!el.querySelector('[data-canvas-phase=loading]')))dispose(entry);
        };
        entry.finishing();
      }
      return;
    }
    if(!entry&&stream.calls.length){
      const seat=anchor.current.closest('[data-chat-turn]')??anchor.current;
      const host=document.createElement('div');host.dataset.dguiStreamTurn=String(stream.turn);seat.after(host);
      entry={key,entries,host,root:createRoot(host),previews:new Map(),sessionId,url:location.href,timer:null,latest:stream.calls};
      entry.observer=new MutationObserver(()=>{if(!host.isConnected||location.href!==entry.url)dispose(entry);else entry.finishing?.()});
      entry.observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-canvas-phase']});entries.set(key,entry);
    }
    if(!entry)return;entry.latest=stream.calls;entry.invalidated=stream.invalidated;
    // Throttle, rather than debounce: a continuous token stream must still paint.
    if(!entry.timer)entry.timer=setTimeout(()=>{entry.timer=null;publish(entry,entry.latest,entry.invalidated)},120);
    // Intentionally no seat cleanup: the conversation DOM owns this root.
  },[stream,sessionId]);
  return h('span',{ref:anchor,hidden:true});
}
