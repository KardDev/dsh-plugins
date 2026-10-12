// Repair transport encodings only where the component schema declares a type.
// Opaque JSON, ECharts options, source code and user data retain their contents.
export function normalizeVisual(value, schemas) {
 const unwrap=v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===1&&Array.isArray(v.item)?v.item:v;
 const scalar=(v,kind)=>kind==='number'&&typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v))?Number(v):kind==='boolean'&&(v==='true'||v==='false')?v==='true':v;
 function record(input,schema,depth=0){
  if(!input||typeof input!=='object'||Array.isArray(input)||depth>32)return input;
  const out={...input};
  for(const [key,v]of Object.entries(input)){
   const target=schema.aliases?.[key]??key,kind=schema.fields?.[target];
   if(kind==='array'||kind==='nodes'){
    let array=unwrap(v);
    if(Array.isArray(array))array=array.map(x=>kind==='nodes'?node(x,depth+1):schema.nested?.[target]?record(x,schema.nested[target],depth+1):x);
    out[key]=array;
   }else out[key]=scalar(v,kind);
  }
  return out;
 }
 function node(v,depth){
  if(!v||typeof v!=='object'||Array.isArray(v))return v;
  // Native v1 uses heading, while the extended vocabulary calls it text.
  // This spelling has an unambiguous equivalent and should not cost a retry.
  if(v.type==='heading'){v={...v,type:'text',content:v.content??v.text??v.title,size:v.size??'h3'};delete v.text;delete v.title}
  if(['card','row','col','grid'].includes(v.type)&&v.items===undefined&&Array.isArray(unwrap(v.children))){v={...v,items:unwrap(v.children)};delete v.children}
  const out=record(v,schemas[v.type]??{},depth);
  if(v.type==='quiz'&&Array.isArray(out.options))out.options=out.options.map(x=>record(x,{fields:{correct:'boolean'}}));
  if(v.type==='table')for(const key of ['rows','data','items','details'])if(Array.isArray(out[key]))out[key]=out[key].map(row=>{row=unwrap(row);return key==='details'&&Array.isArray(row)?row.map(x=>node(x,depth+1)):row});
  if(v.type==='echart')for(const key of ['data','series','links'])if(Array.isArray(out[key]))out[key]=out[key].map(x=>record(x,{fields:{value:'number',data:'array'},nested:{data:{fields:{value:'number'}}}}));
  return out;
 }
 if(Array.isArray(value))return {items:value.map(x=>node(x,0))};
 if(!value||typeof value!=='object')return value;
 const out={...value},items=unwrap(value.items);
 if(Array.isArray(items))out.items=items.map(x=>node(x,0));
 return out;
}
