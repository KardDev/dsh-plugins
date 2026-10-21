import { readFile, writeFile, readdir } from 'node:fs/promises';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
import { BUILD_INFO } from '../lib/build-info.js';
const root='test-output/model-matrix',models=[];
for(const slug of ['mimo-v2-5','ling-3-1-flash','step-5-preview-free']){
 const r=JSON.parse(await readFile(root+'/'+slug+'/results.json','utf8'));
 const observations=[];
 for(const c of r.cases.filter(c=>c.documentId))for(const name of await readdir(dshHomePath('plugins','dsh-generative-ui'))){
  if(name.startsWith(c.documentId+'-audit-')){
   const audit=JSON.parse(await readFile(dshHomePath('plugins','dsh-generative-ui',name),'utf8'));
   if(!observations.some(o=>o.file===name))observations.push({file:name,...audit});
  }
 }
 await writeFile(root+'/'+slug+'/observations.json',JSON.stringify(observations,null,2));
 models.push({model:r.model,slug,build:r.build.id,cwd:r.cwd,selection:r.selection,modelIdentityVerified:r.modelIdentityVerified,sessionId:r.sessionId,sessionTitle:r.sessionTitle,requestModels:r.requestModels,injection:r.injection,cases:r.cases,errors:r.errors,observations});
}
await writeFile(root+'/summary.json',JSON.stringify({build:BUILD_INFO.id,models},null,2));
console.log(JSON.stringify(models.map(r=>({model:r.model,identity:r.modelIdentityVerified,cwd:r.cwd,cases:r.cases.map(c=>({name:c.name,passed:c.passed,elapsedSeconds:Math.round(c.elapsedMs/1000),toolErrors:c.toolErrors?.length,failure:c.failure})),observationCount:r.observations.length})),null,2));
