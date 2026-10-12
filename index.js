import { defineTool } from '@deepseek-ai/dsh-tools';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
import { validateDocument, fallbackText } from './lib/protocol.js';
import { UiStore, stateRoute, documentRoute, historyRoute } from './lib/store.js';
import { evaluate } from './lib/protocol.js';
import { componentCatalog } from './lib/components.js';
import { CANVAS_DESIGN_GUIDE } from './lib/canvas-design.js';
import { architectureExample, scatterExample } from './lib/visual-examples.js';
import { BUILD_INFO } from './lib/build-info.js';
import { UI_SKILL_SECTIONS, promptSections } from './lib/ui-skill.js';
import {DEFAULT_VISUAL_STYLE,VISUAL_STYLE_IDS} from './lib/visual-styles.js';
import { canvasDocument } from './lib/freeform.js';
import z from '@deepseek-ai/schemastery';
import { toolJson } from './lib/tool-json.js';
import { DOCUMENT_PARAMETER,TEXT_BLOCKS_PARAMETER } from './lib/tool-schema.js';
import {textDocument} from './lib/text-document.js';
import {TEXT_PRESETS} from './lib/typography.js';
import { inspectRecord } from './lib/inspection.js';
import {QUICK_EXAMPLES,QUICK_GUIDE} from './lib/quick-examples.js';
import { PROTOCOL_GUIDE, calculatorExample, comparisonExample, budgetExample, curveExample, sceneExamples, bicycleExample, oscillatorExample } from './lib/catalog.js';
import {VISUAL_GUIDE,VISUAL_EXAMPLES,visualCatalog} from './lib/visual.js';
import {registerVisualAssets} from './lib/visual-assets.js';
import {diagnosticsRoute} from './lib/diagnostics-route.js';
import {fenceRoute} from './lib/fence-route.js';
import {sceneCatalog,SCENE_GUIDE} from './lib/scene-library.js';
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
    const normalized=args&&Object.hasOwn(args,'document')?{...args,document:validateDocument(toolJson(args.document,'document'))}:args&&Object.hasOwn(args,'blocks')?{...args,blocks:textDocument({...args,blocks:toolJson(args.blocks,'blocks')}).nodes}:args;
    return execute(normalized,exec);
  }};
}
export const Config=z.object({autoRepair:z.boolean().default(true).description('自动反馈无法交付的 UI 围栏、渲染失败及仅思考没有正文或工具的空交付，最多两次去重提醒；不限制模型思考。'),visualStyle:z.union(VISUAL_STYLE_IDS).default(DEFAULT_VISUAL_STYLE).description('引导模式的视觉风格；同步原生组件外观、风格提示词与案例，自由模式不应用。'),defaultPreset:z.union(TEXT_PRESETS).default('reading').description('兼容旧配置的保留字段，已停用；排版由模型按内容选择。'),designMode:z.union(['guided','free']).default('guided').description('guided：设计技能与示例引导；free：只注入画布接口与交互约束，由模型自主设计。'),displayMode:z.union(['tail','inline','sidebar']).default('inline').description('兼容旧配置的保留字段，已停用；统一使用正文标记，侧栏随时可打开。'),showDetails:z.boolean().default(false).description('显示参数状态、原始说明、视觉诊断和版本历史。默认关闭，保持界面简洁。')}).volatile();
export function apply(ctx,config={}) {
  const store = new UiStore(dshHomePath('plugins', 'dsh-generative-ui'));
  const settings=()=>typeof config.get==='function'?config.get():config;
  const feedback=registerFenceFeedback(ctx,()=>settings().autoRepair!==false);
  const placement=value=>`\nPlace this exact fenced marker in your answer at the intended UI position:\n\`\`\`dsh-ui\n${value.documentId}\n\`\`\``;
  ctx.effect(()=>ctx.tools.register(defineRenderTool({
    name:'render_text',description:'Quickly format everyday answers as readable native text, small comparisons, lists, callouts or link buttons. No HTML/CSS/script needed. Multiple calls in one answer create independent UIs; use separate successful IDs for inline markers. blocks accepts plain strings or native v1 nodes with optional IDs; a text block is {type:"text",text:"Your content"}. Extended title/items visuals use render_ui instead. Text supports size/weight/color/align/lineHeight and spans for inline emphasis. Prefer this short path for ordinary structured explanations.',
    parameters:{title:{type:'string'},preset:{type:'string',enum:TEXT_PRESETS},accent:{type:'string',enum:['blue','teal','violet','amber','rose']},blocks:TEXT_BLOCKS_PARAMETER},
    output:{schema:{type:'json'},render:(_a,v)=>[{type:'text',text:v.document.fallback+`\nUI documentId=${v.documentId}; documentRevision=${v.documentRevision??0}.`+placement(v)}],presentationMeta:(_a,v)=>({dshGenerativeUi:v})},
    async execute(args,exec){exec.signal.throwIfAborted();for(const key of Object.keys(args))if(!['title','preset','accent','blocks'].includes(key))throw Error(`DSH UI: unknown render_text argument ${key}; put all content/styling inside blocks or children`);const document=textDocument({...args,blocks:toolJson(args.blocks,'blocks'),preset:args.preset??'reading'});fallbackText(document);const record=await store.create(document,{sessionId:exec.agent?.id??'unscoped',callId:exec.callId});exec.signal.throwIfAborted();return record;}
  })));
  ctx.effect(() => ctx.tools.register(defineRenderTool({
    name: 'render_ui',
    description: 'Render a static or interactive DSH UI v1 document in this conversation. Proactively use when visual relationships or changing parameters clearly explain the question better, even without an explicit UI request. For everyday styled text use render_text; simple facts can stay plain text. Deliver the smallest complete useful UI first. ui_catalog supplies optional details. Direct native calls only; PTC returns text. Calculations stay local. document accepts v1 {version:1,title,fallback,nodes} OR extended {title,items:[components]} for charts, plots, quiz, forms, diagrams and media. Repair errors at most twice or simplify/answer in text.',
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
    name:'render_canvas',description:'Create a static or interactive HTML/SVG/CSS/JavaScript canvas in the conversation. You design all content, controls, layout and motion. No fixed UI composition. Same persistence, isolation and inspect/patch support as render_ui. Use the injected canvas contract; no external resources or host APIs. Direct native calls only.',
    parameters:{title:{type:'string',required:true},fallback:{type:'string',required:true},state:{type:'json'},data:{type:'json'},derived:{type:'json'},height:{type:'number'},css:{type:'string',description:'Canvas CSS; use an empty string when no custom styles are needed. Styled static previews appear progressively; interaction activates after the assistant turn ends.'},html:{type:'string',required:true},script:{type:'string'}},
    output:{schema:{type:'json'},render:(_a,v)=>[{type:'text',text:fallbackText(v.document)+`\nUI documentId=${v.documentId}; documentRevision=${v.documentRevision??0}; canvas nodeId=canvas.`+placement(v)}],presentationMeta:(_a,v)=>({dshGenerativeUi:v})},
    async execute(args,exec){exec.signal.throwIfAborted();const record=await store.create(canvasDocument(args),{sessionId:exec.agent?.id??'unscoped',callId:exec.callId});exec.signal.throwIfAborted();return record;}
  })));
  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'ui_catalog', description: 'Read the DSH UI protocol and registered components. Optional topic: templates (eight short scene summaries; add scene to retrieve one), visual (extended component fields), overview (default, compact static examples), quick (four minimal static examples), canvas (freeform design guide and four visual examples), data, scenes, all (fourteen examples). Prefer targeted topics to avoid unnecessary context. Read-only; omit for ordinary text answers.',
    parameters: { topic: { type: 'string', enum: ['overview', 'quick', 'visual', 'templates', 'canvas', 'data', 'scenes', 'all'], description: 'overview, quick (four lightweight static layouts), canvas, data, scenes or all; default overview' },scene:{type:'string',description:'templates only: brief, comparison, flow, dashboard, quiz, form, plot, diagram'} }, output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    isConcurrencySafe: () => true,
    async execute({ topic = 'overview',scene } = {}) {
      if(topic==='templates')return sceneCatalog(scene);
      const groups = { overview: [calculatorExample, oscillatorExample], canvas: [bicycleExample, oscillatorExample, architectureExample, scatterExample], data: [calculatorExample, comparisonExample, budgetExample, curveExample, scatterExample], scenes: sceneExamples, all: [calculatorExample, comparisonExample, budgetExample, curveExample, ...sceneExamples, bicycleExample, oscillatorExample, architectureExample, scatterExample] };
      groups.quick=QUICK_EXAMPLES;groups.overview=QUICK_EXAMPLES.slice(0,2);
      groups.visual=VISUAL_EXAMPLES;
      if (!Object.hasOwn(groups, topic)) throw new Error('Unknown ui_catalog topic; use templates, overview, quick, visual, canvas, data, scenes or all');
      if(topic==='visual')return{build:BUILD_INFO,topic,protocol:VISUAL_GUIDE,components:visualCatalog(),examples:VISUAL_EXAMPLES};
      return { build: BUILD_INFO, topic, protocol: PROTOCOL_GUIDE, components: componentCatalog(), design: topic === 'quick' ? QUICK_GUIDE : topic === 'canvas' || topic === 'all' ? CANVAS_DESIGN_GUIDE : 'Choose composition by the question: editorial reading, technical relationships, analytical data, exploratory objects, aligned comparisons or ordered instruction. Keep theme, accessible labels and readable Chinese. Use topic=canvas for the full visual design guide.', examples: groups[topic] };
    }
  })));
  ctx.effect(() => ctx.connection.fetch.register({ path: '/api/plugins/dsh-generative-ui/state', methods: ['GET', 'POST'], requestBody: 'buffered', fetch: stateRoute(store) }));
  ctx.effect(() => ctx.connection.fetch.register({ path: '/api/plugins/dsh-generative-ui/document', methods: ['GET', 'POST'], requestBody: 'buffered', fetch: documentRoute(store) }));
  ctx.effect(() => ctx.connection.fetch.register({ path: '/api/plugins/dsh-generative-ui/history', methods: ['GET', 'POST'], requestBody: 'buffered', fetch: historyRoute(store) }));
  registerVisualAssets(ctx);
  ctx.effect(()=>ctx.connection.fetch.register({path:'/api/plugins/dsh-generative-ui/diagnostics',methods:['GET'],requestBody:'buffered',fetch:diagnosticsRoute(feedback)}));
  ctx.effect(()=>ctx.connection.fetch.register({path:'/api/plugins/dsh-generative-ui/fence',methods:['POST'],requestBody:'buffered',fetch:fenceRoute(store)}));
  ctx.effect(()=>ctx.tools.register(defineTool({name:'validate_ui',description:'Read-only validation for Motion UI v1 or extended title/items visuals. Returns valid, complete, canonical document and precise diagnostics without saving or displaying a UI. valid=true with complete=false means rejected components, not complete delivery. Use when unsure about a complex schema; ordinary minimal UIs can render directly.',parameters:{document:{type:'json',required:true}},output:{schema:{type:'json'},render:(_a,v)=>[{type:'text',text:JSON.stringify(v)}]},isConcurrencySafe:()=>true,async execute({document}){try{const report=diagnoseDelivery(toolJson(document,'document'));return {...report,...(report.valid?{fallback:fallbackText(report.document)}:{error:report.diagnostics[0].message})}}catch(e){return{valid:false,complete:false,error:e.message}}}})));
  ctx.effect(()=>ctx.tools.register(defineTool({
    name:'inspect_ui',description:'Read the current UI revision, saved state/derived and heuristic visual observations. Default summary omits source. Use detail=nodes to read exact nodes before code edits; omitted nodeIds selects the first 16 nodes, or full only when needed. No report means unobserved, not a pass. Do not poll empty reports; automatic repair is at most two rounds per user request.',
    parameters:{documentId:{type:'string',required:true},detail:{type:'string',enum:['summary','nodes','full']},nodeIds:{type:'json',description:'For nodes detail: up to 16 existing node IDs.'}},
    output:{schema:{type:'json'},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]},isConcurrencySafe:()=>true,
    async execute({documentId,detail='summary',nodeIds=[]},exec){const record=await store.owned(documentId,exec.agent?.id);const saved=await store.readState(documentId,record.sessionId);return inspectRecord(record,saved.state,evaluate(record.document,saved.state).derived,await store.audits(documentId),{detail,nodeIds:toolJson(nodeIds,'nodeIds')});}
  })));
  ctx.effect(()=>ctx.tools.register(defineTool({name:'patch_ui',description:'Refine existing UI nodes without changing their IDs, structure, input bindings or actions. First inspect_ui for current documentRevision. changes is [{id,props}], with registered properties only. Replacing canvas html/css/script restarts that canvas; saved parameters and unaffected live nodes remain. Revision conflicts require inspect and retry. No partial scripts execute.',parameters:{documentId:{type:'string',required:true},documentRevision:{type:'number',required:true},changes:{type:'json',required:true}},output:{schema:{type:'json'},render:(_a,v)=>[{type:'text',text:`Updated ${v.document.title}; documentId=${v.documentId}; documentRevision=${v.documentRevision}. Saved parameters retained.`}],presentationMeta:(_a,v)=>({dshGenerativeUiPatch:v})},async execute({documentId,documentRevision,changes},exec){exec.signal.throwIfAborted();return store.refine(documentId,exec.agent?.id,documentRevision,toolJson(changes,'changes'));}})));
  ctx.effect(()=>ctx.tools.register(defineTool({name:'update_ui',description:'Append or replace content of an existing UI without generating a duplicate document. Inspect its revision first. Use targetId to modify an existing native node; visual targetId accepts an extended title/items document. Without targetId, an extended fragment appends to the only root visual when unambiguous; otherwise append adds root nodes (IDs must be unique). replace updates the root content. Preserve existing state/derived definitions; new inputs receive defaults. operationId is a stable unique edit name, reuse it only for an identical retry; replay is idempotent for the latest 64 edits.',parameters:{documentId:{type:'string',required:true},documentRevision:{type:'number',required:true},operationId:{type:'string',required:true},mode:{type:'string',enum:['append','replace'],required:true},targetId:{type:'string'},document:{type:'json',required:true}},output:{schema:{type:'json'},render:(_a,v)=>[{type:'text',text:'Updated existing UI '+v.documentId+'; documentRevision='+v.documentRevision+'. Keep its existing inline marker; do not duplicate it.'}],presentationMeta:(_a,v)=>({dshGenerativeUiPatch:v})},async execute({documentId,documentRevision,operationId,mode,targetId,document},exec){exec.signal.throwIfAborted();return store.update(documentId,exec.agent?.id,documentRevision,operationId,{mode,...(targetId?{targetId}:{}),document:toolJson(document,'document')})}})));
  for (const [i,section] of UI_SKILL_SECTIONS.entries())ctx.effect(()=>ctx.systemPrompt.section({...section,text:()=>promptSections(settings().designMode??'guided',settings().visualStyle??DEFAULT_VISUAL_STYLE)[i].text+(i===0&&settings().designMode!=='free'?'\n'+SCENE_GUIDE:'')+(i===0?'\nFor changes to an existing UI, inspect_ui then update_ui with its current revision and a stable operationId; preserve the original marker and user values. Never create a second copy for an edit. Read delivery diagnostics and correct rejected components before claiming the UI is complete.\nPresentation mode: inline. After a successful render_text/render_ui/render_canvas, put a fenced dsh-ui block containing only its documentId in your answer at the best explanatory position. Never invent an ID or put source inside the marker. If omitted, the interface remains below the answer.':'')}));
}



