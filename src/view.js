import React, { useEffect, useMemo, useRef, useState } from 'react';
import { evaluate, initialState, validateDocument, validateState, followupPrompt } from '../lib/protocol.js';
import { Icon } from './icons.js';
const h = React.createElement;
import { useSavedState } from './saved-state.js';
import { previewDocument, previewCanvas } from '../lib/stream.js';
import { CanvasPreview } from './canvas-preview.js';
import { Sandbox } from './sandbox.js';
import { BUILD_INFO } from '../lib/build-info.js';
import { formatNumber } from '../lib/format-number.js';
import { measureVisual } from '../lib/visual-audit.js';
import { AUDIT_MESSAGES } from '../lib/refinement.js';
import { publishDocument, useCurrentDocument } from './current-document.js';
import { HistoryView } from './history-view.js';
import { PresentationView } from './presentation.js';
const display = value => value === undefined || value === null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);
function NumericInput({ id, spec, value, onChange, invalidChanged, disabled }) {
  const [draft, setDraft] = useState(String(value)), [invalid, setInvalid] = useState(false);
  useEffect(() => { setDraft(String(value)); setInvalid(false); invalidChanged(id, false); }, [value, id, invalidChanged]);
  return h('input', {
    id, type: 'number', value: draft, min: spec.min, max: spec.max, step: spec.step, disabled,
    'aria-invalid': invalid,
    onChange(e) {
      const text = e.target.value; setDraft(text);
      const n = Number(text), bad = text.trim() === '' || !Number.isFinite(n) || n < spec.min || n > spec.max || Math.abs((n - spec.min) / spec.step - Math.round((n - spec.min) / spec.step)) > 1e-6;
      setInvalid(bad); invalidChanged(id, bad); if (!bad) onChange(n);
    }
  });
}
function Table({ rows, columns, id }) {
  return h('div', { className: 'dgui-table-wrap' }, h('table', { 'data-ui-node': id },
    h('thead', null, h('tr', null, columns.map(c => h('th', { key: c.key, scope: 'col' }, c.label, c.unit ? ` (${c.unit})` : '')))),
    h('tbody', null, rows.length ? rows.map((row, i) => h('tr', { key: i }, columns.map(c => h('td', { key: c.key, 'data-numeric': typeof row[c.key] === 'number' }, display(Object.hasOwn(row, c.key) ? row[c.key] : undefined))))) : h('tr', null, h('td', { colSpan: columns.length }, '暂无数据')))));
}
function Chart({ node, rows }) {
  const data = rows.slice(0, 40), values = data.map(r => r[node.valueKey]);
  const low = node.kind === 'line' && values.length ? Math.min(...values) : Math.min(0, ...values);
  const high = node.kind === 'line' && values.length ? Math.max(...values) : Math.max(0, ...values), range = high - low || 1;
  if (!Number.isFinite(range)) throw new Error('图表数值跨度过大，请缩小数值范围。');
  const y = value => 160 - (value - low) / range * 126, width = 600;
  const cell = 540 / Math.max(data.length, 1), labels = data.map(r => r[node.labelKey]);
  const xMin = node.xScale === 'linear' ? Math.min(...labels) : 0, xMax = node.xScale === 'linear' ? Math.max(...labels) : 0;
  const x = i => node.xScale === 'linear' ? xMax === xMin ? 314 : 44 + (labels[i] - xMin) / (xMax - xMin) * 540 : 44 + cell * (i + 0.5), baseline = y(0);
  const palette = ['var(--du-accent)', 'var(--du-green)', 'var(--du-violet)', 'var(--du-amber)'];
  return h('figure', { className: 'dgui-chart', 'data-ui-node': node.id },
    h('figcaption', null, h(Icon, { name: 'chart' }), node.label, node.unit && h('span', { className: 'dgui-chart-unit' }, `(${node.unit})`)),
    h('div', { className: 'dgui-plot', tabIndex: 0, role: 'region', 'aria-label': `${node.label}图表，可横向滚动` }, h('svg', { viewBox: `0 0 ${width} 205`, role: 'img', 'aria-label': `${node.label}。展开图表数据可查看每项数值。` },
      [0, 0.5, 1].map(t => h('g', { key: t }, h('line', { x1: 44, x2: 584, y1: y(low + range * t), y2: y(low + range * t), stroke: 'var(--du-line)', strokeDasharray: '3 5' }), h('text', { x: 35, y: y(low + range * t) + 4, textAnchor: 'end', fontSize: 14, fill: 'var(--du-muted)' }, Number((low + range * t).toPrecision(3)).toLocaleString()))),
      low <= 0 && high >= 0 && h('line', { x1: 44, x2: 584, y1: baseline, y2: baseline, stroke: 'var(--du-line)' }),
      node.kind === 'line' && h('polyline', { points: data.map((r, i) => `${x(i)},${y(r[node.valueKey])}`).join(' '), fill: 'none', stroke: 'var(--du-accent)', strokeWidth: 2.5, strokeLinejoin: 'round' }),
      data.map((r, i) => h('g', { key: i },
        node.kind === 'bar' ? h('rect', { x: x(i) - Math.min(40, cell * 0.3), y: Math.min(y(r[node.valueKey]), baseline), width: Math.max(1, Math.min(80, cell * 0.6)), height: Math.abs(y(r[node.valueKey]) - baseline), rx: 4, fill: palette[i % palette.length] }, h('title', null, `${r[node.labelKey]}: ${r[node.valueKey]}`)) : h('circle', { cx: x(i), cy: y(r[node.valueKey]), r: 3.5, fill: 'var(--du-accent)', stroke: 'var(--du-bg)', strokeWidth: 1.5 }, h('title', null, `${r[node.labelKey]}: ${r[node.valueKey]}`)),
        data.length <= 12 && h('text', { x: x(i), y: y(r[node.valueKey]) + (r[node.valueKey] < 0 ? 14 : -8), textAnchor: node.xScale === 'linear' && i === 0 ? 'start' : node.xScale === 'linear' && i === data.length - 1 ? 'end' : 'middle', fontSize: 14, fontWeight: 550, fill: 'var(--du-ink)' }, Number(r[node.valueKey].toPrecision(4)).toLocaleString()),
        (data.length <= 12 || i % Math.ceil(data.length / 12) === 0) && h('text', { x: x(i), y: 192, textAnchor: 'middle', fontSize: 14, fill: 'var(--du-muted)' }, String(r[node.labelKey]).slice(0, 12)))))),
    h('small', { className: 'dgui-chart-hint' }, '窄屏可横向滑动图表；展开下方数据可查看精确值。'),
    rows.length > 40 && h('small', null, '图示前 40 项，完整数值见下方数据。'),
    h('details', null, h('summary', null, '图表数据'), h(Table, { rows, columns: [{ key: node.labelKey, label: '项目' }, { key: node.valueKey, label: node.label, unit: node.unit }], id: `${node.id}-data` })));
}
export function UiView({ record, sessionId, sendPrompt, preview = false }) {
  const doc = record.document;
  const viewId=React.useId();
  const root=useRef(null),canvasAudits=useRef(new Map()),[audit,setAudit]=useState(null),auditPending=useRef(0);
  const collectAudit=React.useCallback(()=>{
    clearTimeout(auditPending.current);auditPending.current=setTimeout(()=>{
      if(!root.current||preview)return;
      const native=measureVisual(root.current),canvases=[...canvasAudits.current.values()];const issues=[...native,...canvases.flatMap(v=>v.issues)].slice(0,40),coverage=[native.coverage,...canvases.map(v=>v.coverage).filter(Boolean)].slice(0,32);
      const report={width:window.innerWidth,theme:document.body.hasAttribute('data-ds-dark-theme')?'dark':'light',issues,coverage};setAudit(report);
      fetch('/api/plugins/dsh-generative-ui/document?'+new URLSearchParams({documentId:record.documentId,sessionId}),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({documentRevision:record.documentRevision??0,report})}).catch(()=>{});
    },250);
  },[record.documentId,record.documentRevision,sessionId,preview]);
  useEffect(()=>{canvasAudits.current.clear();collectAudit();window.addEventListener('resize',collectAudit);const observer=new MutationObserver(collectAudit);observer.observe(document.body,{attributes:true,attributeFilter:['data-ds-dark-theme']});return()=>{clearTimeout(auditPending.current);window.removeEventListener('resize',collectAudit);observer.disconnect()};},[collectAudit]);
  const onAudit=(id,issues,coverage)=>{if(!Array.isArray(issues))return;canvasAudits.current.set(id,{coverage:coverage?{...coverage,nodeId:id}:undefined,issues:issues.filter(i=>Object.hasOwn(AUDIT_MESSAGES,i.code)).slice(0,40).map(i=>({...i,nodeId:id}))});collectAudit();};
  const { state, setState, ready, status, issue, epoch, retry, useRemote, keepLocal } = useSavedState(record, sessionId, preview);
  const [error, setError] = useState(''), [actionStatus, setActionStatus] = useState('');
  const [busy, setBusy] = useState(false), [invalidFields, setInvalidFields] = useState({});
  const pending = useRef(false);
  useEffect(() => { setInvalidFields({}); }, [epoch]);
  const invalidChanged = React.useCallback((id, invalid) => setInvalidFields(previous => previous[id] === invalid ? previous : { ...previous, [id]: invalid }), []);
  let computed;
  try { computed = evaluate(doc, state); } catch (e) { computed = { error: e.message }; }
  const currentState = useRef(state); currentState.current = state;
  useEffect(()=>{collectAudit();},[state,ready,collectAudit]);
  const updatePatch = patch => {
    const next = validateState(doc, { ...currentState.current, ...patch }); currentState.current = next; setState(next); setError(''); setActionStatus('');
  };
  const update = (key, value) => {
    try { updatePatch({ [key]: value }); }
    catch (e) { setError(e.message); }
  };
  const disabled = !ready || busy || !!computed.error || Object.values(invalidFields).some(Boolean);
  async function followup(actionKey) {
    if (pending.current || disabled) return;
    pending.current = true; setBusy(true); setActionStatus('正在发送…'); setError('');
    try {
      const prompt = followupPrompt(doc, state, actionKey, { documentId: record.documentId, sourceCallId: record.callId, sourceSessionId: record.sessionId, viewedSessionId: sessionId });
      await sendPrompt(prompt); setActionStatus('已加入当前会话队列');
    } catch (e) { setError(`发送失败：${e.message}`); setActionStatus(''); }
    finally { pending.current = false; setBusy(false); }
  }
  const resolve = value => computed.error ? '—' : computed.resolveValue(value);
  function renderNode(n) {
    const props = { key: n.id, 'data-ui-node': n.id, 'data-tone': n.tone };
    switch (n.type) {
      case 'sandbox': return h(Sandbox, { key: n.id, node: n, document:doc, state, data: doc.data, derived: computed.derived ?? {}, disabled, preview: preview || !ready, update: updatePatch, onAudit });
      case 'heading': return h('h4', { ...props, className: 'dgui-section-title' }, h(Icon, { name: n.icon ?? 'layers' }), h('span', null, display(resolve(n.text))));
      case 'text': return h('p', { ...props, className: `dgui-copy${n.icon ? ' dgui-with-icon' : ''}` }, (n.icon || n.tone && n.tone !== 'neutral') && h(Icon, { name: n.icon ?? (n.tone === 'warning' || n.tone === 'danger' ? 'warning' : n.tone === 'success' ? 'check' : 'info') }), h('span', null, display(resolve(n.text))));
      case 'row': case 'column': case 'card': return h('div', { ...props, className: `dgui-${n.type}`, 'data-surface': n.surface }, n.title && h('h4', { className: 'dgui-section-title' }, h(Icon, { name: n.icon ?? 'layers' }), h('span', null, n.title)), n.children.map(renderNode));
      case 'badge': return h('span', { ...props, className: 'dgui-tag' }, h(Icon, { name: n.icon ?? 'info' }), display(resolve(n.text)));
      case 'details': return h('details', { ...props, className: 'dgui-details', open: n.open }, h('summary', null, h(Icon, { name: n.icon ?? 'info' }), n.title), h('div', { className: 'dgui-column' }, n.children.map(renderNode)));
      case 'progress': { const v = resolve(n.value), max = resolve(n.max); return h('div', { ...props, className: 'dgui-progress' }, h('div', { className: 'dgui-progress-label' }, h('span', null, h(Icon, { name: n.icon ?? 'gauge' }), n.label), h('span', null, `${display(v)} / ${display(max)}${n.unit ? ' ' + n.unit : ''}`)), !computed.error && h('progress', { value: v, max, 'aria-label': n.label }), h('small', null, !computed.error ? `${Number((v / max * 100).toFixed(1))}%` : '—')); }
      case 'steps': return h('ol', { ...props, className: 'dgui-steps' }, n.items.map((item, i) => h('li', { key: i, 'data-step-status': item.status }, h('span', { className: 'dgui-step-dot', 'aria-hidden': true }, item.status === 'done' ? h(Icon, { name: 'check' }) : item.status === 'error' ? h(Icon, { name: 'warning' }) : i + 1), h('div', null, h('strong', null, item.title), h('span', { className: 'dgui-step-state' }, { pending: '待进行', active: '当前步骤', done: '已完成', error: '异常' }[item.status]), item.description && h('p', null, item.description)))));
      case 'metric': { const v = resolve(n.value); return h('div', { ...props, className: 'dgui-metric' }, h('span', { className: 'dgui-metric-label' }, h(Icon, { name: n.icon ?? 'gauge' }), n.label), h('strong', null, typeof v === 'number' ? formatNumber(v,n.decimals ?? 2) : '—', ' ', h('small', null, n.unit))); }
      case 'input': case 'slider': case 'select': case 'toggle': {
        const k = n.bind.split('.')[1], spec = doc.state[k], v = state[k], id = `dgui-${record.documentId}-${n.id}-${viewId}`;
        let control;
        if (n.type === 'select') control = h('select', { id, value: spec.options.indexOf(v), disabled: !ready, onChange: e => update(k, spec.options[Number(e.target.value)]) }, spec.options.map((o, i) => h('option', { key: i, value: i }, display(o))));
        else if (n.type === 'toggle') control = h('input', { id, className: 'dgui-toggle', type: 'checkbox', checked: v, disabled: !ready, onChange: e => update(k, e.target.checked) });
        else if (n.type === 'slider') control = h(React.Fragment, null, h('input', { id, type: 'range', min: spec.min, max: spec.max, step: spec.step, value: v, disabled: !ready, onChange: e => update(k, Number(e.target.value)) }), h('output', { htmlFor: id }, display(v)));
        else if (spec.type === 'number') control = h(NumericInput, { id, spec, value: v, disabled: !ready, invalidChanged, onChange: value => update(k, value) });
        else control = h('input', { id, type: 'text', value: v, maxLength: 8192, disabled: !ready, onChange: e => update(k, e.target.value) });
        return h('div', { ...props, className: 'dgui-control' }, h('label', { htmlFor: id }, h(Icon, { name: n.type === 'toggle' ? 'layers' : n.type === 'select' ? 'target' : 'sliders' }), h('span', null, n.label)), control);
      }
      case 'button': return h('button', { ...props, className: 'dgui-button', type: 'button', disabled: disabled || !sendPrompt, onClick: () => followup(n.action) }, n.text, h(Icon, { name: n.icon ?? 'arrow' }));
      case 'table': return computed.error ? null : h(Table, { key: n.id, id: n.id, rows: resolve(n.rows), columns: n.columns });
      case 'chart': return computed.error ? null : h(Chart, { key: n.id, node: n, rows: resolve(n.rows) });
      default: return null;
    }
  }
  const sceneIcons = { dashboard: 'chart', workbench: 'sliders', comparison: 'layers', guide: 'target', status: 'gauge', report: 'info' };
  return h('section', { ref:root,className: 'dgui-root', 'data-document-revision':record.documentRevision??0,'data-dgui-build': BUILD_INFO.id, 'data-dsh-generative-ui': record.documentId, 'data-layout': doc.presentation?.layout, 'data-accent': doc.presentation?.accent, 'data-density': doc.presentation?.density, 'data-preview': preview || undefined, 'aria-label': doc.title, 'aria-busy': preview || undefined },
    h('header', { className: 'dgui-header' }, h('span', { className: 'dgui-heading-icon' }, h(Icon, { name: sceneIcons[doc.presentation?.layout] ?? 'sliders' })), h('strong', { className: 'dgui-header-title' }, doc.title), h('span', { className: 'dgui-badge' }, h(Icon, { name: 'sparkles' }), preview ? '生成中' : '交互界面')),
    h('div', { key: epoch, className: 'dgui-content' }, doc.nodes.map(renderNode)),
    h('div', { className: 'dgui-status', role: 'status', 'data-status': /失败|冲突/.test(status) ? 'error' : /正在|等待/.test(status) ? 'pending' : 'saved' }, h(Icon, { name: /失败|冲突/.test(status) ? 'warning' : /正在|等待/.test(status) ? 'database' : 'check' }), h('span', null, status), actionStatus && h('span', null, ` · ${actionStatus}`)),
    issue && h('div', { className: 'dgui-recovery' },
      issue.kind === 'conflict' ? h(React.Fragment, null,
        h('button', { type: 'button', className: 'dgui-secondary', disabled: status === '正在恢复参数…', onClick: useRemote }, '使用已保存参数'),
        h('button', { type: 'button', className: 'dgui-secondary', disabled: status === '正在恢复参数…', onClick: keepLocal }, '保留本页参数并重试')) :
        h('button', { type: 'button', className: 'dgui-secondary', disabled: status === '正在恢复参数…', onClick: retry }, issue.kind === 'load' ? '重新读取参数' : '重试保存')),
    (error || computed.error) && h('p', { className: 'dgui-error', role: 'alert' }, error || computed.error),
    Object.values(invalidFields).some(Boolean) && h('p', { className: 'dgui-error', role: 'alert' }, '请输入范围内且符合步长的数值。'),
    !preview&&audit&&h('details',{className:'dgui-fallback dgui-audit'},h('summary',null,'显示检查'),h('p',null,`${audit.width}px · ${audit.theme==='dark'?'深色':'浅色'} · 启发式观察，不代表完整视觉验收。`),h('p',null,'未覆盖：复杂背景、遮挡关系及 SVG 配色；报告不等于完整无障碍检查。'),audit.coverage?.some(c=>c.truncated)&&h('p',null,'内容较多，本次只检查了每个区域的前 2000 个元素。'),audit.issues.length?h('ul',null,audit.issues.map((i,j)=>h('li',{key:j},AUDIT_MESSAGES[i.code],i.nodeId?`（${i.nodeId}）`:''))):h('p',null,'本次检查未发现所覆盖的问题。')),
    !preview&&h(HistoryView,{record,sessionId}),
    h('details', { className: 'dgui-fallback' }, h('summary', null, Object.keys(doc.state).length ? '原始文字说明与初始参数' : '原始文字说明'), h('p', null, doc.fallback), Object.keys(doc.state).length > 0 && h('pre', null, JSON.stringify(initialState(doc), null, 2))));
}
export class UiBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? h('div', { className: 'dgui-root', role: 'alert' }, '交互界面无法显示。', h('pre', null, this.props.fallback)) : this.props.children; }
}
export function ToolView(props) {
  if (props.phase === 'preparing') return h(StreamingToolView, props);
  if (props.phase === 'start') return h(StreamingPreview, { raw: props.block?.argsRaw ?? '', callId: props.callId, sessionId: props.sessionId });
  const fallback = (props.block.content ?? []).filter(x => x.type === 'text').map(x => x.text).join('\n');
  if (props.block.isError) return h('div', { className: 'dgui-root dgui-error', role: 'alert' }, '界面生成失败', h('pre', null, fallback));
  const raw = props.block.meta?.dshGenerativeUi;
  if (raw?.version === 1) return h('div', { className: 'dgui-pending' }, '交互界面已生成，请在本轮回答下方操作。', h('details', null, h('summary', null, '文字结果'), h('pre', null, fallback)));
  return h(ValidatedView, { ...props, raw, fallback });
}
function StreamingToolView(props) {
  const raw = props.useToolCallArgumentsPartial ? props.useToolCallArgumentsPartial() : '';
  return h(StreamingPreview, { raw, callId: props.callId, sessionId: props.sessionId });
}
export function StreamingPreview({ raw, callId = 'stream', sessionId }) {
  const deferred = React.useDeferredValue(raw);
  const doc = useMemo(() => previewDocument(deferred), [deferred]);
  const canvas=useMemo(()=>doc?null:previewCanvas(deferred),[doc,deferred]);
  if(canvas)return h('div',{className:'dgui-root','data-preview':true},h(CanvasPreview,{node:canvas}));
  if (!doc) return h('div', { className: 'dgui-pending', role: 'status' }, '正在组织并校验交互界面…');
  return h(UiBoundary, { key: callId, fallback: doc.fallback }, h(UiView, { record: { document: doc, documentId: `preview-${callId}` }, sessionId, preview: true }));
}
export function TurnUiView(props) {
  return (props.turn.data.get('dshGenerativeUi') ?? []).filter(r => r.seq < props.seq).map(r => r.isPatch?h(PatchNotice,{key:`patch-${r.seq}`,raw:r.raw}):h(PresentationView, { key: r.raw.documentId, ...r, sessionId: props.sessionId, sendPrompt: props.sendPrompt,scope:props.presentationScope }));
}
export function PatchNotice({raw}){useEffect(()=>{try{if(raw)publishDocument(raw)}catch{}},[raw]);return h('p',{className:'dgui-copy'},'界面修改已保存；原界面已更新。');}
export function ValidatedView({ raw, fallback, sessionId, sendPrompt }) {
  const {record:current,status,retry}=useCurrentDocument(raw??{},sessionId);
  const result = useMemo(() => {
    try {
      if (!current || current.version !== 1 || typeof current.documentId !== 'string' || typeof current.callId !== 'string') return null;
      return { ...current, document: validateDocument(current.document) };
    } catch { return null; }
  }, [current]);
  if (!result) return h('div', { className: 'dgui-root' }, h('p', null, '文字结果（未提供兼容的界面数据）'), h('pre', null, fallback));
  return h(React.Fragment,null,
    status==='error'&&h('div',{className:'dgui-root dgui-document-warning',role:'status'},h('p',null,'未能确认最新界面版本，当前显示已知版本。'),h('button',{type:'button',className:'dgui-secondary',onClick:retry},'重新读取最新界面')),
    status==='loading'&&h('p',{className:'dgui-copy',role:'status'},'正在读取最新界面版本…'),
    h(UiBoundary, { key: `${result.documentId}:${sessionId}`, fallback:fallback??result.document.fallback }, h(UiView, { key: `${result.documentId}:${sessionId}`, record: result, sessionId, sendPrompt })));
}


