import test from 'node:test';
import assert from 'node:assert/strict';
import {MOTION_RECIPES,motionCatalog,MOTION_GUIDE} from '../lib/motion-library.js';
import {evaluate,validateDocument} from '../lib/protocol.js';
import {promptSections} from '../lib/ui-skill.js';
import {VISUAL_STYLES,DEFAULT_VISUAL_STYLE} from '../lib/visual-styles.js';
import {NATIVE_STYLE_CSS} from '../src/native-style.js';
test('motion recipes validate, remain targeted, and compute exact local values',()=>{
 const list=motionCatalog();assert.equal(list.recipes.length,7);assert.ok(!JSON.stringify(list).includes('nodes'));
 for(const r of MOTION_RECIPES)assert.doesNotThrow(()=>motionCatalog(r.id));
 const plan=motionCatalog('plan').document;assert.equal(evaluate(plan,{months:12,seats:8}).derived.total,2784);
 assert.equal(evaluate(motionCatalog('checklist').document,{readme:true,test:false,license:true}).derived.done,2);
 assert.throws(()=>motionCatalog('unknown'),/Unknown motion recipe/);
 const bad=structuredClone(plan);bad.nodes[0].variant='primary';assert.throws(()=>validateDocument(bad),/variant/);
});
test('aurora is guided-only and preserves the existing default',()=>{
 assert.equal(DEFAULT_VISUAL_STYLE,'prismframe');const style=VISUAL_STYLES.find(s=>s.id==='aurora');assert.equal(style.name,'柔光渐彩');
 assert.ok(promptSections('guided','aurora')[0].text.includes(MOTION_GUIDE));assert.match(promptSections('guided','aurora')[0].text,/柔光渐彩/);
 assert.deepEqual(promptSections('free','aurora'),promptSections('free','prismframe'));
 assert.doesNotMatch(NATIVE_STYLE_CSS,/backdrop-filter\s*:/);assert.match(NATIVE_STYLE_CSS,/data-visual-style=aurora/);
});
