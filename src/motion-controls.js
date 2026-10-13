import React,{useRef,useEffect} from 'react';
const h=React.createElement;
export function SegmentedControl({id,label,options,value,disabled,onChange}){
 const selected=Math.max(0,options.indexOf(value)),buttons=useRef([]);
 function move(event,index){const key=event.key;let next;if(key==='ArrowRight'||key==='ArrowDown')next=(index+1)%options.length;else if(key==='ArrowLeft'||key==='ArrowUp')next=(index+options.length-1)%options.length;else if(key==='Home')next=0;else if(key==='End')next=options.length-1;else return;event.preventDefault();onChange(options[next]);buttons.current[next]?.focus()}
 return h('div',{id,role:'radiogroup','aria-label':label,className:'dgui-segmented',style:{'--segment-count':options.length,'--segment-index':selected},'data-disabled':disabled||undefined},h('span',{className:'dgui-segment-indicator','aria-hidden':true}),options.map((option,i)=>h('button',{key:i,ref:el=>{buttons.current[i]=el},type:'button',role:'radio','aria-checked':i===selected,tabIndex:i===selected?0:-1,disabled,onClick:()=>onChange(option),onKeyDown:e=>move(e,i)},String(option))));
}
// Animate only decoration; canonical values and copied/follow-up data never tween.
export function MetricValue({value,children,preview,expressive=false}){
 const ref=useRef(null),previous=useRef(value),armed=useRef(!preview);
 useEffect(()=>{const changed=previous.current!==value,wasArmed=armed.current;previous.current=value;armed.current=!preview;if(!changed||!wasArmed||preview||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const tokens=ref.current?getComputedStyle(ref.current):null,duration=Number(tokens?.getPropertyValue('--du-feedback-ms'))||460,travel=tokens?.getPropertyValue('--du-feedback-travel').trim()||'90%';const animation=ref.current?.animate?.(expressive?[{opacity:0,transform:'translateY('+travel+')'},{opacity:1,transform:'translateY(-8%)',offset:.75},{opacity:1,transform:'translateY(0)'}]:[{opacity:.65,transform:'translateY(2px)'},{opacity:1,transform:'none'}],{duration:expressive?duration:180,easing:'cubic-bezier(.2,.8,.2,1)'});return()=>animation?.cancel()},[value,preview,expressive]);
 return h('strong',{ref},children);
}
export const MOTION_CSS=`
.dgui-control>.dgui-control-label{flex:1 1 170px;display:flex;align-items:flex-start;gap:7px;line-height:1.6;font-size:inherit;color:var(--du-ink)}.dgui-control>.dgui-control-label .dgui-icon{width:15px;height:15px;margin-top:3px;color:var(--du-accent)}
.dgui-segmented{display:grid;grid-template-columns:repeat(var(--segment-count),minmax(0,1fr));position:relative;isolation:isolate;flex:1 1 240px;min-width:0;background:var(--du-soft);border:1px solid var(--du-line);padding:4px;border-radius:16px;gap:0}
.dgui-segment-indicator{position:absolute;z-index:-1;left:4px;top:4px;bottom:4px;width:calc((100% - 8px)/var(--segment-count));transform:translateX(calc(var(--segment-index)*100%));background:var(--du-bg);border:1px solid var(--du-line);border-radius:12px;box-shadow:0 2px 7px #18253712;transition:transform 220ms cubic-bezier(.2,.8,.2,1)}
.dgui-segmented button{border:0;background:transparent;color:var(--du-muted);padding:9px 10px;min-width:0;border-radius:12px;font:inherit;line-height:1.4;cursor:pointer;overflow-wrap:anywhere;transition:color 160ms ease}
.dgui-segmented button[aria-checked=true]{color:var(--du-accent);font-weight:700}.dgui-segmented button:disabled{cursor:default;opacity:.6}.dgui-segmented button:focus-visible{outline:2px solid var(--du-accent);outline-offset:-2px}
.dgui-root .dgui-button,.dgui-root .motion-copy-button{transition:background-color 160ms ease,color 160ms ease,box-shadow 160ms ease,transform 160ms ease}.dgui-root .dgui-button:active:not(:disabled),.motion-copy-button:active:not(:disabled){transform:scale(.98)}
.dgui-toggle{transition:background-color 180ms ease,border-color 180ms ease}.dgui-toggle:before{transition:transform 180ms ease}
.dgui-root:not([data-preview]) .dgui-chart rect{transition:y 220ms ease-out,height 220ms ease-out}.dgui-root:not([data-preview]) progress::-webkit-progress-value{transition:width 220ms ease-out}
.dgui-control input[type=range]{appearance:none;-webkit-appearance:none;border:0!important;padding:0!important;background:transparent!important;outline-offset:5px}
.dgui-control input[type=range]::-webkit-slider-runnable-track{height:7px;border-radius:999px;background:linear-gradient(to right,var(--du-accent) 0 var(--du-range,0%),var(--du-line) var(--du-range,0%) 100%)}
.dgui-control input[type=range]::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:20px;height:20px;margin-top:-6.5px;border:3px solid var(--du-bg);border-radius:50%;background:var(--du-accent);box-shadow:0 1px 5px #18253730}
.dgui-control input[type=range]::-moz-range-track{height:7px;border-radius:999px;background:var(--du-line)}.dgui-control input[type=range]::-moz-range-progress{height:7px;border-radius:999px;background:var(--du-accent)}.dgui-control input[type=range]::-moz-range-thumb{width:16px;height:16px;border:3px solid var(--du-bg);border-radius:50%;background:var(--du-accent)}
@media(prefers-reduced-motion:reduce){.dgui-root .dgui-segment-indicator,.dgui-root .dgui-button,.dgui-root .motion-copy-button,.dgui-root .dgui-toggle,.dgui-root .dgui-toggle:before,.dgui-root .dgui-chart rect,.dgui-root progress::-webkit-progress-value{transition:none!important;animation:none!important}}
.dgui-root[data-preview] .dgui-segment-indicator{transition:none}
@media(forced-colors:active){.dgui-segment-indicator{background:Highlight}.dgui-segmented button[aria-checked=true]{color:HighlightText}.dgui-control input[type=range]{appearance:auto;-webkit-appearance:auto}}
`;
