import { uiRecords,subscribeUi,setMarkerLocation,removeMarkerLocation } from './presentation-store.js';
const idPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export function markedUiId(block){
  const code=block.querySelector('code'),pre=block.matches('pre')?block:block.querySelector('pre');
  const id=(code?.textContent??pre?.textContent??'').trim();
  // DSH 0.2 maps unknown fence languages to a localized generic label.
  // Accept an exact UUID only; the scanner also requires a known same-session result.
  return idPattern.test(id)?id:null;
}
// One scanner per visible conversation. Only IDs from that conversation's
// successful tool results are eligible; arbitrary/foreign IDs stay plain code.
export function startUiMarkers(root,sessionId){
  const claims=new Map();let scheduled=false,disposed=false;
  const scan=()=>{
    scheduled=false;if(disposed)return;
    for(const [block,c] of claims)if(!block.isConnected||markedUiId(block)!==c.id){removeMarkerLocation(c.id,c.host);c.host.remove();block.style.display=c.display;claims.delete(block)}
    const known=new Set(uiRecords().filter(r=>r.sessionId===sessionId).map(r=>r.raw.documentId));
    for(const block of root.querySelectorAll('div.md-code-block,pre')){
      if(block.matches('pre')&&block.closest('div.md-code-block'))continue;
      if(block.closest('[data-dsh-generative-ui]')||claims.has(block))continue;
      const id=markedUiId(block);if(!known.has(id))continue;
      // The first marker owns the live view; later references remain readable.
      if([...claims.values()].some(c=>c.id===id))continue;
      const host=block.ownerDocument.createElement('div');host.dataset.dguiMarker=id;host.uiMarkerBlock=block;
      block.before(host);claims.set(block,{id,host,display:block.style.display});setMarkerLocation(id,host);
    }
  };
  const queue=()=>{if(!scheduled&&!disposed){scheduled=true;queueMicrotask(scan)}};
  const observer=new MutationObserver(queue);observer.observe(root,{childList:true,subtree:true,characterData:true});
  const unsubscribe=subscribeUi(queue);scan();
  return()=>{disposed=true;observer.disconnect();unsubscribe();for(const [block,c]of claims){removeMarkerLocation(c.id,c.host);block.style.display=c.display;c.host.remove()}claims.clear()};
}
