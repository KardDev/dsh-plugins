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
        items:{type:'array',description:'steps only: direct array, not {item:[...]}. 1..12 step objects. Omit status for a static process guide.',items:{type:'object',additionalProperties:false,properties:{
          title:{type:'string',required:true},description:{type:'string'},status:{type:'string',enum:['pending','active','done','error']}
        }}},
        open:{type:'boolean',description:'details only; defaults to closed.'},
        icon:{type:'string'},tone:{type:'string'},surface:{type:'string'},
        max:{type:'json',description:'progress only: positive numeric value or binding.'},unit:{type:'string'},decimals:{type:'number'},
        action:{type:'string',description:'button only: a key declared in document.actions.'},
        kind:{type:'string',enum:['bar','line']},labelKey:{type:'string'},valueKey:{type:'string'},xScale:{type:'string'},
        html:{type:'string'},css:{type:'string'},script:{type:'string'},fallback:{type:'string'},height:{type:'number'},
        stateKeys:{type:'array',items:{type:'string'}},dataKeys:{type:'array',items:{type:'string'}},derivedKeys:{type:'array',items:{type:'string'}},
        text:{type:'json',description:'Literal scalar or {ref}/{expr}.'},
        value:{type:'json',description:'metric: number or display string/boolean, or {ref}/{expr}. progress: numeric.'},
        rows:{type:'json',description:'table/chart: inline array of objects, {ref:"data.rows"}/{ref:"derived.rows"}, or scoped reference string.'},
        columns:{type:'array',items:{type:'object',additionalProperties:false,properties:{key:{type:'string',required:true},label:{type:'string',required:true},unit:{type:'string'}}}},
        bind:{type:'string',description:'Controls bind state.key.'},children:{type:'array',description:'row/column/card/details: array of registered nodes using the same fields and type-specific rules. steps uses items instead of children.',items:{type:'json'}}
      }}},
      state:dictionary('key -> state specification object, e.g. {people:{type:"number",default:2,min:1,max:12,step:1}}. Numeric defaults/min/max/step are JSON numbers, no units. String/boolean/json state keeps its declared type; options is a direct scalar array. Do not omit numeric limits. json is bounded array/object state for canvas controls.'),
      data:dictionary('Static data; Chinese identifier keys supported. Omit if rows are inline.'),
      derived:dictionary('Local formulas, e.g. {food:{expr:"state.people * state.days * 100"}}. Prefer expr shorthand to deeply nested op/args. round(x) has one argument and uses Math.round (ties toward positive infinity); ceil/floor are not native formula functions. op/args uses direct arrays and numeric constants, not item wrappers. Use ui_catalog for protocol questions, not installation source searches. Omit when unused.'),
      actions:dictionary('Declared agent.followup actions. Omit when unused.'),
      presentation:dictionary('Optional layout/accent/density from registered tokens.')
    }
};
