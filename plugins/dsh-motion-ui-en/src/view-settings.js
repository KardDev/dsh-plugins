import {useSyncExternalStore} from 'react';
import {DEFAULT_VISUAL_STYLE,VISUAL_STYLE_IDS} from '../lib/visual-styles.js';
let scope;
export function configureViewSettings(value){scope=value;}
const subscribe=fn=>scope?.subscribe(fn)??(()=>{});
const snapshot=()=>scope?.getSnapshot()?.value?.showDetails===true;
export function useViewDetails(){return useSyncExternalStore(subscribe,snapshot,()=>false);}
export function selectedNativeStyle(value){
 if(!value||value.designMode==='free')return undefined;
 return VISUAL_STYLE_IDS.includes(value.visualStyle)?value.visualStyle:DEFAULT_VISUAL_STYLE;
}
const styleSnapshot=()=>selectedNativeStyle(scope?.getSnapshot()?.value);
export function useNativeStyle(){return useSyncExternalStore(subscribe,styleSnapshot,()=>undefined);}
