import test from 'node:test';
import assert from 'node:assert/strict';
import {textDocument} from '../lib/text-document.js';
import {TEXT_PRESETS} from '../lib/typography.js';
import {fallbackText} from '../lib/protocol.js';
import {apply} from '../index.js';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('every text preset supports simple blocks, inline emphasis and collision-free IDs',()=>{
 for(const preset of TEXT_PRESETS){const doc=textDocument({preset,blocks:['说明',{id:'_text_0',type:'text',spans:[{text:'节省 '},{text:'55.8%',color:'success',size:24,weight:700}]},{type:'row',columns:2,gap:18,children:[{type:'text',text:'A'},{type:'text',text:'B',align:'right'}]}]});
 assert.equal(doc.presentation.preset,preset);assert.notEqual(doc.nodes[0].id,'_text_0');assert.match(fallbackText(doc),/节省 55.8%/);assert.match(doc.fallback,/节省 55.8%/);}
});
test('text fast path retains native validation and bounded input',()=>{
 for(const node of[{type:'text',text:'x',size:50},{type:'text',text:'x',color:'url(https://x)'},{type:'text',text:'x',style:{}},{type:'text',text:'x',spans:[{text:'y'}]},{type:'steps',items:{invalid:[]}}])assert.throws(()=>textDocument({blocks:[node]}),/DSH UI:/);
 const cyclic={type:'column',children:[]};cyclic.children.push(cyclic);assert.throws(()=>textDocument({blocks:[cyclic]}),/serializable JSON/);
 let nested={type:'text',text:'x'};for(let i=0;i<15;i++)nested={type:'column',children:[nested]};assert.throws(()=>textDocument({blocks:[nested]}),/depth/);
 assert.throws(()=>textDocument({blocks:Array(161).fill('x')}),/too many/);
 assert.throws(()=>textDocument({blocks:['x'.repeat(140000)]}),/size limit/);
});
test('links allow HTTP pages and native local files with exactly one destination',()=>{
 for(const target of[{href:'https://example.com/path?q=1'},{path:'C:\\资料\\报告.pdf'},{path:'./report.html'}])assert.doesNotThrow(()=>textDocument({blocks:[{type:'link',text:'打开',...target}]}));
 for(const target of[{href:'javascript:alert(1)'},{href:'data:text/html,x'},{href:'https://user:secret@example.com'},{href:'https://example.com/a b'},{path:'file:///C:/x'},{path:'\\\\server\\file'},{path:'https://example.com'},{href:'https://example.com',path:'a.pdf'},{}])assert.throws(()=>textDocument({blocks:[{type:'link',text:'打开',...target}]}),/DSH UI:/);
});
test('new typography transports normalize only exact typed values and array wrappers',()=>{
 const doc=textDocument({blocks:[{type:'row',columns:'2',gap:'12',children:[{type:'text',size:'18',weight:'700',spans:{item:{item:[{text:'重点',weight:'600',lineHeight:'1.5'}]}}},{type:'callout',text:'提示'}]},{type:'steps',title:'今天开工',items:[{title:'准备'}]}]});
 assert.equal(doc.nodes[0].columns,2);assert.equal(doc.nodes[0].children[0].size,18);assert.equal(doc.nodes[0].children[0].spans[0].weight,600);assert.match(fallbackText(doc),/今天开工/);
 assert.throws(()=>textDocument({blocks:[{type:'text',spans:{item:[],extra:true}}]}),/spans/);
});
test('multiple render_text calls persist independent documents under the same turn/session',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'motion-text-')),old=process.env.DSH_HOME;process.env.DSH_HOME=dir;
 t.after(async()=>{if(old===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=old;await rm(dir,{recursive:true,force:true})});
 const tools=[];apply({effect:f=>f(),tools:{register:x=>tools.push(x)},connection:{fetch:{register:()=>{}}},systemPrompt:{section:()=>{}}},{get:()=>({defaultPreset:'minimal'})});
 const tool=tools.find(x=>x.name==='render_text'),ctx={agent:{id:'same-session'},signal:new AbortController().signal};
 assert.equal(tool.parameters.properties.blocks.type,'array');
 assert.deepEqual(tool.parameters.properties.blocks.items,{});
 assert.ok(JSON.stringify(tool.parameters).length<1200,'lightweight transport must not expand every component union');
 const a=await tool.execute({blocks:[{id:'shared',type:'text',text:'A',color:'success'}]},{...ctx,callId:'a'});
 const b=await tool.execute({preset:'callout',blocks:[{id:'shared',type:'text',text:'B',color:'danger'}]},{...ctx,callId:'b'});
 assert.notEqual(a.documentId,b.documentId);assert.equal(a.document.presentation.preset,'reading');assert.equal(b.document.presentation.preset,'callout');assert.equal(a.document.nodes[0].text,'A');assert.equal(a.sessionId,b.sessionId);
 const legacy=await tool.execute({blocks:JSON.stringify(['字符串适配器仍可用'])},{...ctx,callId:'legacy'});assert.match(legacy.document.fallback,/字符串适配器仍可用/);
 await assert.rejects(()=>tool.execute({blocks:['内容'],weight:600},{...ctx,callId:'bad'}),/put all content\/styling inside blocks/);
});
