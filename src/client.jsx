import React from 'react';
import { ToolView, TurnUiView } from './view.js';
import { turnUiDefinition } from './history.js';
import {streamUiDefinition} from './stream-history.js';
import {StreamNodeView} from './stream-surface.js';
import { CSS } from './styles.js';
import { ModeSettings } from './settings.js';
import { UiPanel,focusUi } from './presentation.js';
import { setPanelOpener } from './presentation-store.js';
import {configureViewSettings} from './view-settings.js';
import {fenceUiDefinition} from './fence-history.js';
import {FenceNodeView} from './fence-view.js';
import {setRuntimeActivation} from './runtime-diagnostics.js';
import {VISUAL_CSS} from './visual-styles.js';
import {mediaHistoryDefinition} from './media-history.js';
import {MediaNodeView,MediaToolView,MEDIA_PLAYER_CSS,disposeMediaSurfaces} from './media-player.js';
export const inject = ['slots', 'sessions', 'conversation', 'uiConversation', 'configForms'];
export function apply(ctx) {
  setRuntimeActivation({active:true,channel:'Conversation event rendering / body fence positioning'});
  console.info('[motion-ui] client active; channel=conversation-events/fence-dom');
  const scope=ctx.configForms.get('motion-ui');
  configureViewSettings(scope);
  ctx.slots.inject('plugins.bundle.config',()=>ctx.slots.register({name:'plugins.bundle.config',key:'dsh-motion-ui'},props=>React.createElement(ModeSettings,{...props,scope})));
  ctx.uiConversation.events.register(turnUiDefinition);
  ctx.uiConversation.events.register(streamUiDefinition);
  ctx.uiConversation.events.register(fenceUiDefinition);
  ctx.uiConversation.events.register(mediaHistoryDefinition);
  ctx.effect(()=>disposeMediaSurfaces);
  ctx.slots.inject('conversation.chat.node',()=>ctx.slots.register({name:'conversation.chat.node',key:'dshMotionMedia'},MediaNodeView));
  ctx.slots.inject('conversation.chat.node',()=>ctx.slots.register({name:'conversation.chat.node',key:'dshUiFences',inject:sessionId=>({sendPrompt:prompt=>ctx.sessions.scope(sessionId).get('conversation').send(prompt)})},FenceNodeView));
  ctx.slots.inject('conversation.chat.node',()=>ctx.slots.register({name:'conversation.chat.node',key:'dshUiStream'},StreamNodeView));
  ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
    name: 'conversation.chat.turnTail', id: 'dsh-generative-ui',
    inject: sessionId => ({ presentationScope:scope,sendPrompt: prompt => ctx.sessions.scope(sessionId).get("conversation").send(prompt) })
  }, TurnUiView));
  ctx.effect(() => { const style = document.createElement('style'); style.dataset.plugin = 'dsh-generative-ui'; style.textContent = CSS+VISUAL_CSS+MEDIA_PLAYER_CSS; document.head.append(style); return () => style.remove(); });
  for(const name of ['render_video','process_video'])ctx.slots.inject('tool.call.toolview',()=>ctx.slots.register({name:'tool.call.toolview',key:name},MediaToolView));
  for(const name of ['render_ui','render_canvas','render_text','render_mechanism','render_scene'])ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
    name: 'tool.call.toolview', key: name,
    inject: sessionId => ({ sendPrompt: prompt => ctx.sessions.scope(sessionId).get("conversation").send(prompt) })
  }, ToolView));
  // Optional native sidebar services: keep normal conversation rendering alive
  // when this extension point is absent or starts after the plugin.
  ctx.inject?.(['sidebarRightTabs','sidebarRight'],panel=>{
    setRuntimeActivation({sidebar:true});
    const id='dsh-generative-ui:panel',kind='dsh-generative-ui';
    panel.sidebarRightTabs.register({id,kind,title:()=> 'Smart UI',guide:[{id:id+':entry',order:43,title:()=> 'Smart UI',description:()=> 'Interactive interfaces in this session'}]});
    panel.slots.inject('sidebar.right.pane.tab',()=>panel.slots.register({name:'sidebar.right.pane.tab',key:id,inject:sessionId=>({sendPrompt:prompt=>ctx.sessions.scope(sessionId).get('conversation').send(prompt)})},UiPanel));
    panel.slots.inject('sidebar.right.pane.tab.title',()=>panel.slots.register({name:'sidebar.right.pane.tab.title',key:id},()=> 'Smart UI'));
    panel.effect(()=>setPanelOpener((documentId,sessionId)=>{focusUi(documentId,sessionId);panel.sidebarRight.openTab(kind)}));
  });
}


