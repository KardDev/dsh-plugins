import React,{useEffect,useRef,useState} from 'react';
export function ActionMenu({label,children}){
  const [open,setOpen]=useState(false),root=useRef(null),button=useRef(null);
  useEffect(()=>{
    if(!open)return;
    const outside=e=>{if(!root.current?.contains(e.target))setOpen(false);};
    const escape=e=>{if(e.key==='Escape'){setOpen(false);button.current?.focus();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[open]);
  return React.createElement('div',{className:'dgui-action-menu',ref:root},
    React.createElement('button',{ref:button,type:'button',className:'dgui-menu-trigger','aria-label':label,'aria-expanded':open,onClick:()=>setOpen(!open)},'⋯'),
    open&&React.createElement('div',{className:'dgui-menu-content','aria-label':label,onClick:e=>{if(e.target.closest('button'))setOpen(false);}},children));
}
