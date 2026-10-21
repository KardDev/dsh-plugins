import {useSyncExternalStore} from 'react';
const owners=new Map(),listeners=new Set();let revision=0;
const emit=()=>{revision++;for(const fn of listeners)fn()};
export function presentMedia(owner,sessionId,records){owners.set(owner,{sessionId,records});emit();return()=>{if(owners.delete(owner))emit()}}
export function useExportedCanvases(record,sessionId,enabled){
 useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn)},()=>revision,()=>0);
 const ids=new Set();if(!enabled)return ids;
 for(const value of owners.values())if(value.sessionId===sessionId)for(const media of value.records){
  if(media.kind!=='render'||media.sessionId!==sessionId||media.documentId!==record.documentId)continue;
  if((media.documentRevision??0)!==(record.documentRevision??0))continue;
  if(media.nodeId)ids.add(media.nodeId);
 }
 return ids;
}
