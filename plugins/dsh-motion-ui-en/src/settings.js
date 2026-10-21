import {MotionLibrary} from './motion-library.js';
import {VideoCapabilities} from './video-capabilities.js';
import React,{useEffect,useRef,useState}from'react';
import {StyleOptions} from './style-previews.js';
import {RuntimeDiagnostics} from './runtime-diagnostics.js';
import {SceneLibrary} from './scene-library.js';
import {DEFAULT_VISUAL_STYLE} from '../lib/visual-styles.js';
const h=React.createElement;
export function ModeSettings({scope}){
  const [snapshot,setSnapshot]=useState(()=>scope.getSnapshot()),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),pending=useRef(false);
  useEffect(()=>scope.subscribe(()=>setSnapshot(scope.getSnapshot())),[scope]);
  const ready=snapshot.status==='ready'&&snapshot.value!==undefined;
  async function change(mode,key='designMode'){if(pending.current||!ready)return;pending.current=true;setBusy(true);setMessage('');try{
    await scope.mutate([{op:'set',path:[key],value:mode}],scope.getSnapshot().revision);
    const actual=scope.getSnapshot();setSnapshot(actual);if(actual.status!=='ready'||actual.value?.[key]!==mode)throw new Error('Settings not saved — a configuration conflict may have occurred. Try again.');setMessage(key==='visualStyle'?'Visual style saved. Applies from your next request.':key==='designMode'?'Mode saved. Applies from your next request.':'Display settings saved. Inline placement guidance applies from your next request.');
  }catch(e){setMessage(e.message??'Could not save the mode. Try again.');setSnapshot(scope.getSnapshot());}finally{pending.current=false;setBusy(false)}}
  return h('section',{className:'dgui-root dgui-settings','aria-label':'DSH Motion UI settings'},h('h3',null,'DSH Motion UI'),h('label',{htmlFor:'dgui-design-mode'},'Design mode'),h('select',{id:'dgui-design-mode',value:snapshot.value?.designMode??'guided',disabled:!ready||busy,onChange:e=>change(e.target.value)},h('option',{value:'guided'},'Guided'),h('option',{value:'free'},'Free design')),
    h('p',null,'Guided mode supplies a design skill, component protocol and examples. Free design supplies only the canvas interface and interaction constraints — layout, graphics, color and animation are the model’s call. Both modes run with identical permissions.'),
    h('p',null,'Both modes teach the model to judge when UI genuinely helps, and to deliver something small but complete first.'),
    h('h4',null,'Visual style (guided mode only)'),h('p',null,'Clicking a style card saves it; it applies from your next request. The previews below are for comparison only and do not constrain generated layouts. Free mode injects neither style guidance nor examples.'),
    h(StyleOptions,{value:snapshot.value?.visualStyle??DEFAULT_VISUAL_STYLE,disabled:!ready||busy||snapshot.value?.designMode==='free',onChange:value=>change(value,'visualStyle')}),
    h('p',null,'Typography for text, comparison, list, summary and flow blocks is chosen by the model per block. One reply may mix several layouts.'),
    h('p',null,'Every interface is placed through an inline marker. The "Intelligent UI" sidebar entry shows this conversation’s interfaces; inline and sidebar share saved parameters.'),
    h('label',{htmlFor:'dgui-show-details'},h('input',{id:'dgui-show-details',type:'checkbox',checked:snapshot.value?.showDetails===true,disabled:!ready||busy,onChange:e=>change(e.target.checked,'showDetails')}),' Show interface details'),
    h('p',null,'Hides the bottom parameter state, original description, display checks and version history by default. Export and reset stay available from the canvas top-right menu; error messages are always kept.'),
    h('p',null,'This setting affects later requests in the current profile. Existing context may keep older guidance — start a new conversation when comparing modes.'),
    h('label',null,h('input',{type:'checkbox',checked:snapshot.value?.autoRepair!==false,disabled:!ready||busy,onChange:e=>change(e.target.checked,'autoRepair')}),' Auto-feedback on interface generation issues'),h('p',null,'At most two de-duplicated reminders, with no cap on model thinking time; cancelled generations do not trigger a repair.'),
    h(SceneLibrary),h(MotionLibrary),h(VideoCapabilities),h(RuntimeDiagnostics),
    !ready&&h('p',{role:'status'},snapshot.status==='unavailable'?'Plugin settings unavailable. Check that the host loaded the current plugin version.':'Reading settings…'),message&&h('p',{role:'status'},message));
}
