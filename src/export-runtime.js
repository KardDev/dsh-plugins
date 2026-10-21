import {validateDocument,validateState,evaluate}from'../lib/protocol.js';
import {sandboxDocument,canvasSnapshot,canvasPatch,SANDBOX_LIMITS}from'../lib/sandbox.js';
// The exported file has its own state controller; it never calls DSH or an agent.
const payload=JSON.parse(document.getElementById('dsh-ui-export').textContent);
const doc=validateDocument(payload.document),node=doc.nodes.flatMap(function flatten(n){return[n,...(n.children??[]).flatMap(flatten)]}).find(n=>n.id===payload.nodeId&&n.type==='sandbox');
if(!node)throw Error('The exported canvas does not exist');
let state=validateState(doc,payload.state),connected=false,start=Date.now(),count=0;
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join(''),channel=token(),nonce=payload.nonce;
const frame=document.createElement('iframe');frame.title=node.title;frame.sandbox='allow-scripts';frame.referrerPolicy='no-referrer';frame.style.cssText='display:block;width:100%;height:'+ (node.height??420)+'px;border:0';
const status=document.getElementById('status');
const sound=payload.soundtrack;
let audio,unlocked=false,soundState;
let caption;
if(payload.captions?.length&&!window.__DSHMotionRender){caption=document.createElement('div');caption.setAttribute('aria-live','off');caption.style.cssText='position:absolute;bottom:5%;left:10%;right:10%;text-align:center;white-space:pre-line;pointer-events:none;font:600 clamp(14px,2.1vw,28px)/1.4 system-ui;color:white;text-shadow:0 1px 4px black';const surface=document.getElementById('surface');surface.style.position='relative';surface.append(caption)}
const soundAllowed=()=>unlocked&&soundState?.playing&&!soundState.reducedMotion&&soundState.visible&&!document.hidden;
if(sound&&!window.__DSHMotionRender&&/^[\w-]+\.(wav|mp3|m4a|aac|ogg|flac)$/.test(sound.file)){
 audio=document.createElement('audio');audio.src=sound.file;audio.preload='auto';audio.volume=Math.max(0,Math.min(1,sound.volume??.3));
 const button=document.createElement('button');button.textContent='Enable soundtrack';button.type='button';button.addEventListener('click',()=>{unlocked=!unlocked;button.textContent=unlocked?'Disable soundtrack':'Enable soundtrack';if(!soundAllowed())audio.pause();else audio.play().then(()=>{if(!soundAllowed())audio.pause()}).catch(()=>{unlocked=false;button.textContent='Click to retry soundtrack'})});status.before(button);status.before(audio);
}
const publish=()=>{try{frame.contentWindow.postMessage({dshCanvas:1,channel,type:'snapshot',payload:{...canvasSnapshot(node,state,doc.data,evaluate(doc,state).derived,false,payload.theme),visible:!document.hidden,motionSound:!!audio||!!caption}},'*')}catch(e){status.textContent='Calculation failed: '+e.message}};
addEventListener('message',event=>{const m=event.data;if(event.source!==frame.contentWindow||m?.channel!==channel||m.dshCanvas!==1)return;if(Date.now()-start>1000){start=Date.now();count=0}if(++count>SANDBOX_LIMITS.rate)return;
  if(m.type==='ready'){connected=true;publish()}
  else if(m.type==='patch'&&connected){try{const next=validateState(doc,{...state,...canvasPatch(m.payload,node)});evaluate(doc,next);state=next;status.textContent='Local parameters updated; refreshing the file restores the parameters from export time.'}catch(e){status.textContent='Invalid parameters: '+e.message}publish()}
  else if(m.type==='height'&&Number.isFinite(m.payload)&&m.payload>=0)frame.style.height=Math.max(32,Math.min(1000,Math.ceil(m.payload)))+'px';
  else if(m.type==='error')status.textContent='Canvas runtime error: '+String(m.payload).slice(0,1000);
  else if(m.type==='timeline'&&m.payload.id==='main'){
    soundState=m.payload;
    if(caption)caption.textContent=payload.captions.find(c=>m.payload.time>=c.start&&m.payload.time<c.end)?.text??'';
    if(!audio)return;
    const t=m.payload.time;if(Number.isFinite(t)&&Math.abs(audio.currentTime-t)>.2)audio.currentTime=t;
    if(!soundAllowed())audio.pause();
    else if(audio.paused)audio.play().then(()=>{if(!soundAllowed())audio.pause()}).catch(()=>{unlocked=false;status.textContent='Click Enable soundtrack to allow audio playback.'});
  }
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)audio?.pause();if(connected)publish()});
addEventListener('pagehide',()=>audio?.pause());
document.getElementById('surface').append(frame);frame.srcdoc=sandboxDocument(node,channel,nonce);
