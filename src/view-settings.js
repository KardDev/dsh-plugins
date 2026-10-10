import {useSyncExternalStore} from 'react';
let scope;
export function configureViewSettings(value){scope=value;}
const subscribe=fn=>scope?.subscribe(fn)??(()=>{});
const snapshot=()=>scope?.getSnapshot()?.value?.showDetails===true;
export function useViewDetails(){return useSyncExternalStore(subscribe,snapshot,()=>false);}
