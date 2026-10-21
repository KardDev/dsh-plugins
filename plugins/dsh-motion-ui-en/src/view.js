import {ExpressiveAction,ElasticToggle,Stepper} from './expressive-controls.js';
import {SegmentedControl,MetricValue} from './motion-controls.js';
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
import {useUiRegistry} from './presentation-store.js';
import {useViewDetails,useNativeStyle} from './view-settings.js';
import {typographyStyle} from '../lib/typography.js';
import {StreamSurface} from './stream-surface.js';
import {VisualView} from './visual-view.js';
import {deliveryDiagnostics} from '../lib/delivery.js';
import {CopyBlock} from './copy-block.js';
import {useExportedCanvases} from './media-presentation.js';
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
function Table({ rows, columns, id, label }) {
  return h('div', { className: 'dgui-table-wrap' }, h('table', { 'data-ui-node': id },
    label && h('caption', null, label),
    h('thead', null, h('tr', null, columns.map(c => h('th', { key: c.key, scope: 'col' }, c.label, c.unit ? ` (${c.unit})` : '')))),
    h('tbody', null, rows.length ? rows.map((row, i) => h('tr', { key: i }, columns.map(c => h('td', { key: c.key, 'data-numeric': typeof row[c.key] === 'number' }, display(Object.hasOwn(row, c.key) ? row[c.key] : undefined))))) : h('tr', null, h('td', { colSpan: columns.length }, 'No data')))));
}
function Chart({ node, rows }) {
  const [showData,setShowData]=useState(false);
  const data = rows.slice(0, 40), values = data.map(r => r[node.valueKey]);
  const low = node.kind === 'line' && values.length ? Math.min(...values) : Math.min(0, ...values);
  const high = node.kind === 'line' && values.length ? Math.max(...values) : Math.max(0, ...values), range = high - low || 1;
  if (!Number.isFinite(range)) throw new Error('Chart values span too wide a range. Narrow the range.');
  const y = value => 160 - (value - low) / range * 126, width = 600;
  const cell = 540 / Math.max(data.length, 1), labels = data.map(r => r[node.labelKey]);
  const xMin = node.xScale === 'linear' ? Math.min(...labels) : 0, xMax = node.xScale === 'linear' ? Math.max(...labels) : 0;
  const x = i => node.xScale === 'linear' ? xMax === xMin ? 314 : 44 + (labels[i] - xMin) / (xMax - xMin) * 540 : 44 + cell * (i + 0.5), baseline = y(0);
  const palette = ['var(--du-accent)', 'var(--du-green)', 'var(--du-violet)', 'var(--du-amber)'];
  return h('figure', { className: 'dgui-chart', 'data-ui-node': node.id },
    h('figcaption', null, h(Icon, { name: 'chart' }), node.label, rows.length>40&&' (first 40 shown)', node.unit && h('span', { className: 'dgui-chart-unit' }, `(${node.unit})`),h('button',{type:'button',className:'dgui-chart-data-button','aria-expanded':showData,onClick:()=>setShowData(!showData)},'Chart data')),
    h('div', { className: 'dgui-plot', tabIndex: 0, role: 'region', 'aria-label': `${node.label} chart; scroll horizontally` }, h('svg', { viewBox: `0 0 ${width} 205`, role: 'img', 'aria-label': `${node.label}. Expand chart data to see each value.` },
      [0, 0.5, 1].map(t => h('g', { key: t }, h('line', { x1: 44, x2: 584, y1: y(low + range * t), y2: y(low + range * t), stroke: 'var(--du-line)', strokeDasharray: '3 5' }), h('text', { x: 35, y: y(low + range * t) + 4, textAnchor: 'end', fontSize: 14, fill: 'var(--du-muted)' }, Number((low + range * t).toPrecision(3)).toLocaleString()))),
      low <= 0 && high >= 0 && h('line', { x1: 44, x2: 584, y1: baseline, y2: baseline, stroke: 'var(--du-line)' }),
      node.kind === 'line' && h('polyline', { points: data.map((r, i) => `${x(i)},${y(r[node.valueKey])}`).join(' '), fill: 'none', stroke: 'var(--du-accent)', strokeWidth: 2.5, strokeLinejoin: 'round' }),
      data.map((r, i) => h('g', { key: i },
        node.kind === 'bar' ? h('rect', { x: x(i) - Math.min(40, cell * 0.3), y: Math.min(y(r[node.valueKey]), baseline), width: Math.max(1, Math.min(80, cell * 0.6)), height: Math.abs(y(r[node.valueKey]) - baseline), rx: 4, fill: palette[i % palette.length] }, h('title', null, `${r[node.labelKey]}: ${r[node.valueKey]}`)) : h('circle', { cx: x(i), cy: y(r[node.valueKey]), r: 3.5, fill: 'var(--du-accent)', stroke: 'var(--du-bg)', strokeWidth: 1.5 }, h('title', null, `${r[node.labelKey]}: ${r[node.valueKey]}`)),
        data.length <= 12 && h('text', { x: x(i), y: y(r[node.valueKey]) + (r[node.valueKey] < 0 ? 14 : -8), textAnchor: node.xScale === 'linear' && i === 0 ? 'start' : node.xScale === 'linear' && i === data.length - 1 ? 'end' : 'middle', fontSize: 14, fontWeight: 550, fill: 'var(--du-ink)' }, Number(r[node.valueKey].toPrecision(4)).toLocaleString()),
        (data.length <= 12 || i % Math.ceil(data.length / 12) === 0) && h('text', { x: x(i), y: 192, textAnchor: 'middle', fontSize: 14, fill: 'var(--du-muted)' }, String(r[node.labelKey]).slice(0, 12)))))),
    h('div', {hidden:!showData}, h(Table, { rows, columns: [{ key: node.labelKey, label: 'Item' }, { key: node.valueKey, label: node.label, unit: node.unit }], id: `${node.id}-data` })));
}
export function UiView({ record, sessionId, sendPrompt, openFile, preview = false,replaceExportedCanvases=false }) {
  const exportedCanvases=useExportedCanvases(record,sessionId,replaceExportedCanvases);
  const showDetails=useViewDetails();
  const nativeStyle=useNativeStyle();
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
    pending.current = true; setBusy(true); setActionStatus('Sending…'); setError('');
    try {
      const prompt = followupPrompt(doc, state, actionKey, { documentId: record.documentId, sourceCallId: record.callId, sourceSessionId: record.sessionId, viewedSessionId: sessionId });
      await sendPrompt(prompt); setActionStatus('Added to the current session queue');
    } catch (e) { setError(`Failed to send: ${e.message}`); setActionStatus(''); }
    finally { pending.current = false; setBusy(false); }
  }
  const resolve = value => computed.error ? '—' : computed.resolveValue(value);
  function renderNode(n) {
    if(n.type==='sandbox'&&exportedCanvases.has(n.id))return null;
    const props = { key: n.id, 'data-ui-node': n.id, 'data-tone': n.tone,style:['text','heading','callout'].includes(n.type)?typographyStyle(n):['row','column'].includes(n.type)?{gap:n.gap,...(n.columns?{'--du-columns':n.columns}:{} )}:undefined };
    const copy=()=>n.spans?n.spans.map((span,i)=>h('span',{key:i,style:typographyStyle(span)},span.text)):display(resolve(n.text));
    switch (n.type) {
      case 'visual': return h(VisualView,{key:n.id,node:n,state:state[n.stateKey],update:value=>updatePatch({[n.stateKey]:value}),disabled,preview,sendPrompt,openFile,documentTitle:doc.title,provenance:{documentId:record.documentId,sourceSessionId:record.sessionId,viewedSessionId:sessionId}});
      case 'code': return h(CopyBlock,{key:n.id,nodeId:n.id,text:n.code,lang:n.lang,title:n.title,wrap:n.wrap,code:true,disabled:preview});
      case 'sandbox': return h(Sandbox, { key: n.id, node: n, document:doc, state, data: doc.data, derived: computed.derived ?? {}, disabled, preview: preview || !ready, update: updatePatch, onAudit });
      case 'heading': return h('h4', { ...props, className: 'dgui-section-title' }, n.icon&&h(Icon, { name: n.icon }), h('span', null, copy()));
      case 'text': case 'callout': if(n.copyable)return h(CopyBlock,{key:n.id,nodeId:n.id,title:n.title,text:n.spans?n.spans.map(s=>s.text).join(''):display(resolve(n.text)),disabled:preview,style:typographyStyle(n)},copy());return h('p', { ...props, className: `dgui-copy${n.type==='callout'?' dgui-callout':''}${n.icon ? ' dgui-with-icon' : ''}` }, (n.icon || n.tone && n.tone !== 'neutral') && h(Icon, { name: n.icon ?? (n.tone === 'warning' || n.tone === 'danger' ? 'warning' : n.tone === 'success' ? 'check' : 'info') }), h('span', null, copy()));
      case 'row': case 'column': case 'card': return h('div', { ...props, className: `dgui-${n.type}${n.columns?' dgui-grid':''}`, 'data-surface': n.surface,'data-columns':n.columns }, n.title && h('h4', { className: 'dgui-section-title' }, n.icon&&h(Icon, { name: n.icon }), h('span', null, n.title)), n.children.map(renderNode));
      case 'badge': return h('span', { ...props, className: 'dgui-tag' }, h(Icon, { name: n.icon ?? 'info' }), display(resolve(n.text)));
      case 'details': return h('details', { ...props, className: 'dgui-details', open: n.open }, h('summary', null, h(Icon, { name: n.icon ?? 'info' }), n.title), h('div', { className: 'dgui-column' }, n.children.map(renderNode)));
      case 'progress': { const v = resolve(n.value), max = resolve(n.max); return h('div', { ...props, className: 'dgui-progress' }, h('div', { className: 'dgui-progress-label' }, h('span', null, h(Icon, { name: n.icon ?? 'gauge' }), n.label), h('span', null, `${display(v)} / ${display(max)}${n.unit ? ' ' + n.unit : ''}`)), !computed.error && h('progress', { value: v, max, 'aria-label': n.label }), h('small', null, !computed.error ? `${Number((v / max * 100).toFixed(1))}%` : '—')); }
      case 'steps': return h('section',props,n.title&&h('h4',{className:'dgui-section-title'},n.title),h('ol', {className:'dgui-steps'}, n.items.map((item, i) => h('li', { key: i, 'data-step-status': item.status }, h('span', { className: 'dgui-step-dot', 'aria-hidden': true }, item.status === 'done' ? h(Icon, { name: 'check' }) : item.status === 'error' ? h(Icon, { name: 'warning' }) : i + 1), h('div', null, h('strong', null, item.title), item.status && h('span', { className: 'dgui-step-state' }, { pending: 'Pending', active: 'Current step', done: 'Done', error: 'Error' }[item.status]), item.description && h('p', null, item.description))))));
      case 'metric': { const v = resolve(n.value); return h('div', { ...props, className: 'dgui-metric' }, h('span', { className: 'dgui-metric-label' }, h(Icon, { name: n.icon ?? 'gauge' }), n.label), h(MetricValue, {value:v,preview:preview||!ready,expressive:true}, typeof v === 'number' ? formatNumber(v,n.decimals ?? 2) : display(v), ' ', h('small', null, n.unit))); }
      case 'input': case 'slider': case 'select': case 'toggle': {
        const k = n.bind.split('.')[1], spec = doc.state[k], v = state[k], id = `dgui-${record.documentId}-${n.id}-${viewId}`;
        let control;
        if(n.type==='select'&&n.variant==='segmented'&&spec.options.length>=2&&spec.options.length<=8)control=h(SegmentedControl,{id,label:n.label,options:spec.options,value:v,disabled:!ready,onChange:value=>update(k,value)});
        else if (n.type === 'select') control = h('select', { id, value: spec.options.indexOf(v), disabled: !ready, onChange: e => update(k, spec.options[Number(e.target.value)]) }, spec.options.map((o, i) => h('option', { key: i, value: i }, display(o))));
        else if(n.type==='toggle')control=h(ElasticToggle,{id,checked:v,disabled:!ready,onChange:value=>update(k,value)});
        else if (n.type === 'toggle') control = h('input', { id, className: 'dgui-toggle', type: 'checkbox', checked: v, disabled: !ready, onChange: e => update(k, e.target.checked) });
        else if (n.type === 'slider') control = h(React.Fragment, null, h('input', { id, style:{'--du-range':(spec.max>spec.min?(v-spec.min)/(spec.max-spec.min)*100:0)+'%'}, type: 'range', min: spec.min, max: spec.max, step: spec.step, value: v, disabled: !ready, onChange: e => update(k, Number(e.target.value)) }), h('output', { htmlFor: id }, display(v)));
        else if (spec.type === 'number') control = h(NumericInput, { id, spec, value: v, disabled: !ready, invalidChanged, onChange: value => update(k, value) });
        else control = h('input', { id, type: 'text', value: v, maxLength: 8192, disabled: !ready, onChange: e => update(k, e.target.value) });
        if(n.type==='input'&&spec.type==='number')control=h(Stepper,{value:v,spec,label:n.label,disabled:!ready,onChange:value=>update(k,value)},control);
        return h('div', { ...props, className: 'dgui-control' }, h(n.type==='select'&&n.variant==='segmented'&&spec.options.length>=2&&spec.options.length<=8?'span':'label', { htmlFor: id,className:'dgui-control-label' }, h(Icon, { name: n.type === 'toggle' ? 'layers' : n.type === 'select' ? 'target' : 'sliders' }), h('span', null, n.label)), control);
      }
      case 'button': case 'link': {
        const common={...props,className:'dgui-button','data-variant':n.variant??(n.action?'primary':'secondary')};
        if(n.href&&!preview)return h(ExpressiveAction,{tag:'a',text:n.text,icon:n.icon??'external',...common,href:n.href,target:'_blank',rel:'noopener noreferrer',title:n.href},n.text,h(Icon,{name:n.icon??'external'}));
        if(n.path)return h(ExpressiveAction,{text:n.text,icon:n.icon??'file',...common,type:'button',disabled:preview||!openFile,title:openFile?n.path:'File opening is not available on this host.',onClick:async()=>{try{await openFile(n.path);setError('')}catch(e){setError('Failed to open file: '+e.message)}}},n.text,h(Icon,{name:n.icon??'file'}));
        return h(ExpressiveAction,{text:n.text,icon:n.icon??'arrow',...common,type:'button',disabled:preview||disabled||!sendPrompt||!n.action,onClick:()=>followup(n.action)},n.text,h(Icon,{name:n.icon??'arrow'}));
      }
      case 'divider': return h('div',{...props,className:'dgui-divider',role:'separator'},n.label&&h('span',null,n.label));
      case 'table': return computed.error ? null : h(Table, { key: n.id, id: n.id, label:n.label, rows: resolve(n.rows), columns: n.columns });
      case 'chart': return computed.error ? null : h(Chart, { key: n.id, node: n, rows: resolve(n.rows) });
      default: return null;
    }
  }

  if(doc.nodes.every(n=>n.type==='sandbox'&&exportedCanvases.has(n.id)))return null;
  return h('section', { ref:root,className: 'dgui-root', 'data-document-revision':record.documentRevision??0,'data-dgui-build': BUILD_INFO.id, 'data-dsh-generative-ui': record.documentId, 'data-preset':doc.presentation?.preset??({comparison:'comparison',guide:'list',report:'reading'}[doc.presentation?.layout]??'brief'), 'data-visual-style':nativeStyle, 'data-layout': doc.presentation?.layout, 'data-accent': doc.presentation?.accent, 'data-density': doc.presentation?.density, 'data-preview': preview || undefined, 'aria-label': doc.title, 'aria-busy': preview || undefined },
    doc.title&&doc.title!=='Content'&&!(doc.nodes[0]?.type==='heading'&&typeof doc.nodes[0].text==='string'&&doc.nodes[0].text.trim()===doc.title.trim())&&h('header', { className: 'dgui-header' }, h('strong', { className: 'dgui-header-title' }, doc.title)),
    !preview&&deliveryDiagnostics(doc).length>0&&h('p',{className:'dgui-tool-error',role:'status'},'Some content was not generated; the model can repair this interface.'),
    h('div', { key: epoch, className: 'dgui-content' }, doc.nodes.map(renderNode)),
    (Object.keys(doc.state).length>0||issue||actionStatus)&&h('div', { className: showDetails||issue||actionStatus?'dgui-status':'dgui-sr-only', role: 'status', 'data-status': /fail|conflict|error/i.test(status) ? 'error' : /saving|loading|restoring|preparing|waiting|generating|checking|sending|creating|reading/i.test(status) ? 'pending' : 'saved' }, h(Icon, { name: /fail|conflict|error/i.test(status) ? 'warning' : /saving|loading|restoring|preparing|waiting|generating|checking|sending|creating|reading/i.test(status) ? 'database' : 'check' }), h('span', null, status), actionStatus && h('span', null, ` · ${actionStatus}`)),
    issue && h('div', { className: 'dgui-recovery' },
      issue.kind === 'conflict' ? h(React.Fragment, null,
        h('button', { type: 'button', className: 'dgui-secondary', disabled: status === 'Restoring parameters…', onClick: useRemote }, 'Use saved parameters'),
        h('button', { type: 'button', className: 'dgui-secondary', disabled: status === 'Restoring parameters…', onClick: keepLocal }, 'Keep parameters on this page and retry')) :
        h('button', { type: 'button', className: 'dgui-secondary', disabled: status === 'Restoring parameters…', onClick: retry }, issue.kind === 'load' ? 'Reload parameters' : 'Retry save')),
    (error || computed.error) && h('p', { className: 'dgui-error', role: 'alert' }, error || computed.error),
    Object.values(invalidFields).some(Boolean) && h('p', { className: 'dgui-error', role: 'alert' }, 'Enter a value within range that matches the step.'),
    showDetails&&!preview&&audit&&h('details',{className:'dgui-fallback dgui-audit'},h('summary',null,'Show checks'),h('p',null,`${audit.width}px · ${audit.theme==='dark'?'Dark':'Light'} · Heuristic observations only; not a full visual acceptance check.`),h('p',null,'Not covered: complex backgrounds, occlusion, and SVG colors; the report is not a complete accessibility check.'),audit.coverage?.some(c=>c.truncated)&&h('p',null,'Content is large; only the first 2000 elements in each area were checked.'),audit.issues.length?h('ul',null,audit.issues.map((i,j)=>h('li',{key:j},AUDIT_MESSAGES[i.code],i.nodeId?`（${i.nodeId}）`:''))):h('p',null,'No issues were found in the covered checks.')),
    showDetails&&!preview&&h(HistoryView,{record,sessionId}),
    showDetails&&h('details', { className: 'dgui-fallback' }, h('summary', null, Object.keys(doc.state).length ? 'Original fallback and initial parameters' : 'Original fallback'), h('p', null, doc.fallback), Object.keys(doc.state).length > 0 && h('pre', null, JSON.stringify(initialState(doc), null, 2))));
}
export class UiBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? h('div', { className: 'dgui-root', role: 'alert' }, 'The interactive interface cannot be displayed.', h('pre', null, this.props.fallback)) : this.props.children; }
}
export function ToolView(props) {
  // Tool preview and the turn tail have different lifecycles in DSH. Do not
  // mount a canvas before the turn ends only to tear it down for later prose.
  if (props.phase === 'preparing' || props.phase === 'start' || typeof props.block?.argsRaw === 'string') return h('p', {className:'dgui-pending',role:'status'}, 'Generating the interface; the full content will preview progressively.');
  const fallback = (props.block.content ?? []).filter(x => x.type === 'text').map(x => x.text).join('\n');
  if (props.block.isError) return h('div', { className: 'dgui-tool-error', role: 'alert' }, h(Icon,{name:'warning'}), h('span',null,fallback || 'The interface was not generated. Check the tool arguments.'));
  const raw = props.block.meta?.dshGenerativeUi;
  if (raw?.version === 1) {
    try { validateDocument(raw.document); return h('p', { className: 'dgui-pending',role:'status' }, 'Interface generated. Interaction is enabled after the turn ends.'); }
    catch { /* Retain the plain-text fallback for malformed historical metadata. */ }
  }
  return h(ValidatedView, { ...props, raw, fallback });
}
export function StreamingPreview({ raw, callId = 'stream', sessionId }) {
  const committed=useUiRegistry().some(r=>r.sessionId===sessionId&&r.raw.callId===callId);
  const deferred = React.useDeferredValue(raw);
  const doc = useMemo(() => previewDocument(deferred), [deferred]);
  const canvas=useMemo(()=>doc?null:previewCanvas(deferred),[doc,deferred]);
  if(committed)return h('p',{className:'dgui-copy'},'Interface generated.');
  if(canvas)return h('div',{className:'dgui-root','data-preview':true},h(CanvasPreview,{node:canvas}));
  if (!doc) return h('div', { className: 'dgui-pending', role: 'status' }, 'Assembling and validating the interactive interface…');
  return h(UiBoundary, { key: callId, fallback: doc.fallback }, h(UiView, { record: { document: doc, documentId: `preview-${callId}` }, sessionId, preview: true }));
}
export function TurnUiView(props) {
  // Readiness comes from durable turn/end, never from tool completion, a live
  // tail seq, elapsed time, or the presence of a partial Markdown marker.
  const stream=props.turn.data.get('dshUiStream');
  return h(React.Fragment,null,stream&&typeof stream==='object'&&!Array.isArray(stream)&&h(StreamSurface,{stream,sessionId:props.sessionId,committedIds:(props.turn.data.get('dshGenerativeUi')??[]).filter(r=>r.displayReady&&!r.isPatch).map(r=>r.raw.documentId)}), (props.turn.data.get('dshGenerativeUi') ?? []).filter(r=>r.displayReady===true).map(r => r.isPatch?h(PatchNotice,{key:`patch-${r.seq}`,raw:r.raw}):h(PresentationView, { key: r.raw.documentId, ...r, sessionId: props.sessionId, sendPrompt: props.sendPrompt,openFile:props.openFile,scope:props.presentationScope })));
}
export function PatchNotice({raw}){useEffect(()=>{try{if(raw)publishDocument(raw)}catch{}},[raw]);return h('p',{className:'dgui-copy'},'Interface changes saved; the original interface has been updated.');}
export function ValidatedView({ raw, fallback, sessionId, sendPrompt, openFile,replaceExportedCanvases=false }) {
  const {record:current,status,retry}=useCurrentDocument(raw??{},sessionId);
  const result = useMemo(() => {
    try {
      if (!current || current.version !== 1 || typeof current.documentId !== 'string' || typeof current.callId !== 'string') return null;
      return { ...current, document: validateDocument(current.document) };
    } catch { return null; }
  }, [current]);
  if (!result) return h('div', { className: 'dgui-root' }, h('p', null, 'Text result (no compatible interface data)'), h('pre', null, fallback));
  return h(React.Fragment,null,
    status==='error'&&h('div',{className:'dgui-root dgui-document-warning',role:'status'},h('p',null,'Could not confirm the latest interface revision; showing the known revision.'),h('button',{type:'button',className:'dgui-secondary',onClick:retry},'Reload latest interface')),
    status==='loading'&&h('p',{className:'dgui-copy',role:'status'},'Loading the latest interface revision…'),
    h(UiBoundary, { key: `${result.documentId}:${sessionId}`, fallback:fallback??result.document.fallback }, h(UiView, { key: `${result.documentId}:${sessionId}`, record: result, sessionId, sendPrompt,openFile,replaceExportedCanvases })));
}
