/**
 * The dsh-ui fence render pipeline, shared by both render channels:
 *
 * - **Registry channel** (contract hosts): the host's MarkdownText resolves
 *   ```dsh-ui fences through the fence-registry extension point and calls
 *   {@link renderGenuiFence} with a session-scoped context (sessionId + the
 *   settled source identity). An unrepairable body renders {@link FenceFallback}.
 * - **DOM channel** (pristine hosts, no extension point): the DOM observer
 *   (`dom-fence.ts`) finds stock code blocks labelled `dsh-ui` and mounts
 *   {@link renderResolvedFenceNode} into its own React root, wrapped in the
 *   plugin-owned action context. An unrepairable body returns `null` so the
 *   stock code block stays visible, with {@link FenceDiagnostic} mounted above
 *   it so the defect is never silent (issue #158).
 *
 * Structural types are declared locally on purpose: the context contract is
 * a data shape, and pristine hosts do not export the host-side type names.
 */
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type Key, type ReactNode } from 'react'
import { CodeBlock } from '@deepseek-ai/dsh-client-ui-primitives'
import { codeBlockLabels } from './primitive-labels.ts'
import { t, useT } from './i18n/index.ts'
import { ErrorBoundary } from './ErrorBoundary.tsx'
import { ExportableGenuiBlock } from './artifact/ExportableGenuiBlock.tsx'
import { fenceStateKey } from './interaction-store.ts'
import { applyPanelOperation, diagnosePanelBudget, type PanelOperationStatus } from './panel-store.ts'
import type { GenuiSpec } from './spec.ts'
import { describeJsonFailure, isCompleteJson } from '../shared/fence-repair.ts'
import { resolveFence, resolveFenceSpec, type FenceResolution } from '../shared/fence-resolve.ts'

/** Settled fence source identity (data shape, host-independent). */
export interface GenuiFenceSource {
  /** Stable structural id, e.g. `['assistant', seq, block, fence]` or `dom:<anchor>:<i>`. */
  readonly id: string
  /** Three-part order: [messageSeq, textBlockIndex, fenceIndex]. */
  readonly order: readonly [number, number, number]
}

/** Context a fence renderer receives beside the raw source and React key. */
export interface GenuiFenceContext {
  /** Owning session route; absent outside a session-scoped render. */
  readonly sessionId?: string
  /** Present only for settled/interrupted renders with a stable identity. */
  readonly source?: GenuiFenceSource
}

const FENCE_ERROR_STYLE: CSSProperties = {
  margin: '0 0 6px',
  padding: '6px 10px',
  borderRadius: 6,
  background: 'rgba(239, 68, 68, 0.14)',
  border: '1px solid rgba(239, 68, 68, 0.4)',
  color: '#f87171',
  fontSize: 12,
  lineHeight: 1.55,
  whiteSpace: 'pre-wrap',
}

/** Format chart-specific process errors without maintaining a second validator. */
function formatChartProcessErrors(errors: string[]): string | null {
  const chartErrors = errors.filter(error => /(?:variant is unsupported|kind must be bars, line, or donut|requires data or series|(?:data|series) is required for|(?:\.data|\.series)(?:\[\d+\])?(?:\.(?:data|label|value|color))? must|series is only supported for bars)/.test(error))
  return chartErrors.length === 0 ? null : chartErrors.join('；')
}

/** Return a semantic/schema diagnostic from the unified fence resolution. */
function processSemanticFailure(resolution: FenceResolution): string | null {
  if (resolution.spec !== null || resolution.processed === null) return null
  const chartErrors = formatChartProcessErrors(resolution.processed.errors)
  return chartErrors === null
    ? t('err.fieldValidation', { errors: resolution.processed.errors.join('；') })
    : t('err.chartValidation', { errors: chartErrors })
}

/**
 * Fallback for a ```dsh-ui fence whose body has no finished component yet.
 * Two very different situations land here and they must not be conflated:
 *
 * 1. **Streaming partial** — the reply is still being written and the JSON
 *    simply is not complete. The host marks the streaming message with
 *    `[data-streaming]` on the AssistantMarkdown root, which is an ancestor
 *    of every fence. While that marker is present, a plain code block is the
 *    correct rendering (partial JSON must never look like an error).
 *
 * 2. **Settled defect** — the message is finished but the body still does
 *    not parse as JSON (a malformed fence like a missing `}`) or violates the
 *    native chart contract. This used to fail silently: the fence degraded to
 *    a code block with no hint, and the author had no way to know the UI never
 *    rendered. Once the streaming marker is gone, surface a compact diagnostic
 *    so the defect is visible instead of silent.
 */
/**
 * Explain why a ```dsh-ui body cannot render, as the one-line message both
 * channels show. Returns null when there is nothing to report (the body is
 * renderable, or it is an empty/streaming half).
 *
 * @param raw - the raw fence body.
 * @param options - whether settled-only structural repair may be used.
 * @returns the diagnostic text, or null.
 */
export function describeFenceFailure(raw: string, options: { settled?: boolean } = {}): string | null {
  const resolution = resolveFence(raw, { settled: options.settled ?? true })
  if (resolution.spec !== null) return null
  const processDiagnostic = processSemanticFailure(resolution)
  if (processDiagnostic !== null) {
    return t('err.fenceKeptAsCode', { diagnostic: processDiagnostic })
  }
  if (raw.trim() === '') return null
  const parseDiagnostic = describeJsonFailure(raw)
  if (parseDiagnostic === null) return null
  return t('err.fenceParse', { diagnostic: parseDiagnostic })
}

/**
 * The visible diagnostic for a settled, unrenderable ```dsh-ui body.
 *
 * Shared by both channels: the registry channel renders it above its own
 * fallback code block, the DOM channel above the host's stock code block. A
 * fence that keeps degrading to raw JSON must say why it degraded — the
 * console-only path left the defect invisible (issues #158/#172).
 *
 * @param raw - the raw fence body.
 * @returns the alert strip, or null when the body has nothing to report.
 */
export function FenceDiagnostic({ raw, settled = false }: { raw: string; settled?: boolean }): ReactNode {
  // Subscribe so a language switch re-renders an already-visible diagnostic.
  useT()
  const message = describeFenceFailure(raw, { settled })
  if (message === null) return null
  return <div style={FENCE_ERROR_STYLE} role="alert">{message}</div>
}

function FenceFallback({ raw, fenceKey }: { raw: string; fenceKey: Key }) {
  // Subscribed for the CodeBlock copy labels below.
  useT()
  const ref = useRef<HTMLDivElement | null>(null)
  const [settled, setSettled] = useState(false)
  useLayoutEffect(() => {
    const node = ref.current
    if (node !== null && node.closest('[data-streaming]') === null) setSettled(true)
  })
  const diagnostic = settled ? <FenceDiagnostic raw={raw} /> : null
  return (
    <div ref={ref}>
      {diagnostic}
      <CodeBlock key={fenceKey} {...codeBlockLabels()} code={`${raw}\n`} lang="dsh-ui" />
    </div>
  )
}

/**
 * Keyed publisher for a settled `panel:true` fence: submits ONE panel
 * operation from the host-provided stable source (id + order), in an
 * effect — never inside the render function. StrictMode's duplicate effects
 * are absorbed by the operation map's per-source dedup, so the panel folds
 * and notifies exactly once per source. Renders nothing.
 */
function FencePanelPublisher({ sessionId, sourceId, order, spec }: {
  sessionId: string
  sourceId: string
  order: readonly [number, number, number]
  spec: GenuiSpec
}) {
  useEffect(() => {
    const status: PanelOperationStatus = applyPanelOperation(sessionId, {
      sourceId,
      order,
      mode: spec.append === true ? 'append' : 'replace',
      spec,
    })
    if (status === 'overflow') diagnosePanelBudget(sessionId, sourceId)
  }, [sessionId, sourceId, order, spec])
  return null
}

/**
 * Resolve a raw fence body to a guarded spec.
 *
 * - Tier-1 repair (quote escape + trailing commas): safe at any time —
 *   adopted only when the whole body parses, so a still-growing streaming
 *   half keeps falling back to the code block, never flashing a banner.
 * - Tier-2 completion (missing quotes/brackets): settled renders only —
 *   `context.source` exists exclusively once the message finished, so
 *   streaming halves are never completed early.
 * - Native chart semantics are checked before repair on every candidate so
 *   aliases, empty collections, or line/donut series cannot repair into a
 *   default/blank chart.
 */
export function resolveGenuiSpec(raw: string, context?: GenuiFenceContext): GenuiSpec | null {
  return resolveFenceSpec(raw, { settled: context?.source !== undefined })
}

/** The inline GenuiBlock tree for a resolved non-panel spec. */
function renderInlineFence(key: Key, context: GenuiFenceContext | undefined, spec: GenuiSpec): ReactNode {
  const sessionId = context?.sessionId
  const stateKey = sessionId === undefined || context?.source === undefined
    ? undefined
    : fenceStateKey(sessionId, context.source.id, JSON.stringify(spec))
  return (
    // Keep the document slot mounted across streaming→settled; GenuiBlock
    // owns durable-state changes, while a session change resets the tree.
    // Repaired specs render SILENTLY: once the UI renders, no amber note
    // tells the user something was wrong — only an unrecoverable body keeps
    // the red diagnostic.
    <ErrorBoundary key={JSON.stringify([sessionId, key])} label={t('err.boundary.fence')}>
      <ExportableGenuiBlock spec={spec} animateEntrance={context?.source === undefined} stateKey={stateKey} exportEnabled={context?.source !== undefined} />
    </ErrorBoundary>
  )
}

/**
 * The resolved fence render for the DOM channel: `null` when the body is
 * unrepairable (the stock code block stays visible), otherwise the panel
 * publisher (`panel:true`; renders nothing in the flow — mounted as an empty
 * root so the taken-over block is hidden) or the inline GenuiBlock tree.
 * Shared verbatim by both channels.
 */
export function renderResolvedFenceNode(raw: string, key: Key, context?: GenuiFenceContext): ReactNode | null {
  const spec = resolveGenuiSpec(raw, context)
  if (spec === null) return null
  if (spec.panel === true) {
    // Publish only with a settled stable source — streaming/identity-less
    // renders keep the panel untouched. Appends additionally gate on a
    // complete body (a settled-but-malformed append never merges partial
    // content).
    if (context !== undefined && context.sessionId !== undefined && context.source !== undefined) {
      if (spec.append === true && !isCompleteJson(raw)) return <Fragment key={key} />
      return (
        <FencePanelPublisher
          key={key}
          sessionId={context.sessionId}
          sourceId={context.source.id}
          order={context.source.order}
          spec={spec}
        />
      )
    }
    return <Fragment key={key} />
  }
  return renderInlineFence(key, context, spec)
}

/**
 * Registry-channel fence renderer (contract hosts): like the resolved node,
 * but an unrepairable body renders the fallback code block + settled
 * diagnostic — the host replaced its own block with our output — and an
 * unpublishable `panel:true` fence renders `null` (nothing in the flow).
 */
export function renderGenuiFence(raw: string, key: Key, context?: GenuiFenceContext): ReactNode {
  const spec = resolveGenuiSpec(raw, context)
  if (spec === null) return <FenceFallback key={key} fenceKey={key} raw={raw} />
  if (spec.panel === true) {
    if (context !== undefined && context.sessionId !== undefined && context.source !== undefined) {
      if (spec.append === true && !isCompleteJson(raw)) return null
      return (
        <FencePanelPublisher
          key={key}
          sessionId={context.sessionId}
          sourceId={context.source.id}
          order={context.source.order}
          spec={spec}
        />
      )
    }
    return null
  }
  return renderInlineFence(key, context, spec)
}
