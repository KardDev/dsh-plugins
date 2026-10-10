// Lossless transport repairs only at protocol-typed positions. Never traverse
// arbitrary data/state payloads or rewrite labels, HTML, CSS or JavaScript.
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const own = (v,k) => Object.hasOwn(v,k);
const singleItem = v => object(v) && Object.keys(v).length === 1 && own(v,'item');
const array = v => singleItem(v) && Array.isArray(v.item) ? v.item : v;
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
      if (node.type === 'sandbox') {
        if (!own(node,'title')) node.title = doc.title;
        if (!own(node,'fallback')) node.fallback = doc.fallback;
      }
      for (const field of ['children','items','columns','stateKeys','dataKeys','derivedKeys']) if (own(node,field)) node[field] = array(node[field]);
      if (['table','chart'].includes(node.type) && own(node,'rows')) node.rows = array(node.rows);
      for (const field of ['decimals','height']) if (own(node,field)) node[field] = number(node[field]);
      if (node.type === 'details' && own(node,'open')) node.open = boolean(node.open);
      for (const field of ['text','value','max','rows']) if (own(node,field)) expression(node[field],node.type === 'progress');
      if (['row','column','card','details'].includes(node.type) && own(node,'children')) node.children = nodes(node.children);
    }
    return list;
  }
  if (own(doc,'nodes')) doc.nodes = nodes(doc.nodes);
  return doc;
}
