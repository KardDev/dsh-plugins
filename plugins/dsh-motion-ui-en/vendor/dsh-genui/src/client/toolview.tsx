/**
 * The `render_ui` tool's card in the tool row. The host projected the
 * repaired spec into the result's `meta` (the tool's `presentationMeta`);
 * this keyed toolview reads it and renders through GenuiBlock — the same
 * renderer the ```dsh-ui fence uses. Falls back to a compact summary row
 * when the meta is missing or invalid (e.g. a replay of a log recorded
 * before the projection existed).
 *
 * Every settled spec is ALSO published to the session panel store: the
 * conversation dock re-renders the same panel block in place, so repeated
 * render_ui calls update one surface instead of stacking tool-row cards.
 */
import { useEffect, useMemo } from 'react'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import { ExportableGenuiBlock } from './artifact/ExportableGenuiBlock.tsx'
import { ErrorBoundary } from './ErrorBoundary.tsx'
import { repairGenuiSpec } from './guard.ts'
import { toolStateKey } from './interaction-store.ts'
import { applyPanelOperation } from './panel-store.ts'
import css from './GenuiBlock.module.css'

/**
 * Keyed toolview for the `render_ui` tool. `block` is the settled result
 * node once the call completes; while it runs (or on replay without meta)
 * the summary fallback is shown.
 */
export function GenuiToolView({ toolName, block, sessionId }: ToolCallViewProps) {
  // `meta` exists only on the settled result node; running calls (and
  // replayed logs without the projection) fall back to the summary row.
  // Memoized so the publish effect only fires when the settled spec
  // actually changes (same block → same object → no panel churn).
  const meta = 'meta' in block ? block.meta : undefined
  const spec = useMemo(() => (meta === undefined ? null : repairGenuiSpec(meta)), [meta])
  useEffect(() => {
    // Publish the settled spec to the session panel (dock) as a REPLACE op
    // with the result block's call identity and message seq: the same block
    // re-rendered (replay/refresh) is idempotent, and an older result can
    // never clobber a newer panel fence (real ordering in the fold). Running
    // calls publish nothing — the panel keeps its last content.
    if (spec !== null && spec.items.length > 0) {
      applyPanelOperation(sessionId, {
        sourceId: JSON.stringify(['render_ui', block.callId]),
        order: ['seq' in block && typeof block.seq === 'number' ? block.seq : 0, -1, 0],
        mode: 'replace',
        spec,
      })
    }
  }, [sessionId, spec, block])
  if (spec === null || spec.items.length === 0) {
    return (
      <div className={css.toolFallback} data-genui-tool>
        <span className={css.toolFallbackTitle}>{toolName}</span>
        <span className={css.toolFallbackMeta}>{block.callId}</span>
      </div>
    )
  }
  return (
    <div className={css.tool} data-genui-tool>
      <ErrorBoundary label="工具卡片">
        {/* callId is stable across replay → tool-card interaction state is durable */}
        <ExportableGenuiBlock spec={spec} stateKey={toolStateKey(sessionId, block.callId)} />
      </ErrorBoundary>
    </div>
  )
}
