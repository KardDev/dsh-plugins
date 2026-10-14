import {componentFields} from './components.js';
// Keep the default observation small; request exact node source only when editing it.
export function inspectRecord(record,state,derived,audits,{detail='summary',nodeIds=[],query=''}={}){
  if(!['summary','nodes','full'].includes(detail))throw new Error('DSH UI: invalid inspection detail');
  if(typeof query!=='string'||query.length>200)throw new Error('DSH UI: inspection query must be text of at most200 characters');
  const locations=new Map();const flat=(list,parentId=null,path='nodes')=>list.flatMap((n,index)=>{locations.set(n.id,{path:path+'['+index+']',parentId,position:index+1});return[n,...flat(n.children??[],n.id,path+'['+index+'].children')]});const nodes=flat(record.document.nodes);
  const matches=query.trim()?nodes.filter(n=>[n.id,n.type,n.title,n.label,n.text,n.code,n.type==='visual'?JSON.stringify(n.spec):''].some(v=>typeof v==='string'&&v.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))):nodes;
  if(!Array.isArray(nodeIds)||nodeIds.length>16||nodeIds.some(id=>typeof id!=='string'||!nodes.some(n=>n.id===id)))throw new Error('DSH UI: nodeIds requires up to 16 existing IDs');
  const inferred=detail==='nodes'&&!nodeIds.length;
  if(query.trim()&&nodeIds.length)throw new Error('DSH UI: choose query OR nodeIds, not both');
  if(inferred)nodeIds=matches.slice(0,16).map(n=>n.id);
  const bounded=value=>Buffer.byteLength(JSON.stringify(value??{}))<=8192?value:{omitted:true,reason:'Value exceeds 8KiB summary budget; request full inspection.',keys:Object.keys(value??{})};
  const result={documentId:record.documentId,documentRevision:record.documentRevision??0,title:record.document.title,state:detail==='full'?state:bounded(state),derived:detail==='full'?derived:bounded(derived),audits,detail,visualCheck:{status:audits.length?(audits.some(a=>a.issues.length)?'issues-observed':'no-issues-in-covered-checks'):'unobserved',observedViews:audits.length,issueCount:audits.reduce((n,a)=>n+a.issues.length,0),note:'Heuristic client observations only; absence is not a pass. Targets are scoped to this UI/canvas, not the host page.'}};
  if(query.trim())result.search={query:query.trim(),matched:matches.length,returned:Math.min(matches.length,16),targets:matches.slice(0,16).map(n=>({id:n.id,type:n.type,...locations.get(n.id)}))};
  if(detail==='full')result.document=record.document;
  else if(detail==='nodes'){result.nodes=nodes.filter(n=>nodeIds.includes(n.id));if(inferred&&matches.length>16)result.selection={returned:16,total:matches.length,remainingIds:matches.slice(16).map(n=>n.id),hint:'Pass nodeIds to inspect additional nodes.'};}
  else result.nodes=(query.trim()?matches.slice(0,16):nodes).map(n=>({id:n.id,type:n.type,...locations.get(n.id),editableProps:componentFields(n.type).filter(k=>!['id','type','children','bind','action'].includes(k)),...Object.fromEntries(['title','label','text','bind'].filter(k=>typeof n[k]==='string').map(k=>[k,n[k].slice(0,160)])),...(n.type==='sandbox'?{sourceCharacters:{html:n.html.length,css:n.css?.length??0,script:n.script?.length??0}}:{})}));
  return result;
}
