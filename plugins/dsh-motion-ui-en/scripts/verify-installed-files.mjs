import assert from 'node:assert/strict';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { BUILD_INFO } from '../lib/build-info.js';
const profile=process.env.DSH_VERIFY_PROFILE??'web';assert.match(profile,/^[a-z0-9-]+$/);
const installed=`C:/Users/15403/.dsh/profiles/${profile}/node_modules/dsh-motion-ui`;
const pkg=JSON.parse(await readFile('package.json','utf8')),files=[];
async function collect(path){if((await stat(path)).isDirectory())for(const name of await readdir(path))await collect(path+'/'+name);else files.push(path)}
for(const path of ['package.json',...pkg.files])await collect(path);
const hashes=[];
for(const path of files){const ordered=v=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,ordered(v)])):v;const canonical=(p,b)=>p==='package.json'?JSON.stringify(ordered(JSON.parse(b.toString()))):b;const local=createHash('sha256').update(canonical(path,await readFile(path))).digest('hex'),actual=createHash('sha256').update(canonical(path,await readFile(installed+'/'+path))).digest('hex');assert.equal(actual,local,'installed mismatch: '+path);hashes.push({path,sha256:local})}
const report={profile,version:pkg.version,build:BUILD_INFO.id,matchedFiles:hashes.length,hashes};
await writeFile(profile==='web'?'test-output/installed-development-files.json':`test-output/installed-development-files-${profile}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({profile:report.profile,version:report.version,build:report.build,matchedFiles:report.matchedFiles}));
