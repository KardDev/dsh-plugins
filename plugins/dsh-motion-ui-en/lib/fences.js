// Only assistant text projection supplies these candidates. Never infer UI
// ownership from an arbitrary JSON code block or a user/tool message.
export function extractUiFences(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>262144)return[];
 const lines=text.split('\n'),out=[];let fence=null;
 for(const line of lines){if(!fence){const m=line.match(/^ {0,3}(`{3,}|~{3,})(dsh-ui|motion-ui|svg)\s*$/i);if(m)fence={delimiter:m[1][0],count:m[1].length,language:m[2].toLowerCase(),lines:[]};continue}
  if(new RegExp('^ {0,3}'+(fence.delimiter==='`'?'`':'~')+'{'+fence.count+',}\\s*$').test(line)){out.push({language:fence.language,raw:fence.lines.join('\n'),complete:true});fence=null;if(out.length>=24)break}else fence.lines.push(line);
 }if(fence&&out.length<24)out.push({language:fence.language,raw:fence.lines.join('\n'),complete:false});return out;
}
