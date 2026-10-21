import React,{useEffect,useRef,useState} from 'react';
import {Icon} from './icons.js';
import {recordNativeGeometry} from './host-boundary.js';
const h=React.createElement;
export async function copyContent(text){
 try{if(typeof navigator.clipboard?.writeText==='function'){await navigator.clipboard.writeText(text);return true}}catch{/* Fall back for older or insecure hosts. */}
 const active=document.activeElement,selection=window.getSelection(),ranges=selection?Array.from({length:selection.rangeCount},(_,i)=>selection.getRangeAt(i).cloneRange()):[];
 const field=document.createElement('textarea');field.value=text;field.readOnly=true;field.style.cssText='position:fixed;left:-10000px;top:0;opacity:0';document.body.append(field);
 try{field.select();return document.execCommand('copy')===true}catch{return false}finally{field.remove();active?.focus?.({preventScroll:true});if(selection){selection.removeAllRanges();for(const range of ranges)try{selection.addRange(range)}catch{}}}
}
export const COPY_BLOCK_CSS=recordNativeGeometry(`
.motion-copy-block{position:relative;min-width:0;border:1px solid var(--du-line,var(--dsw-alias-border-default,#ddd));border-radius:24px;padding:18px 22px;color:var(--du-ink,var(--dsw-alias-label-primary,inherit));background:var(--du-bg,var(--dsw-alias-bg-layer-1,transparent));overflow:hidden;margin:8px 0}
.motion-copy-block[data-code]{background:var(--du-soft,var(--dsw-alias-bg-layer-2,#8881))}
.motion-copy-bar{display:flex;align-items:center;gap:10px;min-height:30px;margin-bottom:12px;color:var(--du-muted,var(--dsw-alias-label-secondary,#888));font-size:14px;line-height:1.4}
.motion-copy-title{flex:1;min-width:0;overflow-wrap:anywhere}.motion-copy-button{display:inline-flex!important;align-items:center;justify-content:center;flex:none;width:32px;height:32px;padding:6px!important;border:0!important;border-radius:10px!important;background:transparent!important;color:inherit;font:inherit;cursor:pointer;margin-left:auto}
.motion-copy-button:hover{background:var(--du-line,#8882)!important;color:var(--du-ink,inherit)}.motion-copy-button:focus-visible{outline:2px solid var(--du-accent,#508bff);outline-offset:2px}.motion-copy-button:disabled{opacity:.45;cursor:default}.motion-copy-button[data-status=done]{color:var(--du-green,#17995a)}.motion-copy-button[data-status=error]{color:var(--du-red,#d54b5b)}
.motion-copy-body{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.8}.motion-copy-code{margin:0!important;padding:0!important;border:0!important;background:transparent!important;overflow:auto;white-space:pre!important;tab-size:2;font:14px/1.75 ui-monospace,SFMono-Regular,Consolas,monospace}.motion-copy-code[data-wrap]{white-space:pre-wrap!important;overflow-wrap:anywhere}.motion-copy-code code{font:inherit!important;background:none!important;padding:0!important;color:inherit!important}.motion-copy-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.motion-copy-button[data-status=done] .dgui-icon{animation:motion-copy-confirm 420ms cubic-bezier(.34,1.45,.64,1)}.motion-copy-button[data-status=done] path{stroke-dasharray:28;animation:motion-check-draw 450ms ease-out}@keyframes motion-check-draw{from{stroke-dashoffset:28}to{stroke-dashoffset:0}}@keyframes motion-copy-confirm{from{opacity:.5;transform:scale(.8)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.motion-copy-button .dgui-icon,.motion-copy-button path{animation:none!important;transition:none!important}}
@media(max-width:600px){.motion-copy-block{padding:14px 16px;border-radius:20px}}
`);
export function CopyBlock({text,children,title,lang,code=false,wrap=false,disabled=false,style,nodeId,copyLabel,copiedLabel}){
 const[status,setStatus]=useState('idle'),timer=useRef();useEffect(()=>()=>clearTimeout(timer.current),[]);
 const label=status==='done'?(copiedLabel??'Copied'):status==='error'?'Copy failed. Select the content manually.':copyLabel??(code?'Copy code':'Copy text');
 async function copy(){clearTimeout(timer.current);setStatus('copying');const ok=await copyContent(text);setStatus(ok?'done':'error');timer.current=setTimeout(()=>setStatus('idle'),2000)}
 return h('section',{className:'motion-copy-block','data-copy-status':status,'data-code':code||undefined,'data-ui-node':nodeId,style},h('style',null,COPY_BLOCK_CSS),h('div',{className:'motion-copy-bar'},code&&h('span',{'aria-hidden':true},'〈/〉'),h('span',{className:'motion-copy-title'},title??(code?lang||'Code':'Text')),h('button',{className:'motion-copy-button',type:'button',title:label,'aria-label':label,'data-status':status,disabled:disabled||status==='copying',onClick:copy},h(Icon,{name:status==='done'?'check':status==='error'?'warning':'copy'})),h('span',{className:'motion-copy-sr',role:'status','aria-live':'polite'},status==='done'?'Copied to clipboard':status==='error'?label:'')),code?h('pre',{className:'motion-copy-code','data-wrap':wrap||undefined},h('code',{'data-language':lang},text)):h('div',{className:'motion-copy-body'},children??text));
}
