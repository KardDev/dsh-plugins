# DSH Motion UI

为 DeepSeek Harness Web / Desktop 提供可交互组件、自由 HTML/SVG 图解与动画。引导模式会主动注入设计技能、协议和示例；自由模式让模型自主设计。设置位于首页 → 插件 → dsh-motion-ui。

Interactive, declarative tool views for **DeepSeek Harness Web / Desktop 0.2.0-rc.2 / 0.2.1-rc.1 / 0.2.1-rc.2**.

The plugin adds `render_scene` (short flow/comparison/allocation/budget data), `render_text` (quick native typography), `render_ui` (validated components), `render_canvas` (HTML/SVG), `render_mechanism` (compact assembly/kinematics scenes), and `ui_catalog` (protocol + examples). It saves per-document input state on the Host and sends explicit follow-up requests with the current parameter snapshot.

### v0.8.5：文档外壳与皮肤兼容

保护文档外壳的风格圆角，避免宿主／皮肤通用重置造成直角；标记承载节点保持透明、不添加第二层卡片。阅读／极简、设置预览和模型画布内部样式保持独立。

### v0.8.4：阅读阴影与跨轮视频修复

修复阅读／极简排版露出偏移阴影，保留内部卡片样式。历史视频留在所属回复，拼接成功后只展示成片及独立视频，并修复多轮播放器互相触发定位导致页面卡住的问题。

### v0.8.3：控件可读性与阴影卡片排版

改善动画控件的主题对比度，修正画布内边距造成的内部滚动。普通文字卡片保留阴影并随内容自动撑高；SVG 与定位布局增加越界诊断。

### v0.8.2：适配 DSH 0.2.1-rc.2

更新 SDK、兼容声明与依赖范围，保留旧版支持及现有 UI / 视频功能。Web 与原生 Desktop 已验证设置恢复和历史视频控件。

### v0.8.1：视频播放修复

修复 Desktop 视频无法拖动定位、成片与源画布重复显示，以及转义换行造成的源画布排版问题。Desktop 会先通过原有认证路由载入本地成片，再启用完整定位；离开会话释放载入数据。源画布仍可在智能 UI 侧栏查看，新版本编辑不会被旧成片覆盖。

### v0.8.0：从交互界面到视频成片

新增可定位动效时间轴、分镜预览、MP4 导出、本地视频检查与剪辑，以及 MiniMax 配音和字幕时间戳。模型可以按需读取完整动效设计技能，组织宣传片并交付 MP4、HTML 和可编辑工程 ZIP。聊天内视频支持播放/暂停、拖动、音量、倍速、全屏与下载。视频制作需要本机浏览器、FFmpeg 和 FFprobe；配音需要 MiniMax 认证，日常 UI 不会自动转为视频。

### v0.7.0：风格、交互与机制图解

六种风格拥有各自的构图与组件形态，设置提供六类真实样式预览；原生交互反馈全局增强。新增 `render_mechanism`，无需生成长篇绘图源码即可交付装配拆解、齿轮传动和曲柄连杆。保留现有文档协议、默认明亮扁平风格、自由模式和参数保存。详细更新见 [CHANGELOG.md](CHANGELOG.md)。

### 提示词组织

引导模式注入三段：通用设计与所选风格、共享接口契约、两个短案例。自由模式只注入表达选择和接口契约，不注入风格或案例。完整手册按需获取：`ui_catalog({topic:"text"|"native"|"visual"|"canvas"|"style"})`；画布加 `scene:"bicycle"|"oscillator"|"architecture"|"scatter"` 只取一个完整案例。通用设计吸收 Taste Skill 的内容优先、信息层级和实质简洁原则，具体配色、材质与构图仍由所选风格决定。

开发者可运行 `node scripts/audit-prompts.mjs` 统计实际注册的提示段、字符数和工具定义；设置 `MOTION_TOKENIZER_MODULE` 为已安装的 `js-tiktoken` 模块路径，可另算 `o200k_base` 参考 token。按需目录和条件纠错分别统计，不计入首次固定注入；参考值不等同于模型供应商计费。

### v0.7.1：轻量场景与局部修改

`render_scene` 直接把任务数据转换为完整的原生界面，保留所选风格、只读流式预览、正文标记、侧栏和独立参数保存。四种场景：`flow`（步骤）、`comparison`（方案）、`allocation`（总量按比例分配）、`budget`（两人一间房的住宿与交通预算）。其他构图仍用 `render_ui/render_canvas`，不会限制自由模式。

`render_scene({scene:"budget",title:"假设旅行预算",values:{people:3,nights:3,roomRate:600,transportPerPerson:800}})`

金额必须由用户、工具或明确标记的假设提供，不会补猜缺失数据。`ui_catalog({topic:"quick"})` 返回短调用示例。`inspect_ui({documentId,query:"总计"})` 可查节点位置和可修改字段；加 `detail:"nodes"` 只读取匹配源码，再使用现有 `patch_ui/update_ui` 修改原文档、保留兼容参数。

视觉观察新增透明背景对比度、文字裁切和明显尾部空白，并返回画布内定位、文字摘要；这些是启发式观察，不代替完整设计或无障碍验收。渐变、SVG 配色等未覆盖部分仍会明确标记。代码块的冗余 `copyable:true`、字面数字 `expr` 和与 state 完全相同的控件范围可无歧义兼容，冲突值与缺失图表数据仍报具体字段错误。

真实模型回归位于 `scripts/verify-model-usability.mjs`，需显式配置 `MOTION_WEB_LOG`（私有登录日志）或 `MOTION_TEST_URL`，默认 M3.1 Flash、测试结果工作区；设置 `MOTION_WORKSPACE_DIR` 可指定对应目录。模型等待无生成时限、不取消推理；记录纯文字、主动 UI、多文档、保参修改及首块可见时间，不把最终交付等同于首次成功。

### 扩展可视化（v0.6.0）

在原有轻量文字、原生控件和自由 HTML/SVG 画布之外，新增扩展原生组件语言。直接传入 `render_ui({document:{title,items:[...]}})`，或在回答中写 `dsh-ui` / `motion-ui` JSON 源码围栏；无需为普通测验、图表和表单编写 HTML。完整组件依次预览，整轮回复结束后保存并启用交互，正文与原生“智能 UI”侧栏共用同一份文档和参数。

| 场景 | 新增能力 |
| --- | --- |
| 日常表达 | 卡片、分栏、列表、时间线、标签、代码、JSON、复制、公式、选项卡 |
| 数据探索 | 本地表格排序、输入筛选、CSV 导出，轻量柱/线/环图，按需加载 ECharts（含词云等） |
| 学习解释 | 单题即时判分；多题单选统一提交、正确答案与解析、重新作答，全程本地完成 |
| 数学与结构 | 带参数的安全函数绘图、Mermaid、定位图解、SVG、可旋转缩放的基础 3D 场景 |
| 信息收集 | 表单收集参数，一次显式提交后续请求；控件变化不会逐次请求模型 |
| 保存分享 | 扩展可视化的 HTML / JSON 导出位于可选详情区；HTML 内嵌组件与所需图形引擎，媒体仍使用原地址 |

例如：

```js
render_ui({document:{title:"Git 小测",items:[
  {type:"radio",group:"q1",label:"提交记录什么？",options:["暂存区快照","所有未暂存修改"],answer:0,explanation:"git commit 记录暂存区快照。"},
  {type:"submit",label:"检查答案",groups:["q1"]}
]}})
```

`ui_catalog({topic:"visual"})` 提供完整字段和示例；`validate_ui` 可只检查而不创建界面。引导模式注入组件选择、协议与短案例；自由模式只提供必要接口说明。确定无歧义的数组适配包装与声明字段的数字/布尔字符串会先无损归一化，任意 JSON 数据和源码不会被随意改写。

这一扩展复用了 MIT 项目 [dsh-genui](https://github.com/omdsh-dev/dsh-genui) 的组件渲染与校验核心，基于 0.11.4 / `7ff0cf5`，保留其许可证和来源声明。Motion UI 自行管理工具、参数持久化、流式展示、侧栏与风格提示词，并增强测验答案持久化。图形和公式引擎从本地认证路由按需加载，普通文字回答无需加载这些资源。

我们吸收的是可验证的组件能力，并未复制上游宿主插件的所有交互：不提供其 `/panel` 命令或输入框常驻 dock，也未开放自定义渲染器注册 API。独立 HTML 保留本地交互，但无法发送宿主 Agent 请求或打开宿主文件；外部媒体仍需网络。函数图参数沿用组件内状态，跨文档精确共享计算请使用 Motion UI 的 `state/derived` 或画布。

### 连续修改、自动反馈与案例库

- 同一界面继续编辑：`inspect_ui` 获取版本，`update_ui` 追加或替换内容；操作有版本检查和去重重放，不必再生成一张。只有一个扩展根节点时，追加扩展片段会自动合并进去。保留原组件的唯一 `id`，可在重新排版后继续恢复兼容的参数和视图状态。
- 最终源码围栏若无效或缺少关键控件，插件在同一轮回复结束检查时反馈具体诊断。最多两次去重提醒；不限制思考时长，取消生成后不触发。设置里可关闭。
- 渲染工具失败后没有交付正文，或整轮只有思考、没有任何正文和工具调用时，也会反馈完成提醒。空交付提醒允许普通文字回答，不强制生成 UI；明确要求不用回复时跳过。
- 简短正文若只是“现在补上组件”“用流程图看最清楚”等 UI 交付声明，却没有实际界面，也会触发去重提醒。此检查仅匹配可见声明，不读取思考内容；已有界面、完整正文或 UI 概念问答不因这条检查重做。
- 非关键组件被修复省略时，工具明确返回部分交付及原因；关键题目/输入控件被丢弃时拒绝把结果当成成功。已知的标题、容器拼写与声明类型包装会安全归一化。
- 首页插件设置新增八类只读场景预览：重点说明、方案对比、简易流程、数据摘要、本地测验、需求表单、函数探索、结构图解。模型通过 `ui_catalog({topic:"templates",scene:"plot"})` 按需取一个短案例，避免每轮塞入整个案例库；自由模式不注入该设计指导。
- “运行状态”检查前后端构建、客户端渲染通道、原生侧栏、同轮反馈接口和本地资源路由；不会展示 API Key 或本地配置路径。
- 扩展表单、测验、函数图参数/视窗、表格排序、选项卡、折叠项和开关状态可保存、同步并带入导出。自动播放不按动画帧写入宿主；恢复时保持暂停。删除/改变字段语义时，模型仍应明确告知用户；不承诺把旧答案解释成新的问题答案。

### 日常阅读样式

生成期间支持渐进预览：文字和原生组件按完整且校验通过的块出现，HTML/SVG 先提供不执行模型脚本的静态预览。独立展示容器保留最后有效内容，后续思考不会主动卸载它；整轮结束后恢复参数并启用交互。宿主未传输增量时仍显示正常的正式结果。

展示位置统一通过正文 `dsh-ui` 标记定位，不再提供回答尾部和侧栏模式切换。通过 DSH 原生侧栏“智能 UI”入口查看当前会话的界面，正文和侧栏共享参数。旧 `displayMode` 配置保留兼容读取，但不再影响展示和提示词。

首页 → 插件 → dsh-motion-ui 的「视觉风格（仅限引导模式）」提供五套可点击预览：清爽阅读、柔和彩色、技术图解、活力展示、明亮扁平。每套可切换文字说明、双列对比、分隔列表、数据摘要和流程图解，共 25 种预览组合。切换预览只用于比较，不保存排版限制；点击风格卡片才保存选择。从下一次请求开始，只注入该风格的设计指导和两份短案例。组件、工具、状态、权限和已有界面保持原样。自由设计模式保留选择但不注入风格模板；切回引导模式后恢复使用。已有会话可能保留旧指导，对比时建议新建会话。

未选择过风格时，默认使用「明亮扁平」。已保存的其他风格继续尊重用户选择；自由模式仍不注入视觉风格模板。

明亮扁平参考 PrismFrame v0.2 的 Occamy 案例：浅彩背景、白色大圆角卡片、细彩色边线与偏移阴影，配色随解释内容变化。适配聊天宽度与内容高度，不复制视频字幕、页码或满屏留白，不使用玻璃效果。风格是模型生成偏好，并非强制重绘所有原生组件；简单文字仍走轻量排版。新增风格集中注册在 `lib/visual-styles.js`，设置预览、提示词和案例使用同一个注册表。

`render_text` 直接接收文字或原生节点，自动补齐节点 ID。八种独立预设：自然阅读 `reading`、简洁面板 `brief`、并排对比 `comparison`、分隔列表 `list`、重点提示 `callout`、评分摘要 `scorecard`、纵向流程 `flow`、极简文字 `minimal`。排版由模型按每块内容自选，设置不再提供默认文字排版。旧配置中的 `defaultPreset` 保留兼容读取，但不再影响提示词和生成；工具省略 `preset` 时安全回退到自然正文。

文字支持 `size`（12–48 px 或 sm/md/lg/xl/hero）、`weight`、`color`（语义色或十六进制色）、`align`、`lineHeight`；`spans` 可强调同一段中的部分文字。布局支持 `row.columns`（1–4）、`gap` 和 `divider`。日常默认采用轻边框与少量强调色。

```js
render_text({preset:"reading",blocks:[
  {type:"text",spans:[{text:"重点："},{text:"先交付最小完整结果",weight:700,color:"success"}]},
  {type:"link",text:"查看项目",href:"https://github.com/Scorp1o117/dsh-motion-ui",variant:"primary"}
]})
```

同一回复可调用多次，每份文档独立选择预设、配色并保存参数。正文定位时，每份成功结果使用自己的文档 ID 标记一次；没有标记时回退至回答下方。生成期间先逐步预览完整内容，回复结束后恢复参数并启用交互。

`link` 或 `button` 支持三种按钮外观：`primary`、`secondary`、`text`。`href` 打开 HTTP(S) 网页，`path` 通过 DSH 原生文件打开接口打开本地文件（可相对当前工作区）；仅在用户点击后触发。每个按钮只能指定一个目的地：网页、文件或 Agent `action`。不会向画布开放宿主文件或工具权限。

### Reliable process guides (0.5.5)

Static steps accept a direct items array without invented task statuses. The native tool schema now describes every registered component field and the nested step item structure. Exact lossless `items: {item: [...]}` adapter wrappers and literal boolean strings on details.open are normalized before native checks; ambiguous or unsafe inputs remain errors. Invalid steps report the node, index and correction. Failed tool calls retain their error in a compact message.

### Easier authoring and cleaner visuals (0.5.4)

The tool schema exposes the document structure and accepts common authoring forms: inline table/chart rows, Chinese identifiers, text metrics, table captions and structured canvas state (`type:"json"`, array/object, max16KiB per value). Runtime arithmetic and chart series still require numbers; unknown fields and unsafe properties remain errors. Prefer passing a document object directly and use `render_canvas` for HTML/SVG source.

The default display hides bottom diagnostics/history/parameter disclosures. Canvas export/reset/stop live in a compact top-corner menu. Optional details can be enabled under Home → Plugins. Rounded surfaces and soft gradients follow the host theme; canvas height fits content after rendering and shrinks when content is removed.

## Install

Install the published plugin (or paste `dsh-motion-ui` into Home → Plugins → Add plugin):

```powershell
dsh plugin --profile web add dsh-motion-ui
dsh web --no-open
```

The release artifact includes the generated browser bundle; users installing the tarball do not need the build tool. Restart an existing Web process after installation, then reload its browser page. Source builds are also supported: `npm ci --legacy-peer-deps` (DSH peers are supplied by the host), `npm run build`, `npm test`, then `npm pack` and install the generated tarball.

Development installs of `dsh-generative-ui` must be uninstalled before installing `dsh-motion-ui`; do not enable both because they register the same tools. Existing UI documents remain readable: the internal `dsh-generative-ui` storage directory, result metadata and authenticated route namespace are retained for compatibility. Plugin settings must be selected again under the new plugin entry.

## 模型生成效果 / Model-generated UI

以下是模型在 DSH 中实际生成并运行的界面，展示原生组件与自由 HTML/SVG 画布的组合。截图保留模型的实际布局与内容；动画展示为静态帧。它们来自开发期测试，代表这些案例的结果。

### 电压、电流与发热功率

**DeepSeek V4.1 Flash Fast · 主动选择 UI。** 用户只询问电压变化时电流和发热功率为什么不同，模型生成滑块、指标卡和联动曲线，用线性与平方关系解释差异。

![DeepSeek V4.1 Flash Fast 生成的电阻交互解释：电压滑块、三项指标和电流与功率曲线](https://raw.githubusercontent.com/Scorp1o117/dsh-motion-ui/main/docs/screenshots/fast-resistor.png)

### SVG 轨道动画

**DeepSeek V4.1 Flash · 按文字需求生成。** 模型自行编写 SVG、CSS 和动画逻辑，组合轨道图、速度滑块与运行开关；这是数学动画示意，并非真实天体模拟。

![DeepSeek V4.1 Flash 生成的 SVG 轨道动画：中心与环绕对象、速度控制和暂停开关](https://raw.githubusercontent.com/Scorp1o117/dsh-motion-ui/main/docs/screenshots/flash-orbit.png)

### 周期运动单摆

**DeepSeek V4.1 Flash · 按文字需求生成。** 振幅和频率控件驱动 SVG 摆动，支持暂停并保持当前角度；界面明确标注它是周期运动数学示意，而非真实物理仿真。

![DeepSeek V4.1 Flash 生成的交互单摆：SVG 摆体、摆角读数、振幅与频率滑块](https://raw.githubusercontent.com/Scorp1o117/dsh-motion-ui/main/docs/screenshots/flash-pendulum.png)

### 串联与并联电路

**DeepSeek V4.1 Flash Fast · 主动选择 UI。** 用户要求讲清两只电阻怎样分配电压和电流，模型生成接法切换、三个参数滑块、电路图、指标和对比曲线。下面展示完整界面。

![DeepSeek V4.1 Flash Fast 生成的串并联交互讲解：参数控制、电路图、等效电阻和响应曲线](https://raw.githubusercontent.com/Scorp1o117/dsh-motion-ui/main/docs/screenshots/fast-circuits.png)

[截图来源与生成方式](docs/screenshots/README.md)。

## Use

### Lightweight by default (0.5.3)

静态图解、简短流程、方案对比和小看板都是完整的 UI，不要求添加控件或动画。引导模式优先注入静态流程与对比示例，计算器随后；复杂动画示例留在按需目录中。`ui_catalog({topic:"quick"})` 提供四个轻量起点。画布可直接使用 `.ui-flow`、`.ui-step`、`.ui-arrow` 和 `.ui-callout`，无需重复编写样式或脚本。模型仍可按用户需求生成复杂界面；这些是默认表达指导，不是思考时间或输出截断。

每个文档在回答区域只保留一个展示实例。正文标记缺失时仅回退一次；标记后来出现或被删除时自动迁移。提交成功后退出同一调用的工具预览。手动打开的侧栏仍可作为独立视图与正文共享参数。

### Canvas delivery improvements (0.5.2)

Free canvases now include optional theme-aware `.ui-*` primitives for typography, controls, result readouts, SVG nodes, connectors and annotations. Guided mode actively injects a construction handbook covering Chinese label widths, connector routing, actual rendered SVG font sizes, validated calculations and reset behavior. Free mode retains autonomous composition and only receives the interface/delivery contract.

Validated native blocks and inert HTML/SVG previews appear progressively during generation. Preview roots survive tool-card and tail-seat replacement; incomplete or failed input never activates scripts. The final UI takes over after the entire turn ends and parameter restoration enables controls. Failed calls, retries, cancellation and conversation navigation clean transient previews.

Each committed canvas offers **说明与操作 → 导出独立 HTML**. The downloaded file includes the current parameter snapshot, the shared calculation interpreter and an isolated canvas. Declared state and derived results recompute locally without DSH or external libraries. It is a single-canvas export, not a complete mixed native layout; it does not send Agent requests or save back to DSH. Reloading the file restores the export-time parameters. External resources remain unavailable.

These improvements adapt the public design-system/skill, CSS-first streaming and standalone-export ideas from [CopilotKit/OpenIntelligentUI](https://github.com/CopilotKit/OpenIntelligentUI/tree/f6e4388b26a64b9a0714943b08a1ce622b924eec). The implementation uses DSH's existing state/validation/sandbox contract, without adding its separate router service or CDN execution model.

### Presentation, authoring and history (0.5.2)

Presentation uses same-conversation documentId markers in the answer. The model receives marker instructions for every successful UI tool result; missing markers retain a visible fallback. Tail/sidebar mode selectors have been removed. The native Intelligent UI sidebar tab lists current conversation documents; inline UI adds no sidebar button. successfully saved inputs synchronize between the inline view and sidebar, with explicit conflict/retry handling for concurrent drafts.

For simple formulas, write `derived: {power: {expr: "state.V * state.V / state.R"}}` and bind a metric with `{ref:"derived.power"}`. The authoring parser compiles to the existing bounded interpreter, including dependency/cycle validation. It supports arithmetic, comparisons, ternary conditions, parentheses, double-quoted strings, booleans and min/max/round/abs. It does not execute JavaScript or introduce a second calculation runtime. Existing op/args documents remain compatible; freeform animation continues to use the isolated canvas.

Each UI provides **版本历史** with read-only initial-state previews and restore. Preview never executes canvas scripts or writes input state. Restore appends a new head with the chosen document, retaining prior versions and current saved inputs; stale requests fail rather than overwrite another revision. The previous head is archived before replacement, and a failed head write cannot expose a fictitious future version. Preexisting documents start their available history at the first version observed after this update; overwritten older development revisions cannot be reconstructed. Archived input definitions must remain compatible. History uses the same authenticated Connection bridge and conversation ownership checks as document access.

Ask for the useful result naturally, for example: “Create an interactive theoretical weight-size calculator; distinguish estimated weights from real inference VRAM.” The plugin actively injects its design skill, complete protocol and minimal static and calculator worked examples through DSH's system-prompt service; the model does not need to discover a skill file or call a catalog to receive this guidance.

The packaged skill source is `skills/intelligent-ui/SKILL.md`. It teaches scene selection, composition, diagram grammar, theme/color/icon choices, responsive labels, local state, animation and error repair. `lib/ui-skill.js` injects it together with the shared protocol and concrete calculator/animation examples. It adapts public OpenUI, Diagram Design and Taste Skill ideas to DSH; it is not OpenAI's internal prompt. `ui_catalog` remains available for additional examples. This lowers the discovery/syntax burden for smaller models; it cannot guarantee complex program quality for every model.

Supported components: heading, text, card, row, column, metric, table, bar/line chart, numeric/text input, slider, select, toggle, follow-up button, badge, progress, ordered steps and collapsible details. Charts provide their full data as an accessible table. Controls compute locally without calling a model on each change.

The exact protocol and runnable examples are in `lib/catalog.js` and `examples/`. Component attribute definitions in `lib/components.js` drive both validation and capability discovery. `ui_catalog()` returns the protocol, component fields and two compact static examples; `ui_catalog({topic:"canvas"})` adds the full design guide and four distinct visual examples. Other topics are `quick` (four lightweight static layouts), `data`, `scenes`, and `all` (fourteen examples). This avoids sending every example on each request.

The tool card retains a text result. A state-only conversation extension replays standard successful tool results into the official `conversation.chat.turnTail` list slot, so the interactive UI stays visible when DSH folds work details. It does not modify DSH core or add custom persisted event types.

## Default visual design

Standard components receive the same theme-aware design, built-in line icons, clear metric hierarchy, section cards, switches, colored charts, and responsive controls. Existing documents need no changes. Fixed optional `icon`/`tone` tokens are documented in `ui_catalog`; freeform SVG/CSS belongs in an isolated sandbox node. Tones are static semantics and never infer safety from a number. On narrow screens, chart plots and tables scroll internally to preserve readable labels.

Heading/text/card titles are included in the default-state text projection. Conditional text uses a derived `if` expression returning strings; `examples/conditional-budget.json` demonstrates it. Comparison aliases `gt`, `gte`, `neq` supplement the existing operators.

## Scene designs

Optional `presentation: {layout, accent, density}` chooses an authored scene design:

| Layout | Suitable content | Visual treatment |
| --- | --- | --- |
| dashboard | Metrics, trends, analysis | Summary metrics with accent rules and chart hierarchy |
| workbench | Calculators, adjustable parameters | Grouped controls, input separators and result panels |
| comparison | Parallel alternatives | Equal choice cards, optional featured discussion focus |
| guide | Instructions, checklists | Ordered step rail and supporting details |
| status | Observed task snapshots | Header band, counts, progress and stages |
| report | Findings, methods and evidence | Reading hierarchy, inset sections and collapsible appendix |

Accent tokens: `blue`, `teal`, `violet`, `amber`, `rose`. Density: `comfortable` or `compact`. Cards may select `surface: "outline" | "soft" | "featured"`. Omitted presentation retains the original design. All variants inherit DSH's light/dark theme and responsive behavior. Fourteen available examples include six scene documents and four canvases: bicycle disassembly, sine motion, Agent relationships and speed/memory scatter analysis.

Progress requires `0 <= value <= max` with positive max. Steps use explicit `pending`, `active`, `done`, `error` statuses; these are declared snapshots, not automatic subscriptions to Host tasks. The model must ground real progress in tool evidence and visibly label demonstrations. Badges and colors supplement text; they do not establish a recommendation or task completion.

## Progressive generation

The native Tool slot subscribes to DSH's `useToolCallArgumentsPartial` hook. As one normal `render_ui` call streams, completed valid top-level subtrees appear in a disabled preview. Put version/title/fallback, presentation, state/data/derived/actions before nodes to make references available early. Incomplete strings, numbers and subtrees are never guessed or completed. Node IDs preserve existing DOM elements as sections append. Preview performs no state requests and cannot submit actions.

Only a successful Host result installs the durable interactive UI at the turn tail. Failed/cancelled tool results remove the preview and retain the ordinary error text. Refresh replays successful recorded results, not uncommitted argument prefixes. No custom transport or synthetic ui.begin/patch tool calls are needed.

## State and follow-ups

Validated original descriptions and versioned input snapshots live under `$DSH_HOME/plugins/dsh-generative-ui/`. An instance has a Host-generated UUID; saved input state is isolated by that UUID and the viewed conversation. Refresh restores successfully saved inputs. The original description and text fallback stay unchanged. Wait for **参数已保存** before closing the page; unsaved edits can be lost. Read failures offer a retry while controls remain disabled. Save failures preserve local edits and offer retry. Conflicts preserve the local draft and offer explicit remote adoption or keep-local retry; keep-local first reads the newest revision and still saves using compare-and-swap. A response lost after a committed write is handled through the same conflict path. Invalid numeric drafts remain visible until corrected or explicitly replaced by saved parameters.

Follow-up buttons send the current selected parameters through `ctx.sessions.scope(sessionId).get("conversation").send(...)`. The snapshot also includes all current derived values, evaluated with the same interpreter as the UI from the complete current state (stateKeys still filters only the submitted state). Derived numbers retain calculation precision; displayed metrics may be rounded. They report queue admission, not task completion. The agent uses ordinary DSH tools and permission controls for external effects. Local state is not silently injected into model context on every edit.

State API requests use the authenticated DSH Connection `/api` bridge, including its Host/Origin fence. There is no unauthenticated plugin HTTP endpoint. The plugin assumes DSH's single operator model; it does not implement multi-user tenancy.

## Live chart and table data

A derived root can use `{map:{source:"data.samples",fields:{...}}}`. Each output field uses the same bounded expression interpreter; `item.key` reads the current static source row, and normal state/derived references use the current parameters. Chart/table `rows` can reference this derived array. See `examples/live-memory-curve.json` for a working context/KV calculator. The renderer validates current result types on every recomputation; invalid dynamic data shows an error and disables follow-up.

Line charts support `xScale:"linear"` for quantitative samples and place points at their actual numeric x coordinates. Default category spacing remains backward compatible. Line y axes adapt to the data extent; bar charts include zero. Both preserve exact values in their accessible data table.

## Safety and limits

The Host validates JSON shape, registered fields/components, bindings, reference graphs, action keys, numeric ranges/steps and bounded expression operations. Standard components render text as text; expressions use a fixed interpreter. The explicit sandbox node accepts model-authored HTML/SVG, CSS and JavaScript in an opaque-origin iframe, never the host DOM. No direct tool-execution API is exposed.

## Freeform interactive canvas (0.5)

Use `{id,type:"sandbox",title,html,css?,script?,height?,fallback,stateKeys?,dataKeys?,derivedKeys?}` inside any normal UI container. HTML is a body fragment; JavaScript belongs in `script`, not HTML handlers. Inline SVG and CSS animations work. Each source field accepts up to 48 Ki characters, within the 128 KiB document budget. Initial height is 160–1000px; content reports its size and the renderer clamps automatic height to those bounds.

`DSHUI.snapshot` and `DSHUI.subscribe(fn)` expose selected host state/data/derived values and theme. `DSHUI.setState({key:value})` submits an atomic patch for declared state keys, using the existing validation, CAS persistence and recovery. Native controls and canvas share state. Theme variables are `--canvas-bg`, `--canvas-soft`, `--canvas-ink`, `--canvas-muted`, `--canvas-line`, `--canvas-accent`. See `examples/bicycle-explorer.json` and `examples/sine-motion.json` for two independent animations. The catalog includes both.

Canvas code starts only after successful tool commit and state restoration, with an explicit loading state. Parameter changes preserve the frame; reset/source changes restart it. Stop removes it. Normal auxiliary controls and explanation live in the collapsed “说明与操作” menu. Errors expose recovery buttons and a readable message while technical details remain collapsed. Preview contains no executable iframe. Important inputs must live in document.state; animation time restarts on reload. Each canvas includes a text alternative.

Prefer `DSHUI.animate(({time,delta,reducedMotion,visible}) => {...})` for animation. It returns an unsubscribe callback; time/delta are seconds, delta is capped at 0.05. The helper pauses offscreen/background, resumes without accumulating hidden time, and supplies a static delta=0 frame for reduced motion. Integrate delta when the user's running switch is on. `DSHUI.snapshot.visible` reports visibility separately from input validity. Native visibility and media changes refresh the drawing. Raw requestAnimationFrame code remains available but must manage its own lifecycle; existing saved programs are not silently rewritten.

Isolation uses `sandbox="allow-scripts"` without same-origin permission, restrictive CSP, nonce-bearing scripts and a source-window/instance-checked message bridge. CSP blocks fetch, external images/scripts, nested frames and eval. The frame cannot read host cookies, storage or DOM. Undeclared/out-of-range state patches are rejected. No Agent action bridge is provided in 0.5.

This is origin isolation, not a hard CPU/memory limit: expensive/infinite generated code can still affect responsiveness. CSP is not a universal navigation firewall; self-navigation can initiate a request before the renderer stops the navigated frame. Do not send credentials or unrelated private data into generated programs. Remote assets/imports and arbitrary tool access are not supported.

Budgets: 128 KiB UI document, 160 nodes, 12 nested component levels, 500 data rows, 64 keys per dictionary, 128 expression nodes and 4096 evaluation steps. Maps allow 1–16 scalar fields, at most 500 generated rows across all maps, no nested maps, and at most 128 KiB derived output. State writes accept up to 64 KiB. Invalid input returns a tool error so the model can repair it or answer in text.

## Current scope

- Web and Desktop; tested runtimes 0.2.0-rc.2, 0.2.1-rc.1 and 0.2.1-rc.2.
- Direct native calls have custom UI. PTC/composite calls may omit presentation metadata and retain the text fallback.
- Generation supports completed-subtree previews from native argument streaming. Nested incomplete cards wait until whole; separate incremental event protocols remain outside this release. The development additions below support validated edits to committed nodes.
- Tables/charts display supplied datasets or bounded derived rows. Custom local programs, SVG animation and lightweight demonstrations use sandbox nodes; remote resources and host tool access remain outside their scope.
- Stopping/removing the plugin leaves standard tool call/result history and its full initial text fallback readable. Saved input snapshots remain on disk; removal does not delete user data.
- No claim of implementing ChatGPT's proprietary UI protocol or compiler.

## Release development and verification

The scoped release requirements and source attribution are in `RELEASE-PLAN.zh-CN.md`. Build metadata (`lib/build-info.js`) is generated from the version and source hash; native roots expose its ID through `data-dgui-build` for installed-build verification, without adding implementation labels to the interface.

Run `npm run verify:release` with `DSH_PLAYWRIGHT` pointing to an installed Playwright module and Edge available. It builds and runs unit/integration checks plus canvas, scene/stream and recovery browser acceptance, writing `test-output/release-verification.json`. Set `DSH_VERIFY_INSTALLED=1`, `DSH_WEB_LOG` and `DSH_CANVAS_RESUME=1` to also replay the previously generated native verification session. Real-model creative acceptance is recorded separately because it requires the configured model and creates conversation content. A successful local runner alone does not prove installed/model acceptance.

## Development

### Authoring and model guidance (0.5.2)

Both design modes receive a shared intent and delivery policy before the design contract: use UI proactively for relationships, trends or changing parameters when it materially improves explanation, without waiting for a user to name UI. Simple facts, short definitions and explicit text-only requests remain text. The first submission should solve one core relationship with a complete working interaction and readable narrow-screen layout; avoid designing a multi-page application before any useful result. This is model guidance, not a hard inference timeout or proof of universal model capability. Free mode still leaves visual composition and styling to the model.

Configure the plugin under Home → Plugins → dsh-motion-ui, alongside the other plugin settings; there is no separate global settings entry. PC landscape is the primary design and visual acceptance target (1365px/1920px viewports at the actual chat-column width); mobile remains supplementary. Model acceptance waits for natural completion without cancelling inference or imposing a thinking timeout. Earlier interrupted observations are kept separate from natural-completion results.

The plugin setting `designMode` selects `guided` (default, full design skill/protocol/examples) or `free` (only the free-canvas interface, state/lifecycle and essential execution constraints). Free mode removes the layout curriculum and worked UI examples from automatic injection. It does not identify a model as strong or weak, and neither mode changes permissions. The setting is read on each prompt assembly; old model context may still contain prior instructions, so compare modes in fresh conversations.

`render_canvas({title,fallback,css,html,script?,height?,state?,data?,derived?})` creates a single authored canvas with node ID `canvas`. All content, custom controls, graphics, colors and composition can be authored inside it. State/data/derived keys are shared automatically; the same validated bridge, persistence, source limits and inspect/patch operations apply. `render_ui` and optional `ui_catalog` remain available for mixed native components. Both entries support the configured presentation location. Complete CSS followed by partial HTML produces a non-interactive static preview; generated scripts start after successful submission and parameter restoration.

Latest-document fetch errors now show an explicit known-version notice and retry control instead of silently pretending the original payload is current. `inspect_ui` defaults to a source-free summary; request `detail:"nodes",nodeIds:[...]` for exact source or `detail:"full"` when the whole document is necessary. Large state/derived summaries explicitly mark omissions. Automatic repair guidance caps retries at two rounds per user request; this is a model behavior rule, not a provider inference timeout. Display observations now identify native nodes where possible and report bounded coverage counts; unsupported contrast cases are explicitly unobserved.

The injected skill includes a complexity ladder, common parameter repairs and a read/inspect/refine workflow for models of different capabilities. Native components are preferred for simple calculators; authored HTML/SVG remains available for explanatory diagrams and animations. Tool JSON fields accept either a JSON value or one bounded JSON-encoded string, followed by the same strict validation; encoded streaming documents wait until the full string is available.

`inspect_ui({documentId})` returns the latest document/revision, saved inputs, computed derived values and recent client display observations. The folded display check observes horizontal overflow, small rendered text, unnamed controls, known solid-background HTML contrast and reported canvas errors. These are bounded heuristics at the recorded width/theme/time, not a visual quality certification; SVG paint contrast and complex backgrounds are not scored. An unopened client has no report.

`patch_ui({documentId,documentRevision,changes:[{id,props}]})` edits existing node properties after whole-document validation. It keeps the document identity, state/data/derived definitions, node structure, bindings and actions. Revision conflicts require another inspection. Unaffected frames and expanded details survive; replacing canvas HTML/CSS/script restarts that canvas while preserving declared parameters. Refresh loads the latest document revision instead of reverting to the original tool payload. Tools require the creator conversation; display observations are stored separately and stale revisions are excluded.

Local browser/model evidence lives in ignored test-output/. Model acceptance is restricted to the 测试结果 workspace; optional legacy installed checks should only be enabled in an appropriate test profile.

The ongoing optimization benchmark uses GOAT/commandcode `deepseek/deepseek-v4.1-flash-fast`, with the actual provider, model and reasoning setting verified from request records. Compare fresh conversations with identical prompts and keep baseline outputs; no inference deadline or automatic cancellation is applied. First successful UI submission and natural turn completion are separate measurements from browser verification time. PC screenshots use the visible 1920×1080/1365×1080 chat viewport.

Authored canvases can call `DSHUI.formatNumber(value, decimals=2)` to match native metric and fallback display exactly (finite numbers, 0..6 decimal places, comma grouping). Read shared derived values before formatting. Existing authored scripts retain their own formatting until revised; this helper does not rewrite model source. Validation errors list allowed fields at the failed scope and give actionable map-source/key guidance while retaining strict validation.

Source: `lib/protocol.js` (shared validation/calculation/fallback), `lib/store.js` (versioned Host state), `index.js` (DSH adapter), `src/view.js` (React renderer), `src/client.jsx` (slot adapter). `npm run build` generates `client.js` with React supplied by DSH's ModuleLoader.

Run `npm test`, `npm run build`, and `npm run check` before packing. Browser smoke scripts and verification notes are kept under `tests/` and `VERIFICATION.md` in the source checkout.






### 可复制的文本与代码

`render_text` 支持 `{type:"text",title:"文案",text:"正文",copyable:true}` 和 `{type:"code",lang:"bash",code:"git status"}`。文本按需显示复制按钮，代码默认显示；按钮位于右上角，复制后反馈成功或失败。代码保留原始缩进与换行，默认长行横向滚动，可设 `wrap:true` 换行。扩展组件也支持同样的复制面板（文本使用 `content`）。

引导模式的视觉风格会同步应用于原生卡片、指标、控件和可复制内容块，也会注入模型风格提示及案例。切换风格即时更新原生外观和侧栏副本，不修改已生成 HTML 的源码，不改变输入值或计算。自由模式关闭这层风格覆盖。

### 动态交互与柔光渐彩（v0.7.0）

新增「柔光渐彩」可选风格：浅色渐彩背景、实色圆润卡片、深色胶囊按钮与柔和阴影，无玻璃材质。设置中提供六种布局预览与本地交互演示，不改变现有明亮扁平默认值。

原生 select 可设置 `variant:"segmented"`，适合 2..8 个短选项，其他情况自动回退下拉框。滑块值填充、开关、复制反馈与关联进度提供短促过渡；精确数值即时更新，减少动态效果和只读预览不播放交互动画。`ui_catalog({topic:"motion"})` 返回简短目录，加 `scene:"plan"/"checklist"/"copy"/"plot"` 只取一个完整示例。示例数据需替换为真实任务数据，不能将演示动画当作实际操作结果。


### 本地开发修正：动效与风格解耦

原生按钮的磁吸/填充/文字换位、开关拖拽回弹、数字步进和指标更新反馈适用于所有风格；自由模式保留原生交互反馈且不注入视觉风格。柔光渐彩统一文字层级、卡片、指标、表单、表格、流程与复制块外观。五类风格预览移除额外演示按钮，直接展示布局材质。默认仍为明亮扁平，本次不发布或增加版本号。


### 本地开发：视觉风格系统重构

六种稳定风格 ID 和明亮扁平默认值保留。新增构图、文字层级、表面、控件、反例的统一风格语法；原生文字/卡片/指标/表单/流程/表格/复制块与扩展卡片/指标有独立形态。所有风格保留共享交互动效，反馈幅度/节奏适配语言，减少动态效果仍优先。设置提供六种布局预览（含控件表单），直接复用生产组件 CSS，预览不包含可操作控件。相同内容的深浅主题、黑白对照、显式文字样式优先、输入焦点及数值保留加入回归。自由模式不注入这些风格。这些改进随 v0.7.0 发布。

### 结构拆解、工作原理与机械动画（v0.7.0）

常见场景直接调用 `render_mechanism({scene:"assembly"|"gears"|"crank",title?,rpm?,teeth?,radius?,running?,angle?,explode?})`，插件生成图形、控件和参数绑定，无需模型复制绘图源码。其他结构可按需读取 `ui_catalog({topic:"mechanism",scene:"assembly"|"gears"|"crank"})`，获取精简调用与自定义接口。三个原创案例分别覆盖分层装配、齿轮传动、曲柄连杆；用户可以选择部件、调整拆解进度、隐藏外壳、改变转速/齿数/曲柄半径、暂停和手动调角度。六种引导风格继续生效，自由模式仍可自行设计。

例如，下面这一小次工具调用会同时生成齿轮图、参数控件和实时读数：

```js
render_mechanism({scene:"gears", rpm:20, teeth:32})
```

画布显式声明 `libraries:["mechanism"]` 后，隔离框架内才会启用本地 `DSHUI.mechanism`。可用 box/cylinder/gear/rod/spring 组合自己的结构，使用 mount/pose/update 驱动图形；gearPair、sliderCrank 提供同源数值和运动。无需模型重复生成整套 SVG 引擎。普通画布不注入该辅助库；现有源码限制、共享状态验证、网络隔离、减少动态效果和离线导出保持适用。静态轮廓先预览，回复完成并恢复参数后启用完整立体图解。

这是教学几何与运动学：简化齿形不能用于加工，隐藏盖板不是任意实体剖切，按层与深度排序不构成精确遮挡/碰撞审计。瞬时动画相位不持久化，用户参数仍保存。

投影和轮廓数学参考并使用 [Anatomy](https://github.com/wheresryan22/anatomy) 的 MIT 代码（固定版本及许可证见 `lib/third-party/anatomy-NOTICE.md`）。插件的状态桥接、机制案例、渲染与交互逻辑为本项目实现，没有引入完整上游工作流或其 3D 引擎。

## 可定位动效与视频制作（v0.8.0）

动效语言适用于所有视觉风格：通过焦点、连续性、因果和阅读停顿组织变化。自由模式不注入这套美术指导。`ui_catalog({topic:"motion"})` 返回简短索引，`scene:"timeline"|"stages"|"path"|"typography"` 按需返回原创例子；`scene:"reference"` 提供参考录屏分析流程，完整代码不会常驻注入每次对话。

画布可用 `DSHUI.timeline({id:"main",duration:6,draw(time,info),chapters:[{time:0,label:"输入"}],autoplay:false})`，返回 `play/pause/seek/replay/chapter/subscribe/dispose`。`draw` 从绝对秒数和当前参数同步绘制，支持倒拖与分步定位；用户参数继续保存，瞬时进度不逐帧写回。现有 `DSHUI.animate` 保留。离屏、后台和减少动态效果适用于新时间轴。

模型可直接使用五个工具完成视频任务：

- `preview_video({documentId,duration,times?,width?,height?,theme?})`：直接从可编辑时间轴抓取关键画面和联系表，先看图修正，再导出全片，不必反复编码 MP4。`complete=false` 返回时间/元素诊断并保留有效帧；无效样本不会伪装成已检查画面，修正后应重新预览。
- `synthesize_voice({text,voice?,model?,speed?})`：生成真实配音、时长与字幕时间戳，需要用户配置的 MiniMax 认证，调用付费 API。
- `inspect_video({path,times?:[seconds]})`：读取实际时长、尺寸、帧率和音轨，抽取最多 12 个时间点及联系表。模型应实际读取图片再分析；这不是语音识别、自动目标跟踪或完整视频理解。
- `render_video({documentId,nodeId?,duration,width?,height?,fps?,theme?,audioTracks?,audioPath?,audioVolume?,captions?})`：将已保存的一个画布导出为可编辑 HTML、文档/参数快照、制作参数和真正的 MP4。画布须有唯一 `#stage` 和唯一 `DSHUI.timeline`，ID 为 `main`，时长与导出一致。舞台外控件不进入视频。支持本地配乐和精确时间字幕；配乐副本随源码保留，下载后放在 HTML 同一目录，可手动开启，并随播放、暂停、定位同步。
- `process_video({clips:[{path,start?,end?}],width?,height?,fps?,audioPath?,audioVolume?,captions?})`：截取、按顺序拼接、等比适配/补边；保留原音轨，指定配乐时替换原音轨；字幕形如 `{start:0,end:1.5,text:"说明"}`，按输出时间排列，空隙不显示上一条字幕。生成新文件，原素材不覆盖。

视频渲染需要本机 Chrome/Edge 或 Playwright Chromium、FFmpeg、FFprobe。插件仅携带浏览器控制库，不自动下载浏览器/编码器。插件设置中的“检查视频环境”或 `ui_catalog({topic:"video"})` 可以检测；环境变量 `DSH_MOTION_BROWSER`、`DSH_MOTION_FFMPEG`、`DSH_MOTION_FFPROBE` 可指定可执行文件路径。视频需显式请求，普通对话 UI 不自动转成视频。

默认 1920×1080、30fps；允许偶数尺寸 160..3840 × 160..2160、1..60fps、0.1..600 秒，单次最多 36000 帧。超出预算明确报错，可拆成章节，不截断产物。这些是媒体任务预算，不改变模型推理、输出或运行时限。渲染不提供硬性的恶意代码 CPU/内存隔离。

每次导出检查实际尺寸/时长、音轨存在性和完整解码，失败保留源码与真实错误；检查通过不等于美术质量合格。任意 JS 的时间累加、独立 CSS 动画和未设种子的随机状态不会被自动改造成可导出时间轴。配音可使用 `synthesize_voice`；图片和生成式视频素材使用宿主实际提供的工具，插件不虚构素材或模型 API。

工作流参考 [OpenDesign Motion](https://github.com/nexu-io/open-design/pull/8619) 的源码/视频双交付、按需技能和时间轴思路。本项目的时间轴、原创案例及导出/处理实现独立编写，未复制其 GSAP 播放器；完整 motion-design 技能以原文和独立 DSH 适配说明按需提供，来源与许可见下文。

### 一段需求制作宣传片（v0.8.0）

可以请求模型自行组织文案、分镜与 HTML/SVG 动效，再用 `render_video` 交付真实 MP4 和可编辑工程 ZIP。`ui_catalog topic=video scene=promo` 按需提供制作流程，普通对话不加载整套视频手册。

支持两种创作方向：口播讲解按真实语音组织信息；音乐驱动的产品片用大字、贯穿图形变形、能力演示和镜头切换表达产品，不强制添加旁白或字幕。可提供参考片，让模型分析其构图与转场机制，再独立创作。交互数据、机械部件和图形应有可见的因果变化，不能仅靠静态卡片和换色表示能力。

完整内置 OpenDesign 的 `motion-design` 技能，保留原文、固定来源版本与 Apache-2.0 许可，并通过独立 DSH 适配文档映射工具、时间轴和音轨。`ui_catalog({topic:"motion",scene:"motion-design"})` 或 `ui_catalog({topic:"video",scene:"promo"})` 按需返回技能全文，不把正文注入日常对话。上游 OpenDesign CLI/GSAP 播放器协议不作为 DSH 的可调用接口。

`render_video` / `process_video` 的成片在聊天中直接显示播放器，固定控制条提供播放/暂停、进度与时间、音量/静音、倍速和全屏，可下载 MP4、源码和工程。历史工具结果也支持重放为播放器，无需重新生成影片；同一画布的再次导出更新对应播放器，其他影片独立保留。后续正文更新保持播放位置，离开聊天停止声音，多个影片互斥播放。音量和速度在本机记忆；加载失败提供重试与下载入口。

需要本机 Chrome/Edge、FFmpeg、FFprobe。可选的 `synthesize_voice` 调用 MiniMax 付费语音 API，使用官方 mmx 认证或 `MINIMAX_API_KEY`（可选 `MINIMAX_REGION=cn/global`）；不会从 DSH 模型配置中复制密钥。返回真实音频时长及字幕时间戳。通过 `audioTracks` 混合旁白、用户提供的音乐和音效，支持音量、偏移、循环音乐和淡出；旁白不允许循环或被截短。没有配置语音服务时仍可导出无声动效。

示例需求：为我的插件制作一段 30 到 45 秒横屏宣传片，自行写文案和分镜，展示解决的问题和三个核心功能，用中文配音、清晰字幕和不同构图，交付 1080p30 MP4 及可编辑工程。

视频抽帧检查是稀疏视觉观察，不等于完整听审、自动转录或自动剪辑任意素材。外部素材的可用性和授权由提供者负责；不自动下载大型运行时或音乐库。
