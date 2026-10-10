import{EXPORT_RUNTIME}from'./export-runtime-bundle.js';
import{validateState}from'./protocol.js';
export function standaloneCanvas(document,node,state,theme={}){
  validateState(document,state);
  const token=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
  const json=JSON.stringify({document,nodeId:node.id,state,theme,nonce:token}).replace(/</g,'\\u003c');
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';script-src 'nonce-${token}';style-src 'unsafe-inline';frame-src 'self';base-uri 'none';form-action 'none'"><title>${escape(node.title)}</title><style>body{margin:0;padding:24px;background:${theme.scheme==='dark'?'#161b23':'#f4f6fa'};color:${theme.scheme==='dark'?'#e6edf6':'#182537'};font:14px/1.6 system-ui,sans-serif}main{max-width:1100px;margin:auto}h1{font-size:22px}p{overflow-wrap:anywhere}#surface{background:${theme.scheme==='dark'?'#161b23':'#fff'};border-radius:12px;overflow:hidden}#status{min-height:1.6em}</style></head><body><main><h1>${escape(node.title)}</h1><p>DSH Motion UI · 独立副本。包含导出时参数，本地交互不会保存到 DSH，也不会调用 Agent。</p><div id="surface"></div><p id="status" role="status"></p><details><summary>文字说明</summary><p>${escape(node.fallback)}</p></details></main><script type="application/json" id="dsh-ui-export">${json}</script><script nonce="${token}">${EXPORT_RUNTIME.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
}
