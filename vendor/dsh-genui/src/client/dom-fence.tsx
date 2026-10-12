/**
 * DOM render channel: pure-plugin fence rendering for pristine hosts.
 *
 * Stock DSH renders every fenced code block through the shared CodeBlock
 * surface (stable class `md-code-block`, language label rendered as the
 * banner's childless label div). This channel observes the conversation DOM,
 * finds blocks labelled `dsh-ui` or complete `<dsh-ui>…</dsh-ui>` text spans,
 * parses the raw fence body and mounts the plugin's own React tree next to
 * the hidden host element:
 *
 * Fence discovery is **multi-surface** (issue #6): besides `md-code-block`,
 * the channel also matches the deepsuite-style surfaces some host builds
 * render instead (`.code-block` / `.code-block-small`), and — as the
 * structural backstop — ANY element whose banner labels it `dsh-ui` and
 * which contains a `<pre>` body. The only invariants are the language label
 * (a leaf element with the exact text `dsh-ui`, outside the code body) and
 * the `<pre>`. Desktop 0.11.0 instead emits a plain-text tag span for the
 * same fence; the DOM channel recognizes that exact wrapper in assistant
 * messages:
 *
 * - **Streaming takeover**: the channel takes over a dsh-ui block as soon as
 *   ONE finished component parses (the partial parser), and re-renders the
 *   root as the body grows — the UI assembles top-down while the reply
 *   streams, no settled marker required. A body with no finished component
 *   yet stays a stock code block (partial JSON must never look broken).
 * - **Pre-paint surgery repair**: the host's React re-renders during
 *   streaming can wipe our foreign container or reset the hide. A repair
 *   pass in the MutationObserver microtask re-applies the surgery before
 *   paint (same pattern the annotation plugin proved on this host), and the
 *   1s sweep is the backstop.
 * - **Settled transition**: when `[data-streaming]` leaves the row, the
 *   mount re-renders with the stable source identity — the moment panels
 *   publish and durable state keys in (mirrors the registry channel's
 *   settled-source semantics; streaming renders are identity-less).
 * - **Visible failure**: a settled block that stays a code block (malformed
 *   JSON, guard rejection, chart contract) mounts {@link FenceDiagnostic}
 *   above the stock block. Console-only reporting made the defect invisible to
 *   the person who wrote the fence (issue #158); the raw body is preserved.
 * - Stable identity: the owning row's `data-chat-anchor-key` (session-stable,
 *   seq-derived) + the fence's ordinal among settled dsh-ui blocks in that
 *   row. `sourceId = dom:<anchor>:<ordinal>` feeds panel dedup and durable
 *   state.
 * - Actions ride the plugin-owned GenuiActionContext provider: every tree
 *   this channel mounts is wrapped with a handler that relays
 *   `[genui-action]` through the scoped conversation send — no host plumbing.
 * - Removal (branch switch, unload): each mount is unmounted with its root,
 *   and the stock block is restored.
 *
 * Security posture matches the registry channel: only code shipped in this
 * plugin's browser bundle mounts React roots, the model can only author
 * fence text, and unrepairable bodies remain visible in their host form.
 */
import { Fragment, isValidElement, type Key, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ChatNode, ChatSnapshot } from '@deepseek-ai/dsh-client-ui-chat/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { GenuiActionContext, type GenuiActionHandler } from './action-context.ts'
import { withFileLinkContext, type FileLinkAvailability, type FileLinkCordisContext } from './file-link-context.tsx'
import css from './GenuiBlock.module.css'
import { renderSvgFence } from './svg-fence.tsx'
import { repairFenceJson, trimToBalancedRoot } from '../shared/fence-repair.ts'
import { describeFenceFailure, FenceDiagnostic, renderResolvedFenceNode, type GenuiFenceContext } from './fence-render.tsx'
import { resolveViewedSessionId } from './session-resolver.ts'
import { validateCanonicalGenuiSpec } from './guard.ts'
import { diagnoseUnknownGenuiFields } from './genui-runtime/diagnostics.ts'
import { normalizeGenuiSpec } from './genui-runtime/normalize.ts'
import { sourceFencesOfAssistant, sourceLanguageAt } from './source-fence.ts'

/** Fence surfaces the channel can take over, newest host first: the shared
 * CodeBlock surface every rc.6+ markdown fence renders through
 * (`.md-code-block`) and the deepsuite-style surfaces some host builds
 * render instead (`.code-block` / `.code-block-small`). Surfaces with an
 * unlisted class are still found by the structural backstop (label + `<pre>`),
 * so this list is an optimization, not a hard contract. */
const CODE_BLOCK_SELECTORS = '.md-code-block, .code-block, .code-block-small'
/** Marker attribute set on blocks this channel has taken over. */
const PROCESSED = 'data-genui-rendered'
/** The settled marker on AssistantMarkdown (absent = settled). */
const STREAMING = '[data-streaming]'
/** Container class for the plugin-owned root. */
const CONTAINER_CLASS = 'genui-dom-fence'
/** Container class for the visible diagnostic of an unrenderable fence. */
const DIAGNOSTIC_CLASS = 'genui-dom-fence-diagnostic'
/** Slow sweep interval: the observer catches everything, this is the 1s
 * belt-and-braces pass (history loads, missed attribute batches). */
const SWEEP_MS = 1000
const NO_FILE_LINK_AVAILABILITY: FileLinkAvailability = {
  subscribe: () => () => {},
  getSnapshot: () => false,
}

/** Max ancestors walked from a `<pre>` to its fence surface root (banner +
 * pre holder). Most hosts put the pre directly under the surface; some wrap
 * it in a content div. */
const SURFACE_HOPS = 4

/** Block-level content that never belongs to a code-block surface: a real
 * fence surface is "banner chrome + ONE code body". An element that also
 * contains paragraphs/lists/headings/tables (or several `<pre>` bodies) is a
 * message-level container, not a fence — taking it over would hide the whole
 * final answer (issue #19's residual variant of the issue #13 class). */
const BLOCK_CONTENT_SELECTOR = 'p, ul, ol, dl, table, h1, h2, h3, h4, h5, h6, blockquote, hr, img, figure'

/** Does this element look like a single code-block surface rather than a
 * message container? The only allowed non-code content is banner chrome. */
function isPlausibleFenceSurface(candidate: Element): boolean {
  const pres = candidate.querySelectorAll('pre')
  if (pres.length > 1) return false
  const pre = pres[0] ?? null
  for (const el of candidate.querySelectorAll(BLOCK_CONTENT_SELECTOR)) {
    if (pre !== null && pre.contains(el)) continue
    return false
  }
  return true
}

/** `renderResolvedFenceNode` returns a bare Fragment for `panel:true` fences
 * (the publisher renders nothing); every inline fence mounts a real tree.
 * The DOM channel uses this to tell an empty container that was WIPED by a
 * host re-render apart from an intentionally empty panel root. */
function isPanelRoot(node: ReactNode): boolean {
  return isValidElement(node) && node.type === Fragment
}

/** Streaming placeholder gate: the body is a GenUI spec still arriving.
 *  Requires the shape of a spec (an object carrying items/type/title/panel) so
 *  a streaming ```json code block never gets a skeleton. */
function looksLikeGenuiInProgress(raw: string): boolean {
  const text = raw.trimStart()
  if (text.length < 8 || !text.startsWith('{')) return false
  return /"(items|type|title|panel)"\s*:/.test(text)
}

/** Skeleton mounted while a fence body is still streaming and no component has
 *  finished yet. It is a REAL mounted tree, so the channel's rule "never hide
 *  the stock block without a mounted replacement" (issue #19) still holds: if
 *  the body never parses, the settle sweep unmounts the skeleton and the raw
 *  code block returns. */
function GenuiSkeleton() {
  return (
    <div className={css.skeleton} role="status" aria-label="正在生成界面">
      <span className={css.skeletonTitle} />
      <span className={css.skeletonBars}>
        <span style={{ width: '32%' }} />
        <span style={{ width: '52%' }} />
        <span style={{ width: '24%' }} />
      </span>
      <span className={css.skeletonBlock} />
    </div>
  )
}

interface Mount {
  root: Root
  container: HTMLElement
  block: HTMLElement
  lastRaw: string
  lastSettled: boolean
  language: 'dsh-ui' | 'svg'
  lastNode: ReactNode
  /** True while this mount is the streaming skeleton (no component yet). */
  skeleton: boolean
}

function isTextNode(node: Node): node is Text {
  return node.nodeType === Node.TEXT_NODE
}

/** 读取 DSH Desktop 0.11.0 将 dsh-ui 围栏呈现为纯文本标签时的正文。 */
function tagTextBodyOf(block: Element): string | null {
  if (block.tagName !== 'SPAN' || block.childElementCount !== 0) return null
  const flowKind = block.closest('[data-chat-flow-kind]')?.getAttribute('data-chat-flow-kind')
  if (flowKind !== undefined && flowKind !== null && flowKind !== 'assistant-step') return null
  const text = block.textContent?.trim() ?? ''
  const opening = '<dsh-ui>'
  const closing = '</dsh-ui>'
  if (!text.startsWith(opening) || !text.endsWith(closing)) return null
  return text.slice(opening.length, -closing.length).trim()
}

/** The banner's language label: a leaf element whose text is exactly the
 * lang. CodeBlock renders the label as a childless div; deepsuite-style
 * surfaces use a span; the ONLY structural invariants across hosts are "a
 * leaf element holds exactly the lang text" and "it lives outside the code
 * body" — a fence whose code literally contains the text `dsh-ui` must not
 * self-identify through its body. A container holding SEVERAL code blocks
 * must not self-identify through a nested block's label either (issue #13:
 * the shared markdown root was mistaken for a dsh-ui fence and hid the whole
 * message, losing every other code block). */
function infostringOf(block: Element): 'dsh-ui' | 'svg' | null {
  const pre = block.querySelector('pre')
  for (const el of block.querySelectorAll('*')) {
    if (el.childElementCount !== 0) continue
    const lang = el.textContent?.trim()
    if (lang !== 'dsh-ui' && lang !== 'svg') continue
    if (pre !== null && pre.contains(el)) continue
    // A leaf label that belongs to a NESTED known code surface is that
    // surface's banner, not `block`'s own banner. Only accept labels whose
    // nearest known surface is `block` itself (or none — unknown surfaces
    // stay supported by the structural backstop).
    const owner = el.closest(CODE_BLOCK_SELECTORS)
    if (owner !== null && owner !== block) continue
    return lang
  }
  return null
}

/**
 * 已知**真实语言标识符**的闭集：语言 id 有限、由本插件维护，白名单列它是对的。
 * 反例——宿主各语言里通用代码块标题的叫法（`Code` / `代码块` / «Код» / Código /
 * Codice / Kode …）——是**无界集合**，白名单永远列不全：旧实现 `GENERIC_CODE_LABELS`
 * 只列了英/中两种，宿主 locale 为其它语言时本地化标题被当成真语言，围栏永远不被
 * 接管（issue #258）。因此判定反转：标签命中本集合才视为「带语言」，其余（空标签、
 * 本地化通用词）一律视为「无语言」，由 {@link isGenericGenuiFence} 的内容校验把关——
 * 同一份正文的渲染结果不因宿主语言而不同。
 */
const KNOWN_LANGUAGE_LABELS = new Set([
  // 插件自有语言
  'dsh-ui', 'svg',
  // 数据 / 标记 / 纯文本
  'json', 'json5', 'yaml', 'yml', 'toml', 'ini', 'xml', 'html', 'css', 'scss', 'sass', 'less',
  'markdown', 'md', 'text', 'txt', 'plain', 'plaintext', 'log', 'console', 'diff', 'patch',
  // 助手回复里常见的编程语言
  'js', 'jsx', 'javascript', 'ts', 'tsx', 'typescript', 'python', 'py', 'bash', 'sh', 'shell', 'zsh',
  'sql', 'graphql', 'gql', 'rust', 'go', 'golang', 'java', 'kotlin', 'kt', 'swift', 'scala', 'dart',
  'c', 'h', 'cpp', 'c++', 'cxx', 'cs', 'csharp', 'php', 'ruby', 'rb', 'perl', 'lua', 'r', 'matlab',
  'haskell', 'hs', 'elixir', 'ex', 'erlang', 'clojure', 'clj', 'groovy', 'objc', 'objective-c',
  'dockerfile', 'docker', 'makefile', 'make', 'cmake', 'protobuf', 'proto',
])

/**
 * Read a language that the host still exposes in its CodeBlock banner.
 *
 * 只有标签命中 {@link KNOWN_LANGUAGE_LABELS} 才返回语言；空标签与本地化通用词
 * （«Код» / Código / 代码块 …）是宿主的**呈现文案**、不是语义，一律返回 null——
 * 此前它们会被当成真语言，连 ChatSnapshot 来源都被短路（issue #258）。
 */
function domLanguageOf(block: Element): string | null {
  const label = labelTextOf(block)
  return label !== '' && KNOWN_LANGUAGE_LABELS.has(label.toLowerCase()) ? label : null
}

/** The banner label's raw text (empty while streaming — the host renders the
 * language label only once the reply settles). Returns the first leaf
 * outside the code body (banners always lead with the language), so a
 * span-label host reads identically to the div-label host. */
function labelTextOf(block: Element): string {
  const pre = block.querySelector('pre')
  for (const el of block.querySelectorAll('*')) {
    if (el.childElementCount !== 0) continue
    if (pre !== null && pre.contains(el)) continue
    return el.textContent?.trim() ?? ''
  }
  return ''
}

/**
 * 仅在通用 CodeBlock 的内容经过**与带标签路径相同的标点级修复**后仍是合规 GenUI
 * 规范时，恢复丢失的围栏语言。
 *
 * 宿主会隐去它不认识的语言（高亮器不支持 `dsh-ui`），于是同一份围栏在 DOM 里表现为
 * 一个通用标题的普通代码块（标题随宿主 locale 本地化：`Code` / `代码块` / «Код» …）；
 * ChatSnapshot 的语言来源在部分行上不可用
 * 时，内容识别是唯一出路。此前这里要求 `JSON.parse(raw)` 直接通过，导致**正文只差一个
 * 未转义引号（tier-1 能修）的围栏永远不会被接管**——用户看到一个能渲染却始终是代码块的
 * 围栏（真实会话 seq 40530：正文经 tier-1 修 14 处后可渲染，界面却停在代码块）。
 * 结构级修复（tier-2）刻意不参与：内容识别是兜底，不该接管只是"长得像 JSON"的普通代码。

 *
 * @param block - 宿主提供的代码块元素。
 * @param raw - 未修改的围栏正文。
 * @returns 正文能按原有 GenUI 规范直接识别时返回 true。
 */
function isGenericGenuiFence(block: Element, raw: string): boolean {
  const row = block.closest<HTMLElement>(ASSISTANT_FLOW_ROW)
  if (row === null || row.dataset.chatGroupPart === 'reasoning') return false
  // domLanguageOf 已反转（#258）：banner 是已知真实语言 ⇒ 不是通用块；空标签或
  // 本地化通用词 ⇒ null，进入内容校验。这里不再要求标题命中任何白名单。
  if (domLanguageOf(block) !== null || !block.querySelector('[data-code-block-banner]')) return false
  const repaired = repairFenceJson(raw)
  const candidate = repaired === null ? raw : repaired.text
  let value: unknown
  try {
    value = JSON.parse(candidate)
  } catch {
    // 「合法 JSON + 尾部杂字符」（真实样本：模型把工具调用模板泄漏在 JSON 之后，
    // 而且围栏没闭合）同样要能认出来：裁到平衡根值再试一次。只裁剪、不补全结构。
    const trimmed = trimToBalancedRoot(candidate)
    if (trimmed === null) return false
    try {
      value = JSON.parse(trimmed)
    } catch {
      return false
    }
  }
  if (!validateCanonicalGenuiSpec(value).ok || diagnoseUnknownGenuiFields(value).length > 0) return false
  return JSON.stringify(normalizeGenuiSpec(value).value) === JSON.stringify(value)
}

/** 读取宿主代码块或纯文本标签中的围栏正文。 */
function rawOf(block: Element): string {
  const tagTextBody = tagTextBodyOf(block)
  if (tagTextBody !== null) return tagTextBody
  const pre = block.querySelector('pre')
  if (pre === null) return ''
  let text = ''
  for (const node of pre.childNodes) {
    if (isTextNode(node)) text += node.textContent ?? ''
    else text += node.textContent ?? ''
  }
  return text
}

/** Settled gate: no streaming marker on any ancestor. */
function isSettled(block: Element): boolean {
  return block.closest(STREAMING) === null
}

/** Walk up from a `<pre>` to its fence surface root — the ancestor that
 * carries the banner label AND the pre. Returns null when no ancestor within
 * `SURFACE_HOPS` (or the scope boundary) labels itself `dsh-ui`, or when the
 * labeled ancestor is a message-level container rather than a code surface
 * (see {@link isPlausibleFenceSurface}). */
function surfaceOf(pre: HTMLElement, scope: ParentNode = document): HTMLElement | null {
  let el: HTMLElement | null = pre.parentElement
  for (let hops = 0; el !== null && el !== scope && hops < SURFACE_HOPS; hops += 1, el = el.parentElement) {
    if (infostringOf(el) === null) continue
    if (!isPlausibleFenceSurface(el)) return null
    return el
  }
  return null
}

/** The labeled-but-implausible ancestor `surfaceOf` just rejected, if any:
 * diagnostics for the issue #19 guard so a skipped fence is never silent. */
function implausibleLabeledAncestorOf(pre: HTMLElement, scope: ParentNode = document): HTMLElement | null {
  let el: HTMLElement | null = pre.parentElement
  for (let hops = 0; el !== null && el !== scope && hops < SURFACE_HOPS; hops += 1, el = el.parentElement) {
    if (infostringOf(el) === 'dsh-ui' && !isPlausibleFenceSurface(el)) return el
  }
  return null
}

/**
 * Every dsh-ui fence surface or complete tag-text span under `scope`, in DOM order.
 * Known surface classes first (cheap, ordered), then a structural sweep —
 * every `<pre>` whose banner labels it `dsh-ui` — so a host with an
 * unlisted surface shape still renders. The label + `<pre>` gates make the
 * structural pass false-positive-free: a random code surface without the
 * exact `dsh-ui` label is never taken over.
 */
function findFenceCandidates(scope: ParentNode = document): HTMLElement[] {
  const seen = new Set<HTMLElement>()
  const out: HTMLElement[] = []
  for (const el of scope.querySelectorAll<HTMLElement>(CODE_BLOCK_SELECTORS)) {
    // Modifier classes can sit inside a surface (e.g. a `code-block-small`
    // child of `code-block`): only the outermost matching element is a
    // candidate, so a fence is never double-counted or taken over twice.
    if (el.parentElement !== null && el.parentElement.closest(CODE_BLOCK_SELECTORS) !== null) continue
    if (el.closest(`.${CONTAINER_CLASS}, .${DIAGNOSTIC_CLASS}, [data-genui-svg-fence]`) !== null) continue
    if (seen.has(el)) continue
    // Message-level containers that happen to carry a surface class must
    // not be taken over: hiding them hides the whole answer (issue #19).
    if (!isPlausibleFenceSurface(el)) {
      if (infostringOf(el) === 'dsh-ui') warnImplausibleSurface(el)
      continue
    }
    out.push(el)
    seen.add(el)
  }
  for (const pre of scope.querySelectorAll<HTMLElement>('pre')) {
    // `<pre>` bodies inside a known surface were already handled by the
    // selector pass. Walking up from them again would climb PAST their own
    // (non-dsh-ui or dsh-ui) surface into a shared container — e.g. a
    // markdown root holding both a dsh-ui fence and a python block — and
    // the backstop would mislabel that whole container as a fence, hiding
    // every other code block with it (issue #13).
    if (pre.closest(`${CODE_BLOCK_SELECTORS}, .${CONTAINER_CLASS}, .${DIAGNOSTIC_CLASS}, [data-genui-svg-fence]`) !== null) continue
    const surface = surfaceOf(pre, scope)
    if (surface === null) {
      // Diagnose the issue #19 guard: a labeled ancestor that is NOT a code
      // surface (prose/multiple code bodies) was skipped on purpose.
      const rejected = implausibleLabeledAncestorOf(pre, scope)
      if (rejected !== null) warnImplausibleSurface(rejected)
      continue
    }
    if (seen.has(surface)) continue
    // Host DOM drift diagnostic: the fence renders (structural backstop),
    // but the surface class is unknown to this build — warn once per
    // renderer install so future drift is never silent again.
    if (!driftWarned) {
      driftWarned = true
      console.warn('[dsh-genui] 围栏表面类名未被已知选择器命中（宿主 DOM 漂移），已按 label+pre 结构识别 dsh-ui 围栏')
    }
    out.push(surface)
    seen.add(surface)
  }
  for (const span of scope.querySelectorAll<HTMLElement>('span')) {
    if (span.closest(`.${CONTAINER_CLASS}, .${DIAGNOSTIC_CLASS}, ${CODE_BLOCK_SELECTORS}, [data-chat-group-part="reasoning"], [data-tool], [data-sidebar-chat], [data-sidebar-right-session], [data-sidebar-right-panel], [data-panel-conversation], [data-plugin-panel]`) !== null) continue
    if (tagTextBodyOf(span) === null) continue
    out.push(span)
  }
  return out.sort((left, right) => left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)
}

/** One-time-per-install drift diagnostic flag (reset per install, so tests
 * and hot re-installs each get a fresh warning budget). */
let driftWarned = false
/** A rejected surface gets one diagnostic; never log its conversation text. */
let plausibilityWarned = new WeakSet<Element>()
function warnImplausibleSurface(surface: Element): void {
  if (plausibilityWarned.has(surface)) return
  plausibilityWarned.add(surface)
  const pres = surface.querySelectorAll('pre')
  const tags = [...surface.querySelectorAll(BLOCK_CONTENT_SELECTOR)]
    .filter(el => !el.closest('pre')).map(el => el.tagName.toLowerCase())
  console.warn(`[dsh-genui] 跳过带 dsh-ui 标签但疑似消息容器的节点：pre=${pres.length}, outside-code=${[...new Set(tags)].join(',') || 'none'}；保留原文，防止隐藏整条消息（issue #19）`)
}

/** Root factory seam (tests / tuning): the DOM channel creates one React root
 * per taken-over fence through this indirection so mount-failure cleanup is
 * reachable in jsdom without mocking the react-dom module. */
let domRootFactory: (container: HTMLElement) => Root = createRoot

/** Override the React root factory (tests / tuning). */
export function setDomRootFactory(factory: (container: HTMLElement) => Root): void {
  domRootFactory = factory
}

/**
 * The owning conversation row (stable per-message identity).
 *
 * The host renders `data-chat-anchor-key` from a React key that is OMITTED
 * when the routed node's key is undefined — observed on Safari (and any
 * fallback render path), where every fence row lacks the attribute while
 * Chrome's identical page has it. Fences must not silently die there, so the
 * lookup walks down a fallback chain and never gives up:
 *
 * 1. `[data-chat-anchor-key]` — the canonical stable row anchor;
 * 2. `[data-chat-flow-key]` / `[data-chat-flow-kind]` — the same row div
 *    rendered by the host (both carry the routing key/kind, and the kind is
 *    a separate value that survives an undefined React key);
 * 3. the code block itself — last resort; identity degrades to
 *    `dom:unknown:<ordinal>` (see `fenceIndexOf`/`contextOf`).
 */
const FLOW_ROW = '[data-chat-flow-key], [data-chat-flow-kind]'
const ASSISTANT_FLOW_ROW = '[data-chat-flow-kind="assistant-step"]'
function rowOf(block: Element): Element {
  return block.closest('[data-chat-anchor-key]') ?? block.closest(FLOW_ROW) ?? block
}

/** Return a stable one-based ordinal among settled GenUI fences in this row. */
function fenceIndexOf(ctx: Context, row: Element, block: Element, sourceLanguage: (block: Element) => string | null | undefined = candidate => sourceLanguageOf(ctx, candidate)): number {
  if (!row.matches(ASSISTANT_FLOW_ROW) || row.getAttribute('data-chat-anchor-key') === null) {
    const scope = row.getAttribute('data-chat-anchor-key') === null ? document : row
    let fallbackIndex = 0
    for (const candidate of findFenceCandidates(scope)) {
      if (candidate.closest(STREAMING) !== null) continue
      const language = tagTextBodyOf(candidate) !== null ? 'dsh-ui' : domLanguageOf(candidate) ?? sourceLanguage(candidate)
      if (language !== 'dsh-ui' && !(language === undefined && isGenericGenuiFence(candidate, rawOf(candidate)))) continue
      fallbackIndex += 1
      if (candidate === block) return fallbackIndex
    }
    return fallbackIndex + 1
  }
  let index = 0
  for (const candidate of findFenceCandidates(row)) {
    if (candidate.closest(STREAMING) !== null) continue
    if (candidate.closest(ASSISTANT_FLOW_ROW) !== row) continue
    if (candidate.closest('[data-chat-group-part="reasoning"]') !== null) continue
    const language = tagTextBodyOf(candidate) !== null ? 'dsh-ui' : domLanguageOf(candidate) ?? sourceLanguage(candidate)
    if (language !== 'dsh-ui' && !(language === undefined && isGenericGenuiFence(candidate, rawOf(candidate)))) continue
    index += 1
    if (candidate === block) return index
  }
  return index + 1
}

/** Return outer host Markdown code surfaces in one assistant row's DOM order. */
function hostFenceBlocksOf(row: Element): HTMLElement[] {
  return [...row.querySelectorAll<HTMLElement>(CODE_BLOCK_SELECTORS)].filter(candidate => {
    if (candidate.parentElement?.closest(CODE_BLOCK_SELECTORS) !== null) return false
    if (candidate.closest(`.${CONTAINER_CLASS}, .${DIAGNOSTIC_CLASS}, [data-genui], [data-genui-svg-fence]`) !== null) return false
    if (candidate.closest('[data-chat-group-part="reasoning"], [data-tool], [data-sidebar-chat], [data-sidebar-right-session], [data-sidebar-right-panel], [data-panel-conversation], [data-plugin-panel]') !== null) return false
    if (candidate.closest(ASSISTANT_FLOW_ROW) !== row) return false
    return isPlausibleFenceSurface(candidate) && candidate.querySelector('pre') !== null
  })
}

/**
 * Resolve source language for the host code surface at its assistant-row ordinal.
 *
 * @param ctx - active plugin context
 * @param block - host Markdown CodeBlock element
 * @returns source language, null for an unlabelled fence, or undefined when unavailable
 */
export function sourceLanguageOf(ctx: Context, block: Element): string | null | undefined {
  const row = block.closest<HTMLElement>(`${ASSISTANT_FLOW_ROW}[data-chat-node-key]`)
  if (row === null || row.dataset.chatGroupPart === 'reasoning') return undefined
  const nodeKey = row.dataset.chatNodeKey
  const index = hostFenceIndexOf(row, block)
  const sessionId = sessionIdOfForSource(ctx)
  if (!nodeKey || index < 0 || sessionId === undefined) return undefined
  const chat = chatSourceOf(ctx, sessionId)?.getSnapshot()
  return sourceLanguageAt(chat, nodeKey, index)
}

/** Cache each row's Markdown parse for one sweep and retain confirmed opening-line languages per host block. */
function createSourceLanguageResolver(ctx: Context): {
  beginSweep: () => void
  get: (block: Element) => string | null | undefined
  isSessionUnavailable: () => boolean
} {
  const stableLanguages = new WeakMap<Element, { sessionId: SessionId; nodeKey: string; language: string | null }>()
  let sweepLanguages = new Map<Element, string | null | undefined>()
  let parsedNodes = new Map<string, ReturnType<typeof sourceFencesOfAssistant>>()
  let sessionId: SessionId | undefined
  let chat: ChatSnapshot | undefined
  let chatRead = false
  let sessionUnavailable = false

  return {
    beginSweep() {
      sweepLanguages = new Map()
      parsedNodes = new Map()
      sessionId = undefined
      chat = undefined
      chatRead = false
      sessionUnavailable = false
    },
    isSessionUnavailable() {
      return sessionUnavailable
    },
    get(block) {
      if (sweepLanguages.has(block)) return sweepLanguages.get(block)
      const row = block.closest<HTMLElement>(`${ASSISTANT_FLOW_ROW}[data-chat-node-key]`)
      if (row === null || row.dataset.chatGroupPart === 'reasoning') return undefined
      const nodeKey = row.dataset.chatNodeKey
      const sourceSession = sourceSessionOf(ctx)
      if (!sourceSession.available) {
        sessionUnavailable = true
        sweepLanguages.set(block, undefined)
        return undefined
      }
      const activeSessionId = sourceSession.sessionId
      if (!nodeKey || activeSessionId === undefined) return undefined

      const stable = stableLanguages.get(block)
      if (stable?.sessionId === activeSessionId && stable.nodeKey === nodeKey) {
        sweepLanguages.set(block, stable.language)
        return stable.language
      }
      if (!chatRead || sessionId !== activeSessionId) {
        sessionId = activeSessionId
        chat = chatSourceOf(ctx, activeSessionId)?.getSnapshot()
        chatRead = true
      }
      const node = chat?.nodes.get(nodeKey)
      if (node?.kind !== 'assistant-step') return undefined
      const assistantNode = node as ChatNode<'assistant-step'>
      let fences = parsedNodes.get(nodeKey)
      if (fences === undefined) {
        fences = sourceFencesOfAssistant(assistantNode.data.blocks)
        parsedNodes.set(nodeKey, fences)
      }
      const index = hostFenceIndexOf(row, block)
      if (index < 0) return undefined
      const fence = fences[index]
      const language = fence?.lang
      if (fence !== undefined && fence.openingLineComplete) {
        stableLanguages.set(block, { sessionId: activeSessionId, nodeKey, language: fence.lang })
      }
      sweepLanguages.set(block, language)
      return language
    },
  }
}

/**
 * Resolve a host CodeBlock's zero-based ordinal among assistant Markdown surfaces.
 *
 * @param row - owning assistant row
 * @param block - host Markdown CodeBlock element
 * @returns source-order ordinal or -1 when the element is not a host code surface
 */
export function hostFenceIndexOf(row: Element, block: Element): number {
  return hostFenceBlocksOf(row).indexOf(block as HTMLElement)
}

/** Read the viewed session and report when Cordis rejects access to its Context. */
function sourceSessionOf(ctx: Context): { available: true; sessionId: SessionId | undefined } | { available: false } {
  try {
    return { available: true, sessionId: resolveViewedSessionId(ctx.sessions.list.getSnapshot()) }
  } catch {
    return { available: false }
  }
}

/** Read the currently viewed session for source Markdown lookup. */
function sessionIdOfForSource(ctx: Context): SessionId | undefined {
  const sourceSession = sourceSessionOf(ctx)
  return sourceSession.available ? sourceSession.sessionId : undefined
}

/** Read uiConversation as an optional service so Cordis does not require a hard inject. */
function uiConversationOf(ctx: Context): Context['uiConversation'] | undefined {
  if (typeof ctx.get !== 'function') return undefined
  return ctx.get('uiConversation', false) as Context['uiConversation'] | undefined
}

/** Read the current ChatSnapshot source without interrupting sweeps during session transitions. */
function chatSourceOf(ctx: Context, sessionId: SessionId): { getSnapshot: () => ChatSnapshot | undefined; subscribe: (listener: () => void) => (() => void) | undefined } | undefined {
  try {
    const source = uiConversationOf(ctx)?.binding(sessionId).target('chat')
    if (source === undefined) return undefined
    return {
      getSnapshot: () => {
        try {
          return source.getSnapshot()
        } catch {
          return undefined
        }
      },
      subscribe: listener => {
        try {
          return source.subscribe(listener)
        } catch {
          return undefined
        }
      },
    }
  } catch {
    return undefined
  }
}

/**
 * messageSeq estimate from the row's anchor key.
 *
 * The host's context key is `<kindLen>:<kind><id>` (e.g.
 * `14:assistant-step3:0`); the id of an assistant step is `<turn>:<step>` —
 * the ONLY per-message monotonic counter the host exposes in the DOM. Turn
 * and step strictly increase with message order, so a turn-based seq keeps
 * growing across page reloads: the panel store's persisted replay barrier
 * (hydration: replays at/below the persisted max seq are dead) depends on
 * this monotonicity. Without it every assistant step yields the SAME
 * constant (the kind-length prefix), so after a refresh the barrier equals
 * that constant and silently rejects every new panel fence (issue #4).
 *
 * Fallback (non-assistant rows, anchor-less Safari rows): the row's
 * document-order index among chat rows — monotonic within the current
 * render window, degraded across reloads.
 */
function anchorSeqOf(row: Element): number {
  const key = row.getAttribute('data-chat-anchor-key') ?? ''
  const turnStep = /assistant-step(\d+):(\d+)$/.exec(key)
  if (turnStep !== null) {
    const turn = Number(turnStep[1])
    const step = Number(turnStep[2])
    if (Number.isFinite(turn) && Number.isFinite(step)) return turn * 1000 + step
  }
  const rows = document.querySelectorAll(`[data-chat-anchor-key], ${FLOW_ROW}`)
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i] === row) return i
  }
  return 0
}

/**
 * Install the DOM render channel. Returns a disposer that restores every
 * taken-over block and disconnects the observers.
 *
 * @param ctx - the client context (sessions service for the current session).
 * @param sendAction - plugin-owned relay: (sessionId, action, payload) → the
 *   scoped conversation send carrying the `[genui-action]` prompt.
 */
export function installDomFenceRenderer(
  ctx: Context,
  sendAction: (sessionId: SessionId, action: string, payload: Record<string, unknown>) => void,
  fileLinkAvailability: FileLinkAvailability = NO_FILE_LINK_AVAILABILITY,
): () => void {
  if (typeof document === 'undefined') return () => {}
  driftWarned = false
  plausibilityWarned = new WeakSet<Element>()
  const mounts = new Map<HTMLElement, Mount>()
  // Blocks we could not render: the stock code block stays visible AND a
  // visible diagnostic explains why (issue #158). Kept apart from `mounts`
  // because a diagnosed block is never hidden.
  const diagnostics = new Map<HTMLElement, { container: HTMLElement; root: Root; raw: string }>()
  let disposed = false
  let rafId: number | null = null
  let activeChatSession: SessionId | undefined
  let unsubscribeChat: (() => void) | undefined
  const sourceLanguages = createSourceLanguageResolver(ctx)

  /** Apply both plugin contexts to every actual GenUI root render. */
  function wrapFenceNode(node: ReactNode, context: GenuiFenceContext, handler: GenuiActionHandler, streaming: boolean): ReactNode {
    const actionTree = <GenuiActionContext.Provider value={handler}>{node}</GenuiActionContext.Provider>
    return withFileLinkContext(
      ctx as unknown as FileLinkCordisContext,
      fileLinkAvailability,
      context.sessionId,
      streaming,
      actionTree,
    )
  }

  const sessionIdOf = (): SessionId | undefined => sessionIdOfForSource(ctx)
  let lastAvailableSessionId = sessionIdOf()

  /** Keep a mounted fence's React identity stable while Cordis temporarily denies session access. */
  function sessionIdForRender(preserveWhenUnavailable: boolean): SessionId | undefined {
    const sourceSession = sourceSessionOf(ctx)
    if (!sourceSession.available) return preserveWhenUnavailable ? lastAvailableSessionId : undefined
    lastAvailableSessionId = sourceSession.sessionId
    return sourceSession.sessionId
  }

  /** Retry ChatSnapshot subscription while the active session binding is unavailable. */
  function syncChatSubscription(sessionId: SessionId | undefined): void {
    if (sessionId !== activeChatSession) {
      unsubscribeChat?.()
      unsubscribeChat = undefined
      activeChatSession = sessionId
    }
    if (sessionId !== undefined && unsubscribeChat === undefined) {
      unsubscribeChat = chatSourceOf(ctx, sessionId)?.subscribe(schedule)
    }
  }

  /** Render context for a block: session always; the stable source identity
   * only once settled — streaming renders are identity-less (no panel
   * publish, no durable state), mirroring the registry channel. */
  function contextOf(row: Element, block: Element, settled: boolean, preserveSessionIdentity = false): { key: Key; context: GenuiFenceContext } {
    if (settled && row.getAttribute('data-chat-anchor-key') === null) {
      // Safari / fallback render path: the host omitted the row anchor (the
      // attribute is a React key that React drops when undefined). Fences
      // still render with the degraded `dom:unknown:N` identity — warn once
      // per block so the degraded path is visible in the console.
      warnOnce(block, 'no [data-chat-anchor-key] ancestor for a dsh-ui fence (host render path without row anchor — e.g. Safari); using fallback identity dom:unknown:N')
    }
    const fenceIndex = fenceIndexOf(ctx, row, block, sourceLanguages.get)
    const anchorKey = row.getAttribute('data-chat-anchor-key') ?? 'unknown'
    const key = `dom:${anchorKey}:${fenceIndex}` as Key
    const sessionId = sessionIdForRender(preserveSessionIdentity)
    const context: GenuiFenceContext = {
      ...(sessionId === undefined ? {} : { sessionId }),
      ...(settled ? { source: { id: key as string, order: [anchorSeqOf(row), 0, fenceIndex] as const } } : {}),
    }
    return { key, context }
  }

  function unmountBlock(block: HTMLElement): void {
    const mount = mounts.get(block)
    if (mount === undefined) return
    mounts.delete(block)
    mount.root.unmount()
    mount.container.remove()
    block.style.display = ''
    block.removeAttribute(PROCESSED)
    clearDiagnostic(block)
  }

  /** Drop the diagnostic mounted for one block (renderable again, or gone). */
  function clearDiagnostic(block: HTMLElement): void {
    const diagnostic = diagnostics.get(block)
    if (diagnostic === undefined) return
    diagnostics.delete(block)
    try {
      diagnostic.root.unmount()
    } catch {
      // The host's re-render already invalidated the tree; removing the
      // container below is the recovery.
    }
    diagnostic.container.remove()
  }

  /**
   * Mount (or refresh) the visible diagnostic that explains why a settled
   * dsh-ui fence stays a code block. Idempotent per block: the 1s sweep and
   * every mutation pass re-enter here, and the strip must neither duplicate
   * nor vanish when the host re-renders its message (issues #158/#172).
   *
   * This only ever creates/updates the strip and re-attaches it; it never
   * re-renders on an empty container, because React commits asynchronously —
   * a synchronous "it looks wiped" rebuild inside the mutation callback would
   * re-trigger the observer forever (the sweep owns that recovery).
   */
  function renderDiagnostic(block: HTMLElement, raw: string): void {
    // Nothing to report (renderable, empty, or still streaming): never leave
    // an empty strip behind, and drop one that is no longer true.
    if (describeFenceFailure(raw, { settled: true }) === null) {
      clearDiagnostic(block)
      return
    }
    const existing = diagnostics.get(block)
    if (existing !== undefined) {
      // A host re-render can detach our container without removing the block:
      // re-attach before paint; a changed body rebuilds the strip.
      if (existing.container.parentElement !== block.parentElement || existing.container.nextElementSibling !== block) {
        block.before(existing.container)
      }
      if (existing.raw === raw) return
      clearDiagnostic(block)
    }
    const container = document.createElement('div')
    container.className = DIAGNOSTIC_CLASS
    block.before(container)
    let root: Root
    try {
      root = domRootFactory(container)
      root.render(<FenceDiagnostic raw={raw} settled />)
    } catch (error) {
      container.remove()
      warnOnce(block, `failed to mount the dsh-ui diagnostic (${error instanceof Error ? error.message : String(error)}); keeping the stock code block visible`)
      return
    }
    diagnostics.set(block, { container, root, raw })
  }

  /**
   * Sweep-only recovery for a diagnostic whose DOM the host threw away
   * without removing the block (a re-render can empty our container). Runs on
   * the rAF-scheduled sweep, never inside the mutation callback, so a commit
   * that lands a frame later cannot re-trigger it in a loop.
   */
  function rebuildWipedDiagnostic(block: HTMLElement, raw: string): void {
    const existing = diagnostics.get(block)
    if (existing === undefined || existing.container.childElementCount > 0) return
    clearDiagnostic(block)
    renderDiagnostic(block, raw)
  }

  /** One-time-per-block diagnostics: silent returns must be diagnosable
   * (the 1s sweep would otherwise spam the console every pass). */
  const warned = new WeakSet<Element>()
  function warnOnce(block: Element, message: string): void {
    if (warned.has(block)) return
    warned.add(block)
    console.warn(`[dsh-genui] ${message}`)
  }

  /**
   * 通过当前宿主会话发送 DOM 通道 action。
   *
   * @param block - 触发 action 的围栏元素
   * @param action - 组件声明的 action 名称
   * @param payload - 组件产生的交互数据
   */
  function sendActionForBlock(block: Element, action: string, payload: Record<string, unknown>): void {
    const sessionId = sessionIdOf()
    if (sessionId === undefined) {
      warnOnce(block, `cannot resolve the viewed session; action "${action}" was not sent`)
      return
    }
    sendAction(sessionId, action, payload)
  }

  function renderBlock(block: HTMLElement): void {
    if (block.hasAttribute(PROCESSED)) return
    const row = rowOf(block)
    const settled = isSettled(block)
    const domLanguage = tagTextBodyOf(block) !== null ? 'dsh-ui' : domLanguageOf(block)
    const sourceLanguage = domLanguage === null ? sourceLanguages.get(block) : undefined
    const language = domLanguage ?? sourceLanguage
    const raw = rawOf(block)
    // DSH 0.1.7-alpha.2 会在最终 DOM 隐去不支持高亮的语言；公开 ChatSnapshot 的原始 Markdown 是 language 来源。
    // 内容识别只在 source 暂不可用且 assistant 已结束时兜底，不覆盖已确认的 language 或无 language fence。
    const genericGenui = language === undefined && settled && isGenericGenuiFence(block, raw)
    if (language !== 'dsh-ui' && language !== 'svg' && !genericGenui) return
    if (!settled && language !== 'dsh-ui') return
    if (raw.trim() === '') {
      if (settled) warnOnce(block, `settled ${language ?? 'dsh-ui'} fence has an empty body; keeping the code block`)
      return
    }
    const { key, context } = contextOf(row, block, settled)
    const acceptedLanguage = language === 'svg' ? 'svg' : 'dsh-ui'
    const node: ReactNode | null = acceptedLanguage === 'svg' ? renderSvgFence(raw, key) : renderResolvedFenceNode(raw, key, context)
    // Null = no finished component yet (streaming half) or unrepairable: the
    // stock code block stays visible. A settled unrepairable body also gets a
    // VISIBLE diagnostic — console-only reporting left the defect invisible
    // to the author (issues #158/#172).
    let payload = node
    if (payload === null) {
      if (settled || !looksLikeGenuiInProgress(raw)) {
        if (settled) {
          renderDiagnostic(block, raw)
          warnOnce(block, 'settled dsh-ui fence body does not parse; keeping the code block')
        }
        return
      }
      // Streaming, spec-shaped, nothing renderable yet: show the skeleton
      // rather than a wall of half-written JSON.
      payload = <GenuiSkeleton />
    }
    clearDiagnostic(block)
    // Mount FIRST, hide AFTER (issue #19): the stock block is only ever
    // hidden once a successfully mounted replacement stands next to it. A
    // mount failure leaves the original code block untouched — the final
    // answer can never be blanked by a half-completed takeover.
    const container = document.createElement('div')
    container.className = CONTAINER_CLASS
    block.after(container)
    let root: Root
    try {
      root = domRootFactory(container)
    } catch (error) {
      container.remove()
      warnOnce(block, `failed to create a React root for a dsh-ui fence (${error instanceof Error ? error.message : String(error)}); keeping the stock code block visible`)
      return
    }
    try {
      const handler: GenuiActionHandler = (action, payload) => sendActionForBlock(block, action, payload)
      root.render(wrapFenceNode(payload, context, handler, !settled))
    } catch (error) {
      try {
        root.unmount()
      } catch {
        // Best-effort cleanup; removing the container below restores the DOM.
      }
      container.remove()
      warnOnce(block, `failed to mount a dsh-ui fence (${error instanceof Error ? error.message : String(error)}); keeping the stock code block visible`)
      return
    }
    block.style.display = 'none'
    block.setAttribute(PROCESSED, '')
    mounts.set(block, { root, container, block, lastRaw: raw, lastSettled: settled, language: acceptedLanguage, lastNode: payload, skeleton: node === null })
  }

  /** Pre-paint repair: the host's React re-renders during streaming can wipe
   * our foreign container or reset the hide. Re-apply the surgery in the
   * observer microtask (before paint) so raw JSON never flashes between
   * chunks; the rAF sweep re-renders React state at its own pace. */
  function repairSurgery(): void {
    // Diagnostics are plugin-owned DOM too: a host re-render that detaches or
    // empties their container must be repaired before paint.
    for (const [block, diagnostic] of Array.from(diagnostics)) {
      if (!block.isConnected) {
        clearDiagnostic(block)
        continue
      }
      renderDiagnostic(block, diagnostic.raw)
    }
    for (const mount of Array.from(mounts.values())) {
      const block = mount.block
      // The host replaced the row: the stock block is gone but our foreign
      // container may still be attached. Drop the mount NOW (removes the
      // orphan container) instead of waiting for the sweep — the new block
      // will be taken over by the sweep's discovery pass.
      if (!block.isConnected) {
        if (mount.container.isConnected) unmountBlock(block)
        continue
      }
      // Re-attach the container BEFORE re-hiding (issue #19: never hide the
      // original while no mounted replacement stands next to it).
      if (mount.container.parentElement !== block.parentElement
          || mount.container.previousElementSibling !== block) {
        block.after(mount.container)
      }
      if (!mount.container.isConnected) {
        // Insertion failed (pathological host re-parent): surrender the
        // takeover and keep the raw stock block visible rather than leaving
        // it hidden with no replacement.
        block.style.display = ''
        block.removeAttribute(PROCESSED)
        mounts.delete(block)
        try {
          mount.root.unmount()
        } catch {
          // Best-effort; the detached container gets removed below.
        }
        mount.container.remove()
        warnOnce(block, 'dsh-ui replacement container could not be re-attached after a host re-render; restoring the stock code block')
        continue
      }
      if (block.style.display !== 'none') block.style.display = 'none'
      if (!block.hasAttribute(PROCESSED)) block.setAttribute(PROCESSED, '')
    }
  }

  /** Sweep: drop dead mounts, re-render changed bodies (streaming growth and
   * the streaming→settled transition), repair surgery, then take over every
   * new dsh-ui block — settled or still streaming. */
  function sweep(): void {
    if (disposed) return
    sourceLanguages.beginSweep()
    const sourceSession = sourceSessionOf(ctx)
    const sessionId = sourceSession.available ? sourceSession.sessionId : undefined
    if (sourceSession.available) lastAvailableSessionId = sourceSession.sessionId
    syncChatSubscription(sessionId)
    for (const [block, mount] of mounts) {
      if (!block.isConnected) {
        unmountBlock(block)
        continue
      }
      const raw = rawOf(block)
      const settled = isSettled(block)
      const domLanguage = tagTextBodyOf(block) !== null ? 'dsh-ui' : domLanguageOf(block)
      const sourceLanguage = domLanguage === null ? sourceLanguages.get(block) : undefined
      const language = domLanguage ?? sourceLanguage
      const sourceUnavailable = domLanguage === null
        && (!sourceSession.available || sourceLanguages.isSessionUnavailable())
      const validGenui = language === 'dsh-ui'
        || (language === undefined && settled && isGenericGenuiFence(block, raw))
      if (mount.language === 'svg' && language !== 'svg') {
        unmountBlock(block)
        continue
      }
      if (mount.language === 'dsh-ui' && !validGenui && !sourceUnavailable) {
        unmountBlock(block)
        continue
      }
      // A host re-render can also wipe the CONTENT of our container while
      // leaving the node in place. An inline mount whose container came back
      // empty (and was not empty by design — panel roots are) must be
      // re-rendered, otherwise the block stays hidden behind an empty box.
      const contentWiped = !isPanelRoot(mount.lastNode) && mount.container.childElementCount === 0
      if (mount.lastRaw !== raw || mount.lastSettled !== settled || contentWiped) {
        const anchor = rowOf(block)
        const { key, context } = contextOf(anchor, block, settled, true)
        const node = mount.language === 'svg' ? renderSvgFence(raw, key) : renderResolvedFenceNode(raw, key, context)
        if (node === null) {
          if (mount.skeleton && !settled) {
            // Still streaming and still incomplete: keep the skeleton mounted
            // (no React re-render needed) and wait for the next chunk.
            mount.lastRaw = raw
            mount.lastSettled = settled
            continue
          }
          // Settled, or no longer spec-shaped: restore the raw code block.
          unmountBlock(block)
          continue
        }
        if (contentWiped) {
          // The old root's fiber bookkeeping points at children the host
          // already removed — re-rendering it can throw removeChild errors
          // on missing nodes. Rebuild the mount in place: fresh container +
          // fresh root, block re-hidden only after the replacement exists.
          try {
            mount.root.unmount()
          } catch {
            // The host's wipe already invalidated the tree; the fresh root
            // below is the recovery, not the old one.
          }
          const fresh = document.createElement('div')
          fresh.className = CONTAINER_CLASS
          mount.container.remove()
          block.after(fresh)
          try {
            const freshRoot = domRootFactory(fresh)
            const handler: GenuiActionHandler = (action, payload) => sendActionForBlock(block, action, payload)
            freshRoot.render(wrapFenceNode(node, context, handler, !settled))
            mount.root = freshRoot
            mount.container = fresh
          } catch (error) {
            // Never leave the stock block hidden behind a broken root:
            // restore the raw code block and drop the mount (issue #19).
            fresh.remove()
            block.style.display = ''
            block.removeAttribute(PROCESSED)
            mounts.delete(block)
            warnOnce(block, `failed to rebuild a wiped dsh-ui mount (${error instanceof Error ? error.message : String(error)}); restoring the stock code block`)
            continue
          }
        } else {
          try {
            const handler: GenuiActionHandler = (action, payload) => sendActionForBlock(block, action, payload)
            mount.root.render(wrapFenceNode(node, context, handler, !settled))
          } catch (error) {
            // Never leave the stock block hidden behind a broken root: restore
            // the raw code block and drop the mount (issue #19).
            unmountBlock(block)
            warnOnce(block, `failed to re-render a dsh-ui fence (${error instanceof Error ? error.message : String(error)}); restoring the stock code block`)
            continue
          }
        }
        mount.lastRaw = raw
        mount.lastSettled = settled
        mount.lastNode = node
        mount.skeleton = false
      }
    }
    repairSurgery()
    // Diagnostics for blocks that are gone or were taken over must go with
    // them; one whose DOM the host wiped is rebuilt here (sweep cadence, never
    // inside the mutation callback).
    for (const [block, diagnostic] of Array.from(diagnostics)) {
      if (!block.isConnected || block.hasAttribute(PROCESSED)) {
        clearDiagnostic(block)
        continue
      }
      // Same re-verification the takeover path does: a settled block whose
      // label is no longer dsh-ui is somebody else's fence, so our explanation
      // would be about the wrong block.
      if (isSettled(block)) {
        const domLanguage = tagTextBodyOf(block) !== null ? 'dsh-ui' : domLanguageOf(block)
        const sourceLanguage = domLanguage === null ? sourceLanguages.get(block) : undefined
        if ((domLanguage ?? sourceLanguage) !== 'dsh-ui') {
          clearDiagnostic(block)
          continue
        }
      }
      rebuildWipedDiagnostic(block, diagnostic.raw)
    }
    for (const block of findFenceCandidates()) {
      renderBlock(block)
    }
  }

  const schedule = (): void => {
    if (disposed || rafId !== null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      if (disposed) return
      sweep()
    })
  }

  const unsubscribeSessions = typeof ctx.sessions.list.subscribe === 'function'
    ? ctx.sessions.list.subscribe(schedule)
    : undefined

  const observer = new MutationObserver(records => {
    // Restore detached roots before paint, retaining input and pending actions.
    // The latest removal owns the current tree if several commits were batched.
    for (const record of [...records].reverse()) {
      if (record.removedNodes.length === 0 || record.target.childNodes.length > 0) continue
      const target = record.target
      const mount = [...mounts.values()].find(candidate => candidate.container === target)
      if (mount !== undefined) {
        if (!mount.block.isConnected || isPanelRoot(mount.lastNode)) continue
        mount.container.append(...record.removedNodes)
        continue
      }
      // The same surgery for a visible diagnostic the host emptied: re-append
      // its own nodes instead of leaving the author without an explanation.
      const diagnostic = [...diagnostics.values()].find(candidate => candidate.container === target)
      if (diagnostic !== undefined) diagnostic.container.append(...record.removedNodes)
    }
    // Pre-paint pass: surgery repair only (cheap DOM ops); the React
    // re-render goes through the rAF-scheduled sweep.
    repairSurgery()
    schedule()
  })
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-streaming'],
    // React streams tokens as text-node updates: without characterData the
    // observer would only fire on structural changes and miss body growth.
    characterData: true,
  })
  const interval = window.setInterval(sweep, SWEEP_MS)
  sweep()

  return () => {
    disposed = true
    observer.disconnect()
    unsubscribeSessions?.()
    unsubscribeChat?.()
    unsubscribeChat = undefined
    window.clearInterval(interval)
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    for (const block of Array.from(mounts.keys())) unmountBlock(block)
    for (const block of Array.from(diagnostics.keys())) clearDiagnostic(block)
  }
}
