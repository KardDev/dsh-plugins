import React,{useId,useState} from 'react';
import {VISUAL_STYLES} from '../lib/visual-styles.js';
const h=React.createElement;
export const PREVIEW_LAYOUTS=[['text','文字说明'],['comparison','双列对比'],['list','分隔列表'],['summary','数据摘要'],['flow','流程图解']];
function LayoutPreview({layout}){
 if(layout==='text')return h(React.Fragment,null,h('strong',null,'先交付一个可用版本'),h('p',{className:'dgui-preview-copy'},'把目标缩小，把关键体验做好。'),h('p',{className:'dgui-preview-note'},'先验证，再逐步完善。'));
 if(layout==='comparison')return h(React.Fragment,null,h('strong',null,'两种推进方式'),h('div',{className:'dgui-preview-grid'},[['先做小版本','验证重点'],['先铺全功能','覆盖需求']].map(([title,note],i)=>h('div',{key:title,className:'dgui-preview-panel'},h('span',null,'方案 '+(i?'B':'A')),h('b',null,title),h('em',null,note)))));
 if(layout==='summary')return h(React.Fragment,null,h('strong',null,'让重点一眼可见'),h('div',{className:'dgui-preview-grid'},[['3','推进阶段'],['1','核心目标']].map(([number,label])=>h('div',{key:label,className:'dgui-preview-panel'},h('span',null,label),h('b',{className:'dgui-preview-number'},number),h('i',null)))));
 return h(React.Fragment,null,h('strong',null,'把复杂问题讲清楚'),h('div',{className:'dgui-preview-grid'},['明确目标','解释关系','给出行动'].map((text,j)=>h('div',{key:text,className:'dgui-preview-panel'},h('span',null,layout==='list'?'✓':'0'+(j+1)),h('b',null,text),layout==='list'?h('em',null,['先抓住重点','用图形说明','收成下一步'][j]):h('i',null)))));
}
export function StyleOptions({value,disabled,onChange}){
 const [layout,setLayout]=useState('text'),id=useId();
 return h('div',null,h('div',{className:'dgui-preview-tabs',role:'tablist','aria-label':'排版预览'},PREVIEW_LAYOUTS.map(([key,label],i)=>h('button',{key,type:'button',role:'tab',id:id+'-'+key,'aria-selected':layout===key,'aria-controls':id+'-panel',tabIndex:layout===key?0:-1,onClick:()=>setLayout(key),onKeyDown:e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?PREVIEW_LAYOUTS.length-1:(i+(e.key==='ArrowLeft'?-1:1)+PREVIEW_LAYOUTS.length)%PREVIEW_LAYOUTS.length;setLayout(PREVIEW_LAYOUTS[n][0]);e.currentTarget.parentElement.children[n].focus()}},label))),
 h('div',{role:'tabpanel',id:id+'-panel','aria-labelledby':id+'-'+layout},h('div',{className:'dgui-style-options',role:'radiogroup','aria-label':'视觉风格'},VISUAL_STYLES.map((s,i)=>h('button',{key:s.id,type:'button',role:'radio','aria-checked':value===s.id,'aria-label':s.name,disabled,tabIndex:value===s.id?0:-1,className:'dgui-style-option','data-style':s.id,onClick:()=>onChange(s.id),onKeyDown:e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?VISUAL_STYLES.length-1:(i+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)+VISUAL_STYLES.length)%VISUAL_STYLES.length;e.currentTarget.parentElement.children[n].focus();onChange(VISUAL_STYLES[n].id)},style:{'--preview-bg':s.preview.bg,'--preview-ink':s.preview.ink,'--preview-accent':s.preview.accent,'--preview-soft':s.preview.soft,'--preview-line':s.preview.line}},
 h('div',{className:'dgui-style-preview','data-layout':layout,'aria-hidden':true},h(LayoutPreview,{layout})),
 h('div',{className:'dgui-style-name'},s.name,h('span',{'aria-hidden':true},value===s.id?'✓':'')),h('div',{className:'dgui-style-description'},s.description))))));
}
export const STYLE_SETTINGS_CSS=`
.dgui-settings .dgui-style-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:12px 0 16px}
.dgui-settings .dgui-preview-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 8px}
.dgui-settings .dgui-preview-tabs button{font:inherit;font-size:13px;padding:7px 12px;border:1px solid var(--ui-line,#d4dce5);border-radius:999px;background:transparent;color:inherit;cursor:pointer}
.dgui-settings .dgui-preview-tabs button[aria-selected=true]{background:#eaf2ff;color:#244e8d;border-color:#a7c3ed}
.dgui-settings .dgui-preview-tabs button:focus-visible{outline:3px solid #6da7e8;outline-offset:2px}
.dgui-settings .dgui-style-option{appearance:none;min-width:0;text-align:left;padding:10px;border:1px solid var(--ui-line,#d4dce5);border-radius:18px;background:transparent;color:inherit;cursor:pointer;font:inherit;overflow:hidden}
.dgui-settings .dgui-style-option[aria-checked=true]{border-color:#467bd1;box-shadow:0 0 0 1px #467bd1}
.dgui-settings .dgui-style-option:focus-visible{outline:3px solid #6da7e8;outline-offset:3px}.dgui-settings .dgui-style-option:disabled{cursor:default;opacity:.6}
.dgui-settings .dgui-style-preview{box-sizing:border-box;min-height:170px;padding:14px;background:var(--preview-bg);color:var(--preview-ink);border-radius:12px;overflow:hidden}
.dgui-settings .dgui-style-preview>strong{display:block;font-size:16px;line-height:1.4;margin-bottom:14px;font-weight:750}
.dgui-settings .dgui-preview-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.dgui-settings .dgui-preview-panel{min-width:0;padding:8px 6px;border:1px solid var(--preview-line);border-radius:8px}
.dgui-settings .dgui-preview-panel span{display:block;color:var(--preview-accent);font-size:11px;font-weight:750}
.dgui-settings .dgui-preview-panel b{display:block;font-size:12px;margin:5px 0;white-space:nowrap}
.dgui-settings .dgui-preview-panel i{display:block;height:3px;width:75%;background:var(--preview-soft);border-radius:9px}
.dgui-settings .dgui-preview-panel em{display:block;font-style:normal;font-size:12px;line-height:1.5;opacity:.85}
.dgui-settings .dgui-style-preview[data-layout=comparison] .dgui-preview-grid,.dgui-settings .dgui-style-preview[data-layout=summary] .dgui-preview-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.dgui-settings .dgui-style-preview[data-layout=list] .dgui-preview-grid{grid-template-columns:1fr;gap:0}
.dgui-settings .dgui-style-preview[data-layout=list] .dgui-preview-panel{display:grid;grid-template-columns:18px 1fr auto;align-items:center;gap:6px;border:0;border-bottom:1px solid var(--preview-line);border-radius:0;background:transparent;box-shadow:none;padding:7px 0}
.dgui-settings .dgui-style-preview[data-layout=list] .dgui-preview-panel:last-child{border-bottom:0}
.dgui-settings .dgui-style-preview[data-layout=list] .dgui-preview-panel b{margin:0}.dgui-settings .dgui-style-preview[data-layout=list] .dgui-preview-panel span{font-size:12px}
.dgui-settings .dgui-style-preview .dgui-preview-number{font-size:27px;line-height:1.25;color:var(--preview-accent)}
.dgui-settings .dgui-preview-copy{font-size:14px;line-height:1.7;margin:0 0 10px;color:var(--preview-ink)}
.dgui-settings .dgui-preview-note{font-size:13px;line-height:1.6;margin:0;color:var(--preview-accent)}
.dgui-settings [data-style=soft] .dgui-style-preview[data-layout=text],.dgui-settings [data-style=prismframe] .dgui-style-preview[data-layout=text]{border:1px solid var(--preview-line)}
.dgui-settings .dgui-style-name{display:flex;justify-content:space-between;gap:8px;font-size:15px;font-weight:700;margin:11px 2px 5px}.dgui-settings .dgui-style-name>span{color:#467bd1}
.dgui-settings .dgui-style-description{font-size:12px;line-height:1.6;margin:0 2px;opacity:.8}
.dgui-settings [data-style=editorial] .dgui-preview-panel{border:0;border-left:1px solid var(--preview-line);border-radius:0}
.dgui-settings [data-style=soft] .dgui-style-preview{background:linear-gradient(130deg,#f5effc,#eff8f6)}
.dgui-settings [data-style=soft] .dgui-preview-panel{background:#ffffffba;border-radius:14px;border:0}
.dgui-settings [data-style=technical] .dgui-preview-panel{border-radius:4px}.dgui-settings [data-style=technical] .dgui-preview-panel span{font-family:ui-monospace,monospace}
.dgui-settings [data-style=expressive] .dgui-style-preview>strong{font-size:19px}.dgui-settings [data-style=expressive] .dgui-preview-panel{background:var(--preview-soft);border:0;border-radius:12px}.dgui-settings [data-style=expressive] .dgui-preview-panel span{font-size:18px}
.dgui-settings [data-style=prismframe] .dgui-style-preview{border-radius:18px;font-family:ui-rounded,system-ui,sans-serif}.dgui-settings [data-style=prismframe] .dgui-preview-panel{background:white;border-radius:13px;box-shadow:3px 4px 0 #b5d6f5,0 5px 9px #1938580c}
@media(max-width:560px){.dgui-settings .dgui-style-options{grid-template-columns:1fr}}
`;
