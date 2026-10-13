import {build} from 'esbuild';import{writeFile}from'node:fs/promises';
const bundle=await build({entryPoints:['src/mechanism-runtime.js'],bundle:true,write:false,minify:true,format:'iife',globalName:'__MotionMechanism',platform:'browser',target:'es2022',legalComments:'none'});
await writeFile('lib/mechanism-runtime-bundle.js','// Generated from Motion UI integration and Anatomy MIT projection helpers.\nexport const MECHANISM_RUNTIME='+JSON.stringify(bundle.outputFiles[0].text)+';\n');
