/**
 * GenUI plugin: teaches the model the ```dsh-ui fence syntax for emitting
 * declarative UI components inline in its reply. The browser half renders the
 * fence through GenuiBlock (ui-primitives); this host half only tells the
 * model the language exists, so a session without the plugin simply never
 * emits fences and nothing changes.
 *
 * The section uses the host's centrally allocated structured-output placement.
 * @module @changfenhuang/dsh-genui
 */

import { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-tools'
import type { SkillProvider } from '@deepseek-ai/dsh-skill'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRenderUiTool, createValidateDshUiTool } from './tool.ts'
import { installFenceFeedback } from './fence-feedback.ts'

/* ---------------- lazy engine asset route ---------------- */

/**
 * The mermaid/three engines ship as standalone IIFE bundles under
 * `lib/assets/` and are fetched by the client ONLY when a spec needs them.
 * This route serves them from the plugin's own package directory through the
 * host webserver service — the longest-prefix rule lets it win over the
 * generic `/plugins` bundle route, and no host source change is needed. The
 * service is optional at this plugin's start time, so a dependency fiber owns
 * the registration and follows the webserver through late binding, replacement,
 * and plugin reloads.
 */

/** Route prefix under /plugins; anything under it is this plugin's asset. */
const ASSET_ROUTE_PATH = '/plugins/@changfenhuang/dsh-genui/assets'

/** Safe flat file names only: no slashes, no traversal, js assets only. */
const ASSET_FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.js$/

/** The handler itself (registered via the optional webServer probe). */
async function serveGenuiAsset(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405)
    res.end()
    return
  }
  let pathname: string
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
  } catch {
    res.writeHead(400)
    res.end()
    return
  }
  const rel = pathname.startsWith(`${ASSET_ROUTE_PATH}/`) ? pathname.slice(ASSET_ROUTE_PATH.length) : null
  if (rel === null) {
    res.writeHead(404)
    res.end()
    return
  }
  const file = rel.slice(1)
  if (!ASSET_FILE_RE.test(file)) {
    res.writeHead(404)
    res.end()
    return
  }
  try {
    // lib/index.js → ./assets/ = <pkg>/lib/assets/ (the tsdown asset outDir).
    const dir = fileURLToPath(new URL('./assets/', import.meta.url))
    const body = await readFile(join(dir, file))
    res.writeHead(200, {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'no-cache',
    })
    res.end(body)
  } catch {
    // Missing asset (old build) — a loud 404; the client shows its fallback.
    res.writeHead(404)
    res.end()
  }
}

const RENDER_UI_TOOL_GUIDANCE = '- Tool channel: render_ui 工具把同一 spec 渲染为工具行卡片；围栏用于回答内联 UI。'

/** The fence language description injected into every assembled system prompt.
 *  Deliberately slim: the `genui` skill carries the full component→field
 *  mapping; this section keeps only the contract that must always be
 *  present (fence syntax, type whitelist, and critical behavioral rules). */
export const GENUI_SECTION_TEXT = `You can render interactive UI components INSIDE your reply — between paragraphs — by emitting a fenced block with the language tag \`dsh-ui\` containing a JSON spec:

\`\`\`dsh-ui
{"title":"<user-language text>","gap":14,"items":[...]}
\`\`\`

Allowed \`type\` values; the \`genui\` skill, when available, carries the full content→component mapping and per-component field details:

- 布局: text · row · col · grid · card · divider · spacer · hero（封面块，一条回答最多一个）
- 展示: badge · stat · progress · list · table · keyvalue · timeline · file-tree · breadcrumb · callout · steps · diff · json · code · copy · avatar · audio · video
- 图表: chart {"kind":"bars|line|donut","data":[{"label":"...","value":n}],"series":[{"label":"...","data":[...]}]?,"horizontal":true?,"stacked":true?}（series：bars 分组/堆叠 / line 多序列；horizontal 横向柱） · echart (preset 名或 option 直通，预设清单见 skill) · plot (函数图)
- 交互: button · input · textarea · select · checkbox · switch · slider · radio · submit · quiz · link · tabs · accordion
- 高级: mermaid (流程图/时序/甘特/ER 等，关键字见 skill) · diagram (架构/流程图，27 种 kind) · scene3d (3D WebGL)

**默认就该出 UI**：出现下列情况至少出一个围栏：
- ≥3 条并列要点 → \`list\`；数字对比 → \`table\`；指标/进度/状态 → \`stat\`/\`progress\`/\`badge\`
- 步骤/时间线 → \`steps\`/\`timeline\`/\`mermaid\`；架构/流程 → \`diagram\` 或 \`mermaid\`；风险/结论 → \`callout\`；代码/改动 → \`code\`/\`diff\`/\`json\`
- 行内富文本：支持公式、\`code\`、加粗、高亮、链接；禁用 Markdown table / fenced code，改用 table / code / diff / json。
- 默认无卡：按触发条件使用组件，每个组件承载不同信息；卡片只用于并排项与数据对象，单段文字用标题、正文与间距。

**发回答前最后自检一次**：这段内容里有没有 ≥3 条并列要点、任何对比、任何数字/指标、任何步骤或流程？有就先转成组件再开口。**状态汇报、进度说明、提交与改动清单同样算**。
- 趋势/占比 → \`chart\`（≤8 点）或 \`echart\`（多序列/要交互时）；配色默认跟随主题，只有语义需要时才用 \`palette\`/\`card.accent\`；grid 子节点用 \`"span":2\` 跨列做宽窄混排；数据多时给 \`table\`/\`chart\`/\`list\` 配一个 \`input\`(id) + \`filter\` 绑定，读者能就地筛选。

**字段速查**（完整见 genui skill）：\`stat\` \`{"label","value","delta"?}\` · \`table\` \`{"columns":[...],"rows":[[...]],"types"?,"details"?,"filter"?,"export"?}\` · \`progress\` \`{"value":0-100,"label"?,"variant"?,"target"?}\` · \`keyvalue\` \`{"pairs":[{"key","value"}]}\` · \`steps\` \`{"steps":[{"title","desc"?}]}\` · \`file-tree\` \`{"items":[{"name","type":"file|dir","children"?}]}\` · \`callout\` \`{"content","tone"?,"title"?}\`

**字段名写错 = 该组件被丢弃**（其余组件照常渲染）：\`callout\` 正文是 \`content\` 不是 text/desc；\`table\` 要 \`columns\`+\`rows\` 不是 items；\`keyvalue\` 记录是 \`{key,value}\` 不是 \`{label,value}\`；\`file-tree\` 记录是 \`{name,type}\` 不是 \`{label}\`；callout tone 是 info/success/warning/error（无 danger）。不确定就调 \`validate_dsh_ui\`。

Rules:
- LANGUAGE: reply+UI=conversation language; schema fixed. NEVER infer it from prompt/skill/examples/tools. Replace \`<user-language ...>\`; never emit these placeholders literally.
- JSON 严格：坏组件被丢弃，坏围栏变代码块；≥3 节点或含 table 时调 validate_dsh_ui，按诊断修改并重验；小围栏字段存疑也先验证。
- warning=block_markdown：按 replacement 改写并重验。
- 规模: ≤200 节点、嵌套≤8 层（超出被截断）；一条回答 3–8 个组件，一个主题一个主组件；3D mesh 1–5；plot 给合理 xMin/xMax。
- LOCAL-FIRST + actions: UI 能自己做的状态变化（判卷、判题、重置、展开、选中）就地完成，零往返；action 只用于必须模型参与的事。交互以 [genui-action] name + 组件数据回传，届时重渲染更新 UI；无 action 的按钮禁用。
- Durable state: 交互状态按「会话+内容指纹」持久化——刷新/重放恢复；相同内容保留，新内容重置。
- 卷子模式: 每题一个 radio（group+answer+explanation）+ 一个 submit（groups 全列），本地判分。
- Secrets ban: 不索取密码、API Key、Token、恢复码；需要时拒绝并解释。
${RENDER_UI_TOOL_GUIDANCE}
- 围栏位置：\`dsh-ui\` 只写在**回答正文**；写在 reasoning/思考块里不渲染、用户看不到——思考里验证好 spec，正文再输出同一份。
- Panel: "panel":true 只渲染进会话面板 dock 并原地更新；"append":true 追加合并；上限 200 节点/200 次追加，满了发 replace 重建。面板来的 [genui-action] 只回一个 panel:true 围栏 + 至多一行 10 字内确认。`

/**
 * Register the GenUI output-language section and the render_ui tool.
 * @param ctx - cordis context.
 */
// `tools` is intentionally NOT injected: the service is optional for this
// plugin — hosts without tool access keep the fence channel working. Cordis
// inject entries are hard requirements, so the registry is probed at runtime
// instead (see apply).
export const name = '@changfenhuang/dsh-genui'
export const inject = ['systemPrompt']

const BUNDLED_SKILL_RANK = 600
const BUNDLED_SKILL_PROVIDER = 'dsh-genui'
const BUNDLED_SKILL_DESCRIPTION = 'GenUI dsh-ui component/schema reference. Preserve conversation language for all user-visible text.'
const BUNDLED_SKILL_INVOCATION = { modelInvocable: true, userInvocable: true } as const

/** Register through the provider path so source=bundled also gets bundled precedence. */
function bundledSkillProvider(): SkillProvider {
  const moduleDirectory = dirname(fileURLToPath(new URL(import.meta.url)))
  const path = basename(moduleDirectory) === 'plugin'
    ? resolve(moduleDirectory, '../../SKILL.md')
    : resolve(moduleDirectory, '../SKILL.md')
  const raw = readFileSync(path, 'utf8')
  const end = raw.indexOf('\n---\n', 4)
  if (!raw.startsWith('---\n') || end < 0) throw new Error('genui SKILL.md has invalid frontmatter')
  return {
    name: BUNDLED_SKILL_PROVIDER,
    list: () => Promise.resolve([{
      name: 'genui',
      description: BUNDLED_SKILL_DESCRIPTION,
      invocation: BUNDLED_SKILL_INVOCATION,
      source: 'bundled',
      provider: BUNDLED_SKILL_PROVIDER,
      path,
      resourceBase: { kind: 'directory', path: dirname(path) },
      rank: BUNDLED_SKILL_RANK,
      locator: path,
    }]),
    get: () => Promise.resolve({
      name: 'genui',
      description: BUNDLED_SKILL_DESCRIPTION,
      invocation: BUNDLED_SKILL_INVOCATION,
      source: 'bundled',
      provider: BUNDLED_SKILL_PROVIDER,
      path,
      resourceBase: { kind: 'directory', path: dirname(path) },
      content: raw.slice(end + 5),
    }),
  }
}

/**
 * Plugin config as the host passes it (unvalidated: the node half deliberately
 * imports no schema library, so a profile can set these keys directly).
 */
export interface GenuiPluginConfig {
  /**
   * 在最终 dsh-ui 围栏无法渲染的回合中请求模型发送一次修正版（issue #160）。
   * 默认开启，设置为 false 可以关闭同回合围栏修正。GenUI 回合的 reasoning-only 响应仍会交给宿主重试策略处理。
   * 每回合和每个围栏正文最多请求一次，子代理不触发，每次修正请求会消耗模型步数。
   */
  fenceFeedback?: boolean

  /**
   * 是否注册 render_ui 模型工具。默认开启，设置为 false 时关闭；不影响 validate_dsh_ui 和 dsh-ui 围栏渲染。
   */
  renderUiTool?: boolean
}

export function apply(ctx: Context, config?: GenuiPluginConfig): void {
  const renderUiToolEnabled = config?.renderUiTool !== false
  ctx.systemPrompt.section({
    name: 'genui:fence',
    order: ctx.systemPrompt.getSectionOrder('STRUCTURED_OUTPUT'),
    text: renderUiToolEnabled ? GENUI_SECTION_TEXT : GENUI_SECTION_TEXT.replace(`${RENDER_UI_TOOL_GUIDANCE}\n`, ''),
  })
  installFenceFeedback(ctx, config?.fenceFeedback !== false, renderUiToolEnabled)
  // Hosts without tool access keep the fence channel. The dependency fiber
  // starts whenever tools becomes available and unloads its registrations
  // before either the service or this plugin is replaced.
  ctx.inject(['tools'], (toolsCtx) => {
    toolsCtx.effect(function* () {
      if (renderUiToolEnabled) {
        yield toolsCtx.tools.register(createRenderUiTool())
      }
      yield toolsCtx.tools.register(createValidateDshUiTool())
    }, 'dsh-genui: model tools')
  })

  ctx.inject(['skills'], (skillCtx) => {
    skillCtx.skills.registerProvider(() => bundledSkillProvider())
  })

  // webServer.register returns a raw disposer, so an explicit effect binds the
  // route to the dependency fiber instead of leaving it in the host route table.
  ctx.inject(['webServer'], (webCtx) => {
    const webServer = webCtx.reflect.get('webServer') as { register(route: unknown): () => void }
    webCtx.effect(
      () => webServer.register({ kind: 'prefix', path: ASSET_ROUTE_PATH, handler: serveGenuiAsset }),
      'dsh-genui: asset route',
    )
  })
}
