/**
 * Interaction-state store: durable per-block GenUI interaction state
 * (radio answers, checkbox groups, submit lock, input/textarea values) in
 * localStorage.
 *
 * LOCAL-FIRST persistence: a ```dsh-ui block's interactive state survives
 * page refresh and session reopen because it is keyed by
 * `session + block slot + content fingerprint` — replaying the same message
 * (same content) restores the exact state, while NEW content (换题, edited
 * spec) gets a fresh key and thus a clean slate. Different messages never
 * share state because their content fingerprints differ.
 *
 * Bounded: at most MAX_BLOCKS entries, LRU-evicted on write; each block's
 * payload is small (answer maps + a few field values).
 * @module @changfenhuang/dsh-genui/client/interaction-store
 */

/** Durable state of one UI block. */
export interface BlockInteractionState {
  /** group → chosen option label (radio aggregation answers). */
  answers?: Record<string, string>
  /** group → chosen option labels (checkbox aggregation answers). Empty arrays
   * are retained so an explicitly cleared group wins over `checked` defaults
   * after refresh. */
  multiAnswers?: Record<string, string[]>
  /** True after a local grading: the paper stays graded across refresh. */
  locked?: boolean
  /** field id → current value (input/textarea with an `id`). */
  fields?: Record<string, string>
}

const STORE_KEY = 'dsh.genui.interaction'
/** Max tracked blocks; LRU eviction keeps the store bounded. */
const MAX_BLOCKS = 200

interface StoreShape {
  /** Block keys in most-recently-written order (index 0 = newest). */
  order: string[]
  blocks: Record<string, BlockInteractionState>
}

function emptyStore(): StoreShape {
  return { order: [], blocks: {} }
}

function readStore(): StoreShape {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw === null) return emptyStore()
    const parsed = JSON.parse(raw) as Partial<StoreShape>
    if (!Array.isArray(parsed.order) || typeof parsed.blocks !== 'object' || parsed.blocks === null) {
      return emptyStore()
    }
    return { order: parsed.order.filter(k => typeof k === 'string'), blocks: parsed.blocks as Record<string, BlockInteractionState> }
  } catch {
    return emptyStore()
  }
}

function writeStore(store: StoreShape): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store))
  } catch {
    // Quota / privacy-mode failures are non-fatal: interaction stays live
    // in memory, only the persistence is lost.
  }
}

/** Load a block's durable state, or null when absent/corrupt. */
export function loadBlockState(stateKey: string): BlockInteractionState | null {
  if (stateKey === '') return null
  const store = readStore()
  return store.blocks[stateKey] ?? null
}

/** Save a block's durable state (LRU: touched keys move to the front). */
export function saveBlockState(stateKey: string, state: BlockInteractionState): void {
  if (stateKey === '') return
  const store = readStore()
  const order = store.order.filter(k => k !== stateKey)
  order.unshift(stateKey)
  const blocks = { ...store.blocks, [stateKey]: state }
  while (order.length > MAX_BLOCKS) {
    const evicted = order.pop()
    if (evicted !== undefined) delete blocks[evicted]
  }
  writeStore({ order, blocks })
}

/** Forget a block's durable state (e.g. after a reset-to-empty). */
export function clearBlockState(stateKey: string): void {
  if (stateKey === '') return
  const store = readStore()
  if (!(stateKey in store.blocks)) return
  const blocks = { ...store.blocks }
  delete blocks[stateKey]
  writeStore({ order: store.order.filter(k => k !== stateKey), blocks })
}

/**
 * Deterministic content fingerprint (djb2) for a block's raw fence body.
 * Two render passes of the SAME content share a fingerprint (state restores);
 * edited content gets a new one (fresh state). Not a security hash — the
 * store only uses it for equality/identity.
 */
export function fingerprint(raw: string): string {
  let h = 5381
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) + h + raw.charCodeAt(i)) >>> 0
  }
  return h.toString(36)
}

/** Build the durable state key for a fence block: session + fence slot + content fingerprint. */
export function fenceStateKey(sessionId: string, fenceKey: number | string, raw: string): string {
  return `f:${sessionId}:${String(fenceKey)}:${fingerprint(raw)}`
}

/** Build the durable state key for a panel publish (content-keyed). */
export function panelStateKey(sessionId: string, raw: string): string {
  return `p:${sessionId}:${fingerprint(raw)}`
}

/** Build the durable state key for a render_ui tool card (call-keyed). */
export function toolStateKey(sessionId: string, callId: string): string {
  return `t:${sessionId}:${callId}`
}
