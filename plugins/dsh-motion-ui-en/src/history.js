// State-only conversation extension: standard durable tool results remain the source of truth.
export const turnUiDefinition = {
  kind: 'dshGenerativeUi',
  match(event) {
    if (event.type === 'turn/start') return { id: String(event.data.turn), role: 'start' };
    if (event.type === 'turn/end') return { id: String(event.data.turn), role: 'update' };
    if (event.type === 'tool/result' && event.surfaceOp === 'append' && !event.data.message.isError && (event.data.meta?.dshGenerativeUi||event.data.meta?.dshGenerativeUiPatch))
      return { id: String(event.data.turn), role: 'update' };
    return null;
  },
  start(_context, match) { return { turn: match.event.data.turn, settled: false, records: [] }; },
  update(context, match) {
    const event = match.event;
    if (event.type === 'turn/end') {
      if (context.state.settled) return context.state;
      return { ...context.state, settled: true, records: context.state.records.map(r=>({...r,displayReady:true})) };
    }
    if (event.type !== 'tool/result') return context.state;
    const isPatch=!!event.data.meta.dshGenerativeUiPatch,raw = event.data.meta.dshGenerativeUi??event.data.meta.dshGenerativeUiPatch;
    if (context.state.records.some(r => r.raw.documentId === raw.documentId&&(r.raw.documentRevision??0)>=(raw.documentRevision??0))) return context.state;
    const fallback = (event.data.message.content ?? []).filter(c => c.type === 'text').map(c => c.text).join('\n');
    return { ...context.state, records: [...context.state.records, { seq: event.seq, raw, fallback,displayReady:context.state.settled===true,...(isPatch?{isPatch:true}:{}) }] };
  },
  buildLocationData(context, scope, previous) {
    if (scope !== 'turn' || !context.state) return null;
    if (previous?.key === 'dshGenerativeUi' && previous.value === context.state.records) return previous;
    return { kind: 'turn', turn: context.state.turn, key: 'dshGenerativeUi', value: context.state.records };
  }
};

