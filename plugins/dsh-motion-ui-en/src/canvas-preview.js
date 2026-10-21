import {canvasSource} from '../lib/canvas-source.js';
import React,{useEffect,useMemo,useRef,useState}from'react';
import{previewFrameDocument}from'../lib/canvas-preview.js';
const h=React.createElement;
export function CanvasPreview({node}){
  const [height,setHeight]=useState(node.height??420);
  const frame=useRef(null),latest=useRef(node);latest.current=node;
  const config=useMemo(()=>{const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');return{channel:token(),nonce:token()}},[]);
  const srcDoc=useMemo(()=>previewFrameDocument(config.channel,config.nonce),[config]);
  const publish=()=>{const el=frame.current;if(!el)return;const css=getComputedStyle(el.closest('.dgui-root')??el.parentElement);const theme=Object.fromEntries(['bg','soft','ink','muted','line','accent'].map(k=>[k,css.getPropertyValue('--du-'+k).trim()]));theme.scheme=document.body.hasAttribute('data-ds-dark-theme')||el.closest('[data-preview-theme=dark]')?'dark':'light';el.contentWindow?.postMessage({channel:config.channel,html:canvasSource(latest.current).html,css:canvasSource(latest.current).css,theme},'*')};
  useEffect(()=>{const timer=setTimeout(publish,120);return()=>clearTimeout(timer)},[node]);
  useEffect(()=>{const observer=new MutationObserver(publish);observer.observe(document.body,{attributes:true});return()=>observer.disconnect()},[]);
  useEffect(()=>{const receive=event=>{const m=event.data;if(event.source===frame.current?.contentWindow&&m?.channel===config.channel&&Number.isFinite(m.previewHeight)&&m.previewHeight>=0)setHeight(Math.max(32,Math.min(1000,Math.ceil(m.previewHeight))))};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive)},[config]);
  return h('section',{className:'dgui-canvas','data-canvas-phase':'preview','aria-label':node.title},h('p',{className:'dgui-copy',role:'status'},'Generated preview · Interaction enabled after the reply'),h('iframe',{ref:frame,title:node.title+' (static preview)',sandbox:'allow-scripts',referrerPolicy:'no-referrer',srcDoc,onLoad:publish,style:{display:'block',width:'100%',height,border:0,pointerEvents:'none'}}));
}
