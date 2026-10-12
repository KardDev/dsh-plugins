# DSH Motion UI

## 0.6.0 — 2026-10-12

这次更新让 Motion UI 更适合日常对话：简短说明可以快速排版，复杂内容可以组合图表、表单和图解；所选风格也会覆盖原生组件，让 HTML 画布内外更统一。

## 日常文字与可复制内容

- 新增轻量 `render_text` 入口，普通文字无需编写 HTML，自动补齐节点 ID。
- 提供自然阅读、简洁面板、并排对比、分隔列表、重点提示、评分摘要、纵向流程、极简文字八种排版预设，由模型按内容选择。
- 支持文字大小、字重、颜色、对齐、行距与段内重点标注。
- 新增原生代码块和可复制文本块，右上角小按钮复制正文或代码，保留缩进与换行，提供成功/失败反馈。
- 新增网页与本地文件链接按钮，点击后才打开目标。
- 一次回复可以交付多个独立 UI，各自保留布局、参数与正文标记。

## 五种视觉风格，设置里直接预览

- 首页 → 插件中可选择清爽阅读、柔和彩色、技术图解、活力展示、明亮扁平。
- 每种风格提供文字说明、双列对比、列表、数据摘要和流程图解五种布局预览，点击选择即保存。
- 新配置默认使用明亮扁平；保留用户已经保存的风格选择。
- 引导模式同步原生卡片、指标、控件、按钮与复制块的外观，并注入对应设计提示词和案例。
- 明亮扁平采用浅彩底、白色大圆角卡片、彩色细边与轻偏移阴影，改善混合 HTML 界面外部过素的问题。
- 自由模式关闭风格提示及原生风格覆盖，让模型自主设计。切换设置不会改写已生成 HTML 源码或重置输入值。

## 扩展可视化组件

- 支持扩展 `title/items` 组件描述，与原有 v1 组件、HTML/SVG 画布组合使用。
- 新增表格排序/筛选/CSV 导出、选项卡、时间线、代码与 JSON、媒体、数学公式等组件。
- 支持 ECharts（含词云等）、Mermaid、安全表达式函数绘图与基础可旋转 3D 场景；引擎从本地认证路由按需加载。
- 支持单题即时判分、多题统一检查答案与解析、表单收集后一次提交后续请求；简单交互在本地完成。
- 复用 MIT 项目 [dsh-genui](https://github.com/omdsh-dev/dsh-genui) 0.11.4 的组件与校验核心，保留许可证和来源声明；Motion UI 自行管理宿主工具、状态、侧栏和风格引导。

## 渐进预览与正文展示

- 接入工具参数流与显式 `dsh-ui` / `motion-ui` 源码围栏，完整组件可以逐步预览，HTML/SVG 先显示静态内容。
- 预览独立于工具卡片生命周期，避免模型继续思考、输出时界面闪现后消失。
- 预览阶段保持只读；整轮回复结束后保存并启用交互及模型生成的画布脚本。
- 统一使用正文标记定位，删除回答尾部/侧栏展示模式选项。DSH 原生“智能 UI”侧栏随时可用，正文不再显示额外侧栏按钮。
- 同一界面只保留一次正文展示，重复标记不会重复挂载；正文和侧栏共享保存的参数。

## 连续编辑、恢复与交付可靠性

- 新增 `update_ui` 追加/替换操作、修订校验、幂等重放与历史归档，保留兼容的用户参数。
- 保存扩展组件的测验答案、表单字段、函数图参数/视区、排序、选项卡、折叠状态等；内部状态不会混入提交给模型的表单字段。
- 新增只读 `validate_ui`、更易用的 `inspect_ui`、八场景案例库和前后端构建/本地资源运行诊断。
- 简化 `render_text` 工具传输 Schema；对明确无歧义的字段别名、数组包装、数字/布尔字符串做归一化，保留严格运行时校验，不随意改写源码或数据。
- 可选的同轮自动反馈覆盖无法渲染的源码围栏、工具失败后的空交付、仅思考无正文，以及简短“要做 UI”后直接结束的情况；提醒去重，不限制模型思考时间或输出长度。
- 已成功交付、正常文字回答、明确要求不回复、取消操作和子 Agent 不会被强行补 UI。模型是否选对展示方式、生成代码是否正确仍需结合实际内容判断。

## 导出与兼容

- 扩展组件支持 HTML / JSON 导出，HTML 内嵌所需组件、图形引擎与公式字体，保留本地交互；外部媒体仍使用原地址。
- 独立 HTML 不执行宿主 Agent 请求，也不能打开宿主本地文件。
- 面向 DSH 0.2.0-rc.2 的 Web 界面，已验证对应 Web 与 Desktop 宿主中的插件加载和前后端构建一致性。
- 旧文档和存储标识继续兼容；旧展示模式与默认文字排版配置保留读取兼容，但不再限制新界面。


## 0.5.6 — 2026-10-10

- Disable tool-time UI preview and defer committed UI presentation until durable turn/end. Reasoning/text still stream normally. Completed, interrupted and failed turns reveal successfully generated UI; partial/failed tools do not produce a flashing canvas.
- Identify missing/invalid/duplicate node IDs separately with exact nested locations and first duplicate provenance. Mixed canvas/controls accept arbitrary JSON field order. Omitted canvas title/fallback inherit document values; guidance clarifies that state declarations do not create controls.
- Use durable turn completion rather than live tail anchor values for presentation. Regression checks cover pending tool/result stages, late markers, single presentation, saved input and iframe identity after display.
- Normalize plain numeric/boolean transport strings only in declared typed fields, and exact item-array wrappers across controls, nested containers, formulas, tables and action scopes. Preserve ordinary text, data and canvas source.
- Decode a single state-specification JSON object or exact singular object wrapper, with unsafe-key/depth checks reapplied.
- Name missing numeric fields, invalid ranges, options and formula argument paths in repair guidance. Inject a complete numeric-state example and recommend formula shorthand instead of deep argument trees or probe UIs.
- Clarify round semantics, shared-state controls and direct UI-tool usage in injected guidance; use ui_catalog for protocol questions instead of searching DSH installation sources.

## 0.5.5 — 2026-10-10

- Describe all registered component fields in the native tool schema, including the nested steps item shape, and inject a minimal static process example.
- Accept the exact lossless `items: {item: [...]}` adapter wrapper before native tool checks; static steps no longer require a task status. Normalize literal boolean strings on details.open.
- Identify invalid steps by node, item index, actual type/count and correction example. Render tool failures as compact readable messages instead of full UI cards, preserving the actual error.

## 0.5.4 — 2026-10-10

- Publish a native object schema for render_ui, including the document skeleton and component vocabulary. Legacy JSON strings are decoded internally; models are no longer offered a string branch that encourages double escaping.
- Accept JSON fences/trailing commas outside strings without guessing malformed quotes or executing source. Errors identify the failed field and JSON location where available.
- Support string/boolean metrics, optional table captions, inline table/chart rows, scoped row shorthand, and Unicode identifiers consistently across formulas, maps and references.
- Add bounded structured JSON state for canvas checklists/objects, preserving arrays and objects through persistence and standalone export. A string state with a structured default and no options is canonicalized to json; native inputs still require scalar state.
- Default to a clean view: hide footer diagnostics, history, parameter status and original-description disclosures. Home → Plugins offers optional details. Canvas actions use a compact menu; charts expose data through a title-row button.
- Use rounder surfaces and soft theme-aware gradient fills. Committed, preview and exported canvases fit content height rather than keeping a 160px minimum; filtering can shrink them again.

## 0.5.3 — 2026-10-10

- Prefer lightweight static diagrams, concise comparisons, short processes and compact dashboards; controls and animation are added when useful.
- Inject static flow/comparison examples before the calculator, and add `ui_catalog({topic:"quick"})` with four short layouts.
- Add reusable theme-aware flow/node/arrow/callout styles; static views omit parameter-save status and use the broader “可视化” label.
- Elect one answer-area owner per document when multiple tail seats mount, and retire stale tool previews once the committed UI is available. Missing, late or removed inline markers retain a single fallback view. Explicitly opened sidebars remain separate views.

## 0.5.2 — 2026-10-10

First public release for DeepSeek Harness Web 0.2.0-rc.2.

- Native interactive components, six scene layouts, theme-aware colors and icons.
- Freeform HTML/SVG/CSS/JavaScript canvases in an isolated iframe, with local controls and animation.
- Guided and free design modes; guided mode injects design skills, protocol and worked examples into model context.
- Static streaming previews, persisted parameters, shared derived calculations and contextual follow-ups.
- Answer-tail, inline marker and PC sidebar presentation; revision history, inspection and targeted refinement.
- Single-canvas standalone HTML export carrying current parameters and local calculations.

Validation: 54 automated tests, 11 release checks, and natural-completion DeepSeek V4.1 Flash Fast trials. Model-authored typography and contrast still vary; diagram precision and generated program correctness require review. Standalone export excludes surrounding native UI controls. External libraries/resources and direct host access are unavailable in canvases. Desktop compatibility is not claimed.

Development migration: uninstall `dsh-generative-ui` before installing `dsh-motion-ui`. Legacy storage, tool result metadata and route identifiers remain compatible; configure design/display modes again in the new plugin entry.
