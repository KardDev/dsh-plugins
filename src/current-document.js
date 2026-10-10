import { useEffect, useState } from 'react';
import { validateDocument } from '../lib/protocol.js';
const current=new Map(),listeners=new Set();
export function publishDocument(raw){
  const document=validateDocument(raw.document),before=current.get(raw.documentId);
  if(before&&(before.documentRevision??0)>=(raw.documentRevision??0))return;
  current.set(raw.documentId,{...raw,document});if(current.size>128)current.delete(current.keys().next().value);listeners.forEach(fn=>fn());
}
export function useCurrentDocument(raw,sessionId){
  const [,wake]=useState(0);
  const [attempt,retry]=useState(0),[load,setLoad]=useState({status:'loading'});
  useEffect(()=>{
    if(!raw.documentId||!sessionId)return;
    const notify=()=>wake(v=>v+1);listeners.add(notify);const abort=new AbortController();
    setLoad({status:'loading'});
    fetch('/api/plugins/dsh-generative-ui/document?'+new URLSearchParams({documentId:raw.documentId,sessionId}),{credentials:'same-origin',signal:abort.signal}).then(async r=>{
      if(!r.ok)throw new Error('Document unavailable');const latest=await r.json();
      if(abort.signal.aborted)return;
      if(latest.documentId!==raw.documentId||!Number.isSafeInteger(latest.documentRevision??0)||(latest.documentRevision??0)<0)throw new Error('Invalid document response');
      publishDocument(latest);setLoad({status:'ready'});
    }).catch(()=>{if(!abort.signal.aborted)setLoad({status:'error'})});
    return()=>{abort.abort();listeners.delete(notify)};
  },[raw.documentId,sessionId,attempt]);
  const latest=current.get(raw.documentId);
  return {record:latest&&(latest.documentRevision??0)>(raw.documentRevision??0)?latest:raw,status:load.status,retry:()=>retry(v=>v+1)};
}
