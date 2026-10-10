import { LIMITS, validateDocument } from './protocol.js';
import { toolJson } from './tool-json.js';

// Parse complete JSON tokens only. Never finish a string, number or model expression.
// Partial containers retain completed members, but only the document wrapper and
// its top-level nodes array are allowed to use those partial values.
function parseToolArguments(raw) {
  if (typeof raw !== 'string' || raw.length > LIMITS.bytes || new TextEncoder().encode(raw).length > LIMITS.bytes) return null;
  let i = 0;
  const ws = () => { while (/\s/.test(raw[i] ?? '') && i < raw.length) i++; };
  function parse(depth = 0) {
    if (depth > 48) throw Error('depth');
    ws(); const start = i, c = raw[i];
    if (c === '{' || c === '[') {
      const array = c === '[', value = array ? [] : {}, members = new Map(), close = array ? ']' : '}'; i++; ws();
      if (raw[i] === close) { i++; return { value, complete: true, members }; }
      let count = 0;
      while (i < raw.length) {
        if (++count > 500) throw Error('items');
        let k;
        if (!array) {
          const name = parse(depth + 1); if (!name.complete) return { value, complete: false, members };
          if (typeof name.value !== 'string' || Object.hasOwn(value, name.value) || ['__proto__', 'constructor', 'prototype'].includes(name.value)) throw Error('key');
          k = name.value; ws(); if (i === raw.length) return { value, complete: false, members };
          if (raw[i++] !== ':') throw Error('colon');
        }
        const child = parse(depth + 1);
        if (array) { if (child.complete) value.push(child.value); }
        else { members.set(k, child); if (child.complete) value[k] = child.value; }
        if (!child.complete) return { value, complete: false, members };
        ws(); if (i === raw.length) return { value, complete: false, members };
        const separator = raw[i++]; if (separator === close) return { value, complete: true, members };
        if (separator !== ',') throw Error('separator');
        ws(); if (raw[i] === close) throw Error('trailing comma');
      }
      return { value, complete: false, members };
    }
    if (c === '"') {
      i++; let safe = i;
      while (i < raw.length) {
        const ch = raw[i++];
        if (ch === '"') return { value: JSON.parse(raw.slice(start, i)), complete: true };
        if (ch === '\\') {
          if(i===raw.length)break;
          const escaped=raw[i++];
          if(escaped==='u'){if(raw.length-i<4){i=raw.length;break;}if(!/^[0-9a-f]{4}$/i.test(raw.slice(i,i+4)))throw Error('escape');i+=4;}
          else if(!'"\\/bfnrt'.includes(escaped))throw Error('escape');
        } else if(ch.charCodeAt(0)<32)throw Error('string');
        safe=i;
      }
      return { value: JSON.parse(raw.slice(start,safe)+'"'), complete: false };
    }
    while (i < raw.length && !/[\s,}\]]/.test(raw[i])) i++;
    const token = raw.slice(start, i);
    if (i === raw.length) return { complete: false };
    return { value: JSON.parse(token), complete: true };
  }
  try {
    const root = parse(); ws(); if (i !== raw.length) return null; return root;
  } catch { return null; }
}
export function previewDocument(raw) {
  try {
    const root=parseToolArguments(raw);if(!root)return null;
    const document = root.members?.get('document');
    if(document?.complete&&typeof document.value==='string'&&root.members.size===1)return validateDocument(toolJson(document.value,'document'));
    if (!document?.members) return null;
    if ([...root.members.keys()].some(k => k !== 'document')) return null;
    const doc = { ...document.value }, nodes = document.members.get('nodes');
    if (!nodes || !Array.isArray(nodes.value) || !nodes.value.length) return null;
    doc.nodes = nodes.value;
    // Only whole, valid top-level subtrees can appear. Forward references can
    // wait for a later complete data/actions field; Host remains authoritative.
    for (let n = doc.nodes.length; n > 0; n--) {
      try { return validateDocument({ ...doc, nodes: doc.nodes.slice(0, n) }); } catch { /* wait for more input */ }
    }
  } catch { /* malformed and incomplete input never becomes executable UI */ }
  return null;
}

// This description is used only by the inert preview, never as committed metadata.
export function previewCanvas(raw) {
  const root=parseToolArguments(raw);if(!root?.members)return null;
  const get=k=>root.members.get(k),html=get('html'),css=get('css');
  if(!get('title')?.complete||!get('fallback')?.complete||typeof html?.value!=='string'||!html.value||!css?.complete||typeof css.value!=='string')return null;
  if(html.value.length>49152||css.value.length>49152)return null;
  return {id:'canvas-preview',title:String(get('title').value).slice(0,160),fallback:String(get('fallback').value).slice(0,2000),html:html.value,css:css.value,height:Number.isFinite(get('height')?.value)?Math.max(160,Math.min(1000,get('height').value)):420};
}
