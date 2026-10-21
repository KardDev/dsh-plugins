import {iso,depthOf,fitProjection,validateScene,sceneBounds,partGeometry,add,mul,dot} from './mechanism-geometry.js';
const TAU=Math.PI*2;
export function projectionFor(spec,options){validateScene(spec);const points=options&&!spec.bounds?spec.parts.filter(p=>!options.cutaway||!p.cover).flatMap(p=>partGeometry(p).points.map(v=>add(v,mul(p.explode??[0,0,0],options.explode??0)))):sceneBounds(spec);return fitProjection(points.length?points:[[0,0,0],[1,1,1]],600,340,{pad:24,azimuth:spec.azimuth??45,elevation:spec.elevation??30})}
const path=points=>points.map(([x,y],i)=>(i?'L':'M')+(Math.round(x*10)/10)+' '+(Math.round(y*10)/10)).join('')+'Z';
export function renderFaces(spec,projection,{explode=0,selected='all',cutaway=false,pose={}}={},cache=new Map()){
 if(typeof explode!=='number'||!Number.isFinite(explode)||explode<0||explode>1)throw Error('Motion mechanism: explode must be 0..1');
 if(typeof selected!=='string'||typeof cutaway!=='boolean')throw Error('Motion mechanism: selected must be text and cutaway boolean');
 if(!pose||typeof pose!=='object'||Array.isArray(pose))throw Error('Motion mechanism: pose must be an object');
 for(const id of Object.keys(pose))if(!spec.parts.some(p=>p.id===id))throw Error('Motion mechanism: unknown pose part '+id);
 const a=(projection.azimuth??45)*TAU/360,e=(projection.elevation??30)*TAU/360,view=[Math.cos(a)*Math.cos(e),Math.sin(a)*Math.cos(e),Math.sin(e)],faces=[];
 for(const part of spec.parts){
  if(cutaway&&part.cover)continue;const override=pose[part.id]??{};for(const k of Object.keys(override))if(!['at','rotation','from','to'].includes(k))throw Error('Motion mechanism: unsupported pose field '+k);
  const p={...part,...override},key=JSON.stringify(p);let geometry=cache.get(part.id);if(geometry?.key!==key){validateScene({parts:[p]});geometry={key,...partGeometry(p)};cache.set(part.id,geometry)}
  const offset=mul(p.explode??[0,0,0],explode),floor=Math.min(...geometry.points.map(v=>v[2]))+offset[2],active=selected==='all'||selected===part.id||selected===part.group;
  if(geometry.line){const points=geometry.line.map(v=>add(v,offset));faces.push({floor,key:p.id+'_line',part:p.id,group:p.group,d:points.map((v,i)=>(i?'L':'M')+iso(v,projection).join(' ')).join(''),depth:depthOf(points[Math.floor(points.length/2)],projection),line:true,tone:1,material:p.material??'metal',active});continue}
  for(const [index,face]of geometry.faces.entries()){
   const facing=dot(face.normal,view);if(facing<=.0001)continue;
   const points=face.points.map(v=>add(v,offset)),holes=face.holes?.map(h=>h.map(v=>add(v,offset))),center=mul(points.reduce((s,v)=>add(s,v),[0,0,0]),1/points.length),light=dot(face.normal,[-.25,-.4,.88]);
   faces.push({floor,key:p.id+'_'+index,part:p.id,group:p.group,d:path(points.map(v=>iso(v,projection)))+(holes??[]).map(h=>path(h.map(v=>iso(v,projection)))).join(''),depth:depthOf(center,projection),line:false,tone:light>.5?0:light>.1?1:light>-.4?2:3,material:p.material??'metal',active});
  }
 }
 if(faces.length>8192)throw Error('Motion mechanism: face budget exceeded');return faces.sort((a,b)=>a.floor-b.floor||a.depth-b.depth||a.key.localeCompare(b.key));
}
export function sceneSvg(spec,options={}){const projection=projectionFor(spec,options),faces=renderFaces(spec,projection,options).filter(f=>!options.preview||f.tone===0||f.line);const runs=[];for(const f of faces){const last=runs.at(-1);if(last&&last.material===f.material&&last.tone===f.tone&&last.line===f.line)last.d+=f.d;else runs.push({...f})}const shapes=runs.map(f=>'<path data-material="'+f.material+'" data-tone="'+f.tone+'" d="'+f.d+'" fill-rule="evenodd"'+(f.line?' data-line=""':'')+'/>').join('');return '<svg class="mui-mechanism-svg" viewBox="0 0 600 340" role="img" aria-label="'+(options.preview?'结构轮廓预览；完成后显示立体细节':'结构图解预览')+'">'+shapes+'</svg>'}
