import { componentFields } from './components.js';
import { validateDocument } from './protocol.js';
export const AUDIT_MESSAGES = Object.freeze({ overflow: '内容超出视口宽度', smallText: '文字实际显示尺寸小于 12px', contrast: '文字与背景对比度偏低', missingLabel: '交互控件缺少可访问名称',runtimeError:'画布报告运行异常',clippedText:'文字可能被隐藏或裁切',bottomWhitespace:'内容下方存在明显空白' });
export function refineDocument(document, changes) {
  if (!Array.isArray(changes) || !changes.length || changes.length > 32) throw new Error('DSH UI: changes requires 1..32 node edits');
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
