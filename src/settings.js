import React,{useEffect,useRef,useState}from'react';
const h=React.createElement;
export function ModeSettings({scope}){
  const [snapshot,setSnapshot]=useState(()=>scope.getSnapshot()),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),pending=useRef(false);
  useEffect(()=>scope.subscribe(()=>setSnapshot(scope.getSnapshot())),[scope]);
  const ready=snapshot.status==='ready'&&snapshot.value!==undefined;
  async function change(mode,key='designMode'){if(pending.current||!ready)return;pending.current=true;setBusy(true);setMessage('');try{
    await scope.mutate([{op:'set',path:[key],value:mode}],scope.getSnapshot().revision);
    const actual=scope.getSnapshot();setSnapshot(actual);if(actual.status!=='ready'||actual.value?.[key]!==mode)throw new Error('设置未保存，可能发生配置冲突，请重试。');setMessage(key==='designMode'?'模式已保存；从下一次请求开始生效。':'展示设置已保存；正文定位指导从下一次请求开始生效。');
  }catch(e){setMessage(e.message??'模式保存失败，请重试。');setSnapshot(scope.getSnapshot());}finally{pending.current=false;setBusy(false)}}
  return h('section',{className:'dgui-root dgui-settings','aria-label':'DSH Motion UI 设置'},h('h3',null,'DSH Motion UI'),h('label',{htmlFor:'dgui-design-mode'},'设计模式'),h('select',{id:'dgui-design-mode',value:snapshot.value?.designMode??'guided',disabled:!ready||busy,onChange:e=>change(e.target.value)},h('option',{value:'guided'},'引导模式'),h('option',{value:'free'},'自由设计模式')),
    h('p',null,'引导模式提供设计技能、组件协议与示例。自由设计模式只提供画布接口与交互约束，布局、图形、配色和动画由模型决定；两种模式的运行权限相同。'),
    h('p',null,'两种模式都会指导模型判断何时主动使用 UI，并优先交付小而完整的界面。'),
    h('label',{htmlFor:'dgui-display-mode'},'界面展示位置'),h('select',{id:'dgui-display-mode',value:snapshot.value?.displayMode??'tail',disabled:!ready||busy,onChange:e=>change(e.target.value,'displayMode')},h('option',{value:'tail'},'回答下方'),h('option',{value:'inline'},'正文标记位置'),h('option',{value:'sidebar'},'PC 侧栏')),
    h('p',null,'正文模式由模型用标记选择插入位置，缺少标记时显示在回答下方。侧栏不可用时自动回退；正文和侧栏共享已保存参数。'),
    h('label',{htmlFor:'dgui-show-details'},h('input',{id:'dgui-show-details',type:'checkbox',checked:snapshot.value?.showDetails===true,disabled:!ready||busy,onChange:e=>change(e.target.checked,'showDetails')}),' 显示界面详情'),
    h('p',null,'默认隐藏底部的参数状态、原始说明、显示检查和版本历史。导出与重置可通过画布右上角操作菜单使用；错误提示始终保留。'),
    h('p',null,'此设置影响当前 profile 后续请求。已有上下文可能保留旧指导，对比模式时请新建会话。'),
    !ready&&h('p',{role:'status'},snapshot.status==='unavailable'?'插件设置不可用，请确认宿主已加载新版插件。':'正在读取设置…'),message&&h('p',{role:'status'},message));
}
