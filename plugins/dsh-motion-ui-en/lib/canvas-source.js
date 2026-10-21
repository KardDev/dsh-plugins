// Repair formatting separators, preserving code samples, attribute values,
// CSS strings/comments and generated JavaScript.
export function normalizeCanvasHtml(html){
 let protectedDepth=0;
 return html.replace(/<!--[\s\S]*?-->|<(?:"[^"]*"|'[^']*'|[^'">])*>|[^<]+|</g,token=>{
  if(token.startsWith('<')){
   const tag=token.match(/^<(\/)?(pre|code|textarea|script|style)\b/i);
   if(tag)protectedDepth=Math.max(0,protectedDepth+(tag[1]?-1:1));
   return token;
  }
  return !protectedDepth&&/^(?:\s|\\[rn])+$/.test(token)?token.replace(/\\[rn]/g,'\n'):token;
 });
}
export function normalizeCanvasCss(css){
 let out='',quote='',comment=false,last='';
 for(let i=0;i<css.length;i++){
  const c=css[i],next=css[i+1];
  if(comment){out+=c;if(c==='*'&&next==='/'){out+=next;i++;comment=false}continue}
  if(quote){out+=c;if(c==='\\'&&next!==undefined){out+=next;i++}else if(c===quote)quote='';continue}
  if(c==='/'&&next==='*'){out+='/*';i++;comment=true;continue}
  if(c==='"'||c==="'"){quote=c;out+=c;last=c;continue}
  if(c==='\\'&&/[rn]/.test(next??'')&&/[{};]/.test(last)){out+='\n';i++;continue}
  out+=c;if(!/\s/.test(c))last=c;
 }
 return out;
}
export const canvasSource=node=>({html:normalizeCanvasHtml(node.html),css:normalizeCanvasCss(node.css??''),script:node.script??''});
