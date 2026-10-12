/**
 * Fence feedback loop (issue #160): a reply whose ```dsh-ui fence the guard
 * cannot render should not stay broken for the reader. The host's
 * `agent/turn-stopping` boundary lets a plugin steer input into the SAME turn —
 * the machine re-reads its inbox and runs another step instead of closing
 * (see the `dsh-agent` runtime contract) — so the model can resend a corrected
 * fence while the user is still looking at the raw JSON.
 *
 * The loop is deliberately narrow, matching the contract agreed on the issue:
 * - **默认开启。** 插件配置中的 `fenceFeedback: false` 可以关闭回合转向。
 * - **修正上限。** 每个 turn 最多发送两条 correction；render failure 和 delivery reminder 共用上限，
 *   每个 fence body 在当前回合中最多修正一次，新回合可重新修正。
 * - **仅含 reasoning 的恢复。** 已验证的 GenUI 回合若只以 reasoning block 结束，使用宿主的
 *   `EMPTY_RESPONSE` retry policy。
 * - **Never for subagents.** A child session's fence belongs to a parent reply.
 * - **Exact fence matching.** Only an info string of exactly `dsh-ui` opens a
 *   fence, so ` ```dsh-ui-dark `, indented prose, or a mention of the name is
 *   never rewritten.
 * - **Accounted before sending.** The fingerprint is recorded before `steer`,
 *   so a re-entrant boundary cannot deliver the same correction twice.
 * - **Cancellation-aware.** An aborted turn or a missing session is left alone.
 *
 * 检查会复用 renderer 在回合结束后的流程，包括 JSON 修复和坏节点清理；
 * 已经可以渲染的最终回复不会收到修正请求。
 * @module @changfenhuang/dsh-genui/plugin/fence-feedback
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import type { Session, SessionEvent, SessionStore, UserMessage } from '@deepseek-ai/dsh-session'
import { createHash, randomUUID } from 'node:crypto'
import { droppedNodeFailure } from './genui-diagnostic.ts'
import { resolveFence } from '../shared/fence-resolve.ts'

/** Plugin name recorded on every message this loop steers. */
export const FEEDBACK_PLUGIN_NAME = '@changfenhuang/dsh-genui'
/** Source kind persisted by this plugin in Session format v4. */
export const FEEDBACK_SOURCE_KIND = `plugin:${FEEDBACK_PLUGIN_NAME}` as const

/** Marker prefix inside the correction text: `[genui-fence-repair #<fingerprint>]`. */
const MARKER_PREFIX = '[genui-fence-repair #'
/**
 * 同一个 turn 内 fence-feedback correction 的共享上限。
 * Render failure 和 nothing-delivered reminder 共用该 budget；各自的 ledger 独立阻止重复修正。
 */
export const MAX_CORRECTIONS_PER_TURN = 2

/** Marker prefix written by older plugin versions. */
const LEGACY_MARKER_PREFIX = '[genui 自修 #'

/** A fence opener is an info string of exactly `dsh-ui` (≤3 spaces indent). */
const FENCE_OPEN = /^ {0,3}```[ \t]*dsh-ui[ \t]*$/u
/** Any fence closer (the renderer never nests fences in one body). */
const FENCE_CLOSE = /^ {0,3}```[ \t]*$/u
/** Upper bound on fences inspected per reply — a reply is text, not a corpus. */
const MAX_FENCES = 40

/** One ```dsh-ui fence found in an assistant reply. */
export interface ExtractedFence {
  /** Raw body between the fences (no delimiters). */
  readonly raw: string
  /** False when the reply ended before the closing fence. */
  readonly closed: boolean
  /** 1-based position among this reply's fences. */
  readonly index: number
}

/**
 * Extract every ```dsh-ui fence from one assistant reply.
 *
 * @param text - the assistant message text.
 * @returns the fences in document order (at most {@link MAX_FENCES}).
 */
export function extractDshUiFences(text: string): ExtractedFence[] {
  const lines = text.split('\n')
  const fences: ExtractedFence[] = []
  let open: { start: number; index: number } | null = null
  for (let line = 0; line < lines.length; line++) {
    const current = lines[line] ?? ''
    if (open === null) {
      if (FENCE_OPEN.test(current)) open = { start: line + 1, index: fences.length + 1 }
      continue
    }
    if (!FENCE_CLOSE.test(current)) continue
    fences.push({ raw: lines.slice(open.start, line).join('\n'), closed: true, index: open.index })
    open = null
    if (fences.length >= MAX_FENCES) return fences
  }
  if (open !== null && fences.length < MAX_FENCES) {
    fences.push({ raw: lines.slice(open.start).join('\n'), closed: false, index: open.index })
  }
  return fences
}

/** Stable, log-safe identity of one fence body (same body → same fingerprint). */
export function fenceFingerprint(raw: string): string {
  return createHash('sha256').update(raw.trim()).digest('hex').slice(0, 12)
}

/** One fence the guard refuses to render, with its model-facing reason. */
export interface FenceFailure {
  readonly index: number
  readonly fingerprint: string
  /** Actionable diagnosis, in the same wording the validator tool uses. */
  readonly detail: string
}

/**
 * Validate every fence in a reply the way the DOM channel would render it.
 *
 * @param text - the assistant message text.
 * @returns the fences that would stay a raw code block, in document order.
 */
export function fenceFailures(text: string): FenceFailure[] {
  const failures: FenceFailure[] = []
  for (const fence of extractDshUiFences(text)) {
    const detail = fenceFailureDetail(fence)
    if (detail !== null) failures.push({ index: fence.index, fingerprint: fenceFingerprint(fence.raw), detail })
  }
  return failures
}

/** `null` when this fence renders; otherwise the reason it does not. */
function fenceFailureDetail(fence: ExtractedFence): string | null {
  if (!fence.closed) return 'error=unterminated_fence\nrequired=closing_fence'
  const resolution = resolveFence(fence.raw, { settled: true })
  if (resolution.spec !== null) return null
  if (resolution.processed !== null) {
    const dropped = droppedNodeFailure(resolution.processed, resolution.value)
    return dropped?.join('\n')
      ?? ['error=invalid_spec', ...resolution.processed.errors.map(error => `diagnostic=${JSON.stringify(error)}`)].join('\n')
  }
  return 'error=invalid_json\nrepair=failed'
}

/**
 * Build the correction input for a reply with unrenderable fences.
 *
 * @param failures - fences {@link fenceFailures} rejected.
 * @returns the message text to steer into the running turn.
 */
export function fenceCorrectionText(failures: readonly FenceFailure[]): string {
  const body = failures
    .map(failure => `fence=${failure.index}\nfingerprint=${failure.fingerprint}\n${failure.detail}`)
    .join('\n\n')
  const marker = failures.map(failure => `${MARKER_PREFIX}${failure.fingerprint}]`).join(' ')
  return `${marker}\n\n[genui-fence-repair]\nstatus=render_failed\nfences=${failures.length}\nnext=resend_corrected_fence_only\nrepeat_rendered_content=false\nreply_language=conversation\n\n${body}\n`
}

/**
 * Create the identified user-role message this loop steers.
 *
 * Mirrors `createUserMessage` from `@deepseek-ai/dsh-llm` (id + role + frozen)
 * without a runtime dependency on that package: the node half of this plugin
 * deliberately imports no `@deepseek-ai/*` values, so a linked or npm-installed
 * copy resolves identically on every host.
 *
 * @param text - the correction text.
 * @param sessionFormatVersion - the format recorded by the active session.
 * @returns a frozen user message attributed to this plugin as a notice.
 */
export function createFeedbackMessage(text: string, sessionFormatVersion: number): UserMessage {
  const source = sessionFormatVersion >= 4
    ? {
        kind: FEEDBACK_SOURCE_KIND,
        form: 'notice' as const,
        summary: 'genui fence repair requested',
      }
    : {
        kind: 'plugin' as const,
        plugin: FEEDBACK_PLUGIN_NAME,
        form: 'notice' as const,
        summary: 'genui fence repair requested',
      }
  const message = {
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text }],
    source,
  }
  Object.freeze(message.content)
  return Object.freeze(message) as unknown as UserMessage
}

/** Per-session bookkeeping for the loop (process lifetime). */
interface SessionFeedback {
  /** Latest assistant reply text of the current turn (fences are read from here). */
  text: string
  /**
   * A `validate_dsh_ui` call happened in this turn. This is the FORMAL signal
   * that the turn is GenUI-related — the loop never guesses intent by scanning
   * the reasoning block.
   */
  validatedThisTurn: boolean
  /** 子代理会话的输出不会直接交给用户。 */
  isSubagent: boolean
  /**
   * The turn delivered something formal: a non-empty body text, or a
   * `render_ui` call whose RESULT reports success. A failed render is not an
   * answer, and a call whose result has not arrived yet proves nothing.
   */
  deliveredThisTurn: boolean
  /**
   * `render_ui` calls of this turn whose result has not arrived yet. The
   * result — not the call — decides delivery, so an outstanding call blocks
   * steering at the boundary instead of being guessed about.
   */
  pendingRenders: Set<string>
  /** Fence fingerprints already corrected for a RENDER failure in the current turn. */
  correctedSpec: Set<string>
  /**
   * Turns already given the "nothing was delivered" reminder. Kept separate from
   * {@link correctedSpec}: a missing delivery must not consume the render-failure
   * ledger (nor the other way round).
   */
  deliveryRemindedTurns: Set<number>
  /** Corrections already steered in {@link correctionsTurn}. */
  correctionsThisTurn: number
  /** Turn {@link correctionsThisTurn} counts. */
  correctionsTurn: number | undefined
  /** 从 session event 中恢复的当前 turn。 */
  currentTurn: number | undefined
  /** 已计入 correction budget 的 message ID。 */
  accountedCorrectionMessageIds: Set<string>
}

/** What the pure planner needs to decide whether a correction may be sent. */
export interface FenceFeedbackPlanInput {
  /** Latest assistant reply text of the current turn. */
  readonly text: string
  readonly turn: number
  /** Fence bodies already corrected for a render failure in the current turn. */
  readonly correctedSpec: ReadonlySet<string>
  /** Turns already given the delivery reminder. */
  readonly deliveryRemindedTurns?: ReadonlySet<number> | undefined
  /** A `validate_dsh_ui` call happened this turn (formal GenUI signal). */
  readonly validatedThisTurn?: boolean | undefined
  /** The turn already delivered a body or a successful `render_ui` result. */
  readonly deliveredThisTurn?: boolean | undefined
  readonly aborted: boolean
  /** Corrections already steered in this turn (shared hard cap). */
  readonly correctionsThisTurn?: number | undefined
  /** Turn {@link correctionsThisTurn} counts (stale counts are ignored). */
  readonly correctionsTurn?: number | undefined
  /** Whether the host has registered the `render_ui` tool. Defaults to enabled. */
  readonly renderUiToolEnabled?: boolean | undefined
}

/** A correction the caller must account for before steering. */
export interface FenceFeedbackPlan {
  readonly text: string
  readonly fingerprints: readonly string[]
  readonly turn: number
  /**
   * `render` corrects a fence that failed to resolve; `delivery` reminds the
   * model that the turn produced nothing formal. They share the per-turn budget
   * but keep separate ledgers.
   */
  readonly kind: 'render' | 'delivery'
}

/**
 * Decide whether this turn boundary should steer a correction — the pure core of
 * the loop, so every bound (per-turn cap, per-fence ledger, cancellation) is
 * testable without a host.
 *
 * The decision is driven by FORMAL events only: fences in the reply body, a
 * `validate_dsh_ui` call, a delivered body text or a successful `render_ui`
 * result. The reasoning block is
 * never read here — a draft inside the thinking block is not proof that the model
 * chose to deliver it, so it must not change any decision.
 *
 * @param input - reply text, turn identity, formal signals, and the accounting.
 * @returns the correction to send, or null when the loop must stay silent.
 */
export function planFenceFeedback(input: FenceFeedbackPlanInput): FenceFeedbackPlan | null {
  if (input.aborted) return null
  const used = input.correctionsTurn === input.turn ? (input.correctionsThisTurn ?? 0) : 0
  if (used >= MAX_CORRECTIONS_PER_TURN) return null
  const failures = fenceFailures(input.text).filter(failure => !input.correctedSpec.has(failure.fingerprint))
  if (failures.length > 0) {
    return {
      text: fenceCorrectionText(failures),
      fingerprints: failures.map(failure => failure.fingerprint),
      turn: input.turn,
      kind: 'render',
    }
  }
  // No un-corrected render failure. If the turn formally validated a spec and
  // then delivered nothing, remind the model once for this turn.
  if (input.validatedThisTurn !== true || input.deliveredThisTurn === true) return null
  if (input.deliveryRemindedTurns?.has(input.turn) === true) return null
  return {
    text: missingBodyCorrectionText(input.turn, used + 1, input.renderUiToolEnabled ?? true),
    fingerprints: [],
    turn: input.turn,
    kind: 'delivery',
  }
}

/**
 * Correction for a validated GenUI turn that reached the boundary without any
 * formal delivery.
 *
 * @param turn - turn that reached the boundary.
 * @param attempt - correction number within the shared turn budget.
 * @param renderUiToolEnabled - whether the correction may recommend `render_ui`.
 * @returns the message text to steer into the running turn.
 */
export function missingBodyCorrectionText(turn: number, attempt = 1, renderUiToolEnabled = true): string {
  const head = `${MARKER_PREFIX}turn-${turn}]\n\n[genui-fence-repair]\nstatus=nothing_delivered\nfences=0\nnext=emit_fence_in_body\nrepeat_rendered_content=false\nreply_language=conversation\n\n`
  const emphasis = attempt <= 1 ? '' : `（第 ${attempt} 次提醒）`
  const renderUiInstruction = renderUiToolEnabled ? '，或明确调用 render_ui' : ''
  return `${head}本轮尚未产生正式回答，也没有通过支持的通道交付结果${emphasis}。请根据用户当前请求完成正式答复；需要 UI 时，在回答正文输出你最终选定的 dsh-ui 围栏${renderUiInstruction}。可以修改或放弃此前候选；不能完成时，请在正文说明原因。\n`
}

/**
 * 将 GenUI 回合中仅含 reasoning 的完整响应转换为宿主已有的可重试空响应错误。
 *
 * @param options - LLM stream waterfall 拦截的请求。
 * @param source - 本次请求的 provider stream。
 * @returns 原始 stream；仅符合条件的终止 stop 会被改写。
 */
async function* retryReasoningOnlyGenuiStream(
  options: GenerateOptions,
  source: AsyncIterable<StreamChunk>,
): AsyncGenerator<StreamChunk> {
  const { EMPTY_RESPONSE_CODE, isAgentLoopRequest } = await import('@deepseek-ai/dsh-llm')
  if (!isAgentLoopRequest(options)) {
    yield* source
    return
  }

  let hasReasoningBlock = false
  let hasOtherBlock = false
  for await (const chunk of source) {
    if (chunk.type === 'block-end') {
      if (chunk.block.type === 'reasoning') hasReasoningBlock = true
      else hasOtherBlock = true
    }
    if (chunk.type === 'finish' && chunk.reason.kind === 'stop' && hasReasoningBlock && !hasOtherBlock) {
      yield {
        type: 'finish',
        reason: {
          kind: 'error',
          failure: {
            message: 'GenUI turn completed with reasoning only and no deliverable response',
            code: EMPTY_RESPONSE_CODE,
          },
        },
      }
    } else {
      yield chunk
    }
  }
}

/** Text of one assistant message's text blocks, in order. */
function textOfContent(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .map(block => {
      if (typeof block !== 'object' || block === null) return ''
      const record = block as { type?: unknown; text?: unknown }
      return record.type === 'text' && typeof record.text === 'string' ? record.text : ''
    })
    .filter(part => part !== '')
    .join('\n')
}

type RenderResultStatus = 'rendered' | 'invalid'

/** 读取 render_ui result protocol 中明确返回的 status。 */
function renderResultStatus(content: unknown): RenderResultStatus | undefined {
  const lines = textOfContent(content).split(/\r?\n/u)
  if (lines[0]?.trim() !== '[genui-render]') return undefined
  for (const line of lines.slice(1)) {
    if (line === 'status=rendered') return 'rendered'
    if (line === 'status=invalid') return 'invalid'
  }
  return undefined
}

interface ObservedToolResult {
  readonly callId: string
  readonly isError: boolean
  readonly content: unknown
}

/** 从 legacy wrapper 与 Session format v4 中提取 tool result 数据。 */
function observedToolResult(message: unknown): ObservedToolResult | null {
  if (typeof message !== 'object' || message === null) return null
  const record = message as { toolCallId?: unknown; isError?: unknown; content?: unknown }
  if (typeof record.toolCallId === 'string') {
    return { callId: record.toolCallId, isError: record.isError === true, content: record.content }
  }
  if (!Array.isArray(record.content)) return null
  const block = record.content.find(part => typeof part === 'object' && part !== null
    && (part as { type?: unknown }).type === 'tool-result') as {
      toolCallId?: unknown
      isError?: unknown
      content?: unknown
    } | undefined
  if (typeof block?.toolCallId !== 'string') return null
  return { callId: block.toolCallId, isError: block.isError === true, content: block.content }
}

/** Tool whose SUCCESSFUL result is a formal delivery. */
const DELIVERY_TOOL = 'render_ui'

/**
 * Whether one assistant message delivered a non-empty body text.
 *
 * Deliberately narrow: a non-empty text block. A `render_ui` call is decided
 * by its `tool/result`, not by the call appearing in a message — a call that
 * failed (or whose result has not arrived) is not a delivery. Other tools
 * (validate_dsh_ui, bash, …) may succeed without producing any answer, so
 * they are NOT counted as delivery.
 *
 * @param content - assistant content blocks.
 * @returns true when this message delivered a body text.
 */
function deliveredBodyText(content: unknown): boolean {
  if (!Array.isArray(content)) return false
  return content.some(block => {
    if (typeof block !== 'object' || block === null) return false
    const record = block as { type?: unknown; text?: unknown }
    return record.type === 'text' && typeof record.text === 'string' && record.text.trim() !== ''
  })
}


interface FeedbackMarkers {
  readonly renderFingerprints: string[]
  readonly deliveryTurns: number[]
}

/** 分类当前与 legacy correction message 中的 marker。 */
function feedbackMarkersIn(text: string): FeedbackMarkers {
  const renderFingerprints: string[] = []
  const deliveryTurns: number[] = []
  let cursor = 0
  while (cursor < text.length) {
    const current = text.indexOf(MARKER_PREFIX, cursor)
    const legacy = text.indexOf(LEGACY_MARKER_PREFIX, cursor)
    if (current < 0 && legacy < 0) break
    const useLegacy = legacy >= 0 && (current < 0 || legacy < current)
    const prefix = useLegacy ? LEGACY_MARKER_PREFIX : MARKER_PREFIX
    const index = useLegacy ? legacy : current
    const end = text.indexOf(']', index + prefix.length)
    if (end < 0) break
    const marker = text.slice(index + prefix.length, end)
    const turn = /^turn-(\d+)$/u.exec(marker)
    if (turn !== null) deliveryTurns.push(Number(turn[1]))
    else renderFingerprints.push(marker)
    cursor = end + 1
  }
  return { renderFingerprints, deliveryTurns }
}

/** 恢复一条持久化 correction 消耗的 turn budget。 */
function accountReplayedCorrection(state: SessionFeedback, turn: number): void {
  if (state.correctionsTurn !== turn) {
    state.correctionsTurn = turn
    state.correctionsThisTurn = 1
    return
  }
  state.correctionsThisTurn = Math.min(MAX_CORRECTIONS_PER_TURN, state.correctionsThisTurn + 1)
}

/** Identify this plugin's source across current and migrated session shapes. */
function isFeedbackSource(source: { kind?: unknown; plugin?: unknown } | undefined): boolean {
  return source?.kind === FEEDBACK_SOURCE_KIND
    || (source?.kind === 'plugin' && source.plugin === FEEDBACK_PLUGIN_NAME)
}

/**
 * 注册 GenUI 回合跟踪、宿主重试判定和可选的围栏修正流程。
 *
 * @param ctx - 宿主 Context。
 * @param enabled - 是否启用同回合围栏修正。
 * @param renderUiToolEnabled - 是否已注册 `render_ui` 工具。
 */
export function installFenceFeedback(ctx: Context, enabled: boolean, renderUiToolEnabled = true): void {
  const sessions = new Map<string, SessionFeedback>()
  const stateOf = (sessionId: string): SessionFeedback => {
    let state = sessions.get(sessionId)
    if (state === undefined) {
      state = {
        text: '',
        validatedThisTurn: false,
        isSubagent: false,
        deliveredThisTurn: false,
        pendingRenders: new Set(),
        correctedSpec: new Set(),
        deliveryRemindedTurns: new Set(),
        correctionsThisTurn: 0,
        correctionsTurn: undefined,
        currentTurn: undefined,
        accountedCorrectionMessageIds: new Set(),
      }
      sessions.set(sessionId, state)
    }
    return state
  }

  ctx.on('session/disposed', (session): void => {
    sessions.delete(String(session.id))
  })

  const resetTurnState = (state: SessionFeedback, turn: number | undefined): void => {
    state.text = ''
    state.validatedThisTurn = false
    state.deliveredThisTurn = false
    state.pendingRenders.clear()
    state.currentTurn = turn
  }

  const observeEvent = (session: Session, event: SessionEvent): void => {
    const sessionId = String(session.id)
    if (event.type === 'turn/start') {
      // The formal turn boundary: whatever happened in the previous turn is
      // settled and this turn starts clean. The `user/message` reset below is
      // only a fallback for direct prompts.
      const state = stateOf(sessionId)
      state.isSubagent = session.header.parentSession !== undefined
      // 去重只约束当前回合，新一轮仍可修正相同错误。
      state.correctedSpec.clear()
      resetTurnState(state, (event.data as { turn?: number }).turn)
      return
    }
    if (event.type === 'assistant/message') {
      const content = (event.data as { message?: { content?: unknown } }).message?.content
      const text = textOfContent(content)
      const state = stateOf(sessionId)
      state.isSubagent = session.header.parentSession !== undefined
      // Fences are read from the BODY only: a draft in the reasoning block is not
      // a delivery and must not become one.
      state.text = extractDshUiFences(text).length > 0 ? text : ''
      // Delivery is sticky for the turn: once a body text exists, the turn has
      // answered and must never be corrected into publishing again. A
      // `render_ui` call in the content proves nothing here — its result does.
      state.deliveredThisTurn = state.deliveredThisTurn || deliveredBodyText(content)
      return
    }
    if (event.type === 'tool/call') {
      const data = event.data as { name?: unknown; callId?: unknown }
      const state = stateOf(sessionId)
      state.isSubagent = session.header.parentSession !== undefined
      // validate_dsh_ui is the FORMAL signal that this turn is GenUI-related.
      if (data.name === 'validate_dsh_ui') state.validatedThisTurn = true
      // The result — not the call — decides whether render_ui delivered.
      if (data.name === DELIVERY_TOOL && typeof data.callId === 'string') {
        state.pendingRenders.add(data.callId)
      }
      return
    }
    if (event.type === 'tool/result') {
      const data = event.data as { message?: unknown; error?: unknown }
      const result = observedToolResult(data.message)
      if (result === null) return
      const state = stateOf(sessionId)
      state.isSubagent = session.header.parentSession !== undefined
      if (!state.pendingRenders.delete(result.callId)) return
      if (data.error === undefined && result.isError !== true && renderResultStatus(result.content) === 'rendered') {
        state.deliveredThisTurn = true
      }
      return
    }
    if (event.type !== 'user/message') return
    const data = event.data as { id?: unknown; content?: unknown; source?: { kind?: unknown; plugin?: unknown } }
    if (isFeedbackSource(data.source)) {
      const markers = feedbackMarkersIn(textOfContent(data.content))
      if (markers.renderFingerprints.length === 0 && markers.deliveryTurns.length === 0) return
      const state = stateOf(sessionId)
      state.isSubagent = session.header.parentSession !== undefined
      for (const fingerprint of markers.renderFingerprints) state.correctedSpec.add(fingerprint)
      for (const turn of markers.deliveryTurns) state.deliveryRemindedTurns.add(turn)
      if (typeof data.id === 'string' && !state.accountedCorrectionMessageIds.has(data.id)) {
        state.accountedCorrectionMessageIds.add(data.id)
        const turn = markers.deliveryTurns[0] ?? state.currentTurn
        if (turn !== undefined) accountReplayedCorrection(state, turn)
      }
      return
    }
    // A DIRECT human prompt starts a new turn: the previous reply is settled.
    // Synthetic context that rides the same user surface — `agent.inject()`
    // notices, team member messages — carries a different source kind and
    // arrives MID-TURN: resetting here used to wipe the turn's validation and
    // delivery state before the boundary could use it.
    if (data.source?.kind !== 'user') return
    const state = sessions.get(sessionId)
    if (state !== undefined) {
      state.isSubagent = session.header.parentSession !== undefined
      // turn/start 先于用户消息；清掉正文状态时保留正式回合身份。
      resetTurnState(state, state.currentTurn)
    }
  }

  const restoreHistory = (session: Session): void => {
    if (sessions.has(String(session.id))) return
    for (const event of session.snapshotEvents()) observeEvent(session, event)
  }
  ctx.on('session/event', (session, event) => {
    // 服务注入是异步的；首条实时事件也先接管历史，避免丢失旧纠错次数。
    restoreHistory(session)
    observeEvent(session, event)
  })
  ctx.on('session/created', restoreHistory)
  const restoreSessions = (sessionCtx: Context): void => {
    const store = sessionCtx.reflect.get('sessions') as SessionStore | undefined
    if (store === undefined) return
    for (const session of store.list()) restoreHistory(session)
  }
  // 宿主不重播历史；安装时同步接管已有会话，异步注入负责晚到的服务。
  restoreSessions(ctx)
  ctx.inject(['sessions'], restoreSessions)

  ctx.on('llm/stream', (options, next) => {
    if (options.sessionId === undefined || options.purpose !== undefined) return next()
    const state = sessions.get(String(options.sessionId))
    if (state?.validatedThisTurn !== true || state.isSubagent) return next()
    return retryReasoningOnlyGenuiStream(options, next())
  }, { global: true })

  ctx.on('agent/turn-stopping', ({ agent, turn, signal }): void => {
    if (!enabled) return
    // A child session's fence belongs to a parent reply, and an aborted turn is
    // on its way out: never steer into either.
    if (agent.session.header.parentSession !== undefined) return
    const state = sessions.get(String(agent.session.id))
    if (state === undefined) return
    state.currentTurn = turn
    // A render_ui result still outstanding could deliver (or fail) after this
    // boundary fires: steering now would race the late result, so stay silent
    // and let the next boundary decide on settled facts.
    if (state.pendingRenders.size > 0) return
    const usedThisTurn = state.correctionsTurn === turn ? state.correctionsThisTurn : 0
    const plan = planFenceFeedback({
      text: state.text,
      turn,
      correctedSpec: state.correctedSpec,
      deliveryRemindedTurns: state.deliveryRemindedTurns,
      validatedThisTurn: state.validatedThisTurn,
      deliveredThisTurn: state.deliveredThisTurn,
      aborted: signal.aborted,
      correctionsThisTurn: usedThisTurn,
      correctionsTurn: state.correctionsTurn,
      renderUiToolEnabled,
    })
    if (plan === null) return
    // Account BEFORE sending: a re-entrant boundary must not deliver twice.
    for (const fingerprint of plan.fingerprints) state.correctedSpec.add(fingerprint)
    if (plan.kind === 'delivery') state.deliveryRemindedTurns.add(plan.turn)
    state.correctionsTurn = plan.turn
    state.correctionsThisTurn = usedThisTurn + 1
    try {
      const message = createFeedbackMessage(plan.text, agent.session.header.version)
      state.accountedCorrectionMessageIds.add(message.id)
      agent.steer(message)
    } catch (error) {
      ctx.logger?.warn?.(`dsh-genui: fence feedback steering failed (${error instanceof Error ? error.message : String(error)})`)
    }
  })
}
