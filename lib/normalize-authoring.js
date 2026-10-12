// Lossless transport repairs only at protocol-typed positions. Never traverse
// arbitrary data/state payloads or rewrite labels, HTML, CSS or JavaScript.
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
import {visualDocument,VISUAL_TYPES} from './visual.js';
import {COMPONENTS} from './components.js';
const own = (v,k) => Object.hasOwn(v,k);
const singleItem = v => object(v) && Object.keys(v).length === 1 && own(v,'item');
const array = v => {let candidate=v;for(let i=0;i<8&&singleItem(candidate);i++)candidate=candidate.item;return Array.isArray(candidate)?candidate:v};
const numericOps = new Set(['add','sub','mul','div','min','max','round','abs','lt','lte','gt','gte']);
function number(v) {
  if (typeof v !== 'string' || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(v.trim())) return v;
  const n = Number(v);
  return Number.isFinite(n) && (!Number.isInteger(n) || Number.isSafeInteger(n)) ? n : v;
}
const boolean = v => v === 'true' ? true : v === 'false' ? false : v;
function expression(e, numeric = false, logical = false) {
  if (!object(e)) return e;
  if (own(e,'const')) {
    if (numeric) e.const = number(e.const);
    if (logical) e.const = boolean(e.const);
  }
  if (own(e,'args')) e.args = array(e.args);
  if (Array.isArray(e.args)) e.args.forEach((arg,i) => expression(arg,numericOps.has(e.op) || e.op === 'if' && i > 0 && numeric,e.op === 'if' && i === 0));
  if (object(e.map?.fields)) Object.values(e.map.fields).forEach(e => expression(e));
  return e;
}
export function normalizeAuthoring(doc) {
  if (Array.isArray(doc)) doc=visualDocument(doc);
  if (object(doc)&&!own(doc,'nodes')&&(own(doc,'items')||typeof doc.type==='string')) doc=visualDocument(doc);
  if (!object(doc)) return doc;
  if (own(doc,'version')) doc.version = number(doc.version);
  if (object(doc.state)) for (const k of Object.keys(doc.state)) {
    let s = doc.state[k];
    // Decode a single JSON object only where a state specification is required.
    if (typeof s === 'string' && s.trim().startsWith('{')) {
      try { const parsed = JSON.parse(s); if (object(parsed)) s = parsed; } catch { /* Validator reports the state path. */ }
    }
    if (singleItem(s) && object(s.item)) s = s.item;
    doc.state[k] = s;
    if (!object(s)) continue;
    if (own(s,'options')) s.options = array(s.options);
    if (s.type === 'number') {
      for (const field of ['default','min','max','step']) if (own(s,field)) s[field] = number(s[field]);
      if (Array.isArray(s.options)) s.options = s.options.map(number);
    } else if (s.type === 'boolean') {
      if (own(s,'default')) s.default = boolean(s.default);
      if (Array.isArray(s.options)) s.options = s.options.map(boolean);
    }
  }
  if (object(doc.derived)) Object.values(doc.derived).forEach(e => expression(e));
  if (object(doc.actions)) for (const action of Object.values(doc.actions)) if (object(action) && own(action,'stateKeys')) action.stateKeys = array(action.stateKeys);
  function nodes(list) {
    list = array(list);
    if (!Array.isArray(list)) return list;
    for (const node of list) {
      if (!object(node)) continue;
      if(['text','heading','callout'].includes(node.type)&&own(node,'content')){
        // Collapse aliases only when no conflicting content would be lost.
        if(!own(node,'text')){node.text=node.content;delete node.content}
        else if(node.text===node.content)delete node.content;
      }
      if(['text','heading','callout'].includes(node.type)&&typeof node.text==='string'){
        const spans=array(node.spans);
        if(Array.isArray(spans)&&spans.every(s=>object(s)&&typeof s.text==='string')&&spans.map(s=>s.text).join('')===node.text)delete node.text;
      }
      if(node.type==='table'&&own(node,'types')){
        const columns=array(node.columns),rows=array(node.rows),types=array(node.types);
        const allowed=['id','type','label','columns','rows','types'];
        if(Object.keys(node).every(k=>allowed.includes(k))&&Array.isArray(columns)&&columns.length&&columns.every(c=>object(c)&&typeof c.key==='string'&&typeof c.label==='string'&&Object.keys(c).every(k=>['key','label','unit'].includes(k)))&&new Set(columns.map(c=>c.key)).size===columns.length&&Array.isArray(rows)&&rows.every(object)&&Array.isArray(types)&&types.length===columns.length&&types.every(t=>['text','num','delta','bar','badge'].includes(t))){
          const spec={...(node.label?{title:node.label}:{}),items:[{type:'table',columns:columns.map(c=>c.label+(c.unit?` (${c.unit})`:'')),rows:rows.map(row=>columns.map(c=>row[c.key]??null)),types}]},id=node.id;
          for(const k of Object.keys(node))delete node[k];
          Object.assign(node,{...(id!==undefined?{id}:{}),type:'visual',spec});
        }
      }
      // Extended-only nodes have an unambiguous native visual wrapper. Keep
      // the author's ID so mixed documents need no extra repair round.
      if(typeof node.id==='string'&&VISUAL_TYPES.includes(node.type)&&!own(COMPONENTS,node.type)){
        const spec={items:[{...node}]},id=node.id;
        for(const k of Object.keys(node))delete node[k];
        Object.assign(node,{id,type:'visual',spec});
      }
      if(node.type==='table'&&Array.isArray(node.columns)&&node.columns.length&&Array.isArray(node.rows)&&node.rows.every(Array.isArray)&&node.columns.every(c=>object(c)&&Number.isInteger(c.key)&&c.key>=0)&&new Set(node.columns.map(c=>c.key)).size===node.columns.length){
        const columns=node.columns.map(c=>({...c,key:'col_'+c.key}));
        node.rows=node.rows.map(row=>Object.fromEntries(node.columns.map(c=>['col_'+c.key,row[c.key]??null])));node.columns=columns;
      }
      if(node.type==='visual'&&typeof node.id==='string'){
        node.stateKey??='visual_'+node.id;doc.state??={};
        if(!own(doc.state,node.stateKey))doc.state[node.stateKey]={type:'json',default:{}};
      }
      if (node.type === 'sandbox') {
        if (!own(node,'title')) node.title = doc.title;
        if (!own(node,'fallback')) node.fallback = doc.fallback;
      }
      for (const field of ['children','items','columns','stateKeys','dataKeys','derivedKeys']) if (own(node,field)) node[field] = array(node[field]);
      if (['table','chart'].includes(node.type) && own(node,'rows')) node.rows = array(node.rows);
      for (const field of ['decimals','height']) if (own(node,field)) node[field] = number(node[field]);
      if(['row','column'].includes(node.type)){if(own(node,'gap'))node.gap=number(node.gap);if(node.type==='row'&&own(node,'columns'))node.columns=number(node.columns)}
      if(['text','heading','callout'].includes(node.type)){
        for(const field of ['size','weight','lineHeight'])if(own(node,field))node[field]=number(node[field]);
        if(own(node,'spans'))node.spans=array(node.spans);
        if(Array.isArray(node.spans))for(const span of node.spans)if(object(span))for(const field of ['size','weight','lineHeight'])if(own(span,field))span[field]=number(span[field]);
      }
      if (node.type === 'details' && own(node,'open')) node.open = boolean(node.open);
      if(node.type==='text'&&own(node,'copyable'))node.copyable=boolean(node.copyable);
      if(node.type==='code'&&own(node,'wrap'))node.wrap=boolean(node.wrap);
      for (const field of ['text','value','max','rows']) if (own(node,field)) expression(node[field],node.type === 'progress');
      if (['row','column','card','details'].includes(node.type) && own(node,'children')) node.children = nodes(node.children);
    }
    return list;
  }
  if (own(doc,'nodes')) doc.nodes = nodes(doc.nodes);
  return doc;
}
