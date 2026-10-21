// DSH adapters may represent `type: json` fields as JSON strings.
// Decode only the tool field, once; strict protocol validation still applies.
function clean(source) {
  let input=source.trim().replace(/^\uFEFF/, '');
  const fence=input.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
  if(fence)input=fence[1];
  let output='',quoted=false,escaped=false;
  for(let i=0;i<input.length;i++){
    const c=input[i];
    if(quoted){output+=c;if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
    if(c==='"')quoted=true;
    if(c===',' && /^\s*[}\]]/.test(input.slice(i+1)))continue;
    output+=c;
  }
  return output;
}
export function toolJson(value, field, maxBytes=131072){
  if(typeof value!=='string')return value;
  if(new TextEncoder().encode(value).length>maxBytes)throw new Error(`DSH UI: ${field} JSON exceeds size limit`);
  const source=clean(value);
  try{return JSON.parse(source)}catch(error){
    const position=error.message.match(/position (\d+)/)?.[1];
    const location=position===undefined?'':` at line ${source.slice(0,Number(position)).split('\n').length}, column ${Number(position)-source.lastIndexOf('\n',Number(position)-1)}`;
    throw new Error(`DSH UI: ${field} must contain valid JSON${location}. Pass an object directly, not a manually escaped JSON string. Do not use single-quoted keys or raw newlines inside strings. For HTML/SVG use render_canvas with separate html/css/script fields. No partial document was saved.`);
  }
}
// Some provider adapters emit "" for absent optional JSON fields. This is an
// omission only at optional boundaries, never a repair for required documents.
export function optionalToolJson(value,field,fallback){
 return value==null||(typeof value==='string'&&!value.trim())?fallback:toolJson(value,field);
}
