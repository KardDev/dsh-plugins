import test from 'node:test';import assert from 'node:assert/strict';
import {canvasDocument,FREE_UI_CONTRACT} from '../lib/freeform.js';
import {promptSections} from '../lib/ui-skill.js';
import { UI_INTENT_POLICY } from '../lib/ui-intent.js';
test('free entry carries model-authored source with the same state and resource validation',()=>{
 const args={title:'自由设计',fallback:'文字替代',html:'<svg/>',script:'const authored=true;',state:JSON.stringify({speed:{type:'number',default:1,min:1,max:3,step:1}})};
 const doc=canvasDocument(args);assert.equal(doc.nodes[0].script,args.script);assert.deepEqual(doc.nodes[0].stateKeys,['speed']);
 assert.throws(()=>canvasDocument({...args,state:'[]'}));assert.throws(()=>canvasDocument({...args,html:'x'.repeat(49153)}));assert.throws(()=>canvasDocument({...args,height:1001}));
});
test('free prompts remove design curriculum and examples, retaining the executable interface contract',()=>{
 const free=promptSections('free'),guided=promptSections('guided');assert.equal(free[0].text,UI_INTENT_POLICY+'\n\n'+FREE_UI_CONTRACT);assert.equal(free.slice(1).map(s=>s.text).join(''),'');
 assert.ok(free.reduce((n,s)=>n+s.text.length,0)<guided.reduce((n,s)=>n+s.text.length,0)/3);
 assert.match(free[0].text,/DSHUI.setState/);assert.match(free[0].text,/two rounds/);assert.throws(()=>promptSections('unrestricted-host'));
});
