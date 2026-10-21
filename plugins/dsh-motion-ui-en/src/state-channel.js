const listeners=new Map();
const key=(id,sessionId)=>id+'\0'+sessionId;
export function subscribeState(id,sessionId,fn){const k=key(id,sessionId),set=listeners.get(k)??new Set();listeners.set(k,set);set.add(fn);return()=>{set.delete(fn);if(!set.size)listeners.delete(k)}}
export function broadcastState(id,sessionId,saved,origin){for(const fn of listeners.get(key(id,sessionId))??[])if(fn!==origin)fn(saved)}
