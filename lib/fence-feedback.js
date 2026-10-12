import {randomUUID,createHash} from 'node:crypto';
import {extractUiFences} from './fences.js';
import {resolveSourceFence} from './delivery.js';
const fingerprint=raw=>createHash('sha256').update(raw).digest('hex').slice(0,16);
const textOf=content=>Array.isArray(content)?content.filter(x=>x.type==='text').map(x=>x.text??'').join('\n'):'';
export function isUiDeliveryAnnouncement(text,request=''){
 const value=text.trim();
 // Only short visible delivery announcements, never private reasoning or
 // substantive answers, source fences, lists, or questions about UI concepts.
 if(!value||value.length>240||/```|(?:^|\n)\s*(?:[-*]|\d+[.)、])\s*/.test(value))return false;
 if(/(?:什么是|何时|什么时候|为什么|为何|区别|能做什么|有哪些能力).{0,20}(?:UI|界面|组件|流程图|图表|可视化)/i.test(request))return false;
 if(!/(?:UI\b|界面|组件|流程图|图表|可视化|(?:一张|这张)图|render_(?:text|ui|canvas))/i.test(value))return false;
 return /(?:现在|接下来|马上|我会|我来|我将|准备|这就).{0,40}(?:补上|生成|展示|绘制|画|做|调用|制作|呈现)|(?:用|通过).{0,12}(?:流程图|图表|可视化|界面).{0,16}(?:看|展示|呈现|说明|讲|清楚|直观)|我把.{0,70}(?:图上|图中).{0,20}(?:看|展示|呈现)|I(?:'ll| will| am going to).{0,40}(?:render|create|draw|show)/i.test(value);
}
export function registerFenceFeedback(ctx,enabled=()=>true){
 if(typeof ctx.on!=='function')return {available:false};
 const sessions=new Map();
 const fresh=turn=>({turn,blocks:new Map(),corrected:new Set(),notices:new Set(),calls:new Map(),toolFailures:new Map(),seenToolCall:false,silentRequested:false,request:'',delivered:false,lastText:'',count:0});
 function observe(session,event){
  const id=String(session.id);if(event.type==='turn/start'){sessions.set(id,fresh(event.data.turn));return}
  let state=sessions.get(id);if(!state){state=fresh(event.data?.turn);sessions.set(id,state)}
  if(event.type==='assistant/message'){state.lastText=textOf(event.data.message?.content).slice(0,262144);state.blocks.set(event.data.step??0,state.lastText)}
  if(event.type==='tool/call')state.seenToolCall=true;
  if(event.type==='user/message'&&event.data.source?.kind==='user'){state.request=textOf(event.data.content).slice(0,8192);state.silentRequested=/(?:不用|不必|无需|不要)回复|do not (?:respond|reply)|no (?:response|reply) (?:needed|required)/i.test(state.request)}
  if(event.type==='tool/call'&&['render_text','render_ui','render_canvas','update_ui','patch_ui'].includes(event.data.name))state.calls.set(event.data.callId,event.data.name);
  if(event.type==='tool/result'){
   const message=event.data.message,name=state.calls.get(message?.toolCallId);
   if(name){if(message.isError){const diagnostic=name+': '+textOf(message.content).slice(0,1200);state.toolFailures.set(fingerprint(diagnostic),diagnostic)}else state.delivered=true}
  }
  if(event.type==='user/message'&&(event.data.source?.kind==='plugin:motion-ui'||event.data.source?.plugin==='motion-ui')&&!state.notices.has(event.data.id)){
   state.notices.add(event.data.id);state.count++;
   for(const match of textOf(event.data.content).matchAll(/\[motion-repair:([a-f0-9]{16})\]/g))state.corrected.add(match[1]);
  }
 }
 const restore=session=>{if(!sessions.has(String(session.id)))for(const event of session.snapshotEvents?.()??[])observe(session,event)};
 ctx.on('session/event',(session,event)=>{restore(session);observe(session,event)});
 ctx.on('session/disposed',session=>sessions.delete(String(session.id)));
 ctx.on('agent/turn-stopping',({agent,turn,signal})=>{
  if(!enabled()||signal?.aborted||agent.session.header?.parentSession!==undefined||typeof agent.steer!=='function')return;
  restore(agent.session);const state=sessions.get(String(agent.session.id));if(!state||state.turn!==turn||state.count>=2)return;
  const failures=[];
  for(const text of state.blocks.values())for(const fence of extractUiFences(text)){
   const key=fingerprint(fence.raw);if(state.corrected.has(key))continue;
   const result=resolveSourceFence(fence.raw,{svg:fence.language==='svg'});if(result.marker||result.valid&&result.complete)continue;
   failures.push({key,diagnostic:result.diagnostics?.map(x=>x.message).join('; ').slice(0,1200)});
  }
  // A failed UI tool followed by a reasoning-only stop is unfinished work.
  // Do not infer intent from private reasoning or interrupt useful text answers.
  if(!state.delivered&&!state.lastText.trim())for(const[key,diagnostic]of state.toolFailures)if(!state.corrected.has(key))failures.push({key,diagnostic,tool:true});
  const emptyKey=fingerprint('empty-visible-turn');
  if(!state.silentRequested&&!state.seenToolCall&&state.blocks.size&&[...state.blocks.values()].every(text=>!text.trim())&&!state.corrected.has(emptyKey))failures.push({key:emptyKey,empty:true,diagnostic:'The turn is ending with no visible answer and no tool call. No requested work has been delivered.'});
  const visible=[...state.blocks.values()].join('\n').trim(),promiseKey=fingerprint('announcement:'+visible);
  if(!state.silentRequested&&!state.delivered&&isUiDeliveryAnnouncement(visible,state.request)&&!state.corrected.has(promiseKey))failures.push({key:promiseKey,empty:true,diagnostic:'The visible answer only announces a UI, but no UI was delivered. Complete the promised work instead of ending with a delivery announcement.'});
  if(!failures.length)return;
  const chosen=failures.slice(0,4);state.count++;chosen.forEach(f=>state.corrected.add(f.key));
  const text=chosen.map(f=>'[motion-repair:'+f.key+'] '+f.diagnostic).join('\n')+'\n'+(chosen.some(f=>f.empty)?'Complete the user task with an actual visible answer. If a UI helps, submit it through the appropriate rendering tool or a complete source fence; otherwise answer in plain text. Do not finish with only a plan or promise. This notice does not require a UI, limit reasoning or stop generation.':'Motion UI delivery is incomplete. '+(chosen.some(f=>f.tool)?'A rendering tool failed and your last response contained no visible answer. Correct the actual failed tool arguments and submit a complete UI, or provide a useful text fallback. A promise to render later is not delivery. ':'Correct only the failed source fence(s), retaining their intended content. ')+'Do not repeat successful UIs or call render_ui for an already rendered fence. Use ui_catalog or validate_ui for exact syntax. If the same defect cannot be corrected, give a useful text fallback. This notice does not limit your reasoning or stop generation.');
  const source=(agent.session.header?.version??4)>=4?{kind:'plugin:motion-ui',form:'notice',summary:'Motion UI delivery repair'}:{kind:'plugin',plugin:'motion-ui',form:'notice',summary:'Motion UI delivery repair'};
  const id=randomUUID();state.notices.add(id);
  try{agent.steer({id,role:'user',content:[{type:'text',text}],source})}catch(e){ctx.logger?.warn?.('Motion UI correction could not be queued: '+e.message)}
 });return {available:true};
}
