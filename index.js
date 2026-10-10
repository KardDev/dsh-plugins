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
import { canvasDocument } from './lib/freeform.js';
import z from '@deepseek-ai/schemastery';
import { toolJson } from './lib/tool-json.js';
import { inspectRecord } from './lib/inspection.js';
import {QUICK_EXAMPLES,QUICK_GUIDE} from './lib/quick-examples.js';
import { PROTOCOL_GUIDE, calculatorExample, comparisonExample, budgetExample, curveExample, sceneExamples, bicycleExample, oscillatorExample } from './lib/catalog.js';

export const name = 'motion-ui';
export const inject = ['tools', 'connection', 'systemPrompt'];
export const Config=z.object({designMode:z.union(['guided','free']).default('guided').description('guided：设计技能与示例引导；free：只注入画布接口与交互约束，由模型自主设计。'),displayMode:z.union(['tail','inline','sidebar']).default('tail').description('tail：回答下方；inline：正文标记位置；sidebar：PC 侧栏。')}).volatile();
export function apply(ctx,config={}) {
  const store = new UiStore(dshHomePath('plugins', 'dsh-generative-ui'));
  const settings=()=>typeof config.get==='function'?config.get():config;
  const placement=value=>settings().displayMode==='inline'?`\nPlace this exact fenced marker in your answer at the intended UI position:\n\`\`\`dsh-ui\n${value.documentId}\n\`\`\``:'';
  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'render_ui',
    description: 'Render a static or interactive DSH UI v1 document in this conversation. Proactively use when visual relationships or changing parameters clearly explain the question better, even without an explicit UI request. Ordinary facts and short explanations stay text. Deliver the smallest complete useful UI first. ui_catalog supplies optional details. Direct native calls only; PTC returns text. Calculations stay local. document requires version:1,title,fallback,nodes. Repair errors at most twice or simplify/answer in text.',
    parameters: { document: { type: 'json', required: true, description: 'DSH UI v1 document. Follow the injected protocol and worked examples; ui_catalog supplies additional schema/examples when needed.' } },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: fallbackText(value.document)+`\nUI documentId=${value.documentId}; documentRevision=${value.documentRevision??0}. Use inspect_ui before refinements.`+placement(value) }],
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
    parameters:{title:{type:'string',required:true},fallback:{type:'string',required:true},state:{type:'json'},data:{type:'json'},derived:{type:'json'},height:{type:'number'},css:{type:'string',description:'Emit before html for styled static streaming preview; use an empty string when no custom styles are needed.'},html:{type:'string',required:true},script:{type:'string'}},
    output:{schema:{type:'json'},render:(_a,v)=>[{type:'text',text:fallbackText(v.document)+`\nUI documentId=${v.documentId}; documentRevision=${v.documentRevision??0}; canvas nodeId=canvas.`+placement(v)}],presentationMeta:(_a,v)=>({dshGenerativeUi:v})},
    async execute(args,exec){exec.signal.throwIfAborted();const record=await store.create(canvasDocument(args),{sessionId:exec.agent?.id??'unscoped',callId:exec.callId});exec.signal.throwIfAborted();return record;}
  })));
  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'ui_catalog', description: 'Read the DSH UI protocol and registered components. Optional topic: overview (default, compact static examples), quick (four minimal static examples), canvas (freeform design guide and four visual examples), data, scenes, all (fourteen examples). Prefer targeted topics to avoid unnecessary context. Read-only; omit for ordinary text answers.',
    parameters: { topic: { type: 'string', enum: ['overview', 'quick', 'canvas', 'data', 'scenes', 'all'], description: 'overview, quick (four lightweight static layouts), canvas, data, scenes or all; default overview' } }, output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    isConcurrencySafe: () => true,
    async execute({ topic = 'overview' } = {}) {
      const groups = { overview: [calculatorExample, oscillatorExample], canvas: [bicycleExample, oscillatorExample, architectureExample, scatterExample], data: [calculatorExample, comparisonExample, budgetExample, curveExample, scatterExample], scenes: sceneExamples, all: [calculatorExample, comparisonExample, budgetExample, curveExample, ...sceneExamples, bicycleExample, oscillatorExample, architectureExample, scatterExample] };
      groups.quick=QUICK_EXAMPLES;groups.overview=QUICK_EXAMPLES.slice(0,2);
      if (!Object.hasOwn(groups, topic)) throw new Error('Unknown ui_catalog topic; use overview, quick, canvas, data, scenes or all');
      return { build: BUILD_INFO, topic, protocol: PROTOCOL_GUIDE, components: componentCatalog(), design: topic === 'quick' ? QUICK_GUIDE : topic === 'canvas' || topic === 'all' ? CANVAS_DESIGN_GUIDE : 'Choose composition by the question: editorial reading, technical relationships, analytical data, exploratory objects, aligned comparisons or ordered instruction. Keep theme, accessible labels and readable Chinese. Use topic=canvas for the full visual design guide.', examples: groups[topic] };
    }
  })));
  ctx.effect(() => ctx.connection.fetch.register({ path: '/api/plugins/dsh-generative-ui/state', methods: ['GET', 'POST'], requestBody: 'buffered', fetch: stateRoute(store) }));
  ctx.effect(() => ctx.connection.fetch.register({ path: '/api/plugins/dsh-generative-ui/document', methods: ['GET', 'POST'], requestBody: 'buffered', fetch: documentRoute(store) }));
  ctx.effect(() => ctx.connection.fetch.register({ path: '/api/plugins/dsh-generative-ui/history', methods: ['GET', 'POST'], requestBody: 'buffered', fetch: historyRoute(store) }));
  ctx.effect(()=>ctx.tools.register(defineTool({
    name:'inspect_ui',description:'Read the current UI revision, saved state/derived and heuristic visual observations. Default summary omits source. Use detail=nodes with nodeIds to read exact nodes before code edits, or full only when needed. No report means unobserved, not a pass. Do not poll empty reports; automatic repair is at most two rounds per user request.',
    parameters:{documentId:{type:'string',required:true},detail:{type:'string',enum:['summary','nodes','full']},nodeIds:{type:'json',description:'For nodes detail: up to 16 existing node IDs.'}},
    output:{schema:{type:'json'},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]},isConcurrencySafe:()=>true,
    async execute({documentId,detail='summary',nodeIds=[]},exec){const record=await store.owned(documentId,exec.agent?.id);const saved=await store.readState(documentId,record.sessionId);return inspectRecord(record,saved.state,evaluate(record.document,saved.state).derived,await store.audits(documentId),{detail,nodeIds:toolJson(nodeIds,'nodeIds')});}
  })));
  ctx.effect(()=>ctx.tools.register(defineTool({name:'patch_ui',description:'Refine existing UI nodes without changing their IDs, structure, input bindings or actions. First inspect_ui for current documentRevision. changes is [{id,props}], with registered properties only. Replacing canvas html/css/script restarts that canvas; saved parameters and unaffected live nodes remain. Revision conflicts require inspect and retry. No partial scripts execute.',parameters:{documentId:{type:'string',required:true},documentRevision:{type:'number',required:true},changes:{type:'json',required:true}},output:{schema:{type:'json'},render:(_a,v)=>[{type:'text',text:`Updated ${v.document.title}; documentId=${v.documentId}; documentRevision=${v.documentRevision}. Saved parameters retained.`}],presentationMeta:(_a,v)=>({dshGenerativeUiPatch:v})},async execute({documentId,documentRevision,changes},exec){exec.signal.throwIfAborted();return store.refine(documentId,exec.agent?.id,documentRevision,toolJson(changes,'changes'));}})));
  for (const [i,section] of UI_SKILL_SECTIONS.entries())ctx.effect(()=>ctx.systemPrompt.section({...section,text:()=>promptSections(settings().designMode??'guided')[i].text+(i===0&&settings().displayMode==='inline'?'\nPresentation mode: inline. After a successful render_ui/render_canvas, put a fenced dsh-ui block containing only its documentId in your answer at the best explanatory position. Never invent an ID or put source inside the marker. If omitted, the interface remains below the answer.':'')}));
}


