import {COMPONENTS} from './components.js';
// Expose the document skeleton to native function calling, not just prose.
// Per-component and expression checks remain in the shared runtime validator.
const dictionary=description=>({type:'object',additionalProperties:true,description});
export const DOCUMENT_PARAMETER={
  required:true,
  description:'Pass one COMPLETE object, never manually serialize or send a partial patch. v1 always needs nodes:[...] beside state/derived; state alone creates no controls. Choose v1 {version:1,title,fallback,nodes} for shared state/formulas/canvas, OR extended {title,items:[components]} for charts/plots/quiz/forms/mermaid/3D. Do not mix the two root languages.',
  type:'object',additionalProperties:false,
    properties:{
      version:{type:'number',const:1},
      title:{type:'string',required:true},
      fallback:{type:'string',description:'Required for v1 nodes: useful plain-text explanation if UI is unavailable.'},
      items:{type:'array',description:'Extended visual components: use their compact type-specific fields. See injected guide or ui_catalog topic=visual.',items:{type:'json'}},
      nodes:{type:'array',items:{type:'object',additionalProperties:true,properties:{
        id:{type:'string',required:true,description:'Unique letter/underscore identifier; Chinese supported, max64.'},
        type:{type:'string',required:true,enum:Object.keys(COMPONENTS)},
        spec:{type:'json',description:'visual only: extended {title?,items:[components]} composition.'},stateKey:{type:'string',description:'visual only: optional dedicated json state key, auto-created when omitted.'},warnings:{type:'json'},
        label:{type:'string'},title:{type:'string'},
        copyable:{type:'boolean',description:'text only: rounded reusable text block with a copy button.'},code:{type:'string',description:'code only: literal source, preserved exactly and never executed.'},lang:{type:'string'},wrap:{type:'boolean'},
        items:{type:'array',description:'steps only: direct array, not {item:[...]}. 1..12 step objects. Omit status for a static process guide.',items:{type:'object',additionalProperties:false,properties:{
          title:{type:'string',required:true},description:{type:'string'},status:{type:'string',enum:['pending','active','done','error']}
        }}},
        open:{type:'boolean',description:'details only; defaults to closed.'},
        icon:{type:'string'},tone:{type:'string'},surface:{type:'string'},
        size:{type:'json',description:'text/heading: 12..48 pixels or sm/md/lg/xl/hero.'},weight:{type:'number',enum:[400,500,600,700,800]},color:{type:'string',description:'default/muted/accent/success/warning/danger/violet or #RGB/#RRGGBB.'},align:{type:'string',enum:['left','center','right']},lineHeight:{type:'number'},
        spans:{type:'json',description:'text/heading: array of {text,size?,weight?,color?}; use instead of text for inline emphasis.'},gap:{type:'number'},
        max:{type:'json',description:'progress only: positive numeric value or binding.'},unit:{type:'string'},decimals:{type:'number'},
        action:{type:'string',description:'button only: a key declared in document.actions.'},
        href:{type:'string',description:'link/button: absolute http/https URL. Choose exactly one href/path/action.'},path:{type:'string',description:'link/button: local file path opened through DSH on user click; never a shell command.'},variant:{type:'string',enum:['primary','secondary','text','dropdown','segmented']},
        kind:{type:'string',enum:['bar','line']},labelKey:{type:'string'},valueKey:{type:'string'},xScale:{type:'string'},
        html:{type:'string'},css:{type:'string'},script:{type:'string'},fallback:{type:'string'},height:{type:'number'},
        libraries:{type:'array',items:{type:'string',enum:['mechanism']},description:'Optional local mechanism drawing helper; ui_catalog topic=mechanism.'},stateKeys:{type:'array',items:{type:'string'}},dataKeys:{type:'array',items:{type:'string'}},derivedKeys:{type:'array',items:{type:'string'}},
        text:{type:'json',description:'Literal scalar or {ref}/{expr}.'},
        value:{type:'json',description:'metric: number or display string/boolean, or {ref}/{expr}. progress: numeric.'},
        rows:{type:'json',description:'table/chart: inline rows with literal or formula cells, e.g. [{label:"餐饮",value:{ref:"derived.food"}}] or [{label:"住宿",value:{expr:"ceil(state.people / 2) * state.room"}}]. This is the simplest live breakdown; no map required. Also accepts {ref:"data.rows"}/{ref:"derived.rows"}, or scoped reference string.'},
        columns:{type:'json',description:'table: column object array; row: optional integer 1..4 for equal grid columns.'},
        bind:{type:'string',description:'Controls bind state.key.'},children:{type:'array',description:'row/column/card/details: array of registered nodes using the same fields and type-specific rules. steps uses items instead of children.',items:{type:'json'}}
      }}},
      state:dictionary('key -> state specification object, e.g. {people:{type:"number",default:2,min:1,max:12,step:1}}. Numeric defaults/min/max/step are JSON numbers, no units. String/boolean/json state keeps its declared type; options is a direct scalar array. Do not omit numeric limits. json is bounded array/object state for canvas controls.'),
      data:dictionary('Static data; Chinese identifier keys supported. Omit if rows are inline.'),
      derived:dictionary('Local formulas, e.g. {food:{expr:"state.people * state.days * 100"}}. Prefer expr shorthand to deeply nested op/args. round(x), ceil(x), floor(x) and abs(x) each take one argument. ceil(state.people / 2) is supported directly; do not search source or switch to a canvas for rounding. op/args uses direct arrays and numeric constants, not item wrappers. Use ui_catalog for protocol questions, not installation source searches. Omit when unused.'),
      actions:dictionary('Declared agent.followup actions. Omit when unused.'),
      presentation:dictionary('Optional layout/accent/density and preset: reading/brief/comparison/list/callout/scorecard/flow/minimal. Every document owns its own styles.')
    }
};

// Keep the native transport schema shallow. A recursively expanded union of
// every component makes the lightweight tool harder to call; the shared
// runtime validator still enforces exact component fields and limits.
export const TEXT_BLOCKS_PARAMETER={type:'array',required:true,items:{type:'json'},description:'Direct array of text strings or native v1 nodes with optional IDs. Examples: [{type:"text",text:"Answer"}], or [{type:"steps",items:[{title:"First",description:"One sentence"}]}]. Reusable text: {type:"text",copyable:true,title:"Draft",text:"..."}; code: {type:"code",lang:"bash",code:"..."}, always copyable. Layout nodes use children:[nodes]; text may use spans:[{text,weight?,color?}] instead of text. Keep all content/styling inside blocks. Do not serialize the array or wrap it in {item:[...]}. ui_catalog topic=quick supplies exact fields and examples.'};
