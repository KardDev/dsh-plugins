import {ExpressiveAction,ElasticToggle,Stepper} from './expressive-controls.js';
import React,{useState} from 'react';
import {SegmentedControl,MetricValue} from './motion-controls.js';
import {CopyBlock} from './copy-block.js';
import {useNativeStyle} from './view-settings.js';
const h=React.createElement;
export function MotionLibrary(){
 const[open,setOpen]=useState(false),[months,setMonths]=useState(1),[seats,setSeats]=useState(2),[checks,setChecks]=useState([false,false,false]),style=useNativeStyle();
 const total=29*months*seats,done=checks.filter(Boolean).length;
 return h('section',{'aria-label':'Interactive motion demos'},h('h4',null,'Interactive motion demos'),h('p',null,'Local demos you can use directly. Example prices are not quotes, and checking a box does not mean a check was performed; actions do not call the model or change settings.'),h('button',{className:'dgui-secondary',type:'button','aria-expanded':open,onClick:()=>setOpen(!open)},open?'Collapse demos':'Try the demos'),open&&h('section',{className:'dgui-root','data-preset':'brief','data-visual-style':style,'data-motion-demo':true},
 h('h4',null,'Plan switching and linked budget'),h(SegmentedControl,{id:'demo-period',label:'Example purchase months',options:[1,3,12],value:months,onChange:setMonths}),
 h('div',{className:'dgui-control'},h('label',{htmlFor:'demo-seats'},'Example users'),h('input',{id:'demo-seats',type:'range',min:1,max:8,value:seats,style:{'--du-range':((seats-1)/7*100)+'%'},onChange:e=>setSeats(Number(e.target.value))}),h('output',{htmlFor:'demo-seats'},seats)),
 h('div',{className:'dgui-metric'},h('span',{className:'dgui-metric-label'},'Example price 29 CNY per person per month'),h(MetricValue,{value:total,expressive:true},total,' ',h('small',null,'CNY'))),
 h('div',{className:'dgui-control'},h('label',{htmlFor:'demo-quantity'},'Quantity stepper'),h(Stepper,{value:seats,spec:{min:1,max:8,step:1},label:'Example users',onChange:setSeats},h('input',{id:'demo-quantity',type:'number',min:1,max:8,value:seats,onChange:e=>{const v=Number(e.target.value);if(Number.isInteger(v)&&v>=1&&v<=8)setSeats(v)}}))),
 h('h4',null,'Checklist and progress feedback'),h('div',{className:'dgui-column'},['Docs checked','Real tests completed','License confirmed'].map((label,i)=>h('label',{key:label,className:'dgui-control'},label,h(ElasticToggle,{checked:checks[i],onChange:value=>setChecks(previous=>previous.map((v,n)=>n===i?value:v))})))),h('div',{className:'dgui-progress'},h('span',null,done+' / 3 items'),h('progress',{value:done,max:3,'aria-label':'Demo progress'})),
 h(ExpressiveAction,{text:'Reset local demo',className:'dgui-button','data-variant':'primary',type:'button',onClick:()=>{setMonths(1);setSeats(2);setChecks([false,false,false])}}),
 h(CopyBlock,{code:true,lang:'bash',title:'Copy real content',text:'git status\ngit diff'})));
}
