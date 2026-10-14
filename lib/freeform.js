import { toolJson } from './tool-json.js';
import { validateDocument } from './protocol.js';
import {MODEL_CONTRACT} from './prompt-contract.js';
export function canvasDocument({title,fallback,html,css,script,height,libraries,state,data,derived}){
  const values={state:toolJson(state??{},'state'),data:toolJson(data??{},'data'),derived:toolJson(derived??{},'derived')};
  for(const [key,value] of Object.entries(values))if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('DSH UI: '+key+' must be an object');
  return validateDocument({version:1,title,fallback,...values,nodes:[{id:'canvas',type:'sandbox',title,fallback,html,...(css===undefined?{}:{css}),...(script===undefined?{}:{script}),...(height===undefined?{}:{height}),...(libraries===undefined?{}:{libraries}),stateKeys:Object.keys(values.state),dataKeys:Object.keys(values.data),derivedKeys:Object.keys(values.derived)}]});
}
export const FREE_UI_CONTRACT='No design template, visual style, palette, typography scale, composition or example is prescribed in free mode. Choose them yourself; native components and canvas helpers are optional interfaces.\n\n'+MODEL_CONTRACT;
