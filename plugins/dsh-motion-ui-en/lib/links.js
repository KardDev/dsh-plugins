export function validateLink(node){
 const fail=message=>{throw Error('DSH UI: '+message)};
 if([node.href,node.path,node.action].filter(v=>v!==undefined).length!==1)fail(`node.${node.id}: choose exactly one href (http/https), path (file), or action (Agent follow-up)`);
 if(node.variant!==undefined&&!['primary','secondary','text'].includes(node.variant))fail('link/button variant must be primary/secondary/text');
 if(node.href!==undefined){
  if(typeof node.href!=='string'||node.href.length>8192||/[\u0000-\u0020\u007f]/.test(node.href)||!/^https?:\/\//i.test(node.href))fail('href must be an absolute http/https URL; encode spaces');
  let url;try{url=new URL(node.href)}catch{fail('invalid href URL')}
  if(!url.hostname||url.username||url.password)fail('href must have a host and must not contain credentials');
 }
 if(node.path!==undefined){
  if(typeof node.path!=='string'||!node.path.trim()||node.path.length>8192||/[\u0000-\u001f\u007f]/.test(node.path)||/^\s*(?:[a-z][a-z\d+.-]*:|[\\/]{2})/i.test(node.path)&&!/^\s*[a-z]:[\\/]/i.test(node.path))fail('path must be a local file path, not a URL, network path or command');
 }
}
