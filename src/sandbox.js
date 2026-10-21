import React, { useEffect, useMemo, useRef, useState } from 'react';
import { canvasPatch, canvasSnapshot, sandboxDocument, SANDBOX_LIMITS } from '../lib/sandbox.js';
import { CanvasPreview } from './canvas-preview.js';
import { standaloneCanvas } from '../lib/canvas-export.js';
import {useViewDetails} from './view-settings.js';
import {ActionMenu} from './action-menu.js';
const h = React.createElement;
// getRandomValues also works on HTTP LAN deployments, unlike randomUUID.
const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
export function Sandbox({ node, document:doc, state, data, derived, disabled, preview, update, onAudit }) {
  const showDetails=useViewDetails();
  const frame = useRef(null), latest = useRef(null), connected = useRef(false), loads = useRef(0), visible = useRef(true), errorKind = useRef('');
  const [error, setError] = useState(''), [stopped, setStopped] = useState(false), [generation, setGeneration] = useState(0);
  const [height, setHeight] = useState(node.height ?? 420);
  const [token, setToken] = useState(0);
  const [mounted, setMounted] = useState(false);
  const sourceKey = JSON.stringify(node);
  const config = useMemo(() => ({ channel: randomToken(), nonce: randomToken() }), [sourceKey, generation]);
  const srcDoc = useMemo(() => sandboxDocument(node, config.channel, config.nonce), [sourceKey, config]);
  latest.current = { node, state, data, derived, disabled, update, onAudit };
  const publish = () => {
    const el = frame.current, current = latest.current;
    if (!el || !connected.current) return;
    const css = getComputedStyle(el.closest('.dgui-root'));
    const theme = Object.fromEntries([['bg','--du-bg'],['ink','--du-ink'],['muted','--du-muted'],['accent','--du-accent'],['line','--du-line'],['soft','--du-soft']].map(([k, v]) => [k, css.getPropertyValue(v).trim()]));
    theme.visualStyle=el.closest('.dgui-root')?.dataset.visualStyle??'';
    theme.scheme = document.body.hasAttribute('data-ds-dark-theme') || el.closest('[data-preview-theme=dark]') ? 'dark' : 'light';
    el.contentWindow?.postMessage({ dshCanvas: 1, channel: config.channel, type: 'snapshot', payload: { ...canvasSnapshot(current.node, current.state, current.data, current.derived, current.disabled, theme), visible: visible.current && !document.hidden } }, '*');
  };
  useEffect(() => {
    if (preview || stopped) return;
    connected.current = false; loads.current = 0; visible.current = true; errorKind.current = ''; setMounted(false); setError('');
    let start = Date.now(), count = 0;
    const receive = event => {
      const m = event.data;
      if (event.source !== frame.current?.contentWindow || m?.dshCanvas !== 1 || m.channel !== config.channel) return;
      if (Date.now() - start > 1000) { start = Date.now(); count = 0; }
      if (++count > SANDBOX_LIMITS.rate) { errorKind.current = 'rate'; setError('Canvas messages are too frequent. Reset or stop the canvas.'); return; }
      if (m.type === 'ready') { connected.current = true; setError(''); publish(); setToken(t => t + 1); }
      else if (m.type === 'mounted' && connected.current) setMounted(true);
      else if (m.type === 'audit' && connected.current) latest.current.onAudit?.(node.id,m.payload?.issues,m.payload?.coverage);
      else if (m.type === 'height' && connected.current && Number.isFinite(m.payload) && m.payload >= 0) setHeight(Math.max(32, Math.min(SANDBOX_LIMITS.height, Math.ceil(m.payload))));
      else if (m.type === 'error') { errorKind.current = 'runtime'; setError(typeof m.payload === 'string' ? m.payload.slice(0, 1000) : 'Canvas runtime error'); }
      else if (m.type === 'patch' && connected.current && !latest.current.disabled) {
        try { latest.current.update(canvasPatch(m.payload, latest.current.node)); if (errorKind.current === 'patch') { errorKind.current = ''; setError(''); } } catch (e) { if (errorKind.current !== 'runtime') { errorKind.current = 'patch'; setError(e.message); } publish(); }
      }
    };
    window.addEventListener('message', receive);
    const timeout = setTimeout(() => { if (!connected.current) setError('The canvas did not start. Reset it or view the text description.'); }, 5000);
    const observer = new MutationObserver(publish); observer.observe(document.body, { attributes: true });
    const root = frame.current?.closest('.dgui-root'); if (root) observer.observe(root, { attributes: true });
    const intersection = new IntersectionObserver(entries => { visible.current = entries[0]?.isIntersecting ?? true; publish(); });
    if (frame.current) intersection.observe(frame.current);
    document.addEventListener('visibilitychange', publish);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)'); reduced.addEventListener('change', publish);
    return () => { connected.current = false; clearTimeout(timeout); window.removeEventListener('message', receive); document.removeEventListener('visibilitychange', publish); reduced.removeEventListener('change', publish); observer.disconnect(); intersection.disconnect(); };
  }, [config, preview, stopped]);
  useEffect(() => { publish(); }, [state, data, derived, disabled, config, token]);
  const inactive = preview || stopped;
  const restart = () => { setStopped(false); setGeneration(g => g + 1); };
  const download=()=>{try{const el=frame.current,css=getComputedStyle(el.closest('.dgui-root'));const theme=Object.fromEntries(['bg','ink','muted','accent','line','soft'].map(k=>[k,css.getPropertyValue('--du-'+k).trim()]));theme.visualStyle=el.closest('.dgui-root')?.dataset.visualStyle??'';theme.scheme=document.body.hasAttribute('data-ds-dark-theme')||el.closest('[data-preview-theme=dark]')?'dark':'light';const url=URL.createObjectURL(new Blob([standaloneCanvas(doc,node,state,theme)],{type:'text/html;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=(node.title.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,80)||'dsh-ui')+'.html';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e){setError('Export failed: '+e.message)}};
  return h('section', { className: 'dgui-canvas', 'data-ui-node': node.id, 'data-canvas-phase': inactive ? stopped ? 'stopped' : 'preview' : error ? 'error' : mounted ? 'ready' : 'loading', 'aria-label': node.title },
    !preview&&!showDetails&&h(ActionMenu,{label:`${node.title} actions`},
      h('button',{type:'button',disabled:disabled||!doc||stopped,onClick:download},'Export standalone HTML'),
      h('button',{type:'button',disabled:disabled,onClick:restart},stopped?'Resume interaction':'Reset canvas'),
      !stopped&&h('button',{type:'button',onClick:()=>setStopped(true)},'Stop canvas')),
    preview ? h(CanvasPreview,{node}) : inactive ? h('div', { className: 'dgui-canvas-placeholder', role: 'status' }, h('p', null, 'The canvas has been stopped.'), stopped && h('button', { type: 'button', className: 'dgui-secondary', onClick: restart }, 'Resume interaction')) : h('div', { className: 'dgui-canvas-stage', style: { minHeight: mounted || error ? undefined : Math.min(height, 420) } },
      !mounted && !error && h('div', { className: 'dgui-canvas-loading', role: 'status' }, h('span', { className: 'dgui-canvas-spinner', 'aria-hidden': true }), 'Preparing interaction…'),
      h('iframe', { key: config.channel, ref: frame, title: node.title, sandbox: 'allow-scripts', referrerPolicy: 'no-referrer', srcDoc, onLoad: () => { if (++loads.current > 1) { setStopped(true); setError('Canvas navigation detected; the canvas has been stopped.'); } }, style: { width: '100%', height, border: 0, display: 'block', visibility: mounted || error ? 'visible' : 'hidden' }, allow: "camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'" })),
    error && h('div', { className: 'dgui-canvas-issue', role: 'alert' }, h('strong', null, 'Interaction problem'), h('p', null, 'You can reload it; saved parameters will be kept.'), h('div', { className: 'dgui-recovery' }, h('button', { type: 'button', className: 'dgui-secondary', onClick: restart }, 'Reset canvas'), !stopped && h('button', { type: 'button', className: 'dgui-secondary', onClick: () => setStopped(true) }, 'Stop canvas')), h('details', null, h('summary', null, 'Error details'), h('pre', null, error))),
    error&&!showDetails&&h('p',{className:'dgui-error'},node.fallback),
    showDetails&&h('details', { className: 'dgui-canvas-options' }, h('summary', null, 'Description and actions'), h('p', { className: 'dgui-copy' }, node.fallback),
      !preview&&h('button',{type:'button',className:'dgui-secondary',disabled:disabled||!doc||stopped,onClick:download},'Export standalone HTML'),
      !preview && !error && !stopped && h('div', { className: 'dgui-recovery' }, h('button', { type: 'button', className: 'dgui-secondary', onClick: restart }, 'Reset canvas'), h('button', { type: 'button', className: 'dgui-secondary', onClick: () => setStopped(true) }, 'Stop canvas'))));
}
