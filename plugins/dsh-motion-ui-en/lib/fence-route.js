import {createHash} from 'node:crypto';
import {validateDocument} from './protocol.js';
export function fenceRoute(store){return async request=>{
 try{
  if(request.method!=='POST')return Response.json({error:'POST required'},{status:405});
  if(!request.headers.get('content-type')?.startsWith('application/json'))return Response.json({error:'JSON required'},{status:415});
  const body=await request.text();if(Buffer.byteLength(body)>150000)return Response.json({error:'Fence too large'},{status:413});
  const input=JSON.parse(body);if(!input||typeof input.sessionId!=='string'||!input.sessionId.trim()||input.sessionId.length>256||typeof input.source!=='string'||!/^[\w:.-]{1,128}$/.test(input.source)||Object.keys(input).some(k=>!['sessionId','source','document'].includes(k)))throw Error('Invalid fence identity');
  const document=validateDocument(input.document),hash=createHash('sha256').update(input.sessionId+'\0'+input.source+'\0'+JSON.stringify(document)).digest('hex');
  const id=hash.slice(0,8)+'-'+hash.slice(8,12)+'-4'+hash.slice(13,16)+'-a'+hash.slice(17,20)+'-'+hash.slice(20,32);
  let record;try{record=await store.owned(id,input.sessionId)}catch(e){if(e.status!==404)throw e;record=await store.create(document,{documentId:id,sessionId:input.sessionId,callId:'fence:'+input.source})}
  return Response.json(record,{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e.message},{status:e.status??400})}
}}
