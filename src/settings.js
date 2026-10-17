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
    const actual=scope.getSnapshot();setSnapshot(actual);if(actual.status!=='ready'||actual.value?.[key]!==mode)throw new Error('设置未保存，可能发生配置冲突，请重试。');setMessage(key==='visualStyle'?'视觉风格已保存；从下一次请求开始生效。':key==='designMode'?'模式已保存；从下一次请求开始生效。':'展示设置已保存；正文定位指导从下一次请求开始生效。');
  }catch(e){setMessage(e.message??'模式保存失败，请重试。');setSnapshot(scope.getSnapshot());}finally{pending.current=false;setBusy(false)}}
  return h('section',{className:'dgui-root dgui-settings','aria-label':'DSH Motion UI 设置'},h('h3',null,'DSH Motion UI'),h('label',{htmlFor:'dgui-design-mode'},'设计模式'),h('select',{id:'dgui-design-mode',value:snapshot.value?.designMode??'guided',disabled:!ready||busy,onChange:e=>change(e.target.value)},h('option',{value:'guided'},'引导模式'),h('option',{value:'free'},'自由设计模式')),
    h('p',null,'引导模式提供设计技能、组件协议与示例。自由设计模式只提供画布接口与交互约束，布局、图形、配色和动画由模型决定；两种模式的运行权限相同。'),
    h('p',null,'两种模式都会指导模型判断何时主动使用 UI，并优先交付小而完整的界面。'),
    h('h4',null,'视觉风格（仅限引导模式）'),h('p',null,'点击风格卡片即保存，从下一次请求开始生效。下方可切换排版预览，仅供比较，不限制生成排版。自由模式不注入风格指导与案例，由模型自主设计。'),
    h(StyleOptions,{value:snapshot.value?.visualStyle??DEFAULT_VISUAL_STYLE,disabled:!ready||busy||snapshot.value?.designMode==='free',onChange:value=>change(value,'visualStyle')}),
    h('p',null,'文字、对比、列表、摘要与流程的排版交给模型按内容自选。同一回复可组合多块不同排版的界面。'),
    h('p',null,'界面统一通过正文标记定位。DSH 侧栏的“智能 UI”入口可查看当前会话的界面，正文和侧栏共享已保存参数。'),
    h('label',{htmlFor:'dgui-show-details'},h('input',{id:'dgui-show-details',type:'checkbox',checked:snapshot.value?.showDetails===true,disabled:!ready||busy,onChange:e=>change(e.target.checked,'showDetails')}),' 显示界面详情'),
    h('p',null,'默认隐藏底部的参数状态、原始说明、显示检查和版本历史。导出与重置可通过画布右上角操作菜单使用；错误提示始终保留。'),
    h('p',null,'此设置影响当前 profile 后续请求。已有上下文可能保留旧指导，对比模式时请新建会话。'),
    h('label',null,h('input',{type:'checkbox',checked:snapshot.value?.autoRepair!==false,disabled:!ready||busy,onChange:e=>change(e.target.checked,'autoRepair')}),' 自动反馈界面生成问题'),h('p',null,'最多两次去重提醒，不限制模型思考时长；取消生成时不再触发修复。'),
    h(SceneLibrary),h(MotionLibrary),h(VideoCapabilities),h(RuntimeDiagnostics),
    !ready&&h('p',{role:'status'},snapshot.status==='unavailable'?'插件设置不可用，请确认宿主已加载新版插件。':'正在读取设置…'),message&&h('p',{role:'status'},message));
}
