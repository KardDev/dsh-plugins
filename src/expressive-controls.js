import React,{useEffect,useRef,useState} from 'react';
import {Icon} from './icons.js';
const h=React.createElement;
// Reference: Lucian UX/UI Prompt #002 / #013 / #018 (MIT, Seokwoooo).
// Host actions and state remain Motion UI's; no simulated success is carried over.
export function ExpressiveAction({tag='button',text,icon='arrow',...props}){
 const ref=useRef(null);
 function move(e){if(matchMedia('(prefers-reduced-motion: reduce)').matches||props.disabled)return;const box=e.currentTarget.getBoundingClientRect();e.currentTarget.style.setProperty('--du-mx',((e.clientX-box.left-box.width/2)*.035)+'px');e.currentTarget.style.setProperty('--du-my',((e.clientY-box.top-box.height/2)*.07)+'px')}
 function leave(e){e.currentTarget.style.setProperty('--du-mx','0px');e.currentTarget.style.setProperty('--du-my','0px')}
 return h(tag,{...props,ref,'aria-label':text,className:(props.className??'')+' dgui-expressive-action',onPointerMove:move,onPointerLeave:leave},h('span',{className:'dgui-action-fill','aria-hidden':true}),h('span',{className:'dgui-action-label','aria-hidden':true},h('span',null,text),h('span',null,text)),h('span',{className:'dgui-action-orb','aria-hidden':true},h(Icon,{name:icon})));
}
export function ElasticToggle({id,checked,disabled,onChange}){
 const[stretch,setStretch]=useState(false),timer=useRef(),drag=useRef(null),skip=useRef(false);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 function change(value){onChange(value);clearTimeout(timer.current);setStretch(true);timer.current=setTimeout(()=>setStretch(false),260)}
 function end(e,cancel=false){const d=drag.current;drag.current=null;e.currentTarget.style.removeProperty('--du-drag');if(!d||!d.moved)return;if(!cancel){skip.current=true;setTimeout(()=>{skip.current=false},0);change(d.x>17)}setStretch(false)}
 return h('input',{id,type:'checkbox',checked,disabled,className:'dgui-toggle dgui-elastic'+(stretch?' is-stretch':''),onChange:e=>{if(skip.current){skip.current=false;return}change(e.target.checked)},onClick:e=>{if(skip.current)e.preventDefault()},onPointerDown:e=>{if(disabled||e.button!==0)return;drag.current={start:e.clientX,base:checked?34:0,x:checked?34:0,moved:false};e.currentTarget.setPointerCapture(e.pointerId)},onPointerMove:e=>{const d=drag.current;if(!d)return;const dx=e.clientX-d.start;if(Math.abs(dx)>4)d.moved=true;if(d.moved){d.x=Math.max(0,Math.min(34,d.base+dx));e.currentTarget.style.setProperty('--du-drag',d.x+'px')}},onPointerUp:e=>end(e),onPointerCancel:e=>end(e,true)});
}
export function Stepper({value,spec,label,disabled,onChange,children}){
 const step=direction=>onChange(Math.max(spec.min,Math.min(spec.max,Number((value+direction*spec.step).toPrecision(15)))));
 return h('div',{className:'dgui-stepper'},h('button',{type:'button',disabled:disabled||value<=spec.min,'aria-label':'减少'+label,onClick:()=>step(-1)},'−'),children,h('button',{type:'button',disabled:disabled||value>=spec.max,'aria-label':'增加'+label,onClick:()=>step(1)},'+'));
}
export const EXPRESSIVE_CSS=`
.dgui-root .dgui-expressive-action[data-variant=primary]{position:relative;isolation:isolate;overflow:hidden;gap:14px;padding:8px 8px 8px 20px!important;min-height:48px;font-size:inherit;font-weight:700;translate:calc(var(--du-mx,0px) * var(--du-motion-gain,1)) calc(var(--du-my,0px) * var(--du-motion-gain,1));transition:translate .7s cubic-bezier(.34,1.45,.64,1),box-shadow .5s,transform .4s}
.dgui-action-fill{display:none}.dgui-root .dgui-expressive-action[data-variant=primary] .dgui-action-fill{display:block;position:absolute;inset:0;z-index:-1;background:var(--du-motion-fill,linear-gradient(115deg,var(--du-accent),color-mix(in srgb,var(--du-accent) 65%,#202832)));clip-path:circle(21px at calc(100% - 29px) 50%);transition:clip-path .7s cubic-bezier(.2,.8,.2,1)}
.dgui-action-label{display:block;position:relative;overflow:hidden;line-height:1.5;padding:3px 0}.dgui-action-label>span{display:block;transition:transform var(--du-label-ms,550ms) cubic-bezier(.34,1.45,.64,1),opacity .3s}.dgui-action-label>span+span{position:absolute;left:0;top:3px;transform:translateY(130%);opacity:0}
.dgui-root .dgui-expressive-action[data-variant=primary]:is(:hover,:focus-visible):not(:disabled){color:#fff;box-shadow:0 20px 36px -20px color-mix(in srgb,var(--du-accent) 45%,transparent)}
.dgui-root .dgui-expressive-action[data-variant=primary]:is(:hover,:focus-visible):not(:disabled) .dgui-action-fill{clip-path:circle(160% at calc(100% - 29px) 50%)}
.dgui-expressive-action:is(:hover,:focus-visible):not(:disabled) .dgui-action-label>span:first-child{transform:translateY(-130%);opacity:0}.dgui-expressive-action:is(:hover,:focus-visible):not(:disabled) .dgui-action-label>span+span{transform:none;opacity:1}
.dgui-action-orb{width:var(--du-orb-size,42px);height:var(--du-orb-size,42px);border-radius:var(--du-orb-radius,50%);display:grid;place-items:center;background:var(--du-motion-orb,var(--du-accent));color:#fff;flex:none}.dgui-action-orb .dgui-icon{width:20px;height:20px;transition:transform .6s cubic-bezier(.34,1.45,.64,1)}.dgui-expressive-action:hover .dgui-action-orb .dgui-icon{transform:translateX(3px)}
.dgui-expressive-action:not([data-variant=primary]) .dgui-action-orb{width:20px;height:20px;background:transparent;color:inherit;border-radius:0}.dgui-expressive-action:not([data-variant=primary]) .dgui-action-orb .dgui-icon{width:16px;height:16px}
.dgui-root .dgui-elastic{position:relative;flex:none;width:78px;height:44px;border:0;border-radius:var(--du-action-radius,999px);background:var(--du-line);box-shadow:inset 0 2px 5px #0002;touch-action:none}
.dgui-root .dgui-elastic:before{left:6px;top:6px;width:32px;height:32px;background:white;box-shadow:0 4px 10px #0003;transform:translateX(var(--du-drag,0px));transition:transform .5s cubic-bezier(.34,1.45,.64,1),width .25s cubic-bezier(.2,.8,.2,1)}
.dgui-root .dgui-elastic:after{content:'×';position:absolute;left:6px;top:6px;width:32px;height:32px;display:grid;place-items:center;color:#8c8795;font-size:21px;font-weight:700;transform:translateX(var(--du-drag,0px));transition:transform .5s cubic-bezier(.34,1.45,.64,1)}
.dgui-root .dgui-elastic:checked{background:var(--du-motion-fill,var(--du-accent));box-shadow:inset 0 1px 3px #0001,0 10px 20px -12px #14b8a688}
.dgui-root .dgui-elastic:checked:before,.dgui-root .dgui-elastic:checked:after{transform:translateX(var(--du-drag,34px))}.dgui-root .dgui-elastic:checked:after{content:'✓';color:var(--du-accent)}
.dgui-root .dgui-elastic.is-stretch:before{width:44px}.dgui-root .dgui-elastic.is-stretch:checked:before{transform:translateX(22px)}
.dgui-stepper{display:flex;align-items:center;gap:4px;padding:5px;border:1px solid var(--du-line);border-radius:var(--du-radius-inner,20px);background:var(--du-bg);box-shadow:0 12px 24px -20px #30204d60}
.dgui-root .dgui-stepper>button{width:40px;height:40px;flex:none;border:0;border-radius:50%;background:var(--du-soft);color:var(--du-ink);font:600 24px/1 system-ui;cursor:pointer;transition:transform .35s cubic-bezier(.34,1.45,.64,1)}.dgui-root .dgui-stepper>button:last-child{background:var(--du-ink);color:var(--du-bg)}.dgui-stepper>button:active:not(:disabled){transform:scale(.85)}.dgui-stepper>button:disabled{opacity:.35;cursor:default}
.dgui-root .dgui-stepper input{width:84px!important;text-align:center;border:0!important;background:transparent!important;font-size:23px!important;font-weight:700;padding:4px!important}
.dgui-stepper input::-webkit-inner-spin-button,.dgui-stepper input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
@media(prefers-reduced-motion:reduce){.dgui-root .dgui-expressive-action,.dgui-root .dgui-expressive-action *,.dgui-root .dgui-elastic,.dgui-root .dgui-elastic:before,.dgui-root .dgui-elastic:after,.dgui-root .dgui-stepper button{transition:none!important;animation:none!important;translate:none!important}.dgui-root .dgui-elastic.is-stretch:before{width:32px}.dgui-root .dgui-elastic.is-stretch:checked:before{transform:translateX(34px)}}
`;
