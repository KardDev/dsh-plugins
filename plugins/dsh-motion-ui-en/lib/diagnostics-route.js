import {stat} from 'node:fs/promises';
import {BUILD_INFO} from './build-info.js';
export function diagnosticsRoute(feedback){return async()=>{
 const assets=await Promise.all(['visual.js','visual.css','mermaid.js','echarts-core.js','echarts-full.js','three.js','standalone-runtime.js','katex.css'].map(async name=>{try{const s=await stat(new URL('./assets/'+name,import.meta.url));return {name,available:s.isFile()&&s.size>0,bytes:s.size}}catch{return {name,available:false}}}));
 return Response.json({build:BUILD_INFO,hostActive:true,feedbackHookRegistered:feedback.available,assets,assetRoute:'/api/plugins/dsh-generative-ui/assets/',permissions:'unchanged',checkedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
}}
