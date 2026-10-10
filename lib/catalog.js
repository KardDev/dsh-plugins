import { UI_ICONS, UI_TONES } from './presentation.js';
import { componentGuide } from './components.js';
export { sceneExamples } from './scenes.js';
export { bicycleExample, oscillatorExample } from './canvas-example.js';
export const PROTOCOL_GUIDE = `DSH UI v1. Call render_ui({document: ...}) directly when interaction helps. Do not call it inside run_code/PTC in this version.
Formula shorthand: {expr:"state.V * state.V / state.R"} compiles to the same validated interpreter. Supports explicit state.x/data.x/derived.x/item.x references, + - * /, == != < <= > >=, parentheses, condition ? yes : no, min/max/round/abs, double-quoted strings and booleans. Use it in derived, node text/value/max/rows or map.fields. No arbitrary functions, property chains, statements or side effects; complex animation belongs in render_canvas. Example derived:{power:{expr:"state.V * state.V / state.R"}}, metric.value:{ref:"derived.power"}.
Document: {version:1,title:string,fallback:string,presentation?:{layout,accent,density},state?:{},data?:{},derived?:{},nodes:[],actions?:{}}.
Scene layouts: dashboard (metrics/trends), workbench (parameter controls/results), comparison (parallel choice cards), guide (ordered instructions), status (observed task snapshot), report (reading and evidence). Accent: blue/teal/violet/amber/rose; density: comfortable/compact. Omit to keep the standard design. Choose based on the task, not at random. Card surface: outline/soft/featured. Featured indicates discussion focus, not an automatic recommendation.
Additional nodes: badge {id,type,text,icon?,tone?}; progress {id,type,label,value,max,unit?,icon?,tone?} where values may be bindings and 0 <= value <= positive max; steps {id,type,items:[{title,description?,status:"pending"|"active"|"done"|"error"}]} (1..12 items); details {id,type,title,children,open?:boolean,icon?,tone?}. Progress and steps are declared snapshots, not a live host task subscription. Only claim real progress/completion from actual tool evidence; mark demo data visibly. Details keeps the content available in text fallback.
Streaming: use ONE normal native render_ui call. Write version,title,fallback,presentation,state,data,derived,actions BEFORE nodes where possible. The client previews completed, validated top-level subtrees as arguments stream; incomplete nodes/strings/calculations wait. Preview controls are disabled and never save state or send actions. Only a successful Host result activates the durable UI. No separate ui.begin/patch calls are required. A cancelled/failed generation has no interactive document. Prefer several small meaningful top-level sections over one enormous wrapping card.
All IDs and dictionary keys: ASCII letter followed by letters/digits/underscore, max64; unique node IDs. Standard components reject HTML, JS, URLs, styles and callbacks. The sandbox component below is the explicit exception; unlisted fields are always rejected.
Freeform canvas: {id,type:"sandbox",title,html,css?:string,script?:string,height?:160..1000,fallback,stateKeys?:string[],dataKeys?:string[],derivedKeys?:string[]}. Use it for custom SVG diagrams, animation, simulations and bespoke interfaces that fixed components cannot express. HTML is a body fragment. Put CSS in css and ALL JavaScript in script (not inline handlers, script tags or remote imports). Inline SVG is supported. Each source field allows up to 49152 characters; the total document remains 128KiB. The iframe has no same-origin privilege, remote resources/network APIs are blocked by CSP, and no host tools are exposed. Never put credentials or private unrelated data in a canvas. It is browser origin isolation, not a CPU/memory hard sandbox.
Canvas API: window.DSHUI.snapshot -> {state,data,derived,disabled,theme,visible}; DSHUI.animate(fn) returns cleanup and calls fn({time,delta,reducedMotion,visible}), time/delta in seconds, delta capped at 0.05. It pauses offscreen/background and supplies a static delta=0 callback for reduced motion; integrate delta for pause/resume without jumps. DSHUI.subscribe(snapshot=>{...}) immediately supplies current selected values and returns unsubscribe; DSHUI.setState({key:value,...}) requests an atomic Host-validated update of declared stateKeys. Use bare dictionary keys in stateKeys/dataKeys/derivedKeys. Only declared keys are exposed; state types/ranges/options remain enforced. Subscribe to drive DOM/SVG from host state; do not send the same state back from subscribe (feedback loop). Native controls and canvas share the saved state. Local animation may use requestAnimationFrame without saving every frame. No Agent/tool action API in this release. theme exposes bg,soft,ink,muted,line,accent,scheme; CSS variables --canvas-bg/soft/ink/muted/line/accent update automatically. Honor reduced motion, provide accessible labels and responsive layout. Canvas scripts activate only after successful tool commit and state restoration; previews show a placeholder. Use a complete useful fallback per canvas. Code or reset changes restart the frame, state changes do not. All transient internal animation state is reset on reload; declare important parameters in document.state.
state: key -> {type:"number",default,min,max,step} or {type:"string",default,options?:scalar[]} or {type:"boolean",default}. select requires options. Numeric defaults follow step from min.
derived: key -> expression: {const:scalar}, {ref:"state.key"|"data.key"|"derived.key"}, or {op,args:expression[]}. Allowed ops add,mul,min,max (1..8 args); sub,div,eq,neq,lt,lte,gt,gte (2); round,abs (1); if (3, boolean condition). No cycles. Arithmetic requires finite numbers: add does NOT concatenate strings. For formatted labels use a metric's label/unit/decimals, or format text inside a sandbox; omit unused derived fields. if can return strings: {op:"if",args:[{op:"gt",args:[{ref:"derived.weightGiB"},{const:20}]},{const:"超过理论预算"},{const:"在理论预算内"}]} -> bind a text node to this derived result. No separate conditional-rendering field is needed.
Text/metric values are literal scalars or {ref:...}. Table/chart rows may reference data.key or derived.key containing object rows. Dynamic rows: a derived root may be {map:{source:"data.samples",fields:{contextK:{op:"mul",args:[{ref:"state.contextK"},{ref:"item.fraction"}]},value:{ref:"derived.total"}}}}. source must be the string "data.samples", not an inline array; declare those object rows in document.data.samples. Internal field keys use ASCII identifiers such as powerW; Chinese text belongs in display labels. item.key is available only inside map fields. Each field is a normal scalar expression. No nested maps/callbacks; 1..16 fields, max500 generated rows across all maps; normal expression and calculation budgets apply. Derived output max128KiB. DSHUI.formatNumber(value, decimals=2) formats finite numbers with 0..6 decimal places and comma grouping, exactly matching native metrics and fallback; use it for shared readouts instead of mixing toFixed rounding. Use this for live charts/tables, never model calls on slider changes.
Registered component fields (some optional; required values and types follow the rules above/below): ${componentGuide()}. Controls bind "state.key"; slider numeric, toggle boolean, select requires state options. Metric decimals 0..6. Table columns: [{key,label,unit?}]. Chart kind bar/line, finite numeric values, rows as a data/derived binding; line xScale linear positions numeric labelKey samples by their actual coordinate, category uses equal spacing. Use ascending samples for a curve.
actions: key -> {type:"agent.followup",intent:string,stateKeys:string[]}. Button submits current selected parameters as a new conversation request; it does not perform a host action itself. All host actions still use ordinary DSH permissions.
Presentation: heading/text/card/metric accept optional tone (${UI_TONES.join(', ')}); heading/text/card/metric/button accept optional icon (${UI_ICONS.join(', ')}). Fixed tokens only, no SVG/HTML/CSS/color strings. Defaults already include icons and themed spacing. Use accent for primary information, warning for assumptions/caveats, success/danger only for explicitly established facts. Tones are static, not conditional; use derived string text to report changing verdicts. Use row for 2-3 related metrics, card for a meaningful section, avoid repeated headings and deep decorative nesting. Do not use color as the only explanation.
Always include a useful fallback, units, assumptions and data provenance in visible text. No invented measurements. Use local derived values rather than requesting inference on slider changes.
Limits: 128KiB document, 160 nodes, 12 node nesting levels, 64 state/derived/data/action keys, 128 expression nodes, 4096 calculation steps, 8192 characters/string. Charts include an accessible data table. Unknown fields/components are rejected.`;
export const calculatorExample = {
  version: 1, title: '理论权重体积计算器',
  fallback: '27B 参数、4 bit 时纯权重理论体积约 12.57 GiB。这是理论估算，不是实测文件大小或运行显存；不含量化元数据、混合精度层、KV cache 和运行缓冲区。',
  state: { parametersB: { type: 'number', default: 27, min: 1, max: 200, step: 1 }, bits: { type: 'number', default: 4, min: 2, max: 16, step: 1 } },
  data: {},
  derived: { weightGiB: { op: 'div', args: [{ op: 'mul', args: [{ ref: 'state.parametersB' }, { const: 1000000000 }, { ref: 'state.bits' }] }, { const: 8589934592 }] } },
  nodes: [
    { id: 'parameters', type: 'input', label: '参数量 B（十亿）', bind: 'state.parametersB' },
    { id: 'bits', type: 'slider', label: '假设有效位宽 bit', bind: 'state.bits' },
    { id: 'weight', type: 'metric', label: '纯权重理论体积', value: { ref: 'derived.weightGiB' }, unit: 'GiB', decimals: 2, icon: 'database', tone: 'accent' },
    { id: 'note', type: 'text', text: '理论估算，不是实际 GGUF 大小或推理显存。', tone: 'warning' },
    { id: 'followup', type: 'button', text: '按当前参数继续分析', action: 'analyze' }
  ],
  actions: { analyze: { type: 'agent.followup', intent: '分析当前参数下的量化选择，区分理论权重体积与真实运行开销；缺少信息时说明不确定性。', stateKeys: ['parametersB', 'bits'] } }
};
export const comparisonExample = {
  version: 1, title: '示例数据比较', fallback: '仅用于演示：A 为 12，B 为 18，C 为 15；不是实测性能。',
  data: { results: [{ name: 'A', value: 12 }, { name: 'B', value: 18 }, { name: 'C', value: 15 }] },
  nodes: [
    { id: 'note', type: 'text', text: '以下为演示数据，不是实测性能。', tone: 'warning' },
    { id: 'chart', type: 'chart', kind: 'bar', rows: { ref: 'data.results' }, labelKey: 'name', valueKey: 'value', label: '示例分数', unit: '分' },
    { id: 'table', type: 'table', rows: { ref: 'data.results' }, columns: [{ key: 'name', label: '方案' }, { key: 'value', label: '示例分数', unit: '分' }] }
  ]
};
export const budgetExample = {
  ...calculatorExample, title: '理论权重预算比较',
  fallback: '这是纯权重理论预算比较，不包含实际推理运行开销。默认 27B、4 bit、20 GiB 理论预算，权重约 12.57 GiB。',
  state: { ...calculatorExample.state, budgetGiB: { type: 'number', default: 20, min: 1, max: 96, step: 1 } },
  derived: { ...calculatorExample.derived,
    verdict: { op: 'if', args: [{ op: 'gt', args: [{ ref: 'derived.weightGiB' }, { ref: 'state.budgetGiB' }] }, { const: '超过纯权重理论预算；请降低位宽或提高预算。' }, { const: '在纯权重理论预算内；仍需另计运行开销。' }] }
  },
  nodes: [
    { id: 'assumptions', type: 'text', tone: 'warning', text: '以下均为理论估算，不能直接据此判断模型能否在显卡上运行。' },
    { id: 'settings', type: 'card', title: '调整参数', icon: 'sliders', children: [calculatorExample.nodes[0], calculatorExample.nodes[1], { id: 'budget', type: 'slider', label: '纯权重理论预算 GiB', bind: 'state.budgetGiB' }] },
    { id: 'results', type: 'row', children: [calculatorExample.nodes[2], { id: 'budgetMetric', type: 'metric', label: '理论预算', icon: 'target', tone: 'neutral', value: { ref: 'state.budgetGiB' }, unit: 'GiB', decimals: 0 }] },
    { id: 'verdictText', type: 'text', icon: 'info', text: { ref: 'derived.verdict' } }
  ], actions: {}
};
export const curveExample = {
  version: 1, title: '上下文与理论内存曲线',
  fallback: '理论估算，只计算纯权重与 KV cache，不包含运行缓冲、量化元数据或多卡分配。默认 27B、4.25 bpw、32K 上下文、48 KiB/token KV，权重约 13.36 GiB，权重加 KV 约 14.86 GiB。',
  state: {
    parametersB: { type: 'number', default: 27, min: 1, max: 200, step: 1 },
    bits: { type: 'number', default: 4.25, min: 2, max: 8, step: 0.25 },
    contextK: { type: 'number', default: 32, min: 8, max: 128, step: 8 },
    kvKib: { type: 'number', default: 48, min: 8, max: 192, step: 8 }
  },
  data: { samples: [{ fraction: 0.25 }, { fraction: 0.5 }, { fraction: 0.75 }, { fraction: 1 }] },
  derived: {
    weightGiB: calculatorExample.derived.weightGiB,
    totalGiB: { op: 'add', args: [{ ref: 'derived.weightGiB' }, { op: 'div', args: [{ op: 'mul', args: [{ ref: 'state.contextK' }, { ref: 'state.kvKib' }] }, { const: 1024 }] }] },
    curve: { map: { source: 'data.samples', fields: {
      contextK: { op: 'mul', args: [{ ref: 'state.contextK' }, { ref: 'item.fraction' }] },
      totalGiB: { op: 'add', args: [{ ref: 'derived.weightGiB' }, { op: 'div', args: [{ op: 'mul', args: [{ ref: 'state.contextK' }, { ref: 'item.fraction' }, { ref: 'state.kvKib' }] }, { const: 1024 }] }] }
    } } }
  },
  nodes: [
    { id: 'note', type: 'text', tone: 'warning', text: '理论值，不是实测推理显存。仅计纯权重 + KV cache，不含运行缓冲、量化元数据或多卡分配。' },
    { id: 'controls', type: 'card', title: '参数调整', icon: 'sliders', children: [
      calculatorExample.nodes[0], calculatorExample.nodes[1],
      { id: 'context', type: 'slider', label: '最大上下文 K tokens', bind: 'state.contextK' },
      { id: 'kv', type: 'slider', label: '每 token KV 开销 KiB', bind: 'state.kvKib' }
    ] },
    { id: 'metric', type: 'metric', label: '最大上下文下的理论权重 + KV', icon: 'database', value: { ref: 'derived.totalGiB' }, unit: 'GiB', decimals: 2 },
    { id: 'curveChart', type: 'chart', kind: 'line', xScale: 'linear', label: '上下文 K tokens → 权重 + KV', unit: 'GiB', rows: { ref: 'derived.curve' }, labelKey: 'contextK', valueKey: 'totalGiB' },
    { id: 'curveTable', type: 'table', rows: { ref: 'derived.curve' }, columns: [{ key: 'contextK', label: '上下文', unit: 'K tokens' }, { key: 'totalGiB', label: '理论内存', unit: 'GiB' }] },
    { id: 'followup', type: 'button', text: '按当前曲线继续分析', action: 'analyze' }
  ],
  actions: { analyze: { type: 'agent.followup', intent: '依据当前参数与 derived.curve 理论曲线分析上下文和内存取舍，说明尚未计入的实际运行开销。', stateKeys: ['parametersB', 'bits', 'contextK', 'kvKib'] } }
};

