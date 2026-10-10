import { useEffect, useRef, useState } from 'react';
import { initialState, validateState } from '../lib/protocol.js';
import { subscribeState, broadcastState } from './state-channel.js';
export const STATE_URL = '/api/plugins/dsh-generative-ui/state';
async function request(url, options) {
  const response = await fetch(url, { credentials: 'same-origin', ...options });
  const value = await response.json();
  if (!response.ok) { const e = new Error(value.error ?? `HTTP ${response.status}`); e.status = response.status; throw e; }
  return value;
}
export function useSavedState(record, sessionId, preview = false) {
  const doc = record.document;
  const schemaKey=JSON.stringify(doc.state);
  const [state, setState] = useState(() => initialState(doc));
  const [ready, setReady] = useState(false), [status, setStatus] = useState('正在恢复参数…');
  const [issue, setIssue] = useState(null), [epoch, setEpoch] = useState(0), [tick, wake] = useState(0);
  const refs = useRef({ revision: 0, saved: '', saving: false, blocked: true, alive: true, generation: 0, loading: false });
  const liveState=useRef(state);liveState.current=state;
  const receive=useRef(null);
  useEffect(()=>{
    if(preview)return;
    const adopt=saved=>{
      const r=refs.current;if(!r.alive||r.blocked||r.loading||saved.revision<=r.revision)return;
      if(r.saving||JSON.stringify(liveState.current)!==r.saved){r.blocked=true;setIssue({kind:'conflict'});setStatus('保存冲突：另一页面已修改参数；本页参数仍保留。');return;}
      try{const next=checked(saved);r.revision=next.revision;r.saved=JSON.stringify(next.state);liveState.current=next.state;setState(next.state);setStatus('已同步另一视图的参数');}catch{r.blocked=true;setIssue({kind:'load'});setStatus('参数读取失败；本页参数仍保留，请重试。')}
    };
    receive.current=adopt;return subscribeState(record.documentId,sessionId,adopt);
  },[record.documentId,sessionId,schemaKey,preview]);
  const checked = saved => {
    if (!Number.isSafeInteger(saved.revision) || saved.revision < 0) throw new Error('Invalid saved state revision');
    return { revision: saved.revision, state: validateState(doc, saved.state) };
  };
  async function load(keepLocal = false) {
    const r = refs.current;
    if (r.loading || r.saving) return;
    r.loading = true; r.blocked = true; const generation = ++r.generation;
    setReady(false); setStatus('正在恢复参数…');
    try {
      const saved = checked(await request(`${STATE_URL}?${new URLSearchParams({ documentId: record.documentId, sessionId })}`));
      if (!r.alive || generation !== r.generation) return;
      r.revision = saved.revision; r.saved = JSON.stringify(saved.state); r.blocked = false;
      if (!keepLocal) { setState(saved.state); setEpoch(n => n + 1); }
      setIssue(null); setStatus(keepLocal ? '已读取最新版本，准备保存本页参数…' : saved.revision ? '已恢复保存的参数' : '使用初始参数');
      setReady(true); wake(n => n + 1);
    } catch (e) {
      if (!r.alive || generation !== r.generation) return;
      setIssue({ kind: keepLocal ? 'conflict' : 'load', message: e.message });
      setStatus('参数读取失败；本页参数仍保留，请重试。');
    } finally { if (generation === r.generation) r.loading = false; }
  }
  useEffect(() => {
    if (preview) return;
    const r = refs.current; r.alive = true; r.loading = false; load();
    return () => { r.alive = false; r.generation++; r.loading = false; };
  }, [record.documentId, sessionId, schemaKey, preview]);
  useEffect(() => {
    const r = refs.current, signature = JSON.stringify(state);
    if (!ready || r.blocked || r.saving) return;
    if (signature === r.saved) {
      setStatus(previous => /等待保存|准备保存/.test(previous) ? '参数已保存' : previous); return;
    }
    setStatus('参数已修改，等待保存…');
    const timer = setTimeout(async () => {
      r.saving = true; if (r.alive) setStatus('正在保存参数…');
      const revision = r.revision;
      try {
        const saved = checked(await request(STATE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId: record.documentId, sessionId, revision, state }) }));
        if (saved.revision !== revision + 1 || JSON.stringify(saved.state) !== signature) throw new Error('Unexpected save response');
        r.revision = saved.revision; r.saved = signature;
        broadcastState(record.documentId,sessionId,saved,receive.current);
        if (r.alive) { setIssue(null); setStatus('参数已保存'); }
      } catch (e) {
        r.blocked = true;
        if (r.alive) {
          setIssue({ kind: e.status === 409 ? 'conflict' : 'save', message: e.message });
          setStatus(e.status === 409 ? '保存冲突：另一页面已修改参数；本页参数仍保留。' : '保存失败：本页参数尚未保存，可重试。');
        }
      } finally { r.saving = false; if (r.alive) wake(n => n + 1); }
    }, 350);
    return () => clearTimeout(timer);
  }, [state, ready, tick, record.documentId, sessionId]);
  function retry() {
    const r = refs.current;
    if (r.loading || r.saving) return;
    if (issue?.kind === 'load') { load(); return; }
    if (issue?.kind === 'conflict') return;
    r.blocked = false; setIssue(null); setStatus('参数已修改，等待保存…'); wake(n => n + 1);
  }
  return { state: preview ? initialState(doc) : state, setState, ready: !preview && ready, status: preview ? '生成预览 · 完成校验后可操作' : status, issue, epoch, retry, useRemote: () => load(), keepLocal: () => load(true) };
}


