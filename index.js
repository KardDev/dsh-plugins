import {sceneDocument,SCENE_PARAMETERS,sceneReference} from './lib/scene-entry.js';
import {registerVideoTools} from './lib/video-tools.js';
import {VIDEO_GUIDE,PROMO_GUIDE} from './lib/motion-craft.js';
import {loadMotionDesignSkill,MOTION_DESIGN_REFERENCE} from './lib/motion-design-skill.js';
import {normalizeNodeEdits} from './lib/refinement.js';
import {TEXT_GUIDE} from './lib/text-guide.js';
import {CANVAS_CONTRACT,TOOL_DIRECTORY} from './lib/prompt-contract.js';
import {mechanismDocument} from './lib/mechanism-entry.js';
import {mechanismCatalog} from './lib/mechanism-catalog.js';
import {motionCatalog} from './lib/motion-library.js';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
import { validateDocument, fallbackText } from './lib/protocol.js';
import { UiStore, stateRoute, documentRoute, historyRoute } from './lib/store.js';
import { evaluate } from './lib/protocol.js';
import { componentCatalog } from './lib/components.js';
import {CANVAS_SYSTEM_GUIDE} from './lib/canvas-system.js';
import { CANVAS_DESIGN_GUIDE } from './lib/canvas-design.js';
import { architectureExample, scatterExample } from './lib/visual-examples.js';
import { BUILD_INFO } from './lib/build-info.js';
import { UI_SKILL_SECTIONS, promptSections } from './lib/ui-skill.js';
import {stylePrompt,styleExamples,DEFAULT_VISUAL_STYLE,VISUAL_STYLE_IDS} from './lib/visual-styles.js';
import { canvasDocument } from './lib/freeform.js';
import z from '@deepseek-ai/schemastery';
import { toolJson } from './lib/tool-json.js';
import { DOCUMENT_PARAMETER,TEXT_BLOCKS_PARAMETER } from './lib/tool-schema.js';
import {textDocument} from './lib/text-document.js';
import {TEXT_PRESETS} from './lib/typography.js';
import { inspectRecord,normalizeNodeIds } from './lib/inspection.js';
import {QUICK_EXAMPLES,QUICK_GUIDE} from './lib/quick-examples.js';
import { PROTOCOL_GUIDE, calculatorExample, comparisonExample, budgetExample, curveExample, sceneExamples, bicycleExample, oscillatorExample } from './lib/catalog.js';
import {VISUAL_GUIDE,VISUAL_EXAMPLES,visualCatalog} from './lib/visual.js';
import {registerVisualAssets} from './lib/visual-assets.js';
import {diagnosticsRoute} from './lib/diagnostics-route.js';
import {fenceRoute} from './lib/fence-route.js';
import {sceneCatalog} from './lib/scene-library.js';
import {registerFenceFeedback} from './lib/fence-feedback.js';
import {diagnoseDelivery,deliveryDiagnostics} from './lib/delivery.js';

export const name = 'motion-ui';
export const inject = ['tools', 'connection', 'systemPrompt'];
function defineRenderTool(options) {
  const tool=defineTool(options),execute=tool.execute;
  return {...tool,async execute(args,exec){
    // Legacy adapters may stringify JSON. Decode here, without advertising a
    // string branch that encourages models to manually escape whole documents.
    // Canonicalize adapter quirks before native schema checks, so a lossless
    // items:{item:[...]} wrapper receives the same treatment as stored/replayed UI.
    const normalized=args&&Object.hasOwn(args,'document')?{...args,document:validateDocument(toolJson(args.document,'document'))}:args&&Object.hasOwn(args,'blocks')?{...args,blocks:textDocument({...args,blocks:toolJson(args.blocks,'blocks')}).nodes}:args&&Object.hasOwn(args,'changes')?{...args,changes:normalizeNodeEdits(args.changes)}:args&&Object.hasOwn(args,'nodeIds')?{...args,nodeIds:normalizeNodeIds(args.nodeIds)}:args;
    return execute(normalized,exec);
  }};
}
export const Config=z.object({autoRepair:z.boolean().default(true).description('Auto-feedback for undeliverable UI fences, render failures, and empty deliveries with no text or tool calls. At most two de-duplicated reminders; model thinking time is never capped.'),visualStyle:z.union(VISUAL_STYLE_IDS).default(DEFAULT_VISUAL_STYLE).description('Visual style for guided mode. Syncs native component appearance, the style prompt and examples; not applied in free mode.'),defaultPreset:z.union(TEXT_PRESETS).default('reading').description('Retained for legacy config and no longer used; typography is chosen by the model per block.'),designMode:z.union(['guided','free']).default('guided').description('guided: design skill and example-driven guidance; free: injects only the canvas interface and interaction constraints, leaving design to the model.'),displayMode:z.union(['tail','inline','sidebar']).default('inline').description('Retained for legacy config and no longer used; inline markers are always used, and the sidebar can be opened at any time.'),showDetails:z.boolean().default(false).description('Show parameter state, original description, visual diagnostics and version history. Off by default to keep the interface clean.')}).volatile();
export function apply(ctx,config={}) {
  const store = new UiStore(dshHomePath('plugins', 'dsh-generative-ui'));

  const settings=()=>typeof config.get==='function'?config.get():config;
  const feedback=registerFenceFeedback(ctx,()=>settings().autoRepair!==false);
  const placement=value=>`\nPlace this exact fenced marker in your answer at the intended UI position:\n\`\`\`dsh-ui\n${value.documentId}\n\`\`\``;
  ctx.effect(()=>ctx.tools.register(defineRenderTool({
    name:'render_text',description:"Format native text, comparisons, steps, copyable text/code and link buttons without HTML. blocks is a direct array of strings/native nodes with optional IDs. State/formulas require render_ui; custom graphics require render_canvas. Several calls create independent documents.",
    parameters:{title:{type:'string'},preset:{type:'string',enum:TEXT_PRESETS},accent:{type:'string',enum:['blue','teal','violet','amber','rose']},blocks:TEXT_BLOCKS_PARAMETER},
    output:{schema:{type:'json'},render:(_a,v)=>[{type:'text',text:v.document.fallback+`\nUI documentId=${v.documentId}; documentRevision=${v.documentRevision??0}.`+placement(v)}],presentationMeta:(_a,v)=>({dshGenerativeUi:v})},
    async execute(args,exec){exec.signal.throwIfAborted();for(const key of Object.keys(args))if(!['title','preset','accent','blocks'].includes(key))throw Error(`DSH UI: unknown render_text argument ${key}; put all content/styling inside blocks or children`);const document=textDocument({...args,blocks:toolJson(args.blocks,'blocks'),preset:args.preset??'reading'});fallbackText(document);const record=await store.create(document,{sessionId:exec.agent?.id??'unscoped',callId:exec.callId});exec.signal.throwIfAborted();return record;}
  })));
  ctx.effect(() => ctx.tools.register(defineRenderTool({
    name: 'render_ui',
    description: "Render one complete native v1 {version:1,title,fallback,nodes,state?,derived?} OR extended {title,items:[components]} document. Do not mix root languages. Use for useful static/interactive explanations; native formulas stay local. Direct call only. ui_catalog supplies optional fields/examples.",
    parameters: { document: DOCUMENT_PARAMETER },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: fallbackText(value.document)+`\nUI documentId=${value.documentId}; documentRevision=${value.documentRevision??0}. Use inspect_ui before refinements.`+placement(value)+(deliveryDiagnostics(value.document).length?'\nPARTIAL DELIVERY: '+JSON.stringify(deliveryDiagnostics(value.document))+'\nCorrect the rejected components using update_ui rather than generating another copy.':'') }],
      presentationMeta: (_args, value) => ({ dshGenerativeUi: value })
    },
    async execute({ document }, exec) {
      exec.signal.throwIfAborted();
      const validated = validateDocument(toolJson(document,'document')); fallbackText(validated);
      const record = await store.create(validated, { sessionId: exec.agent?.id ?? 'unscoped', callId: exec.callId });
      exec.signal.throwIfAborted(); return record;
    }
  })));
  ctx.effect(()=>ctx.tools.register(defineTool({
    name:'render_canvas',description:"Render custom HTML/SVG/CSS/JS in an isolated canvas, with optional persisted state. Separate html/css/script fields; no external resources or host APIs. Use the injected canvas contract; libraries:[\"mechanism\"] enables the optional local helper.",
    parameters:{title:{type:'string',required:true},fallback:{type:'string',required:true},state:{type:'json'},data:{type:'json'},derived:{type:'json'},libraries:{type:'array',items:{type:'string',enum:['mechanism']}},height:{type:'number'},css:{type:'string',description:'Canvas CSS; use an empty string when no custom styles are needed. Styled static previews appear progressively; interaction activates after the assistant turn ends.'},html:{type:'string',required:true},script:{type:'string'}},
    output:{schema:{type:'json'},render:(_a,v)=>[{type:'text',text:fallbackText(v.document)+`\nUI documentId=${v.documentId}; documentRevision=${v.documentRevision??0}; canvas nodeId=canvas.`+placement(v)}],presentationMeta:(_a,v)=>({dshGenerativeUi:v})},
    async execute(args,exec){exec.signal.throwIfAborted();const record=await store.create(canvasDocument(args),{sessionId:exec.agent?.id??'unscoped',callId:exec.callId});exec.signal.throwIfAborted();return record;}
  })));
  ctx.effect(()=>ctx.tools.register(defineTool({name:'render_scene',description:'Deliver a complete flow/comparison/allocation/budget UI from short task data; Host creates nodes, controls and formulas. No source or catalog needed. values/items must be complete; never invent prices. Custom UI remains render_ui/render_canvas.',parameters:SCENE_PARAMETERS,output:{schema:{type:'json'},render:(_a,v)=>[{type:'text',text:fallbackText(v.document)+'\nUI documentId='+v.documentId+'; documentRevision='+v.documentRevision+'. To revise this saved scene, use inspect_ui then patch_ui/update_ui with this documentId; calling render_scene again creates an extra UI.'+placement(v)}],presentationMeta:(_a,v)=>({dshGenerativeUi:v})},async execute(args,exec){exec.signal.throwIfAborted();const parsed={...args};for(const key of['items','values'])if(parsed[key]!==undefined)parsed[key]=toolJson(parsed[key],key);const record=await store.create(sceneDocument(parsed),{sessionId:exec.agent?.id??'unscoped',callId:exec.callId});exec.signal.throwIfAborted();return record;}})));
  ctx.effect(()=>ctx.tools.register(defineTool({
    name:'render_mechanism',description:"Create an adjustable assembly/gears/crank diagram from parameters, no source or catalog needed. Gear driver16 teeth; crank rod70. Educational geometry/kinematics. For other structures use render_canvas libraries:[\"mechanism\"] and ui_catalog topic=mechanism.",
    parameters:{scene:{type:'string',required:true,enum:['assembly','gears','crank']},title:{type:'string'},rpm:{type:'number',description:'gears/crank: 0..90, default20'},teeth:{type:'number',description:'gears only: driven integer16..48, default32'},radius:{type:'number',description:'crank only: integer10..28, default20'},running:{type:'boolean',description:'gears/crank: defaultfalse'},angle:{type:'number',description:'gears/crank: integer0..360 degrees, default0'},explode:{type:'number',description:'0..1 in steps0.01; assembly default0.45, others0'}},
    output:{schema:{type:'json'},render:(_a,v)=>[{type:'text',text:fallbackText(v.document)+'\nUI documentId='+v.documentId+'; documentRevision='+v.documentRevision+'.'+placement(v)}],presentationMeta:(_a,v)=>({dshGenerativeUi:v})},
    async execute(args,exec){exec.signal.throwIfAborted();const record=await store.create(mechanismDocument(args),{sessionId:exec.agent?.id??'unscoped',callId:exec.callId});exec.signal.throwIfAborted();return record;}
  })));
  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'ui_catalog', description: "Read one optional reference topic or scene. text=native typography; native=v1 fields/formulas; visual=extended components; canvas=API/construction/examples; style=selected guided style/examples; templates/motion/mechanism=targeted recipes. overview/quick/data/scenes/all remain available; avoid all unless needed.",
    parameters: { topic: { type: 'string', enum: ['overview','quick','text','native','style','visual','motion','video','mechanism','templates','canvas','data','scenes','all'], description:'Optional topic; default overview.' },scene:{type:'string',description:'Scene for canvas/templates/motion/mechanism, or explicit style ID for style. Omit to get summaries/current guided style.'} }, output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    isConcurrencySafe: () => true,
    async execute({ topic = 'overview',scene } = {}) {
      if((topic==='motion'||topic==='video')&&scene==='motion-design')return {topic,designSkill:await loadMotionDesignSkill()};
      if(topic==='video')return{topic,guide:VIDEO_GUIDE,designReference:MOTION_DESIGN_REFERENCE,...(scene==='promo'?{production:PROMO_GUIDE,designSkill:await loadMotionDesignSkill()}:{}),capabilities:await video.capabilities(),workflow:'Author render_canvas with exactly one DSHUI.timeline({id:"main",duration,draw}) and #stage. Then render_video({documentId,duration,...}). For input videos inspect_video then view sampled frames, process_video clips/audio/captions. No unrequested video export. Output URLs are authenticated same-host downloads; HTML sources are attachments, never executed in the Host origin.'};
      if(topic==='text')return {topic,guide:TEXT_GUIDE};
      if(topic==='native')return {topic,protocol:PROTOCOL_GUIDE,components:componentCatalog(),example:calculatorExample};
      if(topic==='style'){if(settings().designMode==='free'&&!scene)return{topic,mode:'free',note:'No style is selected in free mode. An explicit scene equal to a style ID requests reference guidance only.',styles:VISUAL_STYLE_IDS};const id=scene??settings().visualStyle??DEFAULT_VISUAL_STYLE;return{topic,style:id,guide:stylePrompt(id),examples:styleExamples(id)}}
      if(topic==='canvas'){
        const docs={bicycle:bicycleExample,oscillator:oscillatorExample,architecture:architectureExample,scatter:scatterExample};
        if(scene&&!Object.hasOwn(docs,scene))throw Error('Unknown canvas scene; use bicycle, oscillator, architecture or scatter');
        return {topic,interface:CANVAS_CONTRACT,construction:CANVAS_SYSTEM_GUIDE,...(settings().designMode==='free'?{}:{design:CANVAS_DESIGN_GUIDE}),examples:scene?[docs[scene]]:Object.entries(docs).map(([scene,d])=>({scene,title:d.title,fallback:d.fallback})),usage:'Add scene to retrieve one complete example, not all four sources.'};
      }
      if(topic==='overview')return{topic,guide:TOOL_DIRECTORY,examples:QUICK_EXAMPLES.slice(0,2)};
      if(topic==='quick')return{...sceneReference(),design:QUICK_GUIDE,fullDocuments:QUICK_EXAMPLES};
      if(topic==='templates')return sceneCatalog(scene);
      if(topic==='mechanism')return mechanismCatalog(scene);
      if(topic==='motion')return {...motionCatalog(scene),...(!scene?{designReferences:[MOTION_DESIGN_REFERENCE]}:{})};
      const groups = { overview: [calculatorExample, oscillatorExample], canvas: [bicycleExample, oscillatorExample, architectureExample, scatterExample], data: [calculatorExample, comparisonExample, budgetExample, curveExample, scatterExample], scenes: sceneExamples, all: [calculatorExample, comparisonExample, budgetExample, curveExample, ...sceneExamples, bicycleExample, oscillatorExample, architectureExample, scatterExample] };
      groups.quick=QUICK_EXAMPLES;groups.overview=QUICK_EXAMPLES.slice(0,2);
      groups.visual=VISUAL_EXAMPLES;
      if (!Object.hasOwn(groups, topic)) throw new Error('Unknown ui_catalog topic; use text, native, style, templates, overview, quick, visual, canvas, data, scenes, motion, mechanism or all');
      if(topic==='visual')return{build:BUILD_INFO,topic,protocol:VISUAL_GUIDE,components:visualCatalog(),examples:VISUAL_EXAMPLES};
      return { build: BUILD_INFO, topic, protocol: PROTOCOL_GUIDE, components: componentCatalog(), design: topic === 'quick' ? QUICK_GUIDE : topic === 'canvas' || topic === 'all' ? CANVAS_DESIGN_GUIDE : 'Choose composition by the question: editorial reading, technical relationships, analytical data, exploratory objects, aligned comparisons or ordered instruction. Keep theme, accessible labels and readable Chinese. Use topic=canvas for the full visual design guide.', examples: groups[topic] };
    }
  })));
  ctx.effect(() => ctx.connection.fetch.register({ path: '/api/plugins/dsh-generative-ui/state', methods: ['GET', 'POST'], requestBody: 'buffered', fetch: stateRoute(store) }));
  const video=registerVideoTools(ctx,store);
  ctx.effect(() => ctx.connection.fetch.register({ path: '/api/plugins/dsh-generative-ui/document', methods: ['GET', 'POST'], requestBody: 'buffered', fetch: documentRoute(store) }));
  ctx.effect(() => ctx.connection.fetch.register({ path: '/api/plugins/dsh-generative-ui/history', methods: ['GET', 'POST'], requestBody: 'buffered', fetch: historyRoute(store) }));
  registerVisualAssets(ctx);
  ctx.effect(()=>ctx.connection.fetch.register({path:'/api/plugins/dsh-generative-ui/diagnostics',methods:['GET'],requestBody:'buffered',fetch:diagnosticsRoute(feedback)}));
  ctx.effect(()=>ctx.connection.fetch.register({path:'/api/plugins/dsh-generative-ui/fence',methods:['POST'],requestBody:'buffered',fetch:fenceRoute(store)}));
  ctx.effect(()=>ctx.tools.register(defineTool({name:'validate_ui',description:"Validate native or extended UI without saving/displaying. valid with complete=false means rejected components. Returns canonical document/diagnostics; a rendering tool still delivers the UI.",parameters:{document:{type:'json',required:true}},output:{schema:{type:'json'},render:(_a,v)=>[{type:'text',text:JSON.stringify(v)}]},isConcurrencySafe:()=>true,async execute({document}){try{const report=diagnoseDelivery(toolJson(document,'document'));return {...report,...(report.valid?{fallback:fallbackText(report.document)}:{error:report.diagnostics[0].message})}}catch(e){return{valid:false,complete:false,error:e.message}}}})));
  ctx.effect(()=>ctx.tools.register(defineRenderTool({
    name:'inspect_ui',description:"Read current revision/state/derived and heuristic observations. Summary includes node paths/positions/editable fields. query finds text/labels/types (max200 chars); detail=nodes with query OR nodeIds reads matching source. Full only when needed. Missing observations mean unobserved; do not poll. Inspect before editing.",
    parameters:{documentId:{type:'string',required:true},detail:{type:'string',enum:['summary','nodes','full']},query:{type:'string',description:'Find by text/label/title/type; mutually exclusive with nodeIds. Up to16 matches; blank means all.'},nodeIds:{type:'array',items:{type:'string'},description:'For nodes detail: direct array of up to16 existing node IDs, e.g. ["canvas"], not HTML DOM IDs.'}},
    output:{schema:{type:'json'},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]},isConcurrencySafe:()=>true,
    async execute({documentId,detail='summary',nodeIds=[],query=''},exec){const record=await store.owned(documentId,exec.agent?.id);const saved=await store.readState(documentId,record.sessionId);return inspectRecord(record,saved.state,evaluate(record.document,saved.state).derived,await store.audits(documentId),{detail,nodeIds:toolJson(nodeIds,'nodeIds'),query});}
  })));
  ctx.effect(()=>ctx.tools.register(defineRenderTool({name:'patch_ui',description:"Edit existing scalar/source properties using the inspected documentRevision. changes:[{id,props}]. IDs/structure/bindings/actions stay unchanged; canvas source replacement restarts that frame. Saved parameters persist. Use update_ui for structure changes.",parameters:{documentId:{type:'string',required:true},documentRevision:{type:'number',required:true},changes:{type:'array',required:true,description:'Direct array [{id,props}]; combine changed properties for one node in props.',items:{type:'object',additionalProperties:false,properties:{id:{type:'string',required:true},props:{type:'json',required:true}}}}},output:{schema:{type:'json'},render:(_a,v)=>[{type:'text',text:`Updated ${v.document.title}; documentId=${v.documentId}; documentRevision=${v.documentRevision}. Saved parameters retained.`}],presentationMeta:(_a,v)=>({dshGenerativeUiPatch:v})},async execute({documentId,documentRevision,changes},exec){exec.signal.throwIfAborted();return store.refine(documentId,exec.agent?.id,documentRevision,toolJson(changes,'changes'));}})));
  ctx.effect(()=>ctx.tools.register(defineTool({name:'update_ui',description:"Append/replace existing content at the inspected revision, keeping documentId and compatible state. targetId selects a node; an extended fragment appends to the sole visual when unambiguous. Supply a stable operationId; reuse only for an identical retry (latest64 replay IDs). Preserve state/derived definitions; new inputs get defaults.",parameters:{documentId:{type:'string',required:true},documentRevision:{type:'number',required:true},operationId:{type:'string',required:true},mode:{type:'string',enum:['append','replace'],required:true},targetId:{type:'string'},document:{type:'json',required:true}},output:{schema:{type:'json'},render:(_a,v)=>[{type:'text',text:'Updated existing UI '+v.documentId+'; documentRevision='+v.documentRevision+'. Keep its existing inline marker; do not duplicate it.'}],presentationMeta:(_a,v)=>({dshGenerativeUiPatch:v})},async execute({documentId,documentRevision,operationId,mode,targetId,document},exec){exec.signal.throwIfAborted();return store.update(documentId,exec.agent?.id,documentRevision,operationId,{mode,...(targetId?{targetId}:{}),document:toolJson(document,'document')})}})));
  for(const[i,section]of UI_SKILL_SECTIONS.entries())ctx.effect(()=>ctx.systemPrompt.section({...section,text:()=>promptSections(settings().designMode??'guided',settings().visualStyle??DEFAULT_VISUAL_STYLE)[i].text}));
}



