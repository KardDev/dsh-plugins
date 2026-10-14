import test from'node:test';import assert from'node:assert/strict';
import{previewCanvas}from'../lib/stream.js';import{UI_SKILL_SECTIONS,promptSections}from'../lib/ui-skill.js';
test('canvas prefixes decode escapes without completing source or exposing scripts',()=>{
  const source={title:'中文',fallback:'说明',css:'.x{color:red}',html:'<p>引号"、反斜线\\、换行\n\u263a</p>',script:'throw Error("must not run")'},raw=JSON.stringify(source);let count=0;
  for(let i=0;i<=raw.length;i++){const preview=previewCanvas(raw.slice(0,i));if(!preview)continue;count++;assert.ok(source.html.startsWith(preview.html));assert.equal(preview.css,source.css);assert.equal(preview.script,undefined)}
  assert.ok(count>10);assert.equal(previewCanvas('{"title":"x","fallback":"x","css":"","html":"abc\\u12')?.html,'abc');
  for(const raw of ['{"title":"x","fallback":"x","html":"partial','{"title":"x","fallback":"x","css":"","html":"bad\\q','{"title":"x","title":"y"}',' '.repeat(131073)])assert.equal(previewCanvas(raw),null);
});
test('compact canvas contract remains injected and free mode keeps autonomous composition',()=>{
  assert.match(UI_SKILL_SECTIONS[0].text,/Chinese characters/);assert.match(UI_SKILL_SECTIONS[1].text,/ui-edge/);assert.match(UI_SKILL_SECTIONS[0].text,/zero denominators/);assert.doesNotMatch(promptSections('free')[0].text,/Chinese characters|Construction handbook/);assert.match(promptSections('free')[0].text,/whole assistant turn ends/);
});
