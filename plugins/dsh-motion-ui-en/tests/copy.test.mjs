import test from 'node:test';
import assert from 'node:assert/strict';
import {textDocument} from '../lib/text-document.js';
import {fallbackText} from '../lib/protocol.js';
import {validateVisual} from '../lib/visual.js';
test('reusable content preserves literal source and rejects invalid copy options',()=>{
 const code='\tconst x = `<img src=x onerror=alert(1)>`;\n  // 中文\n';
 const blocks=[{type:'text',title:'文案',copyable:true,spans:[{text:'你好'},{text:'世界',weight:700}]},{type:'code',lang:'js',code,wrap:true}];
 const before=structuredClone(blocks),doc=textDocument({blocks});
 assert.deepEqual(blocks,before);assert.equal(doc.nodes[1].code,code);assert.ok(fallbackText(doc).includes(code));
 for(const block of [{type:'text',text:'x',copyable:1},{type:'code',code:'x',wrap:3},{type:'code',code:'x'.repeat(50000)}])assert.throws(()=>textDocument({blocks:[block]}),/DSH UI:/);
});
test('extended text and code retain copy fields without partial repair',()=>{
 const items=[{type:'text',content:'正文',title:'文案',copyable:true},{type:'code',lang:'css',code:'a { color: red; }',title:'样式',wrap:true}];
 const result=validateVisual({items});assert.deepEqual(result.warnings,[]);assert.equal(result.spec.items[0].copyable,true);assert.equal(result.spec.items[1].title,'样式');assert.equal(result.spec.items[1].wrap,true);
});
