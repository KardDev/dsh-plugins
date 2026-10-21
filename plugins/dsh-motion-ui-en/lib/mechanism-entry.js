import{mechanismExample}from'./mechanism-catalog.js';import{validateDocument}from'./protocol.js';import{assemblyScene,gearsScene,crankScene}from'./mechanism-scenes.js';import{sceneSvg}from'./mechanism-render.js';import{formatNumber}from'./format-number.js';
export function mechanismDocument(args={}){
 for(const key of Object.keys(args))if(!['scene','title','rpm','teeth','radius','running','angle','explode'].includes(key))throw Error('DSH UI: unknown render_mechanism argument '+key);
 for(const key of['teeth','radius','angle'])if(args[key]!==undefined&&!Number.isInteger(args[key]))throw Error('DSH UI: '+key+' must be an integer');
 const doc=mechanismExample(args.scene),node=doc.nodes[0];
 for(const key of['rpm','teeth','radius','running','angle','explode'])if(args[key]!==undefined){if(!doc.state[key])throw Error('DSH UI: '+key+' is not used by '+args.scene);doc.state[key].default=args[key]}
 // Validate defaults before calculating or producing a preview; the same ranges
 // also govern all subsequent native/iframe state updates.
 validateDocument(doc);
 if(args.title!==undefined){doc.title=args.title;node.title=args.title}
 const s=Object.fromEntries(Object.entries(doc.state).map(([k,v])=>[k,v.default]));
 const fallback=args.scene==='gears'?`外啮合齿轮反向转动。主动轮16齿、${s.rpm} rpm；从动轮${s.teeth}齿、${formatNumber(-s.rpm*16/s.teeth,2)} rpm。速度比由齿数确定，齿形为简化示意，不用于加工。`:args.scene==='crank'?`曲柄旋转带动定长连杆，滑块沿导轨往复。曲柄半径${s.radius}、连杆长度70，完整行程${s.radius*2}，长度为示意单位，非动力学仿真。`:doc.fallback;
 doc.fallback=node.fallback='初始参数示意：'+fallback;
 doc.nodes.at(-1).text=args.scene==='gears'?'外啮合齿轮转向相反；从动转速 = −主动转速 × 主动齿数 ÷ 从动齿数。当前参数与数值见图中实时读数。简化齿形，不用于加工。':args.scene==='crank'?'连杆长度固定为70，滑块沿导轨往复；完整行程等于曲柄半径的两倍。当前半径、位置和行程见实时读数。长度为示意单位，非动力学仿真。':fallback;
 const scene=args.scene==='assembly'?assemblyScene():args.scene==='gears'?gearsScene({drivenTeeth:s.teeth}):crankScene({radius:s.radius,angle:s.angle*Math.PI/180});
 if(args.scene==='gears'){const phase=s.angle*Math.PI/180;scene.parts.find(p=>p.id==='driverGear').rotation=phase;scene.parts.find(p=>p.id==='drivenGear').rotation=-phase*16/s.teeth+Math.PI-Math.PI/s.teeth}
 node.html='<div id="diagram"><section class="mui-mechanism">'+sceneSvg(scene,{explode:s.explode,cutaway:s.cutaway,preview:true})+'<p>'+fallback+'</p></section></div>';
 return validateDocument(doc);
}
export function previewMechanism(raw){try{if(typeof raw!=='string'||raw.length>2048)return null;return mechanismDocument(JSON.parse(raw))}catch{return null}}
