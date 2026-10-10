import React from 'react';
import { ToolView, TurnUiView } from './view.js';
import { turnUiDefinition } from './history.js';
import { CSS } from './styles.js';
import { ModeSettings } from './settings.js';
import { UiPanel,focusUi } from './presentation.js';
import { setPanelOpener } from './presentation-store.js';
import {configureViewSettings} from './view-settings.js';
export const inject = ['slots', 'sessions', 'conversation', 'uiConversation', 'configForms'];
export function apply(ctx) {
  const scope=ctx.configForms.get('motion-ui');
  configureViewSettings(scope);
  ctx.slots.inject('plugins.bundle.config',()=>ctx.slots.register({name:'plugins.bundle.config',key:'dsh-motion-ui'},props=>React.createElement(ModeSettings,{...props,scope})));
  ctx.uiConversation.events.register(turnUiDefinition);
  ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
    name: 'conversation.chat.turnTail', id: 'dsh-generative-ui',
    inject: sessionId => ({ presentationScope:scope,sendPrompt: prompt => ctx.sessions.scope(sessionId).get("conversation").send(prompt) })
  }, TurnUiView));
  ctx.effect(() => { const style = document.createElement('style'); style.dataset.plugin = 'dsh-generative-ui'; style.textContent = CSS; document.head.append(style); return () => style.remove(); });
  for(const name of ['render_ui','render_canvas'])ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
    name: 'tool.call.toolview', key: name,
    inject: sessionId => ({ sendPrompt: prompt => ctx.sessions.scope(sessionId).get("conversation").send(prompt) })
  }, ToolView));
  // Optional native sidebar services: keep normal conversation rendering alive
  // when this extension point is absent or starts after the plugin.
  ctx.inject?.(['sidebarRightTabs','sidebarRight'],panel=>{
    const id='dsh-generative-ui:panel',kind='dsh-generative-ui';
    panel.sidebarRightTabs.register({id,kind,title:()=> '智能 UI',guide:[{id:id+':entry',order:43,title:()=> '智能 UI',description:()=> '当前会话的交互界面'}]});
    panel.slots.inject('sidebar.right.pane.tab',()=>panel.slots.register({name:'sidebar.right.pane.tab',key:id,inject:sessionId=>({sendPrompt:prompt=>ctx.sessions.scope(sessionId).get('conversation').send(prompt)})},UiPanel));
    panel.slots.inject('sidebar.right.pane.tab.title',()=>panel.slots.register({name:'sidebar.right.pane.tab.title',key:id},()=> '智能 UI'));
    panel.effect(()=>setPanelOpener((documentId,sessionId)=>{focusUi(documentId,sessionId);panel.sidebarRight.openTab(kind)}));
  });
}


