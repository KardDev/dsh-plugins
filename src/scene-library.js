import React,{useState} from 'react';
import {SCENES} from '../lib/scene-library.js';
import {validateDocument} from '../lib/protocol.js';
import {UiView} from './view.js';
const h=React.createElement;
export function SceneLibrary(){const[open,setOpen]=useState(false),[selected,select]=useState('brief'),[status,setStatus]=useState('');const scene=SCENES.find(s=>s.id===selected);
 return h('section',{'aria-label':'场景案例库'},h('h4',null,'场景案例库'),h('p',null,'按用途预览短案例。案例展示结构，生成时会适配当前引导风格；控件在此处只作预览。'),h('button',{className:'dgui-secondary',type:'button','aria-expanded':open,onClick:()=>setOpen(!open)},open?'收起案例':'浏览案例'),open&&h(React.Fragment,null,h('div',{className:'dgui-row dgui-scene-choices',role:'group','aria-label':'选择案例'},SCENES.map(s=>h('button',{className:'dgui-secondary',key:s.id,type:'button','aria-pressed':s.id===selected,onClick:()=>{select(s.id);setStatus('')}},s.name))),h(UiView,{key:selected,record:{documentId:'scene-'+selected,document:validateDocument(scene.spec)},sessionId:'scene-preview',preview:true}),h('button',{className:'dgui-secondary',type:'button',onClick:async()=>{try{await navigator.clipboard.writeText(scene.prompt);setStatus('需求已复制，可以修改后发给模型。')}catch{setStatus('复制不可用，请复制下面的需求。')}}},'复制案例需求'),h('p',null,scene.prompt),status&&h('p',{role:'status'},status)));
}
