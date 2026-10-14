// A small authoring language compiled to the existing interpreter; never eval.
import { IDENTIFIER_SOURCE, validIdentifier } from './identifiers.js';
export function compileExpression(source) {
  const fail = () => { throw new Error('DSH UI: invalid formula; use state.x, data.x, derived.x, item.x, numbers, strings, + - * /, comparisons, ?: and min/max/round/ceil/floor/abs'); };
  if (typeof source !== 'string' || !source.trim() || source.length > 2048) fail();
  const tokens = []; let offset = 0;
  const token = new RegExp(String.raw`\s*(?:(\d+(?:\.\d*)?|\.\d+)([eE][+-]?\d+)?|("(?:[^"\\]|\\.)*")|(${IDENTIFIER_SOURCE}(?:\.${IDENTIFIER_SOURCE})?)|(===|!==|<=|>=|==|!=|[+*/()?,:<>-]))`, 'uy');
  while (offset < source.length) {
    if (!source.slice(offset).trim()) break;
    token.lastIndex = offset; const m = token.exec(source); if (!m) fail();
    offset = token.lastIndex;
    tokens.push(m[1] ? { number: Number(m[1] + (m[2] ?? '')) } : m[3] ? { string: JSON.parse(m[3]) } : m[4] ?? m[5]);
    if (tokens.length > 256) fail();
  }
  let pos = 0;
  const operators = { '==': ['eq', 1], '===': ['eq', 1], '!=': ['neq', 1], '!==': ['neq', 1], '<': ['lt', 2], '<=': ['lte', 2], '>': ['gt', 2], '>=': ['gte', 2], '+': ['add', 3], '-': ['sub', 3], '*': ['mul', 4], '/': ['div', 4] };
  const take = t => { if (tokens[pos++] !== t) fail(); };
  function parse(min = 0, depth = 0) {
    if (depth > 12) fail();
    const t = tokens[pos++]; let out;
    if (t && typeof t === 'object') out = { const: Object.hasOwn(t, 'number') ? t.number : t.string };
    else if (t === 'true' || t === 'false') out = { const: t === 'true' };
    else if (t === '(') { out = parse(0, depth + 1); take(')'); }
    else if (t === '-' || t === '+') { const arg = parse(5, depth + 1); out = t === '-' ? { op: 'sub', args: [{ const: 0 }, arg] } : arg; }
    else if (typeof t === 'string' && t.split('.').length === 2 && ['state','data','derived','item'].includes(t.split('.')[0]) && validIdentifier(t.split('.')[1])) out = { ref: t };
    else if (['min', 'max', 'round', 'ceil', 'floor', 'abs'].includes(t)) {
      take('('); const args = [parse(0, depth + 1)];
      while (tokens[pos] === ',') { pos++; args.push(parse(0, depth + 1)); if (args.length > 8) fail(); }
      take(')'); out = { op: t, args };
    } else fail();
    while (typeof tokens[pos]==='string' && Object.hasOwn(operators,tokens[pos]) && operators[tokens[pos]][1] >= min) {
      const [op, precedence] = operators[tokens[pos++]];
      out = { op, args: [out, parse(precedence + 1, depth + 1)] };
    }
    if (min === 0 && tokens[pos] === '?') {
      pos++; const yes = parse(0, depth + 1); take(':'); out = { op: 'if', args: [out, yes, parse(0, depth + 1)] };
    }
    return out;
  }
  const result = parse(); if (pos !== tokens.length) fail(); return result;
}

export function expandExpressions(doc) {
  const expression = (e, at) => {
    if (!e || typeof e !== 'object' || Array.isArray(e)) return e;
    if (Object.hasOwn(e, 'expr')) {
      if (Object.keys(e).length !== 1) throw new Error('DSH UI: expr must be the only formula field');
      try{return compileExpression(e.expr)}catch(error){error.message='DSH UI: '+at+': '+error.message.replace(/^DSH UI: /,'');error.path=at;throw error}
    }
    if (Array.isArray(e.args)) e.args = e.args.map((v,i)=>expression(v,at+'.args['+i+']'));
    if (e.map?.fields) for (const k of Object.keys(e.map.fields)) e.map.fields[k] = expression(e.map.fields[k],at+'.map.fields.'+k);
    return e;
  };
  if (doc.derived && typeof doc.derived === 'object') for (const k of Object.keys(doc.derived)) doc.derived[k] = expression(doc.derived[k],'derived.'+k);
  const walk = nodes => { if (!Array.isArray(nodes)) return; for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    for (const field of ['text', 'value', 'max', 'rows']) if (Object.hasOwn(node, field)) node[field] = expression(node[field],'node.'+node.id+'.'+field);
    if (['table','chart'].includes(node.type)&&Array.isArray(node.rows)) for(const [rowIndex,row] of node.rows.entries()) if(row&&typeof row==='object'&&!Array.isArray(row)) for(const k of Object.keys(row)) row[k]=expression(row[k],'node.'+node.id+'.rows['+rowIndex+'].'+k);
    walk(node.children);
  } };
  walk(doc.nodes); return doc;
}
