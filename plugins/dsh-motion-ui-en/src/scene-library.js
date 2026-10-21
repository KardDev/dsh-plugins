import React,{useState} from 'react';
import {SCENES} from '../lib/scene-library.js';
import {validateDocument} from '../lib/protocol.js';
import {UiView} from './view.js';
const h=React.createElement;
export function SceneLibrary(){const[open,setOpen]=useState(false),[selected,select]=useState('brief'),[status,setStatus]=useState('');const scene=SCENES.find(s=>s.id===selected);
 return h('section',{'aria-label':'Scene library'},h('h4',null,'Scene library'),h('p',null,'Preview short examples by purpose. Examples show structure and adapt to the current guided style at generation time; controls here are preview only.'),h('button',{className:'dgui-secondary',type:'button','aria-expanded':open,onClick:()=>setOpen(!open)},open?'Collapse examples':'Browse examples'),open&&h(React.Fragment,null,h('div',{className:'dgui-row dgui-scene-choices',role:'group','aria-label':'Choose an example'},SCENES.map(s=>h('button',{className:'dgui-secondary',key:s.id,type:'button','aria-pressed':s.id===selected,onClick:()=>{select(s.id);setStatus('')}},s.name))),h(UiView,{key:selected,record:{documentId:'scene-'+selected,document:validateDocument(scene.spec)},sessionId:'scene-preview',preview:true}),h('button',{className:'dgui-secondary',type:'button',onClick:async()=>{try{await navigator.clipboard.writeText(scene.prompt);setStatus('Prompt copied. You can edit it before sending it to the model.')}catch{setStatus('Copy is unavailable. Copy the prompt below.')}}},'Copy example prompt'),h('p',null,scene.prompt),status&&h('p',{role:'status'},status)));
}
