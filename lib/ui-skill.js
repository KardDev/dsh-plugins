import { readFileSync } from 'node:fs';
import { PROTOCOL_GUIDE } from './catalog.js';
import { CANVAS_DESIGN_GUIDE } from './canvas-design.js';
import { FREE_UI_CONTRACT } from './freeform.js';
import { UI_INTENT_POLICY } from './ui-intent.js';
import { CANVAS_SYSTEM_GUIDE } from './canvas-system.js';
import {QUICK_EXAMPLES,QUICK_GUIDE} from './quick-examples.js';

// Authored examples are deliberately small enough to be present in every model's context.
export const SKILL_EXAMPLES = [
  {
    version: 1, title: '示例 · 数量与费用', fallback: '演示：单价 12 元，数量默认 2，总额 24 元。不是报价。',
    presentation: { layout: 'workbench', accent: 'teal', density: 'comfortable' },
    state: { quantity: { type: 'number', default: 2, min: 1, max: 10, step: 1 } },
    derived: { total: { op: 'mul', args: [{ ref: 'state.quantity' }, { const: 12 }] } },
    nodes: [
      { id: 'quantity', type: 'slider', label: '数量（件）', bind: 'state.quantity' },
      { id: 'total', type: 'metric', label: '演示总额', value: { ref: 'derived.total' }, unit: '元', decimals: 0 },
      { id: 'note', type: 'text', text: '示例单价，非实际报价。' }
    ]
  },
  {
    version: 1, title: '示例 · 周期运动', fallback: '一个圆点沿横向做周期运动。速度可调，运行可暂停；数学动画示意，非真实物理仿真。',
    presentation: { layout: 'workbench', accent: 'blue' },
    state: { speed: { type: 'number', default: 1, min: 1, max: 3, step: 1 }, running: { type: 'boolean', default: false } },
    nodes: [
      { id: 'motion', type: 'sandbox', title: '周期运动示意', height: 220, stateKeys: ['speed', 'running'], fallback: '圆点沿直线往返。运行开关控制暂停，速度从 1 到 3。',
        html: '<svg viewBox="0 0 360 140" role="img" aria-label="圆点沿直线往返"><path d="M40 70H320" stroke="var(--canvas-line)"/><circle id="dot" cx="180" cy="70" r="16" fill="var(--canvas-accent)"/></svg><p id="caption"></p>',
        css: 'svg{display:block;width:100%;height:150px}p{margin:8px 12px;font-size:14px;color:var(--canvas-ink)}',
        script: "let state={speed:1,running:false},phase=0;const dot=document.getElementById('dot'),caption=document.getElementById('caption');const unsubscribe=DSHUI.subscribe(s=>{state=s.state;caption.textContent=(state.running?'运行':'暂停')+' · 速度 '+state.speed+' · 数学示意，非物理仿真'});const stop=DSHUI.animate(({delta,reducedMotion,visible})=>{if(state.running&&!reducedMotion&&visible)phase+=delta*state.speed;dot.setAttribute('cx',String(180+120*Math.sin(phase)))});addEventListener('pagehide',()=>{stop();unsubscribe()},{once:true});"
      },
      { id: 'speed', type: 'slider', label: '演示速度（倍）', bind: 'state.speed' },
      { id: 'running', type: 'toggle', label: '运行（关闭后保持当前位置）', bind: 'state.running' }
    ]
  }
];

const skill = readFileSync(new URL('../skills/intelligent-ui/SKILL.md', import.meta.url), 'utf8');
export const UI_SKILL_SECTIONS = Object.freeze([
  { name: 'generative-ui:design-skill', order: 850, interpolate: false, text: UI_INTENT_POLICY + '\n\n' + skill + '\n\nCanvas composition details:\n' + CANVAS_DESIGN_GUIDE + '\n\nConstruction handbook:\n' + CANVAS_SYSTEM_GUIDE },
  { name: 'generative-ui:protocol', order: 851, interpolate: false, text: PROTOCOL_GUIDE },
  { name: 'generative-ui:worked-examples', order: 852, interpolate: false, text: QUICK_GUIDE+'\nThese valid render_ui examples start with static flow and comparison; the last adds a control only for a calculation. Adapt to the user, not their demo claims. Submit as render_ui({document: ...}). Animation examples remain available via ui_catalog({topic:"canvas"}).\n' + [QUICK_EXAMPLES[0],QUICK_EXAMPLES[1],SKILL_EXAMPLES[0]].map(doc => JSON.stringify(doc)).join('\n') }
]);
export function promptSections(mode='guided'){
  if(!['guided','free'].includes(mode))throw new Error('DSH UI: designMode must be guided or free');
  return mode==='guided'?UI_SKILL_SECTIONS:UI_SKILL_SECTIONS.map((s,i)=>({...s,text:i===0?UI_INTENT_POLICY+'\n\n'+FREE_UI_CONTRACT:''}));
}
