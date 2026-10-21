export const fenceUiDefinition={
 kind:'dshUiFences',target:'chat',
 match(event){if(event.type==='turn/start')return{id:String(event.data.turn),role:'start'};if(['turn/end','assistant/message','chunkrow/text-chunks','llm/retry'].includes(event.type)||['assistant/chunk','assistant/live-chunk'].includes(event.type)&&event.data.chunk?.type==='text-delta')return{id:String(event.data.turn),role:'update'};return null},
 start(_c,{event}){return{turn:event.data.turn,blocks:[],settled:false}},
 update({state},{event}){
  if(event.type==='turn/end')return{...state,settled:true};if(state.settled)return state;
  const step=event.data.step;
  if(event.type==='llm/retry')return{...state,invalidated:[...(state.invalidated??[]),step].slice(-48),blocks:state.blocks.filter(b=>b.step!==step)};
  if(event.type==='assistant/message'){
   const blocks=(event.data.message?.content??[]).flatMap((b,index)=>b.type==='text'?[{step,index,text:b.text}]:[]);
   return{...state,everUi:state.everUi||blocks.some(b=>/(?:```|~~~)(?:dsh-ui|motion-ui|svg)/i.test(b.text)),anchorSeq:state.anchorSeq??event.seq,blocks:[...state.blocks.filter(b=>b.step!==step),...blocks].slice(-48)};
  }
  const chunk=event.type==='chunkrow/text-chunks'?{index:event.data.index,text:event.data.texts.join('')}:event.data.chunk,previous=state.blocks.find(b=>b.step===step&&b.index===chunk.index),text=(previous?.text??'')+(chunk.text??chunk.delta??'');
  if(text.length>262144)return state;
  return{...state,everUi:state.everUi||/(?:```|~~~)(?:dsh-ui|motion-ui|svg)/i.test(text),anchorSeq:state.anchorSeq??event.seq,blocks:[...state.blocks.filter(b=>b!==previous),{step,index:chunk.index,text}].slice(-48)};
 },
 publication:()=> 'immediate',
 buildViewNode(c){if(!c.state)return null;return{key:c.key,id:c.id,kind:'dshUiFences',target:'chat',anchorSeq:c.state.anchorSeq??c.start?.event.seq??0,location:c.start?.location??c.matches[0]?.location??{kind:'unresolved'},visibility:c.state.everUi||c.state.blocks.some(b=>/```(?:dsh-ui|motion-ui|svg)|~~~(?:dsh-ui|motion-ui|svg)/i.test(b.text))?'visible':'hidden',data:c.state}}
};

