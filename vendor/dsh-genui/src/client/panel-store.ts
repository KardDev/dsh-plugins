/**
 * Session GenUI panel store: folds stable per-source panel operations into
 * one read-only snapshot per session. The toolview and the settled-fence
 * publisher submit operations (`replace`/`append`) carrying a stable
 * sourceId and a three-part order; the store deduplicates by source, sorts
 * by order, applies a deterministic fold under a node/append budget, and
 * notifies subscribers only when the folded snapshot actually changes.
 *
 * Ordering: no "last caller wins", no Infinity. Operations from DIFFERENT
 * sources always both apply; replays of the same source are idempotent; a
 * later replace resets everything earlier; an append beyond the budget is
 * remembered as an overflow barrier so an out-of-order earlier replace can
 * re-fold deterministically. A local `/panel` override (default panel or
 * clear) is the fold base and blocks every replay at/below the highest
 * message seq seen so far — old history can never resurrect the panel.
 *
 * Scale limits live in `PANEL_LIMITS` (adjustable defaults, not law — see
 * docs/plans/2026-08-12-dsh-genui-design-optimization.md). Budget
 * rejections are DETERMINISTIC (no LRU eviction: eviction would make the
 * fold depend on arrival order).
 *
 */
import type { GenuiSpec, GenuiTab } from './spec.ts'
import { countGenuiNodes } from './guard.ts'

/** Panel scale limits — adjustable defaults (design doc: scale limits are
 *  configurable, not law). Folds read the CURRENT limits, so tuning applies
 *  from the next operation on. */
export const PANEL_LIMITS = {
  /** Max nodes in the folded panel snapshot. */
  maxNodes: 200,
  /** Max append operations kept after the latest replace. */
  maxAppends: 200,
} as const

type PanelLimits = { maxNodes: number; maxAppends: number }

let limits: PanelLimits = { ...PANEL_LIMITS }

/** Override the panel limits (operator tuning / tests). Applied at the next fold. */
export function setPanelLimits(next: Partial<PanelLimits>): void {
  limits = { ...limits, ...next }
}

/** Three-part stable order: [messageSeq, textBlockIndex, fenceIndex]. */
export type PanelOrder = readonly [number, number, number]

/** One persistent panel operation from a settled source. */
export interface PanelOperation {
  /** Stable source identity (fence source id or `['render_ui', callId]`). */
  sourceId: string
  order: PanelOrder
  mode: 'replace' | 'append'
  spec: GenuiSpec
}

/** Outcome of a fold, committed atomically. */
interface FoldResult {
  snapshot: GenuiSpec | null
  /** Accepted operations (latest replace + accepted appends after it). */
  kept: PanelOperation[]
  /** First append rejected by the budget, or null. */
  overflow: PanelOperation | null
  /** Highest message seq among the candidate ops. */
  maxSeenSeq: number
}

interface SessionPanelState {
  ops: Map<string, PanelOperation>
  /** Every sourceId ever processed (kept or dropped) — the replay dedup
   * register. `ops` only keeps the ops in the current fold, so a consumed op
   * dropped by a later replace used to be indistinguishable from a first
   * arrival and re-folded on history scroll; `seen` makes replays idempotent
   * without breaking genuine out-of-order first arrivals. */
  seen: Map<string, PanelOrder>
  overflow: PanelOperation | null
  /** Local /panel override base; null = cleared. */
  local: GenuiSpec | null
  /** Replays at/below this seq are dead (blocked by the local override). */
  localBarrier: number
  /** Replays at/below this seq are dead (persisted-session hydration barrier;
   * live sessions keep -1 — the seen register covers them). */
  replayBarrier: number
  maxSeenSeq: number
  snapshot: GenuiSpec | null
}

const sessions = new Map<string, SessionPanelState>()
const listeners = new Set<() => void>()

function emptyState(): SessionPanelState {
  return { ops: new Map(), seen: new Map(), overflow: null, local: null, localBarrier: -1, replayBarrier: -1, maxSeenSeq: -1, snapshot: null }
}

/* ---------------- localStorage persistence ---------------- */

const STORAGE_KEY = 'dsh.genui.panel'
/** Max persisted sessions; LRU-evicted on write (the deterministic fold is
 * unaffected — hydration only seeds the fold base, history replays rebuild
 * anything evicted). */
const MAX_PERSISTED_SESSIONS = 50

/** What survives a page reload: the folded snapshot, the local /panel
 * override, and the barriers that keep old replays from resurrecting either. */
interface PersistedPanel {
  snapshot: GenuiSpec | null
  local: GenuiSpec | null
  localBarrier: number
  maxSeenSeq: number
}

interface PanelStorageShape {
  order: string[]
  sessions: Record<string, PersistedPanel>
}

function readPanelStorage(): PanelStorageShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return { order: [], sessions: {} }
    const parsed = JSON.parse(raw) as Partial<PanelStorageShape>
    if (!Array.isArray(parsed.order) || typeof parsed.sessions !== 'object' || parsed.sessions === null) {
      return { order: [], sessions: {} }
    }
    return {
      order: parsed.order.filter(k => typeof k === 'string'),
      sessions: parsed.sessions as Record<string, PersistedPanel>,
    }
  } catch {
    return { order: [], sessions: {} }
  }
}

function writePanelStorage(sessionId: string, entry: PersistedPanel): void {
  try {
    const store = readPanelStorage()
    const order = store.order.filter(k => k !== sessionId)
    order.unshift(sessionId)
    const sessions = { ...store.sessions, [sessionId]: entry }
    while (order.length > MAX_PERSISTED_SESSIONS) {
      const evicted = order.pop()
      if (evicted !== undefined) delete sessions[evicted]
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ order, sessions }))
  } catch {
    // Quota / privacy-mode failures are non-fatal: the panel stays live in
    // memory, only cross-restart persistence is lost.
  }
}

/** Lazy session state: hydrate from localStorage once per session when the
 * in-memory record is absent (first access after a reload). The persisted
 * snapshot + barriers restore the panel instantly; replays at/below the
 * persisted maxSeenSeq are dead, so history scrolling can never resurrect or
 * duplicate content. */
function stateOf(sessionId: string): SessionPanelState {
  const existing = sessions.get(sessionId)
  if (existing !== undefined) return existing
  let state = emptyState()
  try {
    const stored = readPanelStorage().sessions[sessionId]
    if (stored !== undefined) {
      state = {
        ops: new Map(),
        seen: new Map(),
        overflow: null,
        local: stored.local ?? null,
        localBarrier: stored.localBarrier ?? -1,
        replayBarrier: stored.maxSeenSeq ?? -1,
        maxSeenSeq: stored.maxSeenSeq ?? -1,
        snapshot: stored.snapshot ?? null,
      }
    }
  } catch {
    // storage unreadable: behave like a fresh session
  }
  sessions.set(sessionId, state)
  return state
}

function compareOrder(a: PanelOrder, b: PanelOrder): number {
  for (let i = 0; i < 3; i++) {
    const d = a[i]! - b[i]!
    if (d !== 0) return d
  }
  return 0
}

/**
 * Deterministic candidate fold. Returns null when the candidate changes
 * nothing (idempotent replay, replay blocked by the local barrier, or an
 * append later than the overflow barrier); otherwise the state to commit.
 * Never mutates the session state.
 */
function fold(state: SessionPanelState, extra: PanelOperation | null): FoldResult | null {
  if (extra !== null) {
    if (extra.order[0] <= state.localBarrier || extra.order[0] <= state.replayBarrier) return null // old replay under a barrier
    if (state.seen.has(extra.sourceId)) return null // idempotent replay (kept OR previously consumed)
    if (state.overflow !== null && state.overflow.sourceId === extra.sourceId) return null
    if (extra.mode === 'append' && state.overflow !== null && compareOrder(extra.order, state.overflow.order) > 0) {
      // Later than the overflow barrier: rejected without touching the fold.
      return null
    }
  }
  // Only live ops (strictly after both barriers) participate.
  const ops = [...state.ops.values()].filter(op => op.order[0] > state.localBarrier && op.order[0] > state.replayBarrier)
  if (extra !== null) ops.push(extra)
  ops.sort((a, b) => compareOrder(a.order, b.order))
  // The latest VALID replace resets everything before it; start the fold
  // there. (A replace beyond the node budget — only reachable with
  // non-default limits — never becomes the base.)
  let start = 0
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]!
    if (op.mode === 'replace' && countGenuiNodes(op.spec, limits.maxNodes + 1) <= limits.maxNodes) start = i
  }
  let snapshot: GenuiSpec | null = state.local
  let overflow: PanelOperation | null = null
  let appendCount = 0
  const kept: PanelOperation[] = []
  let maxSeenSeq = state.maxSeenSeq
  for (let i = start; i < ops.length; i++) {
    const op = ops[i]!
    if (op.order[0] > maxSeenSeq) maxSeenSeq = op.order[0]
    if (op.mode === 'replace') {
      if (countGenuiNodes(op.spec, limits.maxNodes + 1) > limits.maxNodes) {
        // Pathological replace beyond the node budget: rejected like any
        // over-budget op (remembered as the overflow barrier, fold kept).
        if (overflow === null || compareOrder(op.order, overflow.order) < 0) overflow = op
        continue
      }
      overflow = null
      snapshot = op.spec
      kept.length = 0
      appendCount = 0
      kept.push(op)
      continue
    }
    // Each append is gated independently against the current snapshot — a
    // rejection never retroactively drops ops that already fit.
    const merged = mergePanelSpecs(snapshot, op.spec)
    if (appendCount >= limits.maxAppends
      || countGenuiNodes(merged, limits.maxNodes + 1) > limits.maxNodes) {
      if (overflow === null || compareOrder(op.order, overflow.order) < 0) overflow = op
      continue
    }
    snapshot = merged
    appendCount += 1
    kept.push(op)
  }
  if (extra !== null) {
    const sameSet = kept.length === state.ops.size
      && kept.every(op => state.ops.get(op.sourceId)?.mode === op.mode)
      && ((overflow === null && state.overflow === null)
        || (overflow !== null && state.overflow !== null && overflow.sourceId === state.overflow.sourceId))
    if (sameSet) return null
  }
  return { snapshot, kept, overflow, maxSeenSeq }
}

function commit(state: SessionPanelState, result: FoldResult, sessionId: string): void {
  state.snapshot = result.snapshot
  state.overflow = result.overflow
  state.maxSeenSeq = result.maxSeenSeq
  state.ops = new Map(result.kept.map(op => [op.sourceId, op]))
  // Every processed op joins the replay dedup register — kept or dropped,
  // accepted or overflow-rejected: a history-scroll replay must never
  // re-fold a source the fold already consumed.
  for (const op of result.kept) state.seen.set(op.sourceId, op.order)
  if (result.overflow !== null) state.seen.set(result.overflow.sourceId, result.overflow.order)
  writePanelStorage(sessionId, {
    snapshot: state.snapshot,
    local: state.local,
    localBarrier: state.localBarrier,
    maxSeenSeq: state.maxSeenSeq,
  })
}

export type PanelOperationStatus = 'accepted' | 'idempotent' | 'blocked' | 'overflow'

/**
 * Submit one panel operation. Idempotent per sourceId; ordering and budget
 * per the module doc. Returns the outcome so callers can diagnose once per
 * source (e.g. "panel at its node/appends budget — send a replace").
 */
export function applyPanelOperation(sessionId: string, op: PanelOperation): PanelOperationStatus {
  const state = stateOf(sessionId)
  const result = fold(state, op)
  if (result === null) {
    if (state.seen.has(op.sourceId) || state.overflow?.sourceId === op.sourceId) return 'idempotent'
    // A rejection may come from the replay/local barriers (dead old content
    // — worth one diagnostic) or from the budget overflow barrier (a later
    // append beyond the panel budget — the budget diagnostic covers it).
    const laterThanOverflow = state.overflow !== null
      && op.mode === 'append'
      && compareOrder(op.order, state.overflow.order) > 0
    if (!laterThanOverflow) diagnosePanelBlocked(sessionId, op, state)
    return 'blocked'
  }
  const status: PanelOperationStatus = result.overflow !== null && result.overflow.sourceId === op.sourceId
    ? 'overflow'
    : 'accepted'
  const changed = state.snapshot !== result.snapshot
  commit(state, result, sessionId)
  if (changed) for (const fn of listeners) fn()
  return status
}

/* ---------------- barrier-rejection diagnostics ---------------- */

/** One diagnostic per blocked source per page session (replays stay quiet). */
const diagnosedBlocked = new Set<string>()

/**
 * Log one barrier-rejection diagnostic. Barrier kills are EXPECTED for
 * history replays (the persisted hydration barrier makes replays at/below
 * the persisted max seq dead), so this stays quiet on repeat visits — but a
 * NEW message's fence being blocked is a real defect (broken seq
 * derivation), and the one-time warning makes it observable instead of a
 * silent dock freeze (issue #4 asked for exactly this).
 */
function diagnosePanelBlocked(sessionId: string, op: PanelOperation, state: SessionPanelState): void {
  const key = `${sessionId}\u0000${op.sourceId}`
  if (diagnosedBlocked.has(key)) return
  diagnosedBlocked.add(key)
  console.warn(
    `[genui] 面板操作被重放屏障拒绝（source ${op.sourceId}，order[0]=${op.order[0]} ≤ replayBarrier ${state.replayBarrier} / localBarrier ${state.localBarrier}）。历史消息重放被拒是预期行为；若是刚发送的新消息，说明消息序号推导异常，请报告。`,
  )
}

/* ---------------- local /panel override ---------------- */

/**
 * Apply the local `/panel` override: `spec` (the default panel) or null
 * (clear) becomes the fold base, and every operation at/below the highest
 * message seq seen so far is dead — old history replays cannot resurrect
 * the panel. A later real operation (order[0] > barrier) replaces or merges
 * into the override as usual.
 */
export function setLocalPanel(sessionId: string, spec: GenuiSpec | null): void {
  const state = stateOf(sessionId)
  const barrier = state.maxSeenSeq
  // A clear when local is already null is still a change when the barrier
  // moves: the barrier is what kills old history replays.
  if (state.local === spec && state.localBarrier === barrier) return
  state.local = spec
  state.localBarrier = barrier
  // extra is null here, so fold never rejects the candidate (its null
  // returns live behind the `extra !== null` gate).
  const result = fold(state, null)!
  commit(state, result, sessionId)
  for (const fn of listeners) fn()
}

/** One diagnostic per over-budget source (replays stay silent). */
const diagnosedOverflow = new Set<string>()

/** Log one budget-overflow diagnostic per source (replays stay silent). */
export function diagnosePanelBudget(sessionId: string, sourceId: string): void {
  const key = `${sessionId}\u0000${sourceId}`
  if (diagnosedOverflow.has(key)) return
  diagnosedOverflow.add(key)
  console.warn(
    `[genui] 面板已到节点/操作上限（${limits.maxNodes} 节点、${limits.maxAppends} 条追加），本次 append 被拒绝；请让模型发送 replace 更新面板。`,
  )
}

/** Tear down a session's panel state (session destroy / hard clear). Memory
 * only: drops the in-memory record, the session's expand token, and overflow
 * diagnostics, so a long-lived app never accumulates per-session state for
 * closed sessions. The localStorage entry SURVIVES — reopening the session
 * restores the panel instantly (that is the persistence feature); an explicit
 * user clear goes through setLocalPanel(null), which persists the cleared
 * state + barrier. */
export function clearSessionPanel(sessionId: string): void {
  const had = sessions.delete(sessionId)
  const hadToken = expandTokens.delete(sessionId)
  const prefix = `${sessionId}\u0000`
  for (const key of diagnosedOverflow) {
    if (key.startsWith(prefix)) diagnosedOverflow.delete(key)
  }
  for (const key of diagnosedBlocked) {
    if (key.startsWith(prefix)) diagnosedBlocked.delete(key)
  }
  if (!had && !hadToken) return
  for (const fn of listeners) fn()
  for (const fn of expandListeners) fn()
}

/* ---------------- reads / subscription ---------------- */

/** Current folded spec for a session (useSyncExternalStore getSnapshot).
 * Lazily hydrates from localStorage on first access after a reload. */
export function getPanelSpec(sessionId: string): GenuiSpec | null {
  return stateOf(sessionId).snapshot
}

/** Subscribe to panel changes. Returns the disposer. */
export function subscribePanel(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/* ---------------- incremental append (pure merge) ---------------- */

/** If `spec` is a single root `tabs` node, its tabs; otherwise null. */
function asTabs(spec: GenuiSpec): GenuiTab[] | null {
  if (spec.items.length !== 1) return null
  const only = spec.items[0]
  if (only?.type !== 'tabs' || !Array.isArray(only.tabs)) return null
  return only.tabs
}

/**
 * Merge an `append` spec into the current panel spec:
 * - both sides single-tabs containers → merge BY TAB LABEL: items of
 *   same-labelled tabs are appended, new labels are added (order preserved);
 * - otherwise → plain item lists are appended to the tail.
 * The previous title wins unless it was absent. `next` is returned as-is when
 * there is nothing to merge into. Export for tests.
 */
export function mergePanelSpecs(prev: GenuiSpec | null, next: GenuiSpec): GenuiSpec {
  if (prev === null || prev.items.length === 0) return next
  const title = prev.title ?? next.title
  const base = { ...prev, ...(title === undefined ? {} : { title }) }
  const prevTabs = asTabs(prev)
  const nextTabs = asTabs(next)
  if (prevTabs !== null && nextTabs !== null) {
    const merged = new Map(prevTabs.map(t => [t.label, { label: t.label, items: [...t.items] }]))
    for (const tab of nextTabs) {
      const existing = merged.get(tab.label)
      if (existing !== undefined) existing.items.push(...tab.items)
      else merged.set(tab.label, { label: tab.label, items: [...tab.items] })
    }
    return { ...base, items: [{ type: 'tabs', tabs: [...merged.values()] }] }
  }
  return { ...base, items: [...prev.items, ...next.items] }
}

/* ---------------- expand requests ---------------- */

/**
 * Per-session expand tokens: a monotone counter bumped by every explicit
 * expand request (the /panel slash command). The dock compares the token
 * against its own last-seen value so a fresh request expands the panel even
 * when the user collapsed it manually in between.
 */
const expandTokens = new Map<string, number>()

const expandListeners = new Set<() => void>()

/** Request the panel dock to expand for a session (e.g. the /panel command). */
export function requestPanelExpand(sessionId: string): void {
  expandTokens.set(sessionId, (expandTokens.get(sessionId) ?? 0) + 1)
  for (const fn of expandListeners) fn()
}

/** Current expand token for a session (useSyncExternalStore getSnapshot). */
export function getPanelExpandToken(sessionId: string): number {
  return expandTokens.get(sessionId) ?? 0
}

/** Subscribe to expand requests. Returns the disposer. */
export function subscribePanelExpand(listener: () => void): () => void {
  expandListeners.add(listener)
  return () => {
    expandListeners.delete(listener)
  }
}
