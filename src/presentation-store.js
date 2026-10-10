import { useEffect, useState, useSyncExternalStore } from 'react';
const records=new Map(),listeners=new Set(),locations=new Map();
let opener,revision=0;
const emit=()=>{revision++;listeners.forEach(fn=>fn())};
export const notifyUi=emit;
export function rememberUi(raw,sessionId,sendPrompt) {
  if(raw?.version!==1||raw.sessionId!==sessionId)return;
  const old=records.get(raw.documentId);
  if(old&&(old.raw.documentRevision??0)>(raw.documentRevision??0))return;
  if(old?.raw===raw&&old.sendPrompt===sendPrompt)return;
  records.set(raw.documentId,{raw,sessionId,sendPrompt});emit();
}
export const uiRecords=()=>[...records.values()];
export const subscribeUi=fn=>{listeners.add(fn);return()=>listeners.delete(fn)};
export function useUiRegistry(){useSyncExternalStore(subscribeUi,()=>revision,()=>0);return uiRecords();}
export function setPanelOpener(fn){opener=fn;emit();return()=>{if(opener===fn){opener=undefined;emit()}}}
export const panelAvailable=()=>!!opener;
export function openUiPanel(id,sessionId){return opener?.(id,sessionId)}
export function setMarkerLocation(id,host){locations.set(id,host);emit();}
export function removeMarkerLocation(id,host){if(locations.get(id)===host){locations.delete(id);emit();}}
export const markerLocation=id=>locations.get(id);
export function usePresentation(scope){const[,wake]=useState(0);useEffect(()=>scope?.subscribe(()=>wake(v=>v+1)),[scope]);return scope?.getSnapshot().value?.displayMode??'tail';}
