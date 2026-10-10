import {COMPONENTS} from './components.js';
// Expose the document skeleton to native function calling, not just prose.
// Per-component and expression checks remain in the shared runtime validator.
const dictionary=description=>({type:'object',additionalProperties:true,description});
export const DOCUMENT_PARAMETER={
  required:true,
  description:'Pass the document as an OBJECT. Do not manually escape/serialize it. For HTML/SVG source prefer render_canvas.',
  type:'object',additionalProperties:false,
    properties:{
      version:{type:'number',const:1,required:true},
      title:{type:'string',required:true},
      fallback:{type:'string',required:true,description:'Useful plain-text explanation if the UI is unavailable.'},
      nodes:{type:'array',required:true,items:{type:'object',additionalProperties:true,properties:{
        id:{type:'string',required:true,description:'Unique letter/underscore identifier; Chinese supported, max64.'},
        type:{type:'string',required:true,enum:Object.keys(COMPONENTS)},
        label:{type:'string'},title:{type:'string'},
        text:{type:'json',description:'Literal scalar or {ref}/{expr}.'},
        value:{type:'json',description:'metric: number or display string/boolean, or {ref}/{expr}. progress: numeric.'},
        rows:{type:'json',description:'table/chart: inline array of objects, {ref:"data.rows"}/{ref:"derived.rows"}, or scoped reference string.'},
        columns:{type:'array',items:{type:'object',additionalProperties:false,properties:{key:{type:'string',required:true},label:{type:'string',required:true},unit:{type:'string'}}}},
        bind:{type:'string',description:'Controls bind state.key.'},children:{type:'array',items:{type:'json'}}
      }}},
      state:dictionary('key -> {type:number/string/boolean/json,default,...}. Numeric state needs min,max,step. json is bounded array/object state for canvas controls.'),
      data:dictionary('Static data; Chinese identifier keys supported. Omit if rows are inline.'),
      derived:dictionary('Local expressions or maps. Omit when unused.'),
      actions:dictionary('Declared agent.followup actions. Omit when unused.'),
      presentation:dictionary('Optional layout/accent/density from registered tokens.')
    }
};
