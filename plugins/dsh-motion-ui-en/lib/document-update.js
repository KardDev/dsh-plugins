import {validateDocument} from './protocol.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function merge(a={},b={},label){const result={...a};for(const[k,v]of Object.entries(b)){if(Object.hasOwn(result,k)&&!same(result[k],v))throw Error('DSH UI: update cannot redefine '+label+'.'+k+'; preserve existing input/calculation definitions');result[k]=v}return result}
export function updateDocument(current,{mode,targetId,document}){
 if(!['append','replace'].includes(mode))throw Error('DSH UI: mode must be append or replace');
 const incoming=validateDocument(document),next=structuredClone(current);
 const find=(list,id)=>{for(const[n,node]of list.entries()){if(node.id===id)return {list,index:n,node};const child=node.children&&find(node.children,id);if(child)return child}};
 const singleVisualAppend=!targetId&&mode==='append'&&next.nodes.length===1&&next.nodes[0].type==='visual'&&incoming.nodes.length===1&&incoming.nodes[0].type==='visual';
 const target=targetId?find(next.nodes,targetId):singleVisualAppend?{list:next.nodes,index:0,node:next.nodes[0]}:null;if(targetId&&!target)throw Error('DSH UI: targetId must be an existing node ID');
 // An extended fragment gets a generated state slot. A targeted update keeps
 // the existing visual's slot rather than introducing an unrelated default.
 if(target?.node.type==='visual'&&incoming.nodes.length===1&&incoming.nodes[0].type==='visual')delete incoming.state[incoming.nodes[0].stateKey];
 next.state=merge(next.state,incoming.state,'state');next.derived=merge(next.derived,incoming.derived,'derived');next.data=merge(next.data,incoming.data,'data');next.actions=merge(next.actions,incoming.actions,'actions');
 if(target?.node.type==='visual'){
  if(incoming.nodes.length!==1||incoming.nodes[0].type!=='visual')throw Error('DSH UI: visual target requires one extended title/items document');
  const input=incoming.nodes[0],spec=target.node.spec;
  target.node.spec=mode==='append'?{...spec,items:[...spec.items,...input.spec.items]}:input.spec;
  target.node.warnings=input.warnings??[];
 }else if(target){
  if(mode==='append'){if(!Array.isArray(target.node.children))throw Error('DSH UI: append target needs children or a visual spec');target.node.children.push(...incoming.nodes)}
  else {if(incoming.nodes.length!==1)throw Error('DSH UI: targeted replace needs exactly one node');target.list[target.index]={...incoming.nodes[0],id:target.node.id}}
 }else if(mode==='append')next.nodes.push(...incoming.nodes);
 else {next.nodes=incoming.nodes;next.title=incoming.title;next.fallback=incoming.fallback;if(incoming.presentation!==undefined)next.presentation=incoming.presentation;else delete next.presentation}
 // Existing state keys remain available even after replacing display nodes.
 // New controls receive defaults; stored values are migrated by the store.
 return validateDocument(next);
}
