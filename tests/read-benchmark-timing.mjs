import assert from 'node:assert/strict';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {zstdDecompressSync} from 'node:zlib';
import {dshHomePath} from '@deepseek-ai/dsh-home-paths';
const id=process.env.DSH_BENCH_SESSION;assert.ok(/^session-[a-f0-9-]+$/.test(id));
const cache=JSON.parse(await readFile(dshHomePath('storages','session_projcache','sessions',id+'.json'),'utf8'));
assert.equal(cache.record.identity.cwd,'J:\\测试结果');
let rows=[];
for(const dir of await readdir(dshHomePath('sessions'),{withFileTypes:true})){
 if(!dir.isDirectory())continue;let bytes;try{bytes=await readFile(join(dshHomePath('sessions'),dir.name,id,'session.v4.jsonl.zstd'))}catch{continue}
 while(bytes.length){const r=zstdDecompressSync(bytes,{info:true});rows.push(...r.buffer.toString().trim().split('\n').filter(Boolean).map(JSON.parse));bytes=bytes.subarray(r.engine.bytesWritten)}break;
}
const headers=rows.filter(r=>r.type==='request/header'),start=headers[0]?.time;
const report={sessionId:id,observedAt:new Date().toISOString(),sinceFirstRequestMs:start===undefined?null:Date.now()-start,requestModels:headers.map(r=>({provider:r.data.header.config.provider,model:r.data.header.config.model,reasoningEffort:r.data.header.config.reasoningEffort,maxTokens:r.data.header.config.maxTokens})),
 events:rows.filter(r=>['tool/call','tool/result','turn/end'].includes(r.type)||/retry/.test(r.type)).map(r=>({type:r.type,afterMs:r.time-start,...(r.type==='tool/call'?{name:r.data.name}:{}),...(r.type==='tool/result'?{error:!!r.data.message?.isError}: {}),...(r.type==='turn/end'?{reason:r.data.reason?.kind}: {})})),
 reasoningCharacters:rows.filter(r=>r.type==='assistant/message').flatMap(r=>r.data.message?.content??[]).filter(b=>/think|reason/.test(b.type)).reduce((n,b)=>n+(b.text?.length??0),0)};
if(process.env.DSH_BENCH_TIMING_OUTPUT)await writeFile(process.env.DSH_BENCH_TIMING_OUTPUT,JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
