import {LIMITS} from '../lib/protocol.js';
const names=new Set(['render_ui','render_canvas','render_text']);
// This projection is transient. Only successful durable tool results can
// become interactive documents; replay never invents a successful tool call.
export const streamUiDefinition={
  kind:'dshUiStream',target:'chat',
  match(event){
    if(event.type==='turn/start')return{id:String(event.data.turn),role:'start'};
    if(event.type==='turn/end'||event.type==='tool/call'&&names.has(event.data.name)||event.type==='tool/result'||event.type==='llm/retry'||event.type==='chunkrow/tool-call-chunks'||['assistant/chunk','assistant/live-chunk'].includes(event.type)&&event.data.chunk?.type==='tool-call-delta')return{id:String(event.data.turn),role:'update'};
    return null;
  },
  start(_context,{event}){return{turn:event.data.turn,calls:[],invalidated:[],settled:false}},
  update({state},{event}){
    if(event.type==='turn/end')return{...state,calls:[],settled:true};
    if(state.settled)return state;
    if(event.type==='tool/call'){
      const call={key:`${event.data.step}:durable:${event.data.callId}`,callId:event.data.callId,name:event.data.name,raw:event.data.arguments??event.data.argsRaw??''};
      if(typeof call.raw!=='string'||call.raw.length>LIMITS.bytes)return state;
      return{...state,anchorSeq:state.anchorSeq??event.seq,calls:[...state.calls.filter(c=>c.callId!==call.callId),call].slice(-24)};
    }
    if(event.type==='llm/retry')return{...state,invalidated:[...state.invalidated,...state.calls.filter(c=>c.key.startsWith(`${event.data.step}:`)).map(c=>c.callId)].slice(-48),calls:state.calls.filter(c=>!c.key.startsWith(`${event.data.step}:`))};
    if(event.type==='tool/result'){
      if(!event.data.message.isError)return state;
      return{...state,invalidated:[...state.invalidated,event.data.callId].slice(-48),calls:state.calls.filter(c=>c.callId!==event.data.callId)};
    }
    const chunk=event.type==='chunkrow/tool-call-chunks'?{...event.data,argumentsDelta:event.data.args.join('')}:event.data.chunk,key=`${event.data.step}:${chunk.index}`,previous=state.calls.find(c=>c.key===key);
    const name=chunk.name??previous?.name;
    if(!names.has(name))return state;
    const raw=(previous?.raw??'')+(chunk.argumentsDelta??'');
    if(raw.length>LIMITS.bytes)return{...state,calls:state.calls.filter(c=>c.key!==key)};
    const call={key,name,callId:previous?.callId??String(chunk.id),raw};
    return{...state,anchorSeq:state.anchorSeq??event.seq,calls:[...state.calls.filter(c=>c.key!==key),call].slice(-24)};
  },
  publication:()=> 'immediate',
  buildLocationData({state},scope,previous){
    if(scope!=='turn'||!state)return null;
    if(previous?.value===state)return previous;
    return{kind:'turn',turn:state.turn,key:'dshUiStream',value:state};
  },
  buildViewNode(context){
    const state=context.state;
    if(!state)return null;
    return{key:context.key,id:context.id,kind:'dshUiStream',target:'chat',anchorSeq:state.anchorSeq??context.start?.event.seq??0,location:context.start?.location??context.matches[0]?.location??{kind:'unresolved'},visibility:state.settled||state.anchorSeq===undefined?'hidden':'visible',data:state};
  }
};
