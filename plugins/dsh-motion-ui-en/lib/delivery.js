import {validateDocument} from './protocol.js';
import {repairFenceJson} from './visual-guard.js';
export function deliveryDiagnostics(document){
 const diagnostics=[];
 const walk=nodes=>{for(const node of nodes){if(node.type==='visual')for(const message of node.warnings??[])diagnostics.push({severity:'warning',path:node.id,message});if(node.children)walk(node.children)}};walk(document.nodes);
 return diagnostics;
}
export function diagnoseDelivery(input){
 try{const document=validateDocument(input),diagnostics=deliveryDiagnostics(document);return {valid:true,complete:diagnostics.length===0,document,diagnostics}}catch(e){return {valid:false,complete:false,diagnostics:[{severity:'error',path:e.path??e.message.match(/(?:^DSH UI: |unknown field )((?:node|nodes|derived|state|document|presentation)(?:\.[\p{L}\p{N}_]+|\[\d+\])+)/u)?.[1]??'document',message:e.message}]}}
}
export function resolveSourceFence(raw,{svg=false}={}){
 if(typeof raw!=='string'||raw.length>131072)return {valid:false,complete:false,diagnostics:[{severity:'error',path:'source',message:'Source exceeds 128 KiB'}]};
 if(/^[a-f\d]{8}-[a-f\d-]{27,}$/i.test(raw.trim()))return {marker:true};
 if(svg)return diagnoseDelivery({items:[{type:'svg',title:'SVG',code:raw}]});
 let value,repair;
 try{value=JSON.parse(raw)}catch(e){repair=repairFenceJson(raw);if(!repair)return {valid:false,complete:false,diagnostics:[{severity:'error',path:'source',message:'Invalid JSON: '+e.message.slice(0,240)}]};value=JSON.parse(repair.text)}
 const result=diagnoseDelivery(value);if(repair&&result.valid)result.repairs=repair.repairs;return result;
}
