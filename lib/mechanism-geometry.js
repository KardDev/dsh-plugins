// Pure explanatory geometry and kinematics. Projection/contours use Anatomy (MIT).
import {iso,depthOf,fitProjection,roundedPlan,circleRing} from './third-party/anatomy-iso.mjs';
export {iso,depthOf,fitProjection};
export const MECHANISM_LIMITS=Object.freeze({parts:96,teeth:64,faces:8192});
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const fail=s=>{throw Error('Motion mechanism: '+s)};
const num=(v,label,min=-10000,max=10000)=>{if(!finite(v)||v<min||v>max)fail(label+' must be a finite number in '+min+'..'+max);return v};
const vector=(v,label)=>{if(!Array.isArray(v)||v.length!==3)fail(label+' must be [x,y,z]');return v.map((x,i)=>num(x,label+'['+i+']'))};
const id=v=>typeof v==='string'&&/^[\p{L}_][\p{L}\p{M}\p{N}_]{0,63}$/u.test(v)&&!['constructor','prototype','__proto__'].includes(v);
const kinds=['box','cylinder','gear','rod','spring'];
export const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,t)=>a.map(v=>v*t),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const len=Math.hypot(...a);if(len<1e-6)fail('zero-length axis');return mul(a,1/len)};
export function validateScene(spec){
 if(!spec||typeof spec!=='object'||Array.isArray(spec))fail('scene must be an object');
 if(!Array.isArray(spec.parts)||!spec.parts.length||spec.parts.length>MECHANISM_LIMITS.parts)fail('parts requires 1..96 objects');
 const seen=new Set(),groups=new Set();
 for(const [i,p]of spec.parts.entries()){
  const at='parts['+i+']';if(!p||typeof p!=='object'||!id(p.id)||seen.has(p.id))fail(at+'.id must be a unique identifier');seen.add(p.id);
  if(!kinds.includes(p.type))fail(at+'.type must be '+kinds.join('/'));
  if(p.group!==undefined){if(!id(p.group))fail(at+'.group must be an identifier');groups.add(p.group)}
  for(const k of['label','description'])if(p[k]!==undefined&&(typeof p[k]!=='string'||p[k].length>1024))fail(at+'.'+k+' must be short text');
  if(p.cover!==undefined&&typeof p.cover!=='boolean')fail(at+'.cover must be boolean');
  if(p.material!==undefined&&!['metal','dark','accent','warm','cool'].includes(p.material))fail(at+'.material must be metal/dark/accent/warm/cool');
  if(p.at!==undefined)vector(p.at,at+'.at');if(p.explode!==undefined)vector(p.explode,at+'.explode');if(p.rotation!==undefined)num(p.rotation,at+'.rotation',-1e9,1e9);
  if(p.axis!==undefined&&!['x','y','z'].includes(p.axis))fail(at+'.axis must be x/y/z');
  if(p.type==='box'){const size=vector(p.size,at+'.size');if(size.some(v=>v<=0||v>2000))fail(at+'.size must be positive and <=2000');if(p.round!==undefined)num(p.round,at+'.round',0,Math.min(size[0],size[1])/2)}
  if(['cylinder','gear'].includes(p.type)){num(p.radius,at+'.radius',.1,1000);num(p.height??8,at+'.height',.1,1000);if(p.inner!==undefined)num(p.inner,at+'.inner',0,p.radius-.01)}
  if(p.type==='gear'){const teeth=num(p.teeth,at+'.teeth',6,64);if(!Number.isInteger(teeth))fail(at+'.teeth must be an integer');if(p.module!==undefined)num(p.module,at+'.module',.1,p.radius/3)}
  if(['rod','spring'].includes(p.type)){vector(p.from,at+'.from');vector(p.to,at+'.to');if(Math.hypot(...sub(p.to,p.from))<.1)fail(at+' endpoints must differ');num(p.radius??2,at+'.radius',.1,200)}
  if(p.type==='spring'){const turns=num(p.turns??8,at+'.turns',2,24);if(!Number.isInteger(turns))fail(at+'.turns must be integer')}
 }
 if(spec.groups!==undefined){if(!Array.isArray(spec.groups)||spec.groups.length>12)fail('groups must be an array of <=12 labels');const ids=new Set();for(const g of spec.groups){if(!g||!id(g.id)||ids.has(g.id)||!groups.has(g.id)||typeof g.label!=='string'||g.label.length>128)fail('groups must name unique existing part groups');ids.add(g.id)}}
 if(spec.bounds!==undefined){if(!Array.isArray(spec.bounds)||spec.bounds.length!==2)fail('bounds must be [minXYZ,maxXYZ]');const [a,b]=spec.bounds.map((v,i)=>vector(v,'bounds['+i+']'));if(a.some((v,i)=>v>=b[i]))fail('bounds min must be below max on every axis')}
 if(spec.azimuth!==undefined)num(spec.azimuth,'azimuth',10,80);if(spec.elevation!==undefined)num(spec.elevation,'elevation',15,70);
 if(spec.title!==undefined&&(typeof spec.title!=='string'||spec.title.length>256))fail('title must be short text');
 if(spec.bind!==undefined){if(!spec.bind||typeof spec.bind!=='object'||Array.isArray(spec.bind))fail('bind must be an object');for(const[k,v]of Object.entries(spec.bind))if(!['explode','selected','cutaway'].includes(k)||!id(v))fail('bind only accepts declared state keys for explode/selected/cutaway')}
 return spec;
}
function frame(axis){if(axis==='x')return [[0,1,0],[0,0,1],[1,0,0]];if(axis==='y')return [[0,0,1],[1,0,0],[0,1,0]];return [[1,0,0],[0,1,0],[0,0,1]]}
const point=(f,x,y,z)=>add(add(mul(f[0],x),mul(f[1],y)),mul(f[2],z));
function sweep(ring,height,f,inner){
 const low=ring.map(([x,y])=>point(f,x,y,-height/2)),high=ring.map(([x,y])=>point(f,x,y,height/2)),faces=[];
 const topInner=inner?.map(([x,y])=>point(f,x,y,height/2)),bottomInner=inner?.map(([x,y])=>point(f,x,y,-height/2));
 faces.push({points:high,holes:topInner?[topInner.slice().reverse()]:[],normal:f[2]},{points:low.slice().reverse(),holes:bottomInner?[bottomInner]:[],normal:mul(f[2],-1)});
 for(let i=0;i<ring.length;i++){const j=(i+1)%ring.length;if(Math.hypot(...sub(low[j],low[i]))<1e-6)continue;faces.push({points:[low[i],low[j],high[j],high[i]],normal:unit(cross(sub(low[j],low[i]),f[2]))});if(inner)faces.push({points:[bottomInner[j],bottomInner[i],topInner[i],topInner[j]],normal:unit(cross(sub(bottomInner[i],bottomInner[j]),f[2]))})}
 return faces;
}
export function partGeometry(p){
 let f=frame(p.axis),ring,height,faces;
 if(p.type==='box'){ring=roundedPlan({x:-p.size[0]/2,y:-p.size[1]/2,w:p.size[0],d:p.size[1],r:p.round??Math.min(2,p.size[0]/2,p.size[1]/2)},3);height=p.size[2]}
 if(p.type==='cylinder'){ring=circleRing(0,0,p.radius,24);height=p.height??8}
 if(p.type==='gear'){const step=Math.PI*2/p.teeth,m=p.module??p.radius*2/p.teeth;ring=[];for(let i=0;i<p.teeth;i++)for(const[t,r]of[[-.5,p.radius-m*.85],[-.32,p.radius-m*.85],[-.17,p.radius+m*.7],[.17,p.radius+m*.7],[.32,p.radius-m*.85]]){const a=(i+t)*step;ring.push([Math.cos(a)*r,Math.sin(a)*r])}height=p.height??8}
 if(p.type==='rod'){const w=unit(sub(p.to,p.from)),u=unit(cross(w,Math.abs(w[2])<.9?[0,0,1]:[0,1,0]));f=[u,cross(w,u),w];ring=circleRing(0,0,p.radius??2,16);height=Math.hypot(...sub(p.to,p.from))}
 if(p.type==='spring'){const w=unit(sub(p.to,p.from)),u=unit(cross(w,Math.abs(w[2])<.9?[0,0,1]:[0,1,0])),v=cross(w,u),points=[];for(let i=0;i<=128;i++){const t=i/128,a=t*(p.turns??8)*Math.PI*2,fade=Math.min(1,t*12,(1-t)*12);points.push(add(add(p.from,mul(sub(p.to,p.from),t)),add(mul(u,Math.cos(a)*(p.radius??6)*fade),mul(v,Math.sin(a)*(p.radius??6)*fade))))}return {line:points,points}}
 const rotation=p.rotation??0,c=Math.cos(rotation),s=Math.sin(rotation);ring=ring.map(([x,y])=>[x*c-y*s,x*s+y*c]);const inner=p.inner?ring.map(([x,y])=>{const a=Math.atan2(y,x);return [Math.cos(a)*p.inner,Math.sin(a)*p.inner]}):undefined;
 faces=sweep(ring,height,f,inner);const center=p.type==='rod'?mul(add(p.from,p.to),.5):p.at??[0,0,0];faces=faces.map(face=>({...face,points:face.points.map(v=>add(v,center)),holes:face.holes?.map(h=>h.map(v=>add(v,center)))}));return {faces,points:faces.flatMap(f=>f.points)};
}
export function sceneBounds(spec){if(spec.bounds){const[a,b]=spec.bounds;return Array.from({length:8},(_,i)=>[i&1?b[0]:a[0],i&2?b[1]:a[1],i&4?b[2]:a[2]])}return spec.parts.flatMap(p=>{const geometry=partGeometry(p);return geometry.points.flatMap(v=>[v,add(v,p.explode??[0,0,0])])})}
export function gearPair({driverTeeth=16,drivenTeeth=32,rpm=30,angle=0,module=2}={}){for(const[k,v]of Object.entries({driverTeeth,drivenTeeth}))if(!Number.isInteger(v)||v<6||v>64)fail(k+' must be integer 6..64');num(rpm,'rpm',-600,600);num(angle,'angle',-1e9,1e9);num(module,'module',.1,10);return {driverRadius:driverTeeth*module/2,drivenRadius:drivenTeeth*module/2,centerDistance:(driverTeeth+drivenTeeth)*module/2,driverAngle:angle,drivenAngle:-angle*driverTeeth/drivenTeeth+Math.PI-Math.PI/drivenTeeth,driverRpm:rpm,drivenRpm:-rpm*driverTeeth/drivenTeeth,ratio:drivenTeeth/driverTeeth}}
export function sliderCrank({angle=0,radius=20,rod=70,z=20}={}){num(angle,'angle',-1e9,1e9);num(radius,'radius',.1,200);num(rod,'rod',.1,1000);num(z,'z');if(rod<=radius)fail('connecting rod length must exceed crank radius');const crank=[radius*Math.cos(angle),radius*Math.sin(angle),z],x=crank[0]+Math.sqrt(rod*rod-crank[1]*crank[1]);return {crank,piston:[x,0,z],position:x,stroke:radius*2,angle}}
export function follow(value,target,delta,tau=.16){num(value,'value',-1e9,1e9);num(target,'target',-1e9,1e9);num(delta,'delta',0,.1);num(tau,'tau',.01,10);return value+(target-value)*(1-Math.exp(-delta/tau))}

