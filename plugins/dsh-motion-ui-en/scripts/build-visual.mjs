import {build} from 'esbuild';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
await mkdir('lib/assets',{recursive:true});
await mkdir('lib/third-party',{recursive:true});
await writeFile('lib/third-party/dsh-genui-LICENSE.txt',await readFile('vendor/dsh-genui/LICENSE'));
await writeFile('lib/third-party/dsh-genui-NOTICE.md',await readFile('vendor/dsh-genui/NOTICE.md'));
for(const name of ['echarts','mermaid','katex','three'])for(const f of ['LICENSE','NOTICE']){try{await writeFile(`lib/third-party/${name}-${f}.txt`,await readFile(`node_modules/${name}/${f}`))}catch(e){if(e.code!=='ENOENT')throw e}}
const base='vendor/dsh-genui/src/client';
const adapter={name:'motion-standalone-primitives',setup(b){b.onResolve({filter:/primitive-adapter\.ts$/},args=>({path:resolve(base,'standalone/primitive-adapter.tsx')}))}};
const common={bundle:true,write:false,metafile:true,minify:true,legalComments:'eof',target:'es2022',define:{'process.env.NODE_ENV':'"production"'},jsx:'automatic'};
const dependencies=new Set();
function track(result){for(const input of Object.keys(result.metafile.inputs)){const match=input.replaceAll('\\','/').match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//);if(match)dependencies.add(match[1])}return result}
const guard=await build({...common,entryPoints:['src/visual-guard-entry.ts'],format:'esm',platform:'neutral'});
track(guard);
await writeFile('lib/visual-guard.js',guard.outputFiles[0].text);
const core=await build({...common,entryPoints:['src/visual-core.ts'],outfile:'lib/assets/visual.js',format:'cjs',platform:'browser',external:['react','react/jsx-runtime'],plugins:[adapter]});
track(core);
for(const file of core.outputFiles)await writeFile(file.path,file.path.endsWith('.js')?`window.__MotionVisualFactory=(require)=>{var module={exports:{}};var exports=module.exports;${file.text}\nreturn module.exports;};`:file.contents);
// WOFF2-only math assets are local; no CDN or remote font dependency.
let css=await readFile('node_modules/katex/dist/katex.min.css','utf8');
css=css.replace(/src:([^;}]+)/g,(_m,s)=>'src:'+s.split(',').filter(x=>x.includes('.woff2')).map(x=>x.replace(/url\(([^)]+)\)/,(_u,p)=>`url(${p.replace('fonts/','katex-fonts/')})`)).join(','));
await writeFile('lib/assets/katex.css',css);
await mkdir('lib/assets/katex-fonts',{recursive:true});
const{readdir,copyFile}=await import('node:fs/promises');for(const f of await readdir('node_modules/katex/dist/fonts'))if(f.endsWith('.woff2'))await copyFile('node_modules/katex/dist/fonts/'+f,'lib/assets/katex-fonts/'+f);
for(const [name,entry] of [['mermaid','asset-mermaid.ts'],['three','asset-three.ts'],['echarts-core','asset-echarts-core.ts'],['echarts-full','asset-echarts.ts']]){
 const result=track(await build({...common,entryPoints:[base+'/'+entry],format:'iife',platform:'browser'}));await writeFile('lib/assets/'+name+'.js',result.outputFiles[0].contents);
}
// Standalone exports use the same engine assets and fonts as live surfaces.
const standalone=await build({...common,entryPoints:[base+'/standalone/runtime.tsx'],outfile:'lib/assets/standalone-runtime.js',format:'iife',platform:'browser',plugins:[adapter]});
track(standalone);
const standaloneCss=standalone.outputFiles.find(f=>f.path.endsWith('.css'))?.text??'';
const inlineMathCss=css.replace(/url\(([^)]+)\)/g,(_m,p)=>{const name=p.replace(/["']/g,'').split('/').at(-1);return`url(data:font/woff2;base64,${readFileSync('node_modules/katex/dist/fonts/'+name).toString('base64')})`});
for(const file of standalone.outputFiles)await writeFile(file.path,file.path.endsWith('.js')?`{const style=document.createElement('style');style.textContent=${JSON.stringify(standaloneCss+'\n'+inlineMathCss)};document.head.append(style);}\n`+file.text:file.contents);
// Preserve licenses of the actual bundled dependency graph, including engines'
// transitive packages and the self-contained export runtime.
await mkdir('lib/third-party/bundled',{recursive:true});
for(const directory of [...dependencies].sort()){
 const pkg=JSON.parse(await readFile(directory+'/package.json','utf8'));
 for(const f of await readdir(directory))if(/^(?:licen[sc]e|notice)(?:[.-].*)?$/i.test(f)){
  try{await writeFile('lib/third-party/bundled/'+pkg.name.replaceAll('/','_')+'-'+f,await readFile(directory+'/'+f))}catch(e){if(e.code!=='EISDIR')throw e}
 }
}
