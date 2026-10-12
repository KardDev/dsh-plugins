// Keep the default observation small; request exact node source only when editing it.
export function inspectRecord(record,state,derived,audits,{detail='summary',nodeIds=[]}={}){
  if(!['summary','nodes','full'].includes(detail))throw new Error('DSH UI: invalid inspection detail');
  const flat=list=>list.flatMap(n=>[n,...flat(n.children??[])]),nodes=flat(record.document.nodes);
  if(!Array.isArray(nodeIds)||nodeIds.length>16||nodeIds.some(id=>typeof id!=='string'||!nodes.some(n=>n.id===id)))throw new Error('DSH UI: nodeIds requires up to 16 existing IDs');
  const inferred=detail==='nodes'&&!nodeIds.length;
  if(inferred)nodeIds=nodes.slice(0,16).map(n=>n.id);
  const bounded=value=>Buffer.byteLength(JSON.stringify(value??{}))<=8192?value:{omitted:true,reason:'Value exceeds 8KiB summary budget; request full inspection.',keys:Object.keys(value??{})};
  const result={documentId:record.documentId,documentRevision:record.documentRevision??0,title:record.document.title,state:detail==='full'?state:bounded(state),derived:detail==='full'?derived:bounded(derived),audits,detail};
  if(detail==='full')result.document=record.document;
  else if(detail==='nodes'){result.nodes=nodes.filter(n=>nodeIds.includes(n.id));if(inferred&&nodes.length>16)result.selection={returned:16,total:nodes.length,remainingIds:nodes.slice(16).map(n=>n.id),hint:'Pass nodeIds to inspect additional nodes.'};}
  else result.nodes=nodes.map(n=>({id:n.id,type:n.type,...Object.fromEntries(['title','label','text','bind'].filter(k=>typeof n[k]==='string').map(k=>[k,n[k].slice(0,160)])),...(n.type==='sandbox'?{sourceCharacters:{html:n.html.length,css:n.css?.length??0,script:n.script?.length??0}}:{})}));
  return result;
}
