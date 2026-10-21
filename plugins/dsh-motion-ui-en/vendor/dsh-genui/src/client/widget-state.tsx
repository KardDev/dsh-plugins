// Motion UI extension: view/widget state shares the block's durable fields.
// Internal fields are excluded from form submissions, but included in export.
import {createContext,createElement,useContext,useRef,useState,type ReactNode,type Dispatch,type SetStateAction} from 'react'
import type {AnswersState} from './blocks/state.ts'
const Scope=createContext<{path:string;answers?:AnswersState}>({path:'root'})
export function WidgetScope({id,answers,children}:{id:string;answers?:AnswersState;children:ReactNode}){
 const parent=useContext(Scope)
 return createElement(Scope.Provider,{value:{path:parent.path+'/'+id,answers:answers??parent.answers}},children)
}
export function useWidgetState<T>(slot:string,initial:T|(()=>T),valid:(v:unknown)=>boolean=()=>true,enabled=true):[T,Dispatch<SetStateAction<T>>,Dispatch<SetStateAction<T>>]{
 const context=useContext(Scope),key='__motion_widget_'+context.path+':'+slot
 const [value,paint]=useState<T>(()=>{const raw=enabled?context.answers?.fields[key]:undefined;if(raw!==undefined)try{const parsed=JSON.parse(raw);if(valid(parsed))return parsed as T}catch{}return typeof initial==='function'?(initial as ()=>T)():initial})
 const current=useRef(value);current.current=value
 const update=(next:SetStateAction<T>,persist:boolean)=>{const v=typeof next==='function'?(next as (old:T)=>T)(current.current):next;if(!valid(v))return;current.current=v;paint(v);const encoded=JSON.stringify(v);if(enabled&&persist&&encoded!==undefined&&encoded.length<=4096&&encoded!==context.answers?.fields[key])context.answers?.setField(key,encoded)}
 return [value,next=>update(next,true),next=>update(next,false)]
}
