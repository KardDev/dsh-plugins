import {COMPONENTS} from './components.js';
// Expose the document skeleton to native function calling, not just prose.
// Per-component and expression checks remain in the shared runtime validator.
const dictionary=description=>({type:'object',additionalProperties:true,description});
export const DOCUMENT_PARAMETER={
  required:true,
  description:'Complete v1 {version:1,title,fallback,nodes,state?,derived?} OR extended {title,items:[components]}. No mixed roots, partial patches or serialized JSON. State alone creates no controls.',
  type:'object',additionalProperties:false,
    properties:{
      version:{type:'number',const:1},
      title:{type:'string',required:true},
      fallback:{type:'string',description:'Required for v1 nodes: useful plain-text explanation if UI is unavailable.'},
      items:{type:'array',description:'Extended fields: ui_catalog topic=visual.',items:{type:'json'}},
      nodes:{type:'array',description:'REQUIRED for version:1: all visible nodes and control nodes, in this same call. Never submit only state/derived.',items:{type:'object',additionalProperties:true,properties:{
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
        rows:{type:'json',description:'table/chart: inline object rows, including {ref}/{expr} cells, or data/derived rows binding. No map needed for a short breakdown.'},
        columns:{type:'json',description:'table: column object array; row: optional integer 1..4 for equal grid columns.'},
        bind:{type:'string',description:'Controls bind state.key.'},children:{type:'array',description:'row/column/card/details: array of registered nodes using the same fields and type-specific rules. steps uses items instead of children.',items:{type:'json'}}
      }}},
      state:dictionary('Typed states, e.g. {people:{type:"number",default:2,min:1,max:12,step:1}}. Use numeric bounds/defaults, direct options arrays; json stores bounded canvas arrays/objects.'),
      data:dictionary('Static data; Chinese identifier keys supported. Omit if rows are inline.'),
      derived:dictionary('Local formulas, e.g. {food:{expr:"state.people * state.days * 100"}}. round/ceil/floor/abs take one argument. Other expression forms/maps: ui_catalog topic=native. Omit unused derived.'),
      actions:dictionary('Declared agent.followup actions. Omit when unused.'),
      presentation:dictionary('Optional layout/accent/density and preset: reading/brief/comparison/list/callout/scorecard/flow/minimal. Every document owns its own styles.')
    }
};

// Keep the native transport schema shallow. A recursively expanded union of
// every component makes the lightweight tool harder to call; the shared
// runtime validator still enforces exact component fields and limits.
export const TEXT_BLOCKS_PARAMETER={type:'array',required:true,items:{type:'json'},description:'Direct array of strings/native nodes with optional IDs, e.g. [{type:"text",text:"Answer"}]. steps uses items:[{title,description?}], layouts use children:[nodes]. Copyable text: copyable:true; code:{type:"code",lang,code}. Keep styling/content inside blocks. No JSON string or {item:[...]} wrapper.'};
