import {validateDocument,fallbackText,LIMITS} from './protocol.js';
import {normalizeAuthoring} from './normalize-authoring.js';
// The fast path still uses the exact same validator/storage/renderer as render_ui.
export function textDocument({title='内容',preset='reading',accent,blocks}){
 if(!Array.isArray(blocks)||!blocks.length)throw Error('DSH UI: blocks must be a non-empty array of text strings or registered nodes');
 let encoded;try{encoded=JSON.stringify(blocks)}catch{throw Error('DSH UI: blocks must contain serializable JSON')}
 if(new TextEncoder().encode(encoded).length>LIMITS.bytes)throw Error('DSH UI: blocks exceed document size limit');
 const parsed=JSON.parse(encoded),pending=[[parsed,0]];while(pending.length){const[value,depth]=pending.pop();if(depth>48)throw Error('DSH UI: blocks JSON nesting is too deep');if(value&&typeof value==='object')for(const child of Object.values(value))pending.push([child,depth+1])}
 let count=0;const guard=(list,depth=1)=>{if(depth>LIMITS.depth)throw Error('DSH UI: blocks exceed node depth limit');for(const n of list){if(++count>LIMITS.nodes)throw Error('DSH UI: too many blocks');if(n&&typeof n==='object'&&Array.isArray(n.children))guard(n.children,depth+1)}};guard(blocks);
 blocks=normalizeAuthoring({title,fallback:title,nodes:parsed}).nodes;count=0;guard(blocks);
 let serial=0;const used=new Set();
 const collect=list=>list.forEach(n=>{if(n&&typeof n==='object'){if(n.id!==undefined)used.add(n.id);if(Array.isArray(n.children))collect(n.children)}});collect(blocks);
 const copy=list=>list.map(block=>{
  const node=typeof block==='string'?{type:'text',text:block}:structuredClone(block);
  if(!node||typeof node!=='object'||Array.isArray(node))throw Error('DSH UI: each block must be text or a node object');
  // Reserved generated IDs avoid clashing with the caller's optional explicit IDs.
  if(node.id===undefined){do{node.id=`_text_${serial++}`}while(used.has(node.id));used.add(node.id)}
  if(node.children!==undefined){if(!Array.isArray(node.children))throw Error('DSH UI: children must be an array');node.children=copy(node.children)}
  return node;
 });
 const nodes=copy(blocks);
 const doc=validateDocument({version:1,title,fallback:title,presentation:{preset,...(accent?{accent}:{})},nodes});
 doc.fallback=fallbackText({...doc,title:'',fallback:''}).trim().slice(0,8192)||title;
 return doc;
}
