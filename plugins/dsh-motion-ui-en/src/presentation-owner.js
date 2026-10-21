import {useEffect,useState} from 'react';
// A conversation can temporarily mount multiple tail seats during projection.
// Elect one connected anchor per document; explicit sidebar copies are separate.
const roots=new WeakMap();
export function usePresentationOwner(anchor,documentId,sessionId){
  const [owner,setOwner]=useState(false);
  useEffect(()=>{
    const element=anchor.current;if(!element)return;
    const root=element.closest('[data-conversation-scroll]')??element.parentElement;
    if(!root)return;
    let documents=roots.get(root);if(!documents){documents=new Map();roots.set(root,documents)}
    const key=sessionId+':'+documentId;let entries=documents.get(key);if(!entries){entries=new Set();documents.set(key,entries)}
    const entry={element,update:setOwner};entries.add(entry);
    const elect=()=>{let winner;for(const candidate of entries){if(!candidate.element.isConnected)continue;if(!winner||(winner.element.compareDocumentPosition(candidate.element)&4))winner=candidate}for(const candidate of entries)candidate.update(candidate===winner)};
    elect();return()=>{entries.delete(entry);elect();if(!entries.size)documents.delete(key)};
  },[anchor,documentId,sessionId]);
  return owner;
}
