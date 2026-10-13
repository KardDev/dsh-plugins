import {STYLE_SYSTEM} from '../lib/style-system.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {VISUAL_STYLES,visualStyle} from '../lib/visual-styles.js';
import {promptSections} from '../lib/ui-skill.js';
import {textDocument} from '../lib/text-document.js';
import {canvasDocument} from '../lib/freeform.js';
import {validateDocument} from '../lib/protocol.js';
test('all visual styles provide valid small native and canvas examples',()=>{
 assert.equal(new Set(VISUAL_STYLES.map(s=>s.id)).size,VISUAL_STYLES.length);
 for(const style of VISUAL_STYLES){assert.ok(style.preview.accent);for(const e of style.examples){assert.doesNotThrow(()=>validateDocument(e.tool==='render_text'?textDocument(e.args):canvasDocument(e.args)),style.id);}}
});
test('selected style changes only guided design guidance and examples',()=>{
 const base=promptSections();
 for(const style of VISUAL_STYLES){const sections=promptSections('guided',style.id);assert.equal(sections[1].text,base[1].text);assert.match(sections[0].text,new RegExp('用户选择的视觉风格：'+style.name));assert.ok(sections[2].text.includes(JSON.stringify(style.examples[0])));for(const other of VISUAL_STYLES.filter(s=>s.id!==style.id))assert.ok(!sections[2].text.includes(JSON.stringify(other.examples[0])));assert.deepEqual(promptSections('free',style.id),promptSections('free'));}
 assert.throws(()=>visualStyle('unknown'),/unknown visualStyle/);assert.equal(visualStyle().id,'prismframe');assert.equal(visualStyle('prismframe').name,'明亮扁平');assert.match(promptSections('guided','prismframe')[0].text,/禁止玻璃/);
});

test('style curriculum defines distinct composition, type, surface and control grammar',()=>{
 assert.deepEqual(Object.keys(STYLE_SYSTEM),VISUAL_STYLES.map(s=>s.id));const examples=new Set(),shapes=new Set();for(const style of VISUAL_STYLES){const g=STYLE_SYSTEM[style.id];for(const k of['composition','typography','surfaces','controls','avoid'])assert.ok(g[k].length>20,style.id+' '+k);examples.add(JSON.stringify(style.examples[0].args.blocks.map(n=>[n.type,n.children?.map(c=>c.type)])));shapes.add(JSON.stringify(g.native));assert.match(style.prompt,/不能只换强调色/);assert.match(style.prompt,/简单需求/)}assert.equal(examples.size,6);assert.equal(shapes.size,6);
});
