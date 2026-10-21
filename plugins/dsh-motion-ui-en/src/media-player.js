import {useMediaSource} from './media-source.js';
import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Icon} from './icons.js';
import {mediaAssetUrl,visibleMediaRecords} from './media-history.js';
import {presentMedia} from './media-presentation.js';
const h=React.createElement,players=new Set(),preferenceKey='dsh-motion-ui:video-playback';
export function formatMediaTime(seconds){const s=Math.max(0,Math.floor(Number.isFinite(seconds)?seconds:0));return (s>=3600?Math.floor(s/3600)+':':'')+String(Math.floor(s/60)%60).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function preferences(){try{const p=JSON.parse(localStorage.getItem(preferenceKey));return{volume:typeof p?.volume==='number'&&Number.isFinite(p.volume)?Math.max(0,Math.min(1,p.volume)):.8,muted:p?.muted===true,rate:[.5,1,1.25,1.5,2].includes(p?.rate)?p.rate:1}}catch{return{volume:.8,muted:false,rate:1}}}
function remember(v){try{localStorage.setItem(preferenceKey,JSON.stringify({volume:v.volume,muted:v.muted,rate:v.playbackRate}))}catch{}}
const REVIEW_CATEGORIES=['copy','layout','motion','color','timing'];
export function ReviewBar({record,time,duration,ready,onSeek}){
 const documentId=record?.documentId,sessionId=record?.sessionId,revision=record?.documentRevision??0;
 const fps=Number(record?.spec?.fps)||30;
 const total=Math.max(1,Math.round((Number(duration)||0)*fps));
 const frame=Math.max(0,Math.round((Number(time)||0)*fps));
 const [open,setOpen]=useState(false),[items,setItems]=useState([]),[error,setError]=useState(''),
  [text,setText]=useState(''),[category,setCategory]=useState('motion'),
  [mark,setMark]=useState({a:null,b:null}),[saving,setSaving]=useState(false);
 const base=documentId&&sessionId?'/api/plugins/dsh-generative-ui/review?documentId='+encodeURIComponent(documentId)+'&revision='+revision+'&sessionId='+encodeURIComponent(sessionId):null;
 useEffect(()=>{
  if(!open||!base)return;let alive=true;
  (async()=>{try{const r=await fetch(base,{credentials:'same-origin',cache:'no-store'});const v=await r.json();if(!r.ok)throw new Error(v.error||('HTTP '+r.status));if(alive)setItems(Array.isArray(v.items)?v.items:[])}catch(e){if(alive)setError(e.message)}})();
  return()=>{alive=false};
 },[open,base]);
 if(!base)return null;
 const start=mark.a!==null?mark.a:frame,end=mark.b;
 const pct=f=>Math.max(0,Math.min(100,f/total*100));
 const seekFrame=f=>{if(ready&&onSeek)onSeek(Math.max(0,Math.min(total-1,f))/fps)};
 async function save(){
  const critique=text.trim();if(!critique)return;
  const scope=end!==null&&end>=start?'range':'frame';
  setSaving(true);setError('');
  try{
   const r=await fetch(base,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({scope,fps,category,critique,assetId:record.id,anchor:scope==='range'?{startFrame:start,endFrame:end}:{frame:start}})});
   const v=await r.json();if(!r.ok)throw new Error(v.error||('HTTP '+r.status));
   setItems(list=>[...list,v.entry]);setText('');setMark({a:null,b:null});
  }catch(e){setError(e.message)}finally{setSaving(false)}
 }
 return h('div',{className:'motion-review'},
  h('button',{type:'button',className:'motion-review-toggle','aria-expanded':open,onClick:()=>setOpen(v=>!v)},open?'Hide frame review':'Review frames'),
  open&&h('div',{className:'motion-review-body'},
   h('div',{className:'motion-review-head'},
    h('span',{className:'motion-review-frame'},'F'+String(start).padStart(4,'0')+(end!==null?'–F'+String(end).padStart(4,'0'):'')),
    h('span',{className:'motion-review-tc'},formatMediaTime(time||0)+' / '+formatMediaTime(duration||0)),
    h('button',{type:'button',onClick:()=>setMark(m=>({a:frame,b:m.b!==null&&m.b<=frame?null:m.b}))},'In'),
    h('button',{type:'button',onClick:()=>setMark(m=>({a:m.a===null?frame:m.a,b:Math.max(frame,m.a===null?frame:m.a)}))},'Out'),
    h('button',{type:'button',onClick:()=>setMark({a:null,b:null})},'Clear')),
   h('div',{className:'motion-review-strip',role:'slider',tabIndex:0,'aria-valuemin':0,'aria-valuemax':total-1,'aria-valuenow':frame,
    onClick:e=>{const r=e.currentTarget.getBoundingClientRect();seekFrame(Math.round((e.clientX-r.left)/r.width*(total-1)))}},
    end!==null&&h('div',{className:'motion-review-band',style:{left:pct(start)+'%',width:Math.max(0,pct(end)-pct(start))+'%'}}),
    h('div',{className:'motion-review-playhead',style:{left:pct(frame)+'%'}}),
    items.map((n,i)=>{const f=n.anchor?.frame??n.anchor?.startFrame??0;return h('button',{key:n.id,type:'button',className:'motion-review-pin',style:{left:pct(f)+'%'},title:(n.category+': '+(n.critique||'')).slice(0,140),onClick:e=>{e.stopPropagation();seekFrame(f)}},String(i+1))})),
   h('div',{className:'motion-review-compose'},
    h('select',{'aria-label':'Review category',value:category,onChange:e=>setCategory(e.currentTarget.value)},REVIEW_CATEGORIES.map(c=>h('option',{key:c,value:c},c))),
    h('textarea',{'aria-label':'Review note',rows:2,placeholder:'What should change here?',value:text,onChange:e=>setText(e.currentTarget.value)}),
    h('button',{type:'button',className:'motion-review-save',disabled:saving,onClick:save},saving?'Saving…':'Save note')),
   error&&h('p',{className:'motion-review-error',role:'alert'},error),
   h('div',{className:'motion-review-list'},items.length?items.slice(-6).map(n=>h('p',{key:n.id},
    h('strong',null,(n.scope==='range'?'F'+String(n.anchor.startFrame).padStart(4,'0')+'–F'+String(n.anchor.endFrame).padStart(4,'0'):'F'+String(n.anchor.frame).padStart(4,'0'))+' · '+n.category),
    ' — '+n.critique)):h('p',{className:'motion-review-empty'},'No frame notes yet.'))));
}
export function VideoPlayer({record}){
 const video=useRef(null),root=useRef(null),[prefs]=useState(preferences),[playing,setPlaying]=useState(false),[time,setTime]=useState(0),[duration,setDuration]=useState(record.duration??0),[ready,setReady]=useState(false),[volume,setVolume]=useState(prefs.volume),[muted,setMuted]=useState(prefs.muted),[rate,setRate]=useState(prefs.rate),[fullscreen,setFullscreen]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const mediaUrl=mediaAssetUrl(record,'video.mp4'),transport=useMediaSource(mediaUrl),src=transport.src,poster=mediaAssetUrl(record,'poster.jpg'),playbackError=error||transport.error;
 const lastVolume=useRef(prefs.volume||.8);
 const drag=useRef(null),pendingSeek=useRef(null);
 function beginSeek(e){const v=video.current;if(!v||!ready)return;drag.current={resume:!v.paused,value:Number(e.currentTarget.value)};v.pause();e.currentTarget.setPointerCapture?.(e.pointerId)}
 function changeSeek(value){if(drag.current){drag.current.value=Number(value);setTime(Number(value))}else seek(value)}
 function endSeek(cancel=false){const active=drag.current;if(!active)return;drag.current=null;if(cancel)setTime(video.current.currentTime);else seek(active.value);if(active.resume)video.current.play().catch(()=>{})}
 useEffect(()=>{
  const v=video.current,container=root.current;if(!v)return;
  players.add(v);v.volume=prefs.volume;v.muted=prefs.muted;v.playbackRate=prefs.rate;
  const stop=()=>v.pause(),hidden=()=>{if(document.hidden)stop()},fs=()=>setFullscreen(document.fullscreenElement===container);
  document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',stop);document.addEventListener('fullscreenchange',fs);
  return()=>{stop();players.delete(v);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',stop);document.removeEventListener('fullscreenchange',fs)};
 },[src]);
 async function toggle(){const v=video.current;if(!v)return;setNotice('');if(!v.paused){v.pause();return}try{if(v.ended)v.currentTime=0;await v.play()}catch(e){if(e.name!=='AbortError')setNotice('Playback is unavailable right now. Try again or download the video.')}}
 function seek(value){const v=video.current;if(!v||!ready||!Number.isFinite(duration)||duration<=0)return;const target=Math.max(0,Math.min(duration,Number(value)));pendingSeek.current=target;v.currentTime=target;setTime(target)}
 function mute(){const v=video.current;if(v.volume===0){v.volume=lastVolume.current;v.muted=false}else v.muted=!v.muted}
 async function full(){setNotice('');try{if(document.fullscreenElement===root.current)await document.exitFullscreen();else if(root.current.requestFullscreen)await root.current.requestFullscreen();else if(video.current.webkitEnterFullscreen)video.current.webkitEnterFullscreen();else setNotice('This browser does not support fullscreen.')}catch{setNotice('Could not enter fullscreen right now. Try again.')}}
 function key(e){if(e.target!==video.current&&e.target!==root.current)return;const k=e.key.toLowerCase();if([' ','k','m','f','arrowleft','arrowright'].includes(k)){e.preventDefault();if(k===' '||k==='k')toggle();else if(k==='m')mute();else if(k==='f')full();else seek((video.current?.currentTime??0)+(k==='arrowleft'?-5:5))}}
 const button=(name,icon,fn,extra={})=>h('button',{type:'button','aria-label':name,title:name,onClick:fn,...extra},h(Icon,{name:icon}));
 return h('section',{ref:root,className:'motion-video-player','data-motion-video':record.id,'aria-label':'Video player',onKeyDown:key},
  h('video',{ref:video,src:src??undefined,poster:poster??undefined,preload:'metadata',playsInline:true,controls:false,tabIndex:0,'aria-label':'Video',
   onLoadedMetadata:e=>{const v=e.currentTarget;setReady(true);setError('');if(Number.isFinite(v.duration))setDuration(v.duration)},
   onTimeUpdate:e=>{if(!drag.current&&pendingSeek.current===null)setTime(e.currentTarget.currentTime)},onSeeked:e=>{pendingSeek.current=null;if(!drag.current)setTime(e.currentTarget.currentTime)},onDurationChange:e=>{if(Number.isFinite(e.currentTarget.duration))setDuration(e.currentTarget.duration)},
   onPlay:e=>{for(const other of players)if(other!==e.currentTarget)other.pause();setPlaying(true);setError('')},onPause:()=>setPlaying(false),onEnded:()=>setPlaying(false),
   onVolumeChange:e=>{if(e.currentTarget.volume>0)lastVolume.current=e.currentTarget.volume;setVolume(e.currentTarget.volume);setMuted(e.currentTarget.muted);remember(e.currentTarget)},onRateChange:e=>{setRate(e.currentTarget.playbackRate);remember(e.currentTarget)},
   onError:()=>{setError('Cannot play this video. Try again, or download it and open the file.');setReady(false);setPlaying(false)},onClick:toggle,onDoubleClick:full}),
  h('div',{className:'motion-video-controls'},
   h('input',{className:'motion-video-seek',type:'range',min:0,max:duration||1,step:.05,value:Math.min(time,duration||1),disabled:!ready,'aria-label':'Playback position (seconds)','aria-valuetext':formatMediaTime(time)+' / '+formatMediaTime(duration),onPointerDown:beginSeek,onPointerUp:()=>endSeek(),onPointerCancel:()=>endSeek(true),onLostPointerCapture:()=>endSeek(true),onChange:e=>changeSeek(e.currentTarget.value)}),
   button(playing?'Pause video':'Play video',playing?'pause':'play',toggle,{disabled:!!playbackError||!src}),
   h('output',{className:'motion-video-time','aria-label':'Playback time'},formatMediaTime(time)+' / '+formatMediaTime(duration)),
   h('div',{className:'motion-video-volume'},button(muted||volume===0?'Unmute':'Mute video',muted||volume===0?'volumeOff':'volume',mute,{'aria-pressed':muted||volume===0}),h('input',{type:'range',min:0,max:1,step:.05,value:muted?0:volume,'aria-label':'Video volume','aria-valuetext':Math.round((muted?0:volume)*100)+'%',onChange:e=>{const v=video.current;v.volume=Number(e.currentTarget.value);v.muted=v.volume===0}})),
   h('select',{'aria-label':'Playback speed',title:'Playback speed',value:rate,onChange:e=>{video.current.playbackRate=Number(e.currentTarget.value)}},[.5,1,1.25,1.5,2].map(v=>h('option',{key:v,value:v},v+'×'))),
   button(fullscreen?'Exit fullscreen':'Enter fullscreen',fullscreen?'minimize':'fullscreen',full),
   h('a',{href:mediaUrl,download:'video.mp4','aria-label':'Download video',title:'Download video'},h(Icon,{name:'download'})),
   record.files.includes('source.html')&&h('a',{className:'motion-video-source',href:mediaAssetUrl(record,'source.html'),download:'source.html'},'Source'),
   record.files.includes('project.zip')&&h('a',{className:'motion-video-source',href:mediaAssetUrl(record,'project.zip'),download:'project.zip'},'Project')),
  transport.loading&&h('p',{className:'motion-video-message',role:'status'},'Loading video; you can drag to seek when it is ready…'),
  playbackError&&h('div',{className:'motion-video-message',role:'alert'},h('span',null,playbackError),h('button',{type:'button',onClick:()=>{setError('');transport.native?transport.retry():video.current.load()}},'Reload')),
  notice&&h('p',{className:'motion-video-message',role:'status'},notice),
  h(ReviewBar,{record,time,duration,ready,onSeek:seek}));
}
function MediaRecords({records,sessionId}){const owner=useRef({});useLayoutEffect(()=>presentMedia(owner.current,sessionId,records),[records,sessionId]);return h(React.Fragment,null,visibleMediaRecords(records.filter(r=>r.sessionId===sessionId)).map(record=>h(VideoPlayer,{key:record.id,record})))}
const mediaRoots=new WeakMap(),allMediaRoots=new Set();
function disposeSurface(entry){if(entry.disposed)return;entry.disposed=true;entry.observer.disconnect();entry.host.remove();entry.entries.delete(entry.key);allMediaRoots.delete(entry);queueMicrotask(()=>entry.root.unmount())}
export function disposeMediaSurfaces(){for(const entry of [...allMediaRoots])disposeSurface(entry)}
function mediaSeat(anchor,scroll){
 // A folded process group is already a turn-local seat. Its parent is the
 // shared flow slot; skipping that extra parent strands movies at the chat tail.
 let seat=anchor.closest('[data-chat-turn]')??anchor;
 for(let el=anchor.parentElement;el&&el!==scroll;el=el.parentElement)
  if(el.getAttribute('hidden')==='until-found')seat=el;
 return seat;
}
function placeOutsideFold(entry){
 if(!entry.anchor?.isConnected)return;
 const seat=mediaSeat(entry.anchor,entry.scroll),parent=seat.parentElement,before=seat.nextSibling;
 if(before===entry.host||!before&&parent.lastChild===entry.host)return;
 // moveBefore preserves media state in current Chromium. On older engines,
 // restore only movies that were already playing before this DOM relocation.
 try{if(parent.moveBefore){parent.moveBefore(entry.host,before);return}}catch{}
 const playing=[...entry.host.querySelectorAll('video')].filter(v=>!v.paused).map(v=>({v,time:v.currentTime}));parent.insertBefore(entry.host,before);
 queueMicrotask(()=>{for(const {v,time}of playing)if(v.isConnected){if(Math.abs(v.currentTime-time)>.2)v.currentTime=time;v.play().catch(()=>{})}});
}
export function MediaNodeView({node,sessionId}){
 const anchor=useRef(null),[inline,setInline]=useState(false),state=node.data;
 useLayoutEffect(()=>{
  const scroll=anchor.current?.closest('[data-conversation-scroll]');if(!scroll){setInline(true);return}
  let entries=mediaRoots.get(scroll);if(!entries){entries=new Map();mediaRoots.set(scroll,entries)}
  for(const other of [...entries.values()])if(other.sessionId!==sessionId)disposeSurface(other);
  const key=sessionId+':'+state.turn;let entry=entries.get(key);
  if(!state.records?.length){if(entry)disposeSurface(entry);return}
  if(!entry){
   // DSH anchors tool-result nodes inside hidden="until-found" analysis folds.
   // Mount outside the OUTERMOST fold; never unfold a user's tool history.
   const seat=mediaSeat(anchor.current,scroll);
   const host=document.createElement('div');host.dataset.motionMediaTurn=String(state.turn);if(seat===scroll)scroll.append(host);else seat.after(host);
   entry={key,entries,host,root:createRoot(host),sessionId,scroll,anchor:anchor.current,url:location.href};
   entry.observer=new MutationObserver(()=>{if(location.href!==entry.url||!host.isConnected||!scroll.isConnected)disposeSurface(entry);else placeOutsideFold(entry)});entry.observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});entries.set(key,entry);allMediaRoots.add(entry);
  }
  entry.anchor=anchor.current;placeOutsideFold(entry);
  const fingerprint=JSON.stringify(state.records);if(entry.fingerprint!==fingerprint){entry.fingerprint=fingerprint;entry.root.render(h(MediaRecords,{records:state.records??[],sessionId}))}
  // A Host rebase/analysis fold may replace this seat while a movie is playing.
  // The conversation DOM and plugin disposal own the independent media root.
 },[state,sessionId]);
 return h(React.Fragment,null,h('span',{ref:anchor,hidden:true}),inline&&h(MediaRecords,{records:state.records??[],sessionId}));
}
export function MediaToolView({block,phase}){if(block?.isError)return h('p',{className:'dgui-tool-error',role:'alert'},(block.content??[]).filter(c=>c.type==='text').map(c=>c.text).join('\n'));return h('p',{className:'dgui-pending',role:'status'},phase==='preparing'||phase==='start'||typeof block?.argsRaw==='string'?'Creating video…':'Video created; play it in the conversation.')}
export const MEDIA_PLAYER_CSS=`
.motion-video-player{position:relative;min-width:0;width:100%;margin:16px 0;border:1px solid #34363d;border-radius:22px;overflow:hidden;background:#101114;color:#f5f6f8;box-shadow:0 10px 26px -20px #0009;color-scheme:dark}
.motion-video-player video{display:block;width:100%;max-height:72vh;aspect-ratio:16/9;object-fit:contain;background:#000;cursor:pointer}.motion-video-player video:focus-visible{outline:2px solid #a7c4ff;outline-offset:-3px}
.motion-video-controls{display:flex;align-items:center;flex-wrap:wrap;gap:10px;padding:10px 14px 12px}.motion-video-controls .motion-video-seek{flex:0 0 100%;width:100%;margin:0;height:18px}.motion-video-controls input[type=range]{accent-color:#b7d0ff;cursor:pointer;min-width:0}.motion-video-controls input:disabled{cursor:default;opacity:.5}
.motion-video-controls button,.motion-video-controls a,.motion-video-controls select{display:inline-flex;align-items:center;justify-content:center;flex:none;min-width:34px;min-height:34px;border:1px solid transparent;border-radius:10px;padding:6px;background:transparent;color:inherit;text-decoration:none;font:inherit;cursor:pointer}.motion-video-controls select{background:#24262d;padding:5px 7px;font-size:13px}.motion-video-controls button:hover,.motion-video-controls a:hover{background:#292c34}.motion-video-controls :focus-visible,.motion-video-message button:focus-visible{outline:2px solid #b7d0ff;outline-offset:2px}.motion-video-controls button:disabled{opacity:.4;cursor:default}
.motion-video-time{font:12px ui-monospace,Consolas,monospace;white-space:nowrap;font-variant-numeric:tabular-nums;margin-right:auto}.motion-video-volume{display:flex;align-items:center;gap:4px}.motion-video-volume input{width:86px}.motion-video-controls a.motion-video-source{font-size:13px;padding-inline:8px}.motion-video-message{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:0;padding:10px 16px;font-size:14px}.motion-video-message button{border:1px solid #73798a;background:#24262d;color:inherit;border-radius:10px;padding:6px 10px;cursor:pointer}
.motion-video-player:fullscreen{display:flex;flex-direction:column;justify-content:center;width:100%;height:100%;border:0;border-radius:0;background:#000}.motion-video-player:fullscreen video{flex:1;min-height:0;max-height:none;aspect-ratio:auto;object-fit:contain}.motion-video-player:fullscreen .motion-video-controls{flex-shrink:0;background:#101114}
@media(max-width:600px){.motion-video-controls{gap:6px;padding:8px 10px}.motion-video-volume input{width:62px}.motion-video-time{font-size:11px}.motion-video-player{border-radius:18px}.motion-video-controls button,.motion-video-controls a{min-width:32px;min-height:32px}}
@media(forced-colors:active){.motion-video-player{border:1px solid CanvasText}.motion-video-controls button,.motion-video-controls a,.motion-video-controls select{border:1px solid ButtonText}.motion-video-controls input[type=range]{appearance:auto}}
.motion-review{display:flex;flex-direction:column;gap:8px;padding:0 16px 12px;border-top:1px solid #262a33}
.motion-review-toggle{align-self:flex-start;margin-top:10px;background:#24262d;color:inherit;border:1px solid #3a3f4b;border-radius:10px;padding:6px 12px;font:inherit;font-size:13px;cursor:pointer}
.motion-review-toggle:hover{background:#2b2f39}
.motion-review-body{display:flex;flex-direction:column;gap:8px}
.motion-review-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px}
.motion-review-frame{font:600 13px ui-monospace,Consolas,monospace;color:#9fe8d8;letter-spacing:.5px}
.motion-review-tc{font:12px ui-monospace,Consolas,monospace;color:#8b93a7;margin-right:auto;font-variant-numeric:tabular-nums}
.motion-review-head button{background:#24262d;color:inherit;border:1px solid #3a3f4b;border-radius:8px;padding:4px 9px;font:inherit;font-size:12px;cursor:pointer}
.motion-review-head button:hover{border-color:#5EEAD4}
.motion-review-strip{position:relative;height:36px;background:#171a20;border:1px solid #2b303a;border-radius:9px;cursor:crosshair;overflow:hidden}
.motion-review-strip:focus-visible{outline:2px solid #5EEAD4;outline-offset:2px}
.motion-review-band{position:absolute;top:0;bottom:0;background:rgba(94,234,212,.18);border-left:2px solid #5EEAD4;border-right:2px solid #5EEAD4}
.motion-review-playhead{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:#fff;opacity:.85}
.motion-review-pin{position:absolute;top:2px;transform:translateX(-50%);width:16px;height:16px;padding:0;border-radius:50%;border:0;background:#FBBF24;color:#241A05;font:600 9px/16px ui-monospace,Consolas,monospace;cursor:pointer}
.motion-review-compose{display:grid;grid-template-columns:110px minmax(0,1fr) auto;gap:8px;align-items:start}
.motion-review-compose select,.motion-review-compose textarea{background:#171a20;border:1px solid #2b303a;border-radius:8px;color:inherit;font:inherit;font-size:13px;padding:6px 8px}
.motion-review-compose textarea{resize:vertical;min-height:38px}
.motion-review-save{background:#5EEAD4;color:#04211C;border:0;border-radius:8px;padding:8px 12px;font:inherit;font-weight:600;font-size:13px;cursor:pointer;white-space:nowrap}
.motion-review-save:disabled{opacity:.6;cursor:default}
.motion-review-error{margin:0;font-size:12px;color:#fca5a5}
.motion-review-list{display:flex;flex-direction:column;gap:4px;max-height:110px;overflow:auto;font-size:12px;color:#c3cbdb}
.motion-review-list p{margin:0;line-height:1.4}
.motion-review-list strong{color:#9fe8d8;font-weight:600;font-family:ui-monospace,Consolas,monospace;font-size:11px}
.motion-review-empty{margin:0;font-size:12px;color:#7d8598}
.motion-video-player:fullscreen .motion-review{display:none}
@media(max-width:600px){.motion-review-compose{grid-template-columns:1fr}}
`;
