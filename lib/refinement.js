import { componentFields } from './components.js';
import { validateDocument } from './protocol.js';
import {toolJson} from './tool-json.js';
export const AUDIT_MESSAGES = Object.freeze({ overflow: '内容超出视口宽度', smallText: '文字实际显示尺寸小于 12px', contrast: '文字与背景对比度偏低', missingLabel: '交互控件缺少可访问名称',runtimeError:'画布报告运行异常',clippedText:'文字可能被隐藏或裁切',bottomWhitespace:'内容下方存在明显空白' });
export function normalizeNodeEdits(changes) {
  changes=toolJson(changes,'changes');
  // Some providers serialize a JSON array as {item:{id,props}}. Only unwrap
  // an unambiguous transport envelope; ordinary document/data objects stay opaque.
  if(changes&&typeof changes==='object'&&!Array.isArray(changes)&&Object.keys(changes).length===1&&Object.hasOwn(changes,'item')){
    const item=changes.item;
    if(Array.isArray(item))changes=item;
    else if(item&&typeof item==='object'&&!Array.isArray(item)&&Object.hasOwn(item,'id')&&Object.hasOwn(item,'props'))changes=[item];
  }
  if(changes&&typeof changes==='object'&&!Array.isArray(changes)){
    const keys=Object.keys(changes);
    if(keys.length===2&&keys.includes('id')&&keys.includes('props'))changes=[changes];
    else if(keys.length&&keys.length<=32&&keys.every(id=>changes[id]&&typeof changes[id]==='object'&&!Array.isArray(changes[id])))changes=keys.map(id=>({id,props:changes[id]}));
  }
  if (!Array.isArray(changes) || !changes.length || changes.length > 32) throw new Error('DSH UI: changes requires 1..32 node edits');
  const merged=new Map();
  for(let change of changes){
    if(!change||typeof change!=='object'||Array.isArray(change))throw Error('DSH UI: each edit must be {id,props}');
    // A few typed-array adapters leak the PARENT parameter as an empty field
    // on its item. Remove only this empty mirror, never opaque props/source,
    // nonempty nested edits, arbitrary extra fields or missing identity.
    if(Object.hasOwn(change,'changes')&&(change.changes==null||(typeof change.changes==='string'&&!change.changes.trim())||(Array.isArray(change.changes)&&!change.changes.length))){const {changes:emptyMirror,...rest}=change;change=rest}
    const extra=Object.keys(change).find(k=>!['id','props'].includes(k));
    if(extra)throw Error('DSH UI: unknown edit field '+extra+'; each edit allows id,props. Put node properties inside props.');
    const props=toolJson(change.props,'props');if(!props||typeof props!=='object'||Array.isArray(props)||!Object.keys(props).length)throw Error('DSH UI: edit props required');
    const previous=merged.get(change.id);
    if(previous){for(const key of Object.keys(props))if(Object.hasOwn(previous.props,key)&&JSON.stringify(previous.props[key])!==JSON.stringify(props[key]))throw Error('DSH UI: conflicting edits at node.'+change.id+'.'+key);previous.props={...previous.props,...props}}
    else merged.set(change.id,{id:change.id,props:{...props}});
  }
  return [...merged.values()];
}
export function refineDocument(document, changes) {
  changes=normalizeNodeEdits(changes);
  const next = structuredClone(document), nodes = new Map();
  const walk = list => list.forEach(n => { nodes.set(n.id,n); if(n.children)walk(n.children); });walk(next.nodes);
  const seen = new Set();
  for(const change of changes){
    if(!change || Object.keys(change).some(k=>!['id','props'].includes(k)) || seen.has(change.id) || !nodes.has(change.id))throw new Error('DSH UI: edit needs a unique existing node id');
    seen.add(change.id);const node=nodes.get(change.id),props=change.props;
    if(!props || typeof props!=='object' || Array.isArray(props) || !Object.keys(props).length)throw new Error('DSH UI: edit props required');
    const allowed=componentFields(node.type).filter(k=>!['id','type','children','bind','action'].includes(k));
    if(Object.keys(props).some(k=>!allowed.includes(k)))throw new Error('DSH UI: edits cannot change node identity, structure, bindings or actions');
    Object.assign(node,props);
  }
  return validateDocument(next);
}
export function validateAudit(value){
  if(!value || !Number.isInteger(value.width) || value.width<1 || value.width>8192 || !['light','dark'].includes(value.theme) || !Array.isArray(value.issues) || value.issues.length>40)throw new Error('DSH UI: invalid audit');
  const coverage=value.coverage??[];
  if(!Array.isArray(coverage)||coverage.length>32)throw new Error('DSH UI: invalid audit coverage');
  const checkedCoverage=coverage.map(c=>{
    if(!c||typeof c.nodeId!=='string'||c.nodeId.length>64||typeof c.truncated!=='boolean'||['elements','contrastChecked','contrastUncovered'].some(k=>!Number.isInteger(c[k])||c[k]<0||c[k]>2000))throw new Error('DSH UI: invalid audit coverage');
    return {nodeId:c.nodeId,elements:c.elements,truncated:c.truncated,contrastChecked:c.contrastChecked,contrastUncovered:c.contrastUncovered};
  });
  return {width:value.width,theme:value.theme,coverage:checkedCoverage,issues:value.issues.map(i=>{
    if(!i || !Object.hasOwn(AUDIT_MESSAGES,i.code) || typeof i.nodeId!=='string' || i.nodeId.length>64 || (i.value!==undefined && (!Number.isFinite(i.value)||Math.abs(i.value)>100000)))throw new Error('DSH UI: invalid audit issue');
    let target;if(i.target!==undefined){const t=i.target;if(!t||typeof t!=='object'||Array.isArray(t)||Object.keys(t).some(k=>!['selector','text','tag'].includes(k))||['selector','text','tag'].some(k=>typeof t[k]!=='string'||t[k].length>({selector:256,text:120,tag:32}[k])))throw new Error('DSH UI: invalid audit target');target={selector:t.selector,text:t.text,tag:t.tag};}
    return {code:i.code,nodeId:i.nodeId,message:AUDIT_MESSAGES[i.code],...(target?{target}:{}),...(i.value===undefined?{}:{value:i.value})};
  })};
}
