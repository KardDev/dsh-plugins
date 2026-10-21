import React,{useId,useState} from 'react';
import {VISUAL_STYLES} from '../lib/visual-styles.js';
const h=React.createElement;
export const PREVIEW_LAYOUTS=[['text','Text'],['comparison','Comparison'],['list','Separated list'],['summary','Data summary'],['controls','Controls form'],['flow','Flow diagram']];
const header=text=>h('div',{className:'dgui-header'},h('strong',{className:'dgui-header-title'},text));
const copy=text=>h('p',{className:'dgui-copy'},text);
const card=(title,text)=>h('div',{key:title,className:'dgui-card'},h('strong',{className:'dgui-section-title'},title),copy(text));
const metric=(number,label)=>h('div',{key:label,className:'dgui-metric'},h('span',{className:'dgui-metric-label'},label),h('strong',null,number));
// Inert semantic samples share production component CSS. No button, input,
// clipboard request or state controller is mounted inside the selection radio.
export function StyleSample({styleId,layout='text'}){
 let body,title;
 if(layout==='text'){
  title='Ship a usable version first';const content=h('div',{className:'dgui-column'},copy('Narrow the goal; get the core experience right.'),h('p',{className:'dgui-copy dgui-sample-note'},'Validate first, then refine.'));
  body=styleId==='soft'?card('Today’s focus', 'Narrow the goal; get the core experience right.'):content;
  if(styleId==='soft')body=h(React.Fragment,null,body,h('p',{className:'dgui-copy dgui-sample-note'},'Validate first, then refine.'));
 }else if(layout==='comparison'){
  title='Two ways to proceed';body=h('div',{className:'dgui-row'},card('Small version first','Validate the core'),card('Full feature set first','Cover requirements'));
 }else if(layout==='summary'){
  title='Make the point visible at a glance';body=h('div',{className:'dgui-row'},metric('3','Stage'),metric('1','Core goal'));
 }else if(layout==='controls'){
  title='Let the numbers speak';body=h('div',{className:'dgui-column'},h('div',{className:'dgui-control'},h('span',{className:'dgui-control-label'},'Weekly effort'),h('output',null,'12 hours'),h('span',{className:'dgui-sample-track'},h('i'))),h('div',{className:'dgui-sample-options'},['Light','Balanced','Deep'].map((t,i)=>h('span',{key:t,'data-selected':i===1||undefined},t))));
 }else{
  title='Explain a complex problem';body=h('ol',{className:'dgui-steps','data-sample-layout':layout},['Clarify the goal','Show the relationship','Give the next step'].map((text,i)=>h('li',{key:text},h('span',{className:'dgui-step-dot'},layout==='list'?'✓':String(i+1).padStart(2,'0')),h('div',null,h('strong',null,text),layout==='list'&&h('p',null,['Start with the core','Explain with a diagram','End on a next step'][i])))));
 }
 return h('div',{className:'dgui-root dgui-style-preview','data-preset':'brief','data-visual-style':styleId,'data-layout':layout,'aria-hidden':true},header(title),h('div',{className:'dgui-content'},body));
}
export function StyleOptions({value,disabled,onChange}){
 const[layout,setLayout]=useState('text'),id=useId();
 return h('div',null,h('div',{className:'dgui-preview-tabs',role:'tablist','aria-label':'Layout preview'},PREVIEW_LAYOUTS.map(([key,label],i)=>h('button',{key,type:'button',role:'tab',id:id+'-'+key,'aria-selected':layout===key,'aria-controls':id+'-panel',tabIndex:layout===key?0:-1,onClick:()=>setLayout(key),onKeyDown:e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?PREVIEW_LAYOUTS.length-1:(i+(e.key==='ArrowLeft'?-1:1)+PREVIEW_LAYOUTS.length)%PREVIEW_LAYOUTS.length;setLayout(PREVIEW_LAYOUTS[n][0]);e.currentTarget.parentElement.children[n].focus()}},label))),
 h('div',{role:'tabpanel',id:id+'-panel','aria-labelledby':id+'-'+layout},h('div',{className:'dgui-style-options',role:'radiogroup','aria-label':'Visual style'},VISUAL_STYLES.map((s,i)=>h('button',{key:s.id,type:'button',role:'radio','aria-checked':value===s.id,'aria-label':s.name,disabled,tabIndex:value===s.id?0:-1,className:'dgui-style-option','data-style':s.id,onClick:()=>onChange(s.id),onKeyDown:e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?VISUAL_STYLES.length-1:(i+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)+VISUAL_STYLES.length)%VISUAL_STYLES.length;e.currentTarget.parentElement.children[n].focus();onChange(VISUAL_STYLES[n].id)}},h(StyleSample,{styleId:s.id,layout}),h('div',{className:'dgui-style-name'},s.name,h('span',{'aria-hidden':true},value===s.id?'✓':'')),h('div',{className:'dgui-style-description'},s.description))))));
}
export const STYLE_SETTINGS_CSS=`
.dgui-settings .dgui-style-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:12px 0 16px}
.dgui-settings .dgui-preview-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 8px}
.dgui-settings .dgui-preview-tabs button{font:inherit;font-size:13px;padding:7px 12px;border:1px solid var(--ui-line,#d4dce5);border-radius:999px;background:transparent;color:inherit;cursor:pointer}
.dgui-settings .dgui-preview-tabs button[aria-selected=true]{background:var(--du-tint,#eaf2ff);color:var(--du-accent,#244e8d);border-color:var(--du-accent,#a7c3ed)}
.dgui-settings .dgui-preview-tabs button:focus-visible{outline:3px solid #6da7e8;outline-offset:2px}
.dgui-settings .dgui-style-option{appearance:none;min-width:0;text-align:left;padding:10px;border:1px solid var(--ui-line,#d4dce5);border-radius:18px;background:transparent;color:inherit;cursor:pointer;font:inherit;overflow:hidden}
.dgui-settings .dgui-style-option[aria-checked=true]{border-color:#467bd1;box-shadow:0 0 0 1px #467bd1}
.dgui-settings .dgui-style-option:focus-visible{outline:3px solid #6da7e8;outline-offset:3px}.dgui-settings .dgui-style-option:disabled{cursor:default;opacity:.6}
.dgui-settings .dgui-style-preview.dgui-root[data-preset][data-visual-style]{--du-style-scale:.72;margin:0;min-height:210px;padding:16px;pointer-events:none;user-select:none;font-size:13px;box-sizing:border-box;overflow:hidden}
.dgui-settings .dgui-style-preview.dgui-root[data-preset][data-visual-style] .dgui-header{margin-bottom:14px}
.dgui-settings .dgui-style-preview.dgui-root[data-preset][data-visual-style] .dgui-row{gap:10px;flex-wrap:nowrap}
.dgui-settings .dgui-style-preview.dgui-root[data-preset][data-visual-style] .dgui-row>*{flex-basis:0;min-width:0}
.dgui-settings .dgui-style-preview.dgui-root[data-preset][data-visual-style] .dgui-card{padding:12px;gap:8px}
.dgui-settings .dgui-style-preview.dgui-root[data-preset][data-visual-style] .dgui-metric{padding:12px;gap:6px}
.dgui-settings .dgui-style-preview.dgui-root[data-preset][data-visual-style] .dgui-steps{gap:7px;margin-top:0}
.dgui-settings .dgui-style-preview.dgui-root[data-preset][data-visual-style] .dgui-steps li{padding:8px 10px;gap:10px}
.dgui-settings .dgui-style-preview.dgui-root[data-preset][data-visual-style] .dgui-steps p{font-size:11px}
.dgui-settings .dgui-style-preview.dgui-root[data-preset][data-visual-style] .dgui-control{padding:10px;gap:8px}
.dgui-settings .dgui-style-preview.dgui-root[data-preset][data-visual-style] .dgui-control-label{font-size:13px;flex:1}
.dgui-settings .dgui-style-preview.dgui-root[data-preset][data-visual-style] .dgui-control output{min-width:0;font-size:13px;padding:3px 7px}
.dgui-settings .dgui-style-preview.dgui-root[data-preset][data-visual-style] .dgui-step-dot{width:24px;height:24px;font-size:12px;margin-left:0}
.dgui-settings .dgui-style-preview.dgui-root[data-preset][data-visual-style=editorial]{border:0;border-radius:0;background:var(--du-bg)}
.dgui-settings .dgui-style-preview.dgui-root[data-preset][data-visual-style=editorial] .dgui-card{padding:8px 0}
.dgui-settings .dgui-style-preview.dgui-root[data-preset][data-visual-style=editorial] .dgui-steps{border:0;margin-left:0}
.dgui-settings .dgui-style-preview.dgui-root[data-preset][data-visual-style=technical] .dgui-row:has(>.dgui-metric){gap:0}
.dgui-settings .dgui-style-preview.dgui-root[data-preset][data-visual-style=expressive] .dgui-step-dot{font-size:23px;width:30px}
.dgui-settings .dgui-style-preview.dgui-root[data-preset][data-visual-style=expressive] .dgui-metric:first-child{flex-grow:1.6}
.dgui-settings .dgui-style-preview.dgui-root[data-preset][data-visual-style=aurora] .dgui-card{border-radius:18px}
.dgui-sample-note{color:var(--du-muted)!important}.dgui-style-preview[data-visual-style=soft] .dgui-sample-note{padding-left:10px}.dgui-style-preview[data-visual-style=expressive] .dgui-sample-note{border-left:3px solid var(--du-accent);padding-left:10px}
.dgui-sample-track{width:100%;height:6px;border-radius:999px;display:block;background:var(--du-line);position:relative;margin:8px 0}.dgui-sample-track i{display:block;width:42%;height:100%;border-radius:inherit;background:var(--du-accent)}.dgui-sample-track i:after{content:'';position:absolute;width:15px;height:15px;left:calc(42% - 7px);top:-4.5px;border-radius:50%;background:var(--du-bg);border:3px solid var(--du-accent)}
.dgui-sample-options{display:flex;gap:6px}.dgui-sample-options span{flex:1;text-align:center;padding:5px 8px;border:1px solid var(--du-line);border-radius:var(--du-radius-inner);font-size:12px}.dgui-sample-options [data-selected]{background:var(--du-tint);color:var(--du-accent);font-weight:700}
.dgui-settings .dgui-style-name{display:flex;justify-content:space-between;gap:8px;font-size:15px;font-weight:700;margin:11px 2px 5px}.dgui-settings .dgui-style-name>span{color:#467bd1}
.dgui-settings .dgui-style-description{font-size:12px;line-height:1.6;margin:0 2px;opacity:.8}
@media(max-width:560px){.dgui-settings .dgui-style-options{grid-template-columns:1fr}}
`;
