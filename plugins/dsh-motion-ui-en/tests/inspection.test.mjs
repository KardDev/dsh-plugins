import test from 'node:test';import assert from 'node:assert/strict';
import {inspectRecord} from '../lib/inspection.js';
import {SKILL_EXAMPLES} from '../lib/ui-skill.js';
test('default inspections omit program source; exact selected nodes and full documents are explicit',()=>{
 const record={documentId:'id',documentRevision:2,document:SKILL_EXAMPLES[1]},summary=inspectRecord(record,{speed:2},{},[]);
 assert.equal(summary.document,undefined);assert.equal(summary.nodes[0].html,undefined);assert.ok(summary.nodes[0].sourceCharacters.html>0);
 const selected=inspectRecord(record,{speed:2},{},[],{detail:'nodes',nodeIds:['motion']});assert.equal(selected.nodes.length,1);assert.equal(selected.nodes[0].html,record.document.nodes[0].html);
 assert.equal(inspectRecord(record,{}, {},[],{detail:'full'}).document,record.document);
 assert.deepEqual(inspectRecord(record,{}, {},[],{detail:'nodes'}).nodes,record.document.nodes);
 assert.throws(()=>inspectRecord(record,{},{},[],{detail:'nodes',nodeIds:['absent']}));
 assert.equal(inspectRecord(record,{}, {large:'x'.repeat(9000)},[]).derived.omitted,true);
 assert.equal(inspectRecord(record,{}, {large:'x'.repeat(9000)},[],{detail:'full'}).derived.large.length,9000);
});
