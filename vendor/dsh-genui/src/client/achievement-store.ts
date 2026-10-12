/**
 * achievement-store.ts — 成就状态存储与埋点入口（模块级单例）。
 *
 * 只存计数与解锁时间戳；绝不含消息/内容。localStorage 持久化，
 * 订阅接口供 toast 与成就页消费。埋点入口：
 *  - recordFence(spec)：一次「内容不重复」的界面渲染（按 spec 指纹去重，
 *    LRU 指纹表跨刷新防重放重复计数）
 *  - recordPanel()：面板 dock 出现
 *  - recordInteraction()：组件动作回传（去抖后）
 *  - recordTemplateUse()：模板中心试用
 */
import type { GenuiSpec } from './spec.ts'
import { ACHIEVEMENTS, checkAchievements, countSpecKinds, emptyState, type AchieveState, type AchievementDef } from './achievements.ts'

const STORE_KEY = 'dsh.genui.achievements'
const SEEN_KEY = 'dsh.genui.achievements.seen'
const SEEN_MAX = 200

interface AchieveStore {
  state: AchieveState
  unlocked: Record<string, number>
}

let store: AchieveStore = loadStore()
const listeners = new Set<() => void>()
/** 解锁 toast 队列（FIFO；成就页打开时也读）。 */
let toastQueue: AchievementDef[] = []

function loadStore(): AchieveStore {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw === null) return { state: emptyState(), unlocked: {} }
    const parsed = JSON.parse(raw) as Partial<AchieveStore>
    const state = { ...emptyState(), ...(parsed.state ?? {}) }
    return { state, unlocked: typeof parsed.unlocked === 'object' && parsed.unlocked !== null ? parsed.unlocked as Record<string, number> : {} }
  } catch {
    return { state: emptyState(), unlocked: {} }
  }
}

function saveStore(): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store))
  } catch {
    // Quota / privacy-mode failures are non-fatal: achievements still tick
    // in memory for this page session.
  }
}

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    if (raw === null) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function writeSeen(list: string[]): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(list.slice(0, SEEN_MAX)))
  } catch {
    // non-fatal
  }
}

function emit(): void {
  for (const listener of listeners) listener()
}

/** 应用一次状态更新：持久化 + 检查新解锁（进 toast 队列）+ 通知订阅者。 */
function applyDelta(patch: Partial<AchieveState>): void {
  store.state = { ...store.state, ...patch }
  const fresh = checkAchievements(store.state, store.unlocked)
  for (const ach of fresh) store.unlocked[ach.id] = Date.now()
  if (fresh.length > 0) toastQueue.push(...fresh)
  saveStore()
  emit()
}

/** 53-bit string hash (cyrb53-style): dedupe fingerprints are stored as
 *  hashes, never as the serialized spec itself — localStorage must not
 *  persist conversation-derived content (table rows, text, …). */
function fingerprintOf(spec: GenuiSpec): string {
  const s = JSON.stringify(spec)
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  return `${(h1 >>> 0).toString(36)}-${(h2 >>> 0).toString(36)}`
}

/** 记录一次「内容不重复」的 fence 渲染。 */
export function recordFence(spec: GenuiSpec): void {
  const fingerprint = fingerprintOf(spec)
  const seen = readSeen()
  if (seen.includes(fingerprint)) return
  writeSeen([fingerprint, ...seen])
  const kinds = countSpecKinds(spec)
  applyDelta({
    fences: store.state.fences + 1,
    charts: store.state.charts + (kinds.charts > 0 ? 1 : 0),
    advanced: store.state.advanced + (kinds.advanced > 0 ? 1 : 0),
  })
}

/** 记录一次面板 dock 出现（仅会话从无到有时）。 */
export function recordPanel(): void {
  applyDelta({ panels: store.state.panels + 1 })
}

/** 记录一次组件交互动作回传。 */
export function recordInteraction(): void {
  applyDelta({ interactions: store.state.interactions + 1 })
}

/** 记录一次模板试用。 */
export function recordTemplateUse(): void {
  applyDelta({ templates: store.state.templates + 1 })
}

/** 当前状态快照（订阅者读取）。 */
export function getAchievementSnapshot(): { state: AchieveState, unlocked: Record<string, number> } {
  return store
}

/** 取走新解锁（toast 消费；一次性）。 */
export function consumeUnlocks(): AchievementDef[] {
  const queue = toastQueue
  toastQueue = []
  return queue
}

/** 订阅状态变化（toast 与成就页）。 */
export function subscribeAchievements(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 成就页 spec 数据源（面板内渲染用）。 */
export function achievementCount(): { total: number, unlocked: number } {
  return {
    total: ACHIEVEMENTS.length,
    unlocked: ACHIEVEMENTS.filter(a => store.unlocked[a.id] !== undefined).length,
  }
}
