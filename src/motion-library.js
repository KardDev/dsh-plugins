import {ExpressiveAction,ElasticToggle,Stepper} from './expressive-controls.js';
import React,{useState} from 'react';
import {SegmentedControl,MetricValue} from './motion-controls.js';
import {CopyBlock} from './copy-block.js';
import {useNativeStyle} from './view-settings.js';
const h=React.createElement;
export function MotionLibrary(){
 const[open,setOpen]=useState(false),[months,setMonths]=useState(1),[seats,setSeats]=useState(2),[checks,setChecks]=useState([false,false,false]),style=useNativeStyle();
 const total=29*months*seats,done=checks.filter(Boolean).length;
 return h('section',{'aria-label':'动态交互案例'},h('h4',null,'动态交互案例'),h('p',null,'可直接操作的本地演示。示例价格不是报价，勾选不代表已执行检查；操作不会调用模型或改动设置。'),h('button',{className:'dgui-secondary',type:'button','aria-expanded':open,onClick:()=>setOpen(!open)},open?'收起交互演示':'体验交互演示'),open&&h('section',{className:'dgui-root','data-preset':'brief','data-visual-style':style,'data-motion-demo':true},
 h('h4',null,'方案切换与预算联动'),h(SegmentedControl,{id:'demo-period',label:'示例购买月数',options:[1,3,12],value:months,onChange:setMonths}),
 h('div',{className:'dgui-control'},h('label',{htmlFor:'demo-seats'},'示例使用人数'),h('input',{id:'demo-seats',type:'range',min:1,max:8,value:seats,style:{'--du-range':((seats-1)/7*100)+'%'},onChange:e=>setSeats(Number(e.target.value))}),h('output',{htmlFor:'demo-seats'},seats)),
 h('div',{className:'dgui-metric'},h('span',{className:'dgui-metric-label'},'示例单价 29 元/人/月'),h(MetricValue,{value:total,expressive:true},total,' ',h('small',null,'元'))),
 h('div',{className:'dgui-control'},h('label',{htmlFor:'demo-quantity'},'数量步进'),h(Stepper,{value:seats,spec:{min:1,max:8,step:1},label:'示例人数',onChange:setSeats},h('input',{id:'demo-quantity',type:'number',min:1,max:8,value:seats,onChange:e=>{const v=Number(e.target.value);if(Number.isInteger(v)&&v>=1&&v<=8)setSeats(v)}}))),
 h('h4',null,'勾选与进度反馈'),h('div',{className:'dgui-column'},['说明文档已检查','实际测试已完成','许可证已确认'].map((label,i)=>h('label',{key:label,className:'dgui-control'},label,h(ElasticToggle,{checked:checks[i],onChange:value=>setChecks(previous=>previous.map((v,n)=>n===i?value:v))})))),h('div',{className:'dgui-progress'},h('span',null,done+' / 3 项'),h('progress',{value:done,max:3,'aria-label':'演示完成进度'})),
 h(ExpressiveAction,{text:'重置本地演示',className:'dgui-button','data-variant':'primary',type:'button',onClick:()=>{setMonths(1);setSeats(2);setChecks([false,false,false])}}),
 h(CopyBlock,{code:true,lang:'bash',title:'复制真实内容',text:'git status\ngit diff'})));
}
