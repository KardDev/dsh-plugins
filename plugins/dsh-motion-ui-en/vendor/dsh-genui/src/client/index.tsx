/**
 * dsh-genui browser half: the ```dsh-ui fence renderer, the keyed toolview
 * for the `render_ui` tool, and the session panel dock.
 *
 * Fence rendering is dual-mode, chosen at boot:
 * - **Registry channel** (contract hosts): the host's MarkdownText resolves
 *   ```dsh-ui fences through the fence-registry extension point; this package
 *   registers `renderGenuiFence`. Action callbacks ride the host-installed
 *   GenuiActionContext.
 * - **DOM channel** (pristine hosts): no extension point exists, so
 *   `dom-fence.ts` observes the conversation DOM, finds settled stock code
 *   blocks labelled `dsh-ui`, and mounts the same render pipeline in its own
 *   React roots — wrapped in the plugin-owned GenuiActionContext that relays
 *   `[genui-action]` through the scoped conversation send. Either way the
 *   deployment is the STOCK DSH snapshot plus this plugin.
 *
 * The renderer parses the fence body with the partial parser: while the reply
 * streams, every FINISHED component appears the moment its JSON object
 * closes, so the UI assembles top-down before the fence (or reply) completes.
 * A body with no finished component yet falls back to a plain code block.
 * @module @changfenhuang/dsh-genui/client
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { IConversation } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { createElement, type Key, type ReactNode } from 'react'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import * as primitives from '@deepseek-ai/dsh-client-ui-primitives'
import { installDomFenceRenderer } from './dom-fence.tsx'
import { createFileLinkAvailability, withFileLinkContext, type FileLinkCordisContext } from './file-link-context.tsx'
import { renderGenuiFence, type GenuiFenceContext } from './fence-render.tsx'
import { renderSvgFence } from './svg-fence.tsx'
import { createPanelSlashSource } from './panel-command.ts'
import { GenuiPanel, type GenuiPanelInjected } from './panel.tsx'
import { GenuiToolView } from './toolview.tsx'
import { mountAchievementToasts } from './achievement-toast.tsx'
import { bridgeHostLocale } from './i18n/index.ts'
import type { InputTriggerServiceContract } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import { assetUrl } from './asset-loader.ts'

/** Host extension surface the registry channel needs (absent on pristine). */
type HostFenceExt = {
  registerFenceRenderer?: (lang: string, renderer: (raw: string, key: Key, context?: GenuiFenceContext) => ReactNode) => () => void
}

/** Add low-priority prefetch links for the lazy engine assets (mermaid/three).
 * Browser-dependent: some engines ignore `<link rel=prefetch>`; harmless
 * either way — the on-demand loader still covers a cache miss. Exported for
 * tests. */
export function prefetchGenuiAssets(): void {
  if (typeof document === 'undefined') return
  for (const file of ['mermaid.js', 'three.js']) {
    if (document.head.querySelector(`link[rel="prefetch"][href="${assetUrl(file)}"]`) !== null) continue
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.as = 'script'
    link.href = assetUrl(file)
    document.head.appendChild(link)
  }
}

/** Session panel action loop: same [genui-action] contract as inline fences,
 * routed through the scoped conversation send (queued user message). The
 * prompt asks the model to re-run render_ui so the panel updates in place. */
function panelActionSend(ctx: Context, sessionId: SessionId): GenuiPanelInjected {
  const scoped = ctx.sessions.scope(sessionId)
  const conversation = scoped?.get('conversation') as IConversation | undefined
  return {
    sessionId,
    sendGenuiAction: (action, payload) => {
      if (conversation === undefined) return
      const payloadText = Object.keys(payload).length === 0
        ? ''
        : ` 组件数据: ${JSON.stringify(payload)}`
      void conversation.send(`[genui-action] ${action}。用户刚刚在面板中触发了动作 "${action}"，请根据组件数据执行相应操作，只输出一个 panel:true 的 dsh-ui 围栏来更新面板，回复文本至多一行 10 字以内的确认（如"已刷新"），不要解释、不要普通围栏。${payloadText}`).catch((err: unknown) => {
        // A failed prompt (session gone, agent busy) drops the action; the
        // panel stays interactive — the component is not disabled. Log the
        // failure WITHOUT the action payload or any secret values (the
        // message may contain field content).
        console.warn(`[genui] 面板动作 "${action}" 发送失败（session ${sessionId}）：`, err instanceof Error ? err.message : String(err))
      })
    },
    insertTemplate: (text) => {
      // Same insert channel as dsh-memory's organizeMemory: the standard
      // conversation.input.for(scope).setDraft — templates land in the
      // composer draft, not a queued message, so the user can edit before
      // sending.
      const input = (conversation as unknown as {
        input?: { for?(actx: unknown): { setDraft(text: string): void } | undefined }
      } | undefined)?.input?.for?.(scoped)
      input?.setDraft(text)
    },
  }
}

/** Relay a `/panel <指令>` instruction to the model: the scoped conversation
 * send with an explicit panel-only directive, so the model replaces the
 * default panel with content tailored to the request. */
function sendPanelInstruction(ctx: Context, sessionId: SessionId, instruction: string): void {
  const scoped = ctx.sessions.scope(sessionId)
  const conversation = scoped?.get('conversation') as IConversation | undefined
  if (conversation === undefined) return
  void conversation.send(`用户执行了 /panel 并请求：${instruction}。请只输出一个 panel:true 的 dsh-ui 围栏来更新会话面板，内容按请求定制；回复文本至多一行 10 字以内的确认（如"已更新"），不要解释、不要普通围栏。`).catch((err: unknown) => {
    // A failed prompt drops the instruction; the default panel stays
    // visible. Log without the instruction text (may contain secrets).
    console.warn(`[genui] /panel 指令发送失败（session ${sessionId}）：`, err instanceof Error ? err.message : String(err))
  })
}

/**
 * Inline-fence action relay (DOM channel): the same message template the
 * contract host's sendGenuiAction uses, so the model sees one identical
 * [genui-action] contract on both channels.
 */
function sendInlineGenuiAction(ctx: Context, sessionId: SessionId, action: string, payload: Record<string, unknown>): void {
  const scoped = ctx.sessions.scope(sessionId)
  const conversation = scoped?.get('conversation') as IConversation | undefined
  if (conversation === undefined) return
  const payloadText = Object.keys(payload).length === 0
    ? ''
    : ` 组件数据: ${JSON.stringify(payload)}`
  void conversation.send(`[genui-action] ${action}。用户刚刚在界面中触发了动作 "${action}"，请根据组件数据执行相应操作，并用 dsh-ui 输出更新后的界面。${payloadText}`).catch(() => {
    // A failed prompt (session gone, agent busy) drops the action;
    // the UI stays interactive — the component is not disabled.
  })
}

/** Visual-regression flag: `scripts/e2e-visual.mts` sets
 * `window.__DSH_GENUI_E2E__ = true` via an init script BEFORE this bundle
 * boots, which pins the DOM channel even on hosts that ship the registry
 * extension point. The DOM channel is what lets the harness inject a gallery
 * fence into an empty scratch profile and screenshot the real React tree
 * without a model round trip; production pages never set the flag. */
function forcedDomChannel(): boolean {
  return (globalThis as { __DSH_GENUI_E2E__?: boolean }).__DSH_GENUI_E2E__ === true
}

/** Cordis client entry: register the fence renderer on boot, the keyed
 * toolview for the render_ui tool, and the session panel dock; returning the
 * disposers lets cordis tear all registrations down on plugin unload. */
export function apply(ctx: Context): () => void {
  // Fence channel selection: the registry extension point when the host
  // ships it (contract line), the DOM observer otherwise (pristine line).
  // One plugin build serves both deployments.
  // Language: follow the host's DSH language preference when the deployment
  // ships the locale service, otherwise fall back to browser detection. Read
  // OPTIONALLY (never declared in `inject`) so a pristine host without the
  // service still renders — a declared-but-absent service would park the
  // fiber forever and kill all GenUI rendering.
  const localeDispose = bridgeHostLocale(ctx)
  const registerFn = (primitives as unknown as HostFenceExt).registerFenceRenderer
  const useRegistry = typeof registerFn === 'function' && !forcedDomChannel()
  const fileLinkAvailability = createFileLinkAvailability(ctx as unknown as FileLinkCordisContext)
  const channel = useRegistry ? 'registry' : 'dom'
  console.info(`[genui] client active; fence-channel=${channel}`)
  const disposers: Array<() => void> = useRegistry
    ? [localeDispose, registerFn!('dsh-ui', (raw, key, context) => withFileLinkContext(
      ctx as unknown as FileLinkCordisContext,
      fileLinkAvailability,
      context?.sessionId,
      context?.source === undefined,
      renderGenuiFence(raw, key, context),
    )), registerFn!('svg', renderSvgFence)]
    : [localeDispose, installDomFenceRenderer(ctx, (sessionId, action, payload) => sendInlineGenuiAction(ctx, sessionId, action, payload), fileLinkAvailability)]
  // Idle prefetch of the lazy engine assets: the browser downloads them at
  // LOW priority whenever the page is idle, so the first mermaid/3D node in
  // a session usually hits a warm cache instead of paying the fetch on first
  // use. Never blocks first paint; the loader still handles a miss.
  prefetchGenuiAssets()
  // Achievement toasts (0.9.5): a body-level stack independent of the panel.
  disposers.push(mountAchievementToasts())
  // Keyed toolview: the harness dispatches 'tool.call.toolview' by wire tool
  // name; registering under 'render_ui' gives the tool's result card the
  // GenUI renderer (reading the repaired spec from result meta). The toolview
  // also publishes every settled spec to the session panel store.
  disposers.push(ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
    name: 'tool.call.toolview',
    key: 'render_ui',
  }, (props: ToolCallViewProps) => withFileLinkContext(
    ctx as unknown as FileLinkCordisContext,
    fileLinkAvailability,
    props.sessionId,
    false,
    createElement(GenuiToolView, props),
  ))))
  // Session panel dock: a session-scoped, always-present seat above the
  // composer (TodoDock posture). Renders the session's latest render_ui
  // spec in place; absent spec = no panel.
  disposers.push(ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: 'genui-panel',
    order: 50,
    inject: (sessionId: SessionId): GenuiPanelInjected => ({
      ...panelActionSend(ctx, sessionId),
      fileLinkContext: { ctx: ctx as unknown as FileLinkCordisContext, availability: fileLinkAvailability },
    }),
  }, GenuiPanel)))
  // /panel slash command: a deterministic, client-side entry point that
  // opens the panel dock (publishes the default spec + expand request),
  // clears it (/panel clear), or relays an instruction to the model
  // (/panel <指令>) so the panel gets tailored content.
  //
  // inputTriggers is subscribed via cordis OPTIONAL injection (ctx.inject),
  // NOT a one-shot ctx.get() at apply time: the service is typically
  // provided by a different bundle than slots/sessions, so it can arrive
  // AFTER apply() runs — a one-shot lookup would silently disable /panel
  // even on hosts that DO ship the service (service arrival order race).
  // ctx.inject activates the callback only when the service arrives (any
  // order) and disposes with the subscription fiber; hosts without the
  // service simply never register /panel, and rendering is unaffected
  // either way.
  ctx.inject(['inputTriggers'], (scope) => {
    const slash = scope.get('inputTriggers') as InputTriggerServiceContract | undefined
    if (slash === undefined) return
    scope.effect(() => slash.registerSource(
      createPanelSlashSource((sessionId, instruction) => sendPanelInstruction(ctx, sessionId, instruction)),
    ), 'genui: /panel')
  })
  return () => {
    for (const dispose of disposers) dispose()
  }
}

// Browser services the client entry needs: the slots registry (toolview +
// dock) and sessions (scoped conversation send behind actions). This
// declaration is what the host's fiber inject waiting uses — without it
// apply() runs before the services bind and the whole plugin tree fails the
// boot sweep.
//
// inputTriggers (the /panel command source) is deliberately NOT declared:
// cordis `inject` is a hard activation gate — a declared service that is
// never provided (pristine DSH shells ship no inputTriggers provider) parks
// the fiber in waiting forever and apply() never runs, silently killing all
// GenUI rendering. Instead the apply() body subscribes via ctx.inject
// (optional injection): hosts with the service get /panel registered in any
// arrival order, hosts without it never register /panel — and the renderer
// itself never depends on the service either way.
export const inject = ['slots', 'sessions']

// Re-export the registry renderer for the test suite (setup.ts registers it
// exactly like apply() does on contract hosts).
export { renderGenuiFence }
export type { GenuiFenceContext } from './fence-render.tsx'
