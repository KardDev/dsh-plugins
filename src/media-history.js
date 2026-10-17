const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const allowedFiles=new Set(['video.mp4','poster.jpg','source.html','project.zip']);
// Durable tool output is also available in older conversations. Never execute
// returned HTML or trust arbitrary URLs/file paths from a result.
export function mediaRecord(message){
 if(message?.isError)return null;
 for(const part of message?.content??[]){
  if(part.type!=='text'||typeof part.text!=='string'||part.text.length>2_000_000)continue;
  try{
   const value=JSON.parse(part.text.split('\n',1)[0]);
   if(!uuid.test(value.id)||!['render','process'].includes(value.kind)||value.status!=='completed'||typeof value.sessionId!=='string'||!value.sessionId||value.sessionId.length>256)continue;
   const files=(value.files??[]).map(f=>typeof f==='string'?f:f?.name).filter(f=>allowedFiles.has(f));
   if(!files.includes('video.mp4'))continue;
   const output=value.output??{},positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0?n:null;
   return {id:value.id,sessionId:value.sessionId,kind:value.kind,files:[...new Set(files)],documentId:uuid.test(value.documentId)?value.documentId:null,documentRevision:Number.isSafeInteger(value.documentRevision)&&value.documentRevision>=0?value.documentRevision:null,nodeId:typeof value.nodeId==='string'?value.nodeId:null,duration:positive(output.duration),width:positive(output.width),height:positive(output.height),hasAudio:Array.isArray(output.audio)?output.audio.length>0:null};
  }catch{/* Unrelated or malformed tool output remains a normal tool result. */}
 }
 return null;
}
export function mediaAssetUrl(record,file){
 if(!record||!uuid.test(record.id)||typeof record.sessionId!=='string'||!record.sessionId||!allowedFiles.has(file)||!record.files?.includes(file))return null;
 return '/api/plugins/dsh-generative-ui/media?assetId='+record.id+'&sessionId='+encodeURIComponent(record.sessionId)+'&file='+encodeURIComponent(file);
}
export const mediaHistoryDefinition={
 kind:'dshMotionMedia',target:'chat',
 match(event){
  if(event.type==='turn/start')return{id:String(event.data.turn),role:'start'};
  if(event.type==='tool/result'&&event.surfaceOp==='append'&&mediaRecord(event.data.message))return{id:String(event.data.turn),role:'update'};
  return null;
 },
 start(_context,{event}){return{turn:event.data.turn,records:[]}},
 update({state},{event}){
  const record=mediaRecord(event.data.message);if(!record)return state;
  const key=record.kind==='render'&&record.documentId?record.documentId+':'+record.nodeId:record.id;
  const index=state.records.findIndex(r=>r.key===key);
  if(index>=0&&state.records[index].id===record.id)return state;
  const records=[...state.records];if(index>=0)records[index]={...record,key};else records.push({...record,key});
  return{...state,anchorSeq:state.anchorSeq??event.seq,records};
 },
 publication:()=> 'immediate',
 buildViewNode(c){if(!c.state)return null;return{key:c.key,id:c.id,kind:'dshMotionMedia',target:'chat',anchorSeq:c.state.anchorSeq??c.start?.event.seq??0,location:c.start?.location??c.matches?.[0]?.location??{kind:'unresolved'},visibility:c.state.records.length?'visible':'hidden',data:c.state}}
};
