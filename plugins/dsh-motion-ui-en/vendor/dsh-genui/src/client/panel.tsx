/**
 * Session GenUI panel: the dock surface that renders the latest `render_ui`
 * spec IN PLACE. The toolview publishes every new result into the panel
 * store; this component subscribes and re-renders the same block, so a
 * refresh (model calls render_ui again) updates the panel instead of the
 * message flow accumulating new UI per round.
 *
 * Mounted through the 'conversation.input.dock' list slot (TodoDock posture)
 * — a session-scoped, always-present seat above the composer — so the panel
 * coexists with the message flow on one screen. Absent spec = no panel.
 *
 * The dock is COLLAPSIBLE (TodoDock pattern), defaulting to a one-line
 * header: a tall always-open panel pins above the composer and crushes the
 * message flow's visible area, making history feel unreachable. Collapsed,
 * it takes a single row; expanded, the body caps its height and scrolls
 * internally, so the conversation stays scrollable either way.
 *
 * The expanded body is vertically RESIZABLE: a drag strip between the header
 * and the body adjusts the body height (clamped to sane bounds); the custom
 * height survives expand/collapse cycles for the session's life.
 *
 * Actions ride the same GenuiActionContext contract as inline fences: the
 * sendGenuiAction injection (built from the scoped conversation service in
 * apply) queues a [genui-action] user message back to the model.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import { GenuiActionContext, type GenuiActionHandler } from './action-context.ts'
import { withFileLinkContext, type FileLinkAvailability, type FileLinkCordisContext } from './file-link-context.tsx'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { ExportableGenuiBlock } from './artifact/ExportableGenuiBlock.tsx'
import { ErrorBoundary } from './ErrorBoundary.tsx'
import { panelStateKey } from './interaction-store.ts'
import { TemplateDrawer } from './TemplateDrawer.tsx'
import { clearSessionPanel, getPanelExpandToken, getPanelSpec, setLocalPanel, subscribePanel, subscribePanelExpand } from './panel-store.ts'
import { useT } from './i18n/index.ts'
import css from './GenuiBlock.module.css'

/** Resize bounds for the panel body, in px. */
const PANEL_HEIGHT_MIN = 120
const PANEL_HEIGHT_MAX = 600

/** First-panel hint dismissal flag (module-level localStorage key):
 *  shown once beside the first rendered spec, never again. */
const ONBOARD_KEY = 'dsh.genui.panel-hint'

// Achievement telemetry re-exports (already injected at apply).
import { recordPanel, recordTemplateUse } from './achievement-store.ts'

/** Injection face built per session in apply (scoped conversation send). */
export interface GenuiPanelInjected {
  sessionId: string
  sendGenuiAction: GenuiActionHandler
  fileLinkContext?: { ctx: FileLinkCordisContext; availability: FileLinkAvailability }
  /** Template center "try it": insert the template instruction into the
   *  current composer draft (standard conversation.input.for channel). */
  insertTemplate: (text: string) => void
}

export type GenuiPanelProps = PropsRuntime<'conversation.input.dock'> & GenuiPanelInjected

/**
 * Panel dock entry. Renders nothing until the session's toolview published a
 * spec; afterwards the SAME block re-renders on every publish. Collapsed by
 * default so the dock never steals the message flow's scroll room; the
 * header always shows the current panel title.
 */
export function GenuiPanel({ sessionId, sendGenuiAction, insertTemplate, fileLinkContext }: GenuiPanelProps) {
  const t = useT()
  const spec = useSyncExternalStore(subscribePanel, () => getPanelSpec(sessionId))
  const expandToken = useSyncExternalStore(subscribePanelExpand, () => getPanelExpandToken(sessionId))
  const [collapsed, setCollapsed] = useState(true)
  // Custom body height from the resize drag; null = the CSS default (360px).
  const [bodyHeight, setBodyHeight] = useState<number | null>(null)
  const [resizing, setResizing] = useState(false)
  const dragStart = useRef<{ y: number; height: number } | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  // Template center (0.9.4) + achievements (0.9.5): the drawer host —
  // null = closed, 'templates' | 'achievements' = open on that tab.
  const [drawer, setDrawer] = useState<null | 'templates' | 'achievements'>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const flashTimer = useRef(0)
  const hasSpec = spec !== null && spec.items.length > 0
  // First-panel hint: shown once beside the first rendered spec (never on the
  // hero — the host composer hero flex-compresses dock items with no content,
  // and the template button is a permanent header entry anyway).
  const [hint, setHint] = useState<boolean>(() => {
    try {
      return hasSpec && localStorage.getItem(ONBOARD_KEY) !== '1'
    } catch {
      return hasSpec
    }
  })
  useEffect(() => {
    if (!hint) return
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(ONBOARD_KEY, '1')
      } catch {
        // Private-mode storage failures are non-fatal: the hint may reappear.
      }
      setHint(false)
    }, 6000)
    return () => window.clearTimeout(t)
  }, [hint])
  // Achievement telemetry (0.9.5): one panel appearance per dock mount.
  useEffect(() => {
    if (!hasSpec) return
    recordPanel()
  }, [hasSpec])

  // Explicit expand requests (the /panel command) open the dock even when the
  // user collapsed it manually: the monotone token guarantees a fresh request
  // is never mistaken for the previous one.
  useEffect(() => {
    if (expandToken > 0) setCollapsed(false)
  }, [expandToken])

  // Session teardown: the dock is session-scoped, so unmount means the host
  // pruned or destroyed the session's scope. Release the session's panel
  // state (snapshot, ops, overflow diagnostics, expand token) — without this
  // the module-level store grows one entry per session for the app's whole
  // lifetime. A reopen lazily rebuilds from history replays, which is the
  // host's own lifecycle contract.
  useEffect(() => {
    return () => {
      clearSessionPanel(sessionId)
    }
  }, [sessionId])

  // Cleanup safety net: if the component unmounts mid-drag (spec cleared),
  // the window listeners must not outlive it.
  useEffect(() => {
    if (!resizing) return
    return () => {
      dragStart.current = null
    }
  }, [resizing])

  // Template-center flash timer must not outlive the dock.
  useEffect(() => () => window.clearTimeout(flashTimer.current), [])

  /** Start a vertical resize drag on the panel's top edge. Dragging UP grows
   * the panel (the edge moves toward the message flow); dragging down shrinks
   * it. Pointer capture binds move/up/cancel to the HANDLE, so dragging past
   * the element edge keeps tracking and nothing global is registered — no
   * window listeners, nothing to leak on unmount. */
  const startResize = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const handle = e.currentTarget
    // Track from the current committed height (state mirrors the drag, the
    // CSS default otherwise) — no DOM measurement needed.
    const startHeight = bodyHeight ?? 360
    dragStart.current = { y: e.clientY, height: startHeight }
    setResizing(true)
    try {
      handle.setPointerCapture(e.pointerId)
    } catch {
      // jsdom / capture unsupported: listeners below still track the drag.
    }
    const onMove = (ev: PointerEvent): void => {
      const start = dragStart.current
      if (start === null) return
      // Upward drag (clientY decreasing) grows the body height.
      const next = Math.min(PANEL_HEIGHT_MAX, Math.max(PANEL_HEIGHT_MIN, start.height + (start.y - ev.clientY)))
      setBodyHeight(next)
    }
    const onUp = (): void => {
      dragStart.current = null
      setResizing(false)
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }, [bodyHeight])

  if (!hasSpec) return null

  const showFlash = (text: string): void => {
    setFlash(text)
    window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(null), 2500)
  }

  return (
    <div className={css.panel} data-genui-panel>
      {/* Resize grip on the panel's TOP EDGE (above the header): the drag
          target the user described — the outermost top border, not a strip
          under the title. */}
      {!collapsed && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={t('panel.resize.aria')}
          className={`${css.panelResizeHandle}${resizing ? ` ${css.panelResizeHandleActive}` : ''}`}
          onPointerDown={startResize}
        />
      )}
      <div className={css.panelHeader}>
        <button
          type="button"
          className={css.panelToggle}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(c => !c)}
        >
          <span className={css.panelBadge}>{t('panel.badge')}</span>
          <span className={css.panelTitle}>{spec?.title ?? t(drawer !== null ? 'panel.title.explore' : 'panel.title.default')}</span>
          <span className={css.panelChevron} aria-hidden>
            {/* 折叠状态对应的箭头。 */}
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d={collapsed ? 'M12 10L8.70711 6.70711C8.31658 6.31658 7.68342 6.31658 7.29289 6.70711L4 10' : 'M4 6L7.29289 9.29289C7.68342 9.68342 8.31658 9.68342 8.70711 9.29289L12 6'} stroke="currentColor" />
            </svg>
          </span>
        </button>
        {/* Template center (0.9.4): one button — the discovery surface for
            new users and a quick-start entry for everyone. */}
        <button
          type="button"
          className={`${css.panelTpl}${drawer === 'templates' ? ` ${css.panelTplActive}` : ''}`}
          aria-label={t('panel.templates.aria')}
          title={t('panel.templates.title')}
          onClick={() => { setCollapsed(false); setDrawer(d => (d === 'templates' ? null : 'templates')) }}
        >
          {t('panel.templates')}
        </button>
        {/* Achievements (0.9.5): the exploration trophies, rendered by GenUI
            itself (dogfooding). */}
        <button
          type="button"
          className={`${css.panelTpl}${drawer === 'achievements' ? ` ${css.panelTplActive}` : ''}`}
          aria-label={t('panel.achievements.aria')}
          title={t('panel.achievements.title')}
          onClick={() => { setCollapsed(false); setDrawer(d => (d === 'achievements' ? null : 'achievements')) }}
        >
          {t('panel.achievements')}
        </button>
        {/* In-place dismiss (issue #23): the same local override `/panel
            clear` applies — persists to localStorage, notifies subscribers,
            unmounts the dock without any navigation or reload. */}
        <button
          type="button"
          className={css.panelClose}
          aria-label={t('panel.close.aria')}
          title={t('panel.close.aria')}
          onClick={() => setLocalPanel(sessionId, null)}
        >
          <span aria-hidden>✕</span>
        </button>
      </div>
      {hint && drawer === null && (
        <div className={css.panelHint} role="status">
          {t('panel.hint')}
        </div>
      )}
      {!collapsed && (
        <div
          ref={bodyRef}
          className={css.panelBody}
          data-genui-panel-body
          style={bodyHeight === null ? undefined : { height: bodyHeight }}
        >
          {drawer !== null ? (
            <TemplateDrawer
              tab={drawer}
              onUse={(text) => {
                recordTemplateUse()
                insertTemplate(text)
                showFlash(t('panel.flash.inserted'))
              }}
            />
          ) : spec !== null ? (
            <GenuiActionContext.Provider value={sendGenuiAction}>
              {fileLinkContext === undefined
                ? <ErrorBoundary label={t('panel.boundary')}>
                  {/* content-fingerprinted: same panel spec re-published restores its state */}
                  <ExportableGenuiBlock spec={spec} stateKey={panelStateKey(sessionId, JSON.stringify(spec))} />
                </ErrorBoundary>
                : withFileLinkContext(
                  fileLinkContext.ctx,
                  fileLinkContext.availability,
                  sessionId,
                  false,
                  <ErrorBoundary label={t('panel.boundary')}>
                    {/* content-fingerprinted: same panel spec re-published restores its state */}
                    <ExportableGenuiBlock spec={spec} stateKey={panelStateKey(sessionId, JSON.stringify(spec))} />
                  </ErrorBoundary>,
                )}
            </GenuiActionContext.Provider>
          ) : null}
        </div>
      )}
      {flash !== null && (
        <div className={css.panelFlash} role="status">{flash}</div>
      )}
    </div>
  )
}
