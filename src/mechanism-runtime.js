import {validateScene,gearPair,sliderCrank,follow} from '../lib/mechanism-geometry.js';
import {projectionFor,renderFaces} from '../lib/mechanism-render.js';
import {assemblyScene,gearsScene,crankScene} from '../lib/mechanism-scenes.js';
import {MECHANISM_CSS} from '../lib/mechanism-css.js';
const NS='http://www.w3.org/2000/svg';
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node};
const number=(v,fallback)=>typeof v==='number'&&Number.isFinite(v)?v:fallback;
export function createMechanismAPI(api){
 function mount(target,spec){
  const container=typeof target==='string'?document.querySelector(target):target;if(!container||!container.replaceChildren)throw Error('Motion mechanism: target element not found');validateScene(spec);
  let scene=structuredClone({...spec,onSelect:undefined}),projection=projectionFor(scene),values={explode:0,selected:'all',cutaway:false,pose:{}},destroyed=false,projectionKey='',lastOrder='',frames=0;const cache=new Map(),paths=new Map(),buttons=new Map(),cleanups=[];
  const root=el('section','mui-mechanism'),title=el('h2',null,scene.title??'结构图解'),svg=document.createElementNS(NS,'svg'),layer=document.createElementNS(NS,'g'),nav=el('div','mui-mechanism-nav'),controls=el('div','mui-mechanism-controls'),description=el('p','mui-mechanism-description'),readout=el('output','mui-mechanism-readout'),style=el('style');style.textContent=MECHANISM_CSS;
  title.hidden=scene.title==='';root.setAttribute('aria-label',scene.title??'结构图解');svg.setAttribute('class','mui-mechanism-svg');svg.setAttribute('viewBox','0 0 600 340');svg.setAttribute('role','img');svg.setAttribute('aria-label','可拆解的结构示意图；使用下方按钮选择部件');svg.append(layer);root.append(style,title,svg,nav,controls,readout,description);container.replaceChildren(root);
  const groups=()=>scene.groups?.length?scene.groups:scene.parts.map(p=>({id:p.id,label:p.label??p.id,description:p.description??''}));
  function choose(id){if(scene.bind?.selected)api.setState({[scene.bind.selected]:id});else if(typeof spec.onSelect==='function')spec.onSelect(id);else update({selected:id})}
  function buildNav(){nav.replaceChildren();buttons.clear();if(!scene.bind?.selected&&typeof spec.onSelect!=='function'){nav.hidden=true;return}nav.hidden=false;for(const g of[{id:'all',label:'全部',description:''},...groups()]){const b=el('button',null,g.label);b.type='button';b.setAttribute('aria-pressed',String(values.selected===g.id));b.addEventListener('click',()=>choose(g.id));buttons.set(g.id,b);nav.append(b)}}
  let explodeInput,explodeOutput,cutInput;
  if(scene.bind?.explode){const label=el('label',null,'拆解进度');explodeInput=el('input');explodeInput.type='range';explodeInput.min='0';explodeInput.max='1';explodeInput.step='.01';explodeInput.setAttribute('aria-label','拆解进度');explodeOutput=el('output');explodeInput.addEventListener('input',()=>api.setState({[scene.bind.explode]:Number(explodeInput.value)}));label.append(explodeInput,explodeOutput);controls.append(label)}
  if(scene.bind?.cutaway&&scene.parts.some(p=>p.cover)){const label=el('label',null,'剖开外壳');cutInput=el('input');cutInput.type='checkbox';cutInput.setAttribute('aria-label','剖开外壳');cutInput.addEventListener('change',()=>api.setState({[scene.bind.cutaway]:cutInput.checked}));label.prepend(cutInput);controls.append(label)}controls.hidden=!controls.childNodes.length;
  function draw(next){const key=JSON.stringify([next.explode,next.cutaway]);if(key!==projectionKey){projection=projectionFor(scene,next);projectionKey=key}const faces=renderFaces(scene,projection,next,cache),present=new Set();for(const f of faces){present.add(f.key);let path=paths.get(f.key);if(!path){path=document.createElementNS(NS,'path');path.setAttribute('fill-rule','evenodd');paths.set(f.key,path)}for(const[k,v]of Object.entries({d:f.d,'data-part':f.part,'data-material':f.material,'data-tone':f.tone,'data-active':f.active})){if(path.getAttribute(k)!==String(v))path.setAttribute(k,String(v))}if(f.line)path.setAttribute('data-line','');else path.removeAttribute('data-line')}
   for(const[k,path]of paths)if(!present.has(k)){path.remove();paths.delete(k)}const order=faces.map(f=>f.key).join('|');if(order!==lastOrder){for(const f of faces)layer.append(paths.get(f.key));lastOrder=order}frames++;
  }
  function update(patch={}){if(destroyed)return;for(const key of Object.keys(patch))if(!['explode','selected','cutaway','pose','parts','readout'].includes(key))throw Error('Motion mechanism: unknown update field '+key);
   if(patch.parts){const next={...scene,parts:patch.parts};validateScene(next);const nextProjection=projectionFor(next);renderFaces(next,nextProjection,{...values,...patch},new Map());scene=next;projection=nextProjection;cache.clear();lastOrder='';projectionKey=''}
   const next={...values,...patch};if(patch.pose)next.pose=patch.pose;draw(next);values=next;
   for(const[id,b]of buttons)b.setAttribute('aria-pressed',String(next.selected===id));const selected=groups().find(g=>g.id===next.selected)??scene.parts.find(p=>p.id===next.selected);description.textContent=selected?.description??(next.selected==='all'?'选择一个部件，查看它的职责；拆解只展示装配关系。':'');
   if(explodeInput){explodeInput.value=String(next.explode);explodeOutput.textContent=Math.round(next.explode*100)+'%'}if(cutInput)cutInput.checked=next.cutaway;if(patch.readout!==undefined)readout.textContent=String(patch.readout);
  }
  svg.addEventListener('click',event=>{const path=event.target.closest('[data-part]');if(!path)return;const part=scene.parts.find(p=>p.id===path.getAttribute('data-part'));if(part)choose(scene.groups?.length?part.group??part.id:part.id)});
  buildNav();
  cleanups.push(api.subscribe(snapshot=>{if(destroyed)return;const patch={};for(const[k,key]of Object.entries(scene.bind??{})){if(!Object.hasOwn(snapshot.state,key))throw Error('Motion mechanism: bind.'+k+' names undeclared state '+key);patch[k]=snapshot.state[key]}
   root.dataset.style=snapshot.theme?.visualStyle??'';for(const b of buttons.values())b.disabled=snapshot.disabled;if(explodeInput)explodeInput.disabled=snapshot.disabled;if(cutInput)cutInput.disabled=snapshot.disabled;update(patch)}));
  return Object.freeze({update,pose:pose=>update({pose}),stats:()=>({frames,faces:paths.size,parts:scene.parts.length}),destroy(){if(destroyed)return;destroyed=true;cleanups.forEach(f=>f());paths.clear();cache.clear();container.replaceChildren()}});
 }
 function mountDemo(target,name,options={}){
  if(!['assembly','gears','crank'].includes(name))throw Error('Motion mechanism: demo must be assembly/gears/crank');const bind=options.bind??{},state=()=>api.snapshot.state,get=(key,fallback)=>Object.hasOwn(bind,key)?state()[bind[key]]:fallback;
  for(const[k,key]of Object.entries(bind)){if(!['explode','selected','cutaway','rpm','teeth','running','angle','radius'].includes(k)||typeof key!=='string'||!Object.hasOwn(state(),key))throw Error('Motion mechanism: invalid demo binding '+k)}
  let angle=get('angle',0)*Math.PI/180,phase=angle,params='',lastReduced=false;const baseBind=Object.fromEntries(Object.entries(bind).filter(([k])=>['explode','selected','cutaway'].includes(k)));
  function build(){if(name==='assembly')return assemblyScene();if(name==='gears')return gearsScene({driverTeeth:options.driverTeeth??16,drivenTeeth:get('teeth',32),module:options.module??1.5});return crankScene({radius:get('radius',20),rod:options.rod??70})}
  const controller=mount(target,{...build(),...(options.title===undefined?{}:{title:options.title}),bind:baseBind});let stopped=false;
  function paint(delta=0,reduced=false,visible=true){if(stopped)return;const rpm=get('rpm',30),running=get('running',false),target=get('angle',0)*Math.PI/180;let nextPhase=phase;if(target!==angle){nextPhase=target;angle=target}else if(running&&visible&&!reduced)nextPhase+=rpm*Math.PI*2/60*delta;phase=nextPhase;
   const key=JSON.stringify([name,get('teeth',32),get('radius',20)]);if(key!==params){controller.update({parts:build().parts});params=key}
   if(name==='gears'){const g=gearPair({driverTeeth:options.driverTeeth??16,drivenTeeth:get('teeth',32),rpm,angle:phase,module:options.module??1.5});controller.update({pose:{driverGear:{rotation:g.driverAngle},drivenGear:{rotation:g.drivenAngle}},readout:'主动轮 '+api.formatNumber(g.driverRpm,0)+' rpm · 从动轮 '+api.formatNumber(g.drivenRpm,2)+' rpm · 齿数比 '+api.formatNumber(g.ratio,2)+'（负号表示反向）'})}
   else if(name==='crank'){const k=sliderCrank({angle:phase,radius:get('radius',20),rod:options.rod??70,z:28});controller.update({pose:{crankPin:{at:k.crank},link:{from:k.crank,to:k.piston},piston:{at:[k.position,0,22]},pistonPin:{at:k.piston}},readout:'曲柄角 '+api.formatNumber(((phase*180/Math.PI)%360+360)%360,1)+'° · 滑块位置 '+api.formatNumber(k.position,2)+' · 行程 '+api.formatNumber(k.stroke,1)+'（示意长度单位）'})}
   lastReduced=reduced;
  }
  let cancel=null;const sync=()=>{paint(0,lastReduced,true);if(name==='assembly')return;if(get('running',false)&&!cancel){cancel=api.animate(({delta,reducedMotion,visible})=>{if(visible&&!reducedMotion)paint(delta,false,true);else if(lastReduced!==reducedMotion)paint(0,reducedMotion,visible)})}else if(!get('running',false)&&cancel){cancel();cancel=null}};const unsubscribe=api.subscribe(sync);
  paint();return Object.freeze({...controller,destroy(){if(stopped)return;stopped=true;cancel?.();unsubscribe();controller.destroy()}});
 }
 return Object.freeze({mount,mountDemo,gearPair,sliderCrank,follow,scenes:Object.freeze({assembly:assemblyScene,gears:gearsScene,crank:crankScene})});
}
