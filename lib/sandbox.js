import {canvasSource} from './canvas-source.js';
import {MECHANISM_RUNTIME} from './mechanism-runtime-bundle.js';
import { measureVisual } from './visual-audit.js';
import { formatNumber } from './format-number.js';
import { CANVAS_SYSTEM_CSS } from './canvas-system.js';
import {createTimelineAPI} from './timeline.js';
import {createTimelineControlRepair, canvasContentHeight} from './canvas-controls.js';
// Shared bounds and document construction. Generated code runs only in an opaque-origin frame.
export const SANDBOX_LIMITS = Object.freeze({ source: 49152, height: 1000, message: 16384, rate: 30 });
export function canvasSnapshot(node, state, data, derived, disabled, theme) {
  const pick = (keys, values) => Object.fromEntries((keys ?? []).map(k => [k, values[k]]));
  return { state: pick(node.stateKeys, state), data: pick(node.dataKeys, data), derived: pick(node.derivedKeys, derived), disabled, theme };
}
export function canvasPatch(message, node) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) throw new Error('Invalid canvas patch');
  const keys = Object.keys(message);
  if (!keys.length || keys.length > 64 || keys.some(k => !(node.stateKeys ?? []).includes(k))) throw new Error('Canvas state key is not declared');
  if (JSON.stringify(message).length > SANDBOX_LIMITS.message) throw new Error('Canvas patch is too large');
  return message;
}
export function sandboxDocument(node, channel, nonce) {
  const json = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  // Only bootstrap/generated script elements receive a nonce. Markup scripts/handlers stay inert.
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${CANVAS_SYSTEM_CSS}</style></head><body><main id="canvas"></main><script nonce="${nonce}">(()=>{
  const channel=${json(channel)}, source=${json(canvasSource(node))};
  let snapshot={state:{},data:{},derived:{},disabled:true,theme:{}}, started=false;
  const listeners=new Set(), send=(type,payload)=>parent.postMessage({dshCanvas:1,channel,type,payload},'*');
  const report=e=>send('error',String(e?.message??e).slice(0,1000));
  const repairTimelineControls=(${createTimelineControlRepair.toString()})();
  const contentHeight=${canvasContentHeight.toString()};
  const repairControls=()=>{if(!window.__DSHMotionRender&&timelineAPI.capture.list().length)repairTimelineControls()};
  for(const type of ['click','input','change'])document.addEventListener(type,()=>queueMicrotask(repairControls));
  const audit=${measureVisual.toString()};let auditTimer;const scheduleAudit=()=>{clearTimeout(auditTimer);auditTimer=setTimeout(()=>{repairControls();const issues=audit(document.getElementById('canvas'),${json(node.id??'')});send('audit',{issues,coverage:issues.coverage})},400)};
  addEventListener('resize',scheduleAudit);
  addEventListener('error',e=>report(e.error??e.message));addEventListener('unhandledrejection',e=>report(e.reason));
  const animations=new Set(), motion=matchMedia('(prefers-reduced-motion: reduce)');
  let raf=0,last=0,time=0;
  const visible=()=>snapshot.visible!==false&&!document.hidden;
  const canAnimate=()=>visible()&&!snapshot.disabled&&!motion.matches&&!window.__DSHMotionRender;
  const draw=delta=>{for(const fn of animations)try{fn({time,delta,reducedMotion:motion.matches,visible:visible()})}catch(e){animations.delete(fn);report(e)}};
  const tick=t=>{raf=0;if(!canAnimate()||!animations.size){last=0;draw(0);return}const delta=last?Math.min(.05,(t-last)/1000):0;last=t;time+=delta;draw(delta);if(animations.size)raf=requestAnimationFrame(tick)};
  const refresh=()=>{draw(0);if(canAnimate()&&animations.size){if(!raf){last=0;raf=requestAnimationFrame(tick)}}else{cancelAnimationFrame(raf);raf=0;last=0}};
  motion.addEventListener('change',refresh);document.addEventListener('visibilitychange',refresh);
  const formatNumber=${formatNumber.toString()};
  const api={formatNumber,get snapshot(){return structuredClone(snapshot)},subscribe(fn){if(typeof fn!=='function')throw Error('Listener required');listeners.add(fn);fn(api.snapshot);return()=>listeners.delete(fn)},setState(patch){if(!snapshot.disabled)send('patch',patch)},animate(fn){if(typeof fn!=='function')throw Error('Animation callback required');animations.add(fn);refresh();return()=>{animations.delete(fn);if(!animations.size){cancelAnimationFrame(raf);raf=0;last=0}}}};
  let soundTick=0,soundPlaying,soundTime,soundVisible;const timelineAPI=(${createTimelineAPI.toString()})(api.animate,!!window.__DSHMotionRender,s=>{if(snapshot.motionSound){const now=performance.now();if(now-soundTick>=100||s.playing!==soundPlaying||s.visible!==soundVisible||(!s.playing&&s.time!==soundTime)){soundTick=now;soundPlaying=s.playing;soundTime=s.time;soundVisible=s.visible;send('timeline',s)}}});api.timeline=timelineAPI.timeline;
  Object.defineProperty(window,'__DSHMotionCapture',{value:timelineAPI.capture,writable:false});
  ${node.libraries?.includes('mechanism')?MECHANISM_RUNTIME.replace(/<\/script/gi,'<\\/script')+';api.mechanism=__MotionMechanism.createMechanismAPI(api);':''}
  Object.defineProperty(window,'DSHUI',{value:Object.freeze(api),writable:false});
  for(const type of ['click','input','change','keydown','pointerdown'])document.addEventListener(type,e=>{if(snapshot.disabled){e.preventDefault();e.stopImmediatePropagation()}},true);
  addEventListener('message',event=>{
    const m=event.data;if(event.source!==parent||m?.dshCanvas!==1||m.channel!==channel||m.type!=='snapshot')return;
    snapshot=m.payload;for(const [k,v] of Object.entries(snapshot.theme??{}))document.documentElement.style.setProperty('--canvas-'+k,v);
    document.documentElement.style.colorScheme=snapshot.theme?.scheme??'light';document.documentElement.dataset.canvasScheme=snapshot.theme?.scheme??'light';
    const wasStarted=started;
    if(!started){started=true;document.getElementById('canvas').innerHTML=source.html;const style=document.createElement('style');style.textContent=source.css;document.head.append(style);const script=document.createElement('script');script.nonce=${json(nonce)};script.textContent=source.script;document.body.append(script)}
    if(wasStarted)for(const fn of listeners)try{fn(api.snapshot)}catch(e){report(e)}
    repairControls();refresh();if(!wasStarted)send('mounted');scheduleAudit();
  });
  let resizePending=false;new ResizeObserver(()=>{if(!started||resizePending)return;resizePending=true;requestAnimationFrame(()=>{resizePending=false;send('height',contentHeight(document.getElementById('canvas')))})}).observe(document.getElementById('canvas'));
  send('ready');
})();</script></body></html>`;
}
