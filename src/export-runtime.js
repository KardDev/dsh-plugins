import {validateDocument,validateState,evaluate}from'../lib/protocol.js';
import {sandboxDocument,canvasSnapshot,canvasPatch,SANDBOX_LIMITS}from'../lib/sandbox.js';
// The exported file has its own state controller; it never calls DSH or an agent.
const payload=JSON.parse(document.getElementById('dsh-ui-export').textContent);
const doc=validateDocument(payload.document),node=doc.nodes.flatMap(function flatten(n){return[n,...(n.children??[]).flatMap(flatten)]}).find(n=>n.id===payload.nodeId&&n.type==='sandbox');
if(!node)throw Error('导出的画布不存在');
let state=validateState(doc,payload.state),connected=false,start=Date.now(),count=0;
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join(''),channel=token(),nonce=payload.nonce;
const frame=document.createElement('iframe');frame.title=node.title;frame.sandbox='allow-scripts';frame.referrerPolicy='no-referrer';frame.style.cssText='display:block;width:100%;height:'+ (node.height??420)+'px;border:0';
const status=document.getElementById('status');
const publish=()=>{try{frame.contentWindow.postMessage({dshCanvas:1,channel,type:'snapshot',payload:{...canvasSnapshot(node,state,doc.data,evaluate(doc,state).derived,false,payload.theme),visible:!document.hidden}},'*')}catch(e){status.textContent='计算失败：'+e.message}};
addEventListener('message',event=>{const m=event.data;if(event.source!==frame.contentWindow||m?.channel!==channel||m.dshCanvas!==1)return;if(Date.now()-start>1000){start=Date.now();count=0}if(++count>SANDBOX_LIMITS.rate)return;
  if(m.type==='ready'){connected=true;publish()}
  else if(m.type==='patch'&&connected){try{const next=validateState(doc,{...state,...canvasPatch(m.payload,node)});evaluate(doc,next);state=next;status.textContent='本地参数已更新；刷新文件会回到导出时的参数。'}catch(e){status.textContent='参数无效：'+e.message}publish()}
  else if(m.type==='height'&&Number.isFinite(m.payload))frame.style.height=Math.max(160,Math.min(1000,Math.ceil(m.payload)))+'px';
  else if(m.type==='error')status.textContent='画布运行异常：'+String(m.payload).slice(0,1000);
});
document.addEventListener('visibilitychange',()=>{if(connected)publish()});
document.getElementById('surface').append(frame);frame.srcdoc=sandboxDocument(node,channel,nonce);
