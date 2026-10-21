import { mkdir, readFile, writeFile, rename, unlink, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { validateDocument, validateState, initialState } from './protocol.js';
import { refineDocument, validateAudit } from './refinement.js';
import {updateDocument} from './document-update.js';
export class UiStoreError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const idPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export class UiStore {
  constructor(directory) { this.directory = directory; this.locks = new Map(); }
  documentPath(id) { if (!idPattern.test(id)) throw new UiStoreError(400, 'Invalid UI document ID'); return join(this.directory, `${id}.json`); }
  statePath(id, sessionId) {
    this.documentPath(id);
    if (typeof sessionId !== 'string' || !sessionId.trim() || sessionId.length > 256) throw new UiStoreError(400, 'Invalid session ID');
    const hash = createHash('sha256').update(id + '\0' + sessionId).digest('hex');
    return join(this.directory, `state-${hash}.json`);
  }
  async atomic(path, value) {
    await mkdir(dirname(path), { recursive: true }); const temp = `${path}.${randomUUID()}.tmp`;
    try { await writeFile(temp, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 }); await rename(temp, path); }
    finally { await unlink(temp).catch(e => { if (e.code !== 'ENOENT') throw e; }); }
  }
  async create(document, context) {
    const record = { version: 1, documentRevision: 0, documentId: context.documentId??randomUUID(), sessionId: context.sessionId, callId: context.callId, document: validateDocument(document), createdAt:new Date().toISOString() };
    await this.atomic(this.documentPath(record.documentId), record); return record;
  }
  async readDocument(id) {
    try {
      const record = JSON.parse(await readFile(this.documentPath(id), 'utf8'));
      if (record.version !== 1 || record.documentId !== id || (record.documentRevision!==undefined&&(!Number.isSafeInteger(record.documentRevision)||record.documentRevision<0))) throw new Error('Invalid saved UI record');
      record.document = validateDocument(record.document); return record;
    } catch (e) { if (e.code === 'ENOENT') throw new UiStoreError(404, 'UI document is no longer stored'); throw e; }
  }
  async readState(id, sessionId) {
    const path = this.statePath(id, sessionId), record = await this.readDocument(id);
    try {
      const saved = JSON.parse(await readFile(path, 'utf8'));
      if (saved.version !== 1 || !Number.isSafeInteger(saved.revision) || saved.revision < 1) throw new Error('Invalid saved UI state');
      const defaults=initialState(record.document),migrated=Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,Object.hasOwn(saved.state,k)?saved.state[k]:v]));
      return { version: 1, revision: saved.revision, state: validateState(record.document, migrated) };
    } catch (e) { if (e.code !== 'ENOENT') throw e; return { version: 1, revision: 0, state: initialState(record.document) }; }
  }
  async owned(id,sessionId){const record=await this.readDocument(id);if(record.sessionId!==sessionId)throw new UiStoreError(403,'UI belongs to another conversation');return record;}
  // Session-scoped listing for surfaces that must survive a host restart: the
  // client registry is in-memory only, so the sidebar rehydrates from here.
  async listSession(sessionId){
    if(typeof sessionId!=='string'||!sessionId)throw new UiStoreError(400,'Invalid session');
    let names=[];
    try{names=await readdir(this.directory)}catch(e){if(e.code!=='ENOENT')throw e}
    const items=[];
    for(const name of names){
      if(!name.endsWith('.json')||name.includes('-audit-')||name.startsWith('state-'))continue;
      try{
        const record=JSON.parse(await readFile(join(this.directory,name),'utf8'));
        if(!record||record.sessionId!==sessionId||!record.document)continue;
        items.push({
          version: record.version ?? 1,
          documentId: record.documentId,
          documentRevision: record.documentRevision ?? 0,
          callId: typeof record.callId === 'string' ? record.callId : `stored-${record.documentId}`,
          document: record.document
        });
      }catch{}
    }
    return items;
  }
  historyPath(id, revision) {
    this.documentPath(id);
    if (!Number.isSafeInteger(revision) || revision < 0) throw new UiStoreError(400, 'Invalid history revision');
    return join(this.directory, 'history', id, `${revision}.json`);
  }
  async archive(record) {
    const path = this.historyPath(record.documentId, record.documentRevision ?? 0);
    await mkdir(dirname(path), { recursive: true });
    // The current head is itself the newest version. Archive it before replacing
    // the head, so a failed write cannot create a fictitious future revision.
    const temp = `${path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temp, JSON.stringify(record), { encoding: 'utf8', mode: 0o600 });
      const { link } = await import('node:fs/promises');
      try { await link(temp, path); } catch (e) {
        if (e.code !== 'EEXIST') throw e;
        if (await readFile(path, 'utf8') !== JSON.stringify(record)) throw new UiStoreError(500, 'History record differs from saved version');
      }
    } finally { await unlink(temp).catch(e => { if (e.code !== 'ENOENT') throw e; }); }
  }
  async history(id, sessionId) {
    const head = await this.owned(id, sessionId), revision = head.documentRevision ?? 0;
    let names = []; try { names = await readdir(dirname(this.historyPath(id, 0))); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    const revisions = names.filter(n => /^(0|[1-9]\d*)\.json$/.test(n)).map(n => Number(n.slice(0, -5))).filter(n => n < revision);
    const records = await Promise.all(revisions.sort((a,b) => b-a).slice(0,199).map(n => this.readVersion(id,sessionId,n,head)));
    return { documentId:id, documentRevision:revision, truncated:revisions.length>199, versions:[head,...records].map(r=>({revision:r.documentRevision??0,title:r.document.title,createdAt:r.createdAt??null,restoredFrom:r.restoredFrom??null})) };
  }
  async readVersion(id, sessionId, revision, knownHead) {
    const head = knownHead ?? await this.owned(id, sessionId);
    this.historyPath(id, revision);
    if (revision === (head.documentRevision ?? 0)) return head;
    if (revision > (head.documentRevision ?? 0)) throw new UiStoreError(404, 'History version not found');
    try {
      const record = JSON.parse(await readFile(this.historyPath(id, revision), 'utf8'));
      if (record.documentId !== id || record.sessionId !== sessionId || record.version !== 1 || (record.documentRevision??0) !== revision) throw new Error('Invalid history record');
      record.document = validateDocument(record.document); return record;
    } catch (e) { if (e.code === 'ENOENT') throw new UiStoreError(404, 'History version not found'); throw e; }
  }
  async restore(id,sessionId,revision,targetRevision) {
    const path=this.documentPath(id),previous=this.locks.get(path)??Promise.resolve();
    const pending=previous.catch(()=>{}).then(async()=>{
      const record=await this.owned(id,sessionId);
      if (!Number.isSafeInteger(revision) || revision !== (record.documentRevision??0)) throw new UiStoreError(409,'Document changed; reload history before restoring');
      const target=await this.readVersion(id,sessionId,targetRevision,record);
      if (JSON.stringify(target.document.state)!==JSON.stringify(record.document.state)) throw new UiStoreError(400,'This version has incompatible input definitions');
      const saved=await this.readState(id,sessionId);validateState(target.document,saved.state);
      const next={...record,documentRevision:revision+1,document:target.document,restoredFrom:targetRevision,createdAt:new Date().toISOString()};
      await this.archive(record);await this.atomic(path,next);return next;
    });
    this.locks.set(path,pending);try{return await pending}finally{if(this.locks.get(path)===pending)this.locks.delete(path)}
  }
  async refine(id,sessionId,revision,changes){
    const path=this.documentPath(id),previous=this.locks.get(path)??Promise.resolve();
    const pending=previous.catch(()=>{}).then(async()=>{const record=await this.owned(id,sessionId);if(!Number.isSafeInteger(revision)||revision<0)throw new UiStoreError(400,'Invalid document revision');if((record.documentRevision??0)!==revision)throw new UiStoreError(409,'Document changed; inspect_ui before retrying');const next={...record,documentRevision:revision+1,document:refineDocument(record.document,changes),createdAt:new Date().toISOString()};delete next.restoredFrom;await this.archive(record);await this.atomic(path,next);return next;});
    this.locks.set(path,pending);try{return await pending}finally{if(this.locks.get(path)===pending)this.locks.delete(path)}
  }
  async update(id,sessionId,revision,operationId,operation){
    if(typeof operationId!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(operationId))throw new UiStoreError(400,'operationId requires 1..64 letters, digits, underscores or hyphens');
    const path=this.documentPath(id),previous=this.locks.get(path)??Promise.resolve();
    const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
    const hash=createHash('sha256').update(JSON.stringify(canonical(operation))).digest('hex');
    const pending=previous.catch(()=>{}).then(async()=>{
      const record=await this.owned(id,sessionId),replayed=record.operations?.find(x=>x.id===operationId);
      if(replayed){if(replayed.hash!==hash)throw new UiStoreError(409,'operationId already used for different content');return record}
      if(!Number.isSafeInteger(revision)||revision!==(record.documentRevision??0))throw new UiStoreError(409,'Document changed; inspect_ui before updating');
      const document=updateDocument(record.document,operation),next={...record,document,documentRevision:revision+1,createdAt:new Date().toISOString(),operations:[...(record.operations??[]),{id:operationId,hash}].slice(-64)};
      delete next.restoredFrom;await this.archive(record);await this.atomic(path,next);return next;
    });this.locks.set(path,pending);try{return await pending}finally{if(this.locks.get(path)===pending)this.locks.delete(path)}
  }
  async saveAudit(id,sessionId,revision,value){
    const record=await this.owned(id,sessionId);if((record.documentRevision??0)!==revision)throw new UiStoreError(409,'Audit is for an old document revision');
    const report={...validateAudit(value),documentRevision:revision,observedAt:new Date().toISOString()};
    // One file per viewport/theme avoids lost updates from simultaneous visual checks.
    const bucket=report.width<600?'mobile':report.width<1000?'tablet':'desktop';await this.atomic(join(this.directory,`${id}-audit-${bucket}-${report.theme}.json`),report);return report;
  }
  async audits(id){
    const {readdir}=await import('node:fs/promises');const record=await this.readDocument(id),names=(await readdir(this.directory)).filter(n=>n.startsWith(id+'-audit-')&&n.endsWith('.json'));
    const reports=await Promise.all(names.slice(-24).map(async n=>JSON.parse(await readFile(join(this.directory,n),'utf8'))));
    return reports.filter(r=>r.documentRevision===(record.documentRevision??0)).sort((a,b)=>b.observedAt.localeCompare(a.observedAt)).slice(0,6);
  }
  async saveState(id, sessionId, revision, state) {
    const path = this.statePath(id, sessionId), previous = this.locks.get(path) ?? Promise.resolve();
    const pending = previous.catch(() => {}).then(async () => {
      if (!Number.isSafeInteger(revision) || revision < 0) throw new UiStoreError(400, 'Invalid state revision');
      const record = await this.readDocument(id), checked = validateState(record.document, state);
      const current = await this.readState(id, sessionId);
      if (current.revision !== revision) throw new UiStoreError(409, 'State changed in another view. Reload before saving.');
      const next = { version: 1, revision: revision + 1, state: checked }; await this.atomic(path, next); return next;
    });
    this.locks.set(path, pending);
    try { return await pending; } finally { if (this.locks.get(path) === pending) this.locks.delete(path); }
  }
}
export function historyRoute(store) {
  return async request => {
    try {
      const url=new URL(request.url),id=url.searchParams.get('documentId'),sessionId=url.searchParams.get('sessionId');
      let value;
      if(request.method==='GET') value=url.searchParams.has('revision')?await store.readVersion(id,sessionId,Number(url.searchParams.get('revision'))):await store.history(id,sessionId);
      else {
        if(request.method!=='POST')throw new UiStoreError(405,'Method not allowed');
        if(!request.headers.get('content-type')?.startsWith('application/json'))throw new UiStoreError(415,'JSON body required');
        const text=await request.text();if(Buffer.byteLength(text)>1024)throw new UiStoreError(413,'History request too large');
        let input;try{input=JSON.parse(text)}catch{throw new UiStoreError(400,'Invalid JSON body')}
        if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['documentRevision','targetRevision'].includes(k)))throw new UiStoreError(400,'Invalid restore body');
        value=await store.restore(id,sessionId,input.documentRevision,input.targetRevision);
      }
      return Response.json(value,{headers:{'Cache-Control':'no-store'}});
    } catch(e) {const status=e.status??500;return Response.json({error:status===500?'Could not access UI history':e.message},{status,headers:{'Cache-Control':'no-store'}});}
  };
}
export function documentRoute(store){
  return async request=>{
    try{
      const url=new URL(request.url),id=url.searchParams.get('documentId'),sessionId=url.searchParams.get('sessionId');
      if(request.method==='GET')return Response.json(await store.owned(id,sessionId),{headers:{'Cache-Control':'no-store'}});
      if(request.method!=='POST')throw new UiStoreError(405,'Method not allowed');
      if(!request.headers.get('content-type')?.startsWith('application/json'))throw new UiStoreError(415,'JSON body required');
      const text=await request.text();if(Buffer.byteLength(text)>16384)throw new UiStoreError(413,'Audit too large');
      let input;try{input=JSON.parse(text)}catch{throw new UiStoreError(400,'Invalid JSON body')}
      if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['documentRevision','report'].includes(k)))throw new UiStoreError(400,'Invalid audit body');
      return Response.json(await store.saveAudit(id,sessionId,input.documentRevision,input.report),{headers:{'Cache-Control':'no-store'}});
    }catch(e){const status=e.status??(e.message?.startsWith('DSH UI:')?400:500);return Response.json({error:status===500?'Could not access document':e.message},{status});}
  };
}
export function stateRoute(store) {
  return async request => {
    const response = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
    try {
      if (request.method === 'GET') {
        const url = new URL(request.url);
        return response(await store.readState(url.searchParams.get('documentId'), url.searchParams.get('sessionId')));
      }
      if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405);
      if (!request.headers.get('content-type')?.startsWith('application/json')) return response({ error: 'JSON body required' }, 415);
      const raw = await request.text();
      if (new TextEncoder().encode(raw).length > 65536) return response({ error: 'State body too large' }, 413);
      let input; try { input = JSON.parse(raw); } catch { return response({ error: 'Invalid JSON body' }, 400); }
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !['documentId', 'sessionId', 'revision', 'state'].includes(k))) return response({ error: 'Invalid state request' }, 400);
      return response(await store.saveState(input.documentId, input.sessionId, input.revision, input.state));
    } catch (e) {
      const status = e.status ?? (e.message?.startsWith('DSH UI:') ? 400 : 500);
      return response({ error: status === 500 ? 'Could not access saved UI state' : e.message }, status);
    }
  };
}
