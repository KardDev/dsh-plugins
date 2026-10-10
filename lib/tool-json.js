// DSH adapters may represent `type: json` fields as JSON strings.
// Decode only the tool field, once; strict protocol validation still applies.
export function toolJson(value, field, maxBytes=131072){
  if(typeof value!=='string')return value;
  if(Buffer.byteLength(value,'utf8')>maxBytes)throw new Error(`DSH UI: ${field} JSON exceeds size limit`);
  try{return JSON.parse(value)}catch{throw new Error(`DSH UI: ${field} must contain valid JSON. Fix quoting/escaping. For a standalone HTML/SVG canvas, render_canvas accepts separate html/css/script fields.`)}
}
