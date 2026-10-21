// Human review annotations for rendered media, stored as JSONL next to the
// document store. One file per document revision keeps an edit and the
// critique that motivated it in the same place, which is what makes the
// record usable as a preference pair later.
import {mkdir,readFile,appendFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

const ID=/^[A-Za-z0-9_-]{8,64}$/;
const CATEGORIES=['copy','layout','motion','color','timing'];
const fail=(status,message)=>{const error=new Error(message);error.status=status;return error};

export class ReviewStore{
  constructor(directory,uiStore){
    this.directory=join(directory,'reviews');
    this.ui=uiStore;
  }
  file(documentId,revision){
    if(!ID.test(String(documentId??'')))throw fail(400,'Invalid document id');
    const rev=Number(revision);
    if(!Number.isSafeInteger(rev)||rev<0)throw fail(400,'Invalid revision');
    return join(this.directory,`${documentId}@${rev}.jsonl`);
  }
  normalize(input){
    if(!input||typeof input!=='object'||Array.isArray(input))throw fail(400,'Invalid review body');
    const rawFps=Number(input.fps);
    const fps=Number.isFinite(rawFps)&&rawFps>=1&&rawFps<=120?rawFps:30;
    const category=CATEGORIES.includes(input.category)?input.category:null;
    if(!category)throw fail(400,'Invalid category');
    const critique=typeof input.critique==='string'?input.critique.trim():'';
    if(!critique)throw fail(400,'Critique is required');
    if(critique.length>2000)throw fail(400,'Critique must be at most 2000 characters');
    const anchor=input.anchor;
    if(!anchor||typeof anchor!=='object')throw fail(400,'Missing anchor');
    const assetId=typeof input.assetId==='string'?input.assetId.slice(0,80):null;
    if(input.scope==='range'){
      const startFrame=Math.round(Number(anchor.startFrame));
      const endFrame=Math.round(Number(anchor.endFrame));
      if(!Number.isSafeInteger(startFrame)||!Number.isSafeInteger(endFrame)||startFrame<0||endFrame<startFrame)
        throw fail(400,'Invalid range anchor');
      return {scope:'range',category,critique,assetId,fps,
        anchor:{startFrame,endFrame,startTime:+(startFrame/fps).toFixed(3),endTime:+(endFrame/fps).toFixed(3),frames:endFrame-startFrame+1}};
    }
    const frame=Math.round(Number(anchor.frame));
    if(!Number.isSafeInteger(frame)||frame<0)throw fail(400,'Invalid frame anchor');
    return {scope:'frame',category,critique,assetId,fps,anchor:{frame,time:+(frame/fps).toFixed(3)}};
  }
  async append(documentId,revision,sessionId,input){
    const file=this.file(documentId,revision);
    const record=await this.ui.owned(documentId,sessionId);
    const entry={id:randomUUID(),createdAt:new Date().toISOString(),status:'open',
      documentId,documentRevision:Number(revision),nodeId:record.document?.nodes?.find?.(n=>n.type==='sandbox')?.id??null,
      ...this.normalize(input)};
    await mkdir(this.directory,{recursive:true});
    await appendFile(file,JSON.stringify(entry)+'\n','utf8');
    return entry;
  }
  async list(documentId,revision,sessionId){
    const file=this.file(documentId,revision);
    await this.ui.owned(documentId,sessionId);
    let text='';
    try{text=await readFile(file,'utf8')}catch(e){if(e.code!=='ENOENT')throw e}
    const items=text.split('\n').filter(Boolean).map(line=>{try{return JSON.parse(line)}catch{return null}}).filter(Boolean);
    return {documentId,revision:Number(revision),items,total:items.length};
  }
}

export function reviewRoute(reviews){
  return async request=>{
    const respond=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
    try{
      const url=new URL(request.url);
      const documentId=url.searchParams.get('documentId');
      const sessionId=url.searchParams.get('sessionId');
      const revision=Number(url.searchParams.get('revision')??0);
      if(request.method==='GET')return respond(await reviews.list(documentId,revision,sessionId));
      if(request.method!=='POST')throw fail(405,'Method not allowed');
      if(!request.headers.get('content-type')?.startsWith('application/json'))throw fail(415,'JSON body required');
      const text=await request.text();
      if(Buffer.byteLength(text)>8192)throw fail(413,'Review too large');
      let input;try{input=JSON.parse(text)}catch{throw fail(400,'Invalid JSON body')}
      return respond({entry:await reviews.append(documentId,revision,sessionId,input)});
    }catch(e){const status=e.status??500;return respond({error:status===500?'Could not access review data':e.message},status)}
  };
}
