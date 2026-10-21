import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UiStore, stateRoute } from '../lib/store.js';
import { calculatorExample } from '../lib/catalog.js';
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-ui-test-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new UiStore(directory), record = await store.create(calculatorExample, { sessionId: 'original', callId: 'call1' });
  return { store, record, directory };
}
test('saved state survives a new store instance and is isolated by viewed session', async t => {
  const { store, record, directory } = await fixture(t);
  const current = await store.readState(record.documentId, 'original'); assert.equal(current.revision, 0);
  await store.saveState(record.documentId, 'original', 0, { ...current.state, bits: 8 });
  const restarted = new UiStore(directory); assert.equal((await restarted.readState(record.documentId, 'original')).state.bits, 8);
  assert.equal((await restarted.readState(record.documentId, 'fork')).state.bits, 4);
  assert.equal((await restarted.readDocument(record.documentId)).document.state.bits.default, 4);
});
test('concurrent writes with the same revision cannot silently overwrite one another', async t => {
  const { store, record } = await fixture(t), state = (await store.readState(record.documentId, 'original')).state;
  const result = await Promise.allSettled([store.saveState(record.documentId, 'original', 0, { ...state, bits: 8 }), store.saveState(record.documentId, 'original', 0, { ...state, bits: 6 })]);
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(result.find(r => r.status === 'rejected').reason.status, 409);
});
test('state API rejects traversal, missing documents, malformed requests and invalid inputs', async t => {
  const { store, record } = await fixture(t), route = stateRoute(store);
  const get = (id, sid = 'original') => route(new Request(`http://localhost/api/plugins/dsh-generative-ui/state?${new URLSearchParams({ documentId: id, sessionId: sid })}`));
  assert.equal((await get('../outside')).status, 400);
  assert.equal((await get('00000000-0000-4000-8000-000000000000')).status, 404);
  const post = body => route(new Request('http://localhost/api/plugins/dsh-generative-ui/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
  assert.equal((await post('{')).status, 400);
  assert.equal((await post({ documentId: record.documentId, sessionId: 'original', revision: 0, state: { parametersB: 27, bits: 99 } })).status, 400);
  const response = await get(record.documentId); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal((await response.json()).state.bits, 4);
});
