import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadMotionDesignSkill} from '../lib/motion-design-skill.js';
import {apply} from '../index.js';

test('full pinned design skill is byte-identical, licensed and adapted separately',async()=>{
 const skill=await loadMotionDesignSkill(),raw=await readFile(new URL('../skills/motion-design/SKILL.md',import.meta.url));
 assert.equal(skill.original,raw.toString('utf8'));
 assert.equal(createHash('sha256').update(raw).digest('hex'),skill.provenance.sha256);
 assert.equal(skill.complete,true);assert.equal(skill.modified,false);
 for(const section of ['Art direction before adding movement','Choreograph attention','Choose a visual grammar','Author reliable editable motion','Plan and produce sound for video','Video production and dual delivery','Quality while composing'])assert.ok(skill.original.includes(section),section);
 assert.match(await readFile(new URL('../skills/motion-design/LICENSE',import.meta.url),'utf8'),/Copyright 2026 Open Design contributors/);
 assert.match(skill.adapter,/DSHUI\.timeline/);assert.match(skill.adapter,/do not cap model reasoning/);
 assert.match(skill.original,/\$OD_BIN/); // Original host-specific content is retained, not silently shortened.
});

test('Host exposes the full skill on demand in both modes and keeps it out of ordinary prompts/catalogs',async()=>{
 for(const mode of ['guided','free']){
  const tools=[],sections=[];apply({effect:f=>f(),tools:{register:t=>tools.push(t)},connection:{fetch:{register:()=>{}}},systemPrompt:{section:s=>sections.push(s)}},{get:()=>({designMode:mode,visualStyle:'prismframe'})});
  const catalog=tools.find(t=>t.name==='ui_catalog'),skill=await catalog.execute({topic:'motion',scene:'motion-design'});
  assert.equal(skill.designSkill.complete,true);
  const full=skill.designSkill.original,prompts=sections.map(s=>s.text()).join('\n');assert.ok(!prompts.includes(full));assert.ok(!prompts.includes('# Motion Design\n'));
  assert.ok(!(JSON.stringify(await catalog.execute({topic:'overview'}))).includes(full));
  const overview=await catalog.execute({topic:'motion'});assert.equal(overview.designReferences[0].id,'motion-design');assert.ok(!JSON.stringify(overview).includes(full));
  const promo=await catalog.execute({topic:'video',scene:'promo'});assert.equal(promo.designSkill.original,full);assert.equal(promo.designSkill.provenance.sha256,skill.designSkill.provenance.sha256);
 }
});
