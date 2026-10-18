# DSH Motion UI

## 0.8.5 — 2026-10-18

### 文档外壳与皮肤兼容

- 加固原生文档外壳的圆角边界，避免通用宿主或皮肤的 section 圆角重置将文档变成直角（Issue #3）。
- 沿用各视觉风格的外壳尺寸，明亮扁平、柔和笔记、技术图解等保留不同圆角；阅读／极简保持无外壳，设置预览保持原有样式。
- 标记插入位置只负责承载界面，清除其额外边框、背景、阴影和内边距，避免皮肤把它再次装饰成卡片。
- 不重写模型生成的 HTML/SVG 或画布内部样式，保留独立文档、交互状态与内容布局。

### 验证

- 新增 576 个风格、排版、主题、宽度与样式加载顺序组合检查，覆盖皮肤先加载／后加载和设备缩放 1.5。
- 验证通用重置规则下的直角复现、各风格外壳恢复、内部卡片、画布内容、自由模式与预览样式。
- 保留 0.8.4 的阅读阴影与跨轮视频修复，并执行完整回归及正式包安装验证。


## 0.8.4 — 2026-10-17

### 阅读排版与视觉风格

- 修复阅读、极简排版被后续风格规则重新加上根节点阴影的问题，解决明亮扁平和柔光渐彩中文字周围露出偏移底块的现象（Issue #2）。
- 调整样式覆盖顺序，保持这两种排版的根节点透明、无边框和无额外内边距；深色主题及深色预览遵循相同规则。
- 保留内部卡片和其他排版应有的阴影、配色与组件样式。

### 视频位置、成片与页面响应

- 历史视频固定在所属回复内，新一轮回复开始后不会继续堆在聊天列表末尾。
- 修复多轮视频的定位监听器互相触发、持续搬动播放器并可能卡住页面的问题；正常重排保留播放器实例及播放位置。
- 拼接成片生成成功后，用成片替代其使用的分镜播放器；独立视频继续保留，源文档和工程文件不删除。

### 验证

- 149 项单元/集成测试，以及构建、浏览器和播放器回归。
- 新增 432 个风格、排版、主题和宽度组合检查，覆盖阅读外壳、深色预览、内部卡片及正常排版的阴影保留。
- 覆盖跨轮视频定位、折叠历史、播放与拖动定位、切换页面，以及多播放器定位循环的复现与防回归。


## 0.8.3 — 2026-10-17

### 动画预览控件

- 修正时间轴舞台外的按钮、时间和章节文字在主题切换后对比度不足的问题。仅处理可可靠判断背景色的低对比度控件，保留舞台画面及已有可读样式。
- 修正画布高度未计入页面内边距导致的内部滚动，正式画布与生成中的静态预览均使用完整内容高度。

### 阴影卡片与布局诊断

- 普通 HTML 文字卡片可随换行自动撑高，并补足底部圆角空间；阴影保留，内容缩短后可恢复到原最小高度。
- 正式画布、静态预览和独立 HTML 导出共用排版修正。刻意滚动、文字截断、绝对定位、受保护布局及动画舞台不参与自动重排。
- 新增卡片文字越界诊断，可定位 SVG / tspan 与定位布局中的问题文字，提示模型调整背景尺寸、内边距或排版。
- 补充设计指导：保留阴影解决布局问题，避免通过裁切、缩小文字或删除阴影掩盖溢出。

### 验证与范围

148 项单元/集成测试、26 组构建与浏览器回归、18 项播放器检查通过。覆盖阴影保留、响应式换行、圆角边界、内容收缩、SVG 诊断，以及主题切换与播放器操作。

针对 Issue #2 的同类故障增加了复现和防护；报告未提供原始文档，因此仍需原作者确认原案例，暂不将该 Issue 标记为已解决。

## 0.8.2 — 2026-10-17

本版为兼容性更新，支持 DSH Web / Desktop 0.2.1-rc.2，保留 0.2.0-rc.2 与 0.2.1-rc.1 支持。

- 更新 DSH 开发 SDK 与锁文件，兼容声明及依赖范围明确包含 0.2.1-rc.2。
- 保留现有工具、风格、文档与交互状态，使用方式不变。
- 延续 0.8.1 的视频定位、重复界面及源画布排版修复；rc.2 Desktop 继续使用经过验证的原生媒体播放处理。

验证覆盖 148 项单元/集成测试、24 组构建与浏览器回归、18 项播放器检查；在 rc.2 Web 和原生 Desktop 中检查设置恢复与历史视频，Desktop 通过真实鼠标拖动、解码帧时间、画面像素变化及导航资源释放确认定位有效。

## 0.8.1 — 2026-10-17

修复视频交付时的重复界面、源画布排版，以及 Desktop 原生播放器无法拖动定位的问题。

### Desktop 进度条定位

- 修复 Desktop 的 `dsh-app://` 媒体通道将 MP4 可定位范围识别为 0 秒，导致拖动后回到开头的问题。
- Desktop 通过原有认证路由载入本地成片，再使用有完整长度的 Blob 播放；载入完成前显示状态并禁用定位，失败可重试。离开会话时取消未完成读取、停止播放并释放 Blob。
- 拖动时预览目标时间，松手后定位一次，保留原来的播放或暂停状态，避免连续定位请求和时间更新争抢滑块。Web 继续使用原有 HTTP 媒体播放。

### 避免重复的视频界面

- 成功导出后，聊天正文只显示播放器，收起相同文档、节点和版本的源画布；源画布仍可从“智能 UI”侧栏访问。
- 其他界面、不同影片和后续编辑的新版本继续保留；导出失败不收起源画布。

### 源画布排版

- 兼容 HTML 标签之间、CSS 规则边界被写成字面量 `\n` / `\r` 的排版分隔符，修复可见转义字符、样式失效和画面溢出。
- 保留代码示例、属性值、CSS 字符串及注释和 JavaScript 源码，不重写已保存文档。

### 验证

148 项单元/集成测试、24 组构建与浏览器回归，以及 18 项播放器检查。Desktop 原生通道额外验证了真实鼠标拖动、解码帧时间、画面像素变化、播放状态和离开页面后的资源释放，未仅以进度数字变化判定成功。


## 0.8.0 — 2026-10-17

Motion UI 新增从可定位动画到视频成片的制作流程，保留原有日常排版、可视化、交互组件、状态保存与风格设置。

### 动效时间轴与设计指导

- 新增 `DSHUI.timeline`：播放、暂停、定位、重播、章节和绝对时间绘制，支持分步解释与可重复的视频采集；现有动画接口继续可用。
- 新增时间轴、分步讲解、路径传播和文字动效四个原创案例，适用于各视觉风格。
- 完整内置 OpenDesign `motion-design` 技能，保留原文、固定来源、校验值与 Apache-2.0 许可，通过独立 DSH 适配说明按需读取。宣传片指导区分口播讲解、产品片与音乐视觉蒙太奇，不增加日常常驻提示词。

### 视频预览、导出与素材处理

- `preview_video`：从时间轴生成关键帧和联系表，先检查画面再编码；有效画面保留，脚本与资源问题返回时间点、元素位置或源码行列。
- `render_video`：交付真实 MP4、可编辑 HTML、文档/参数快照和工程 ZIP，支持本地音轨、字幕、嵌套舞台与透明起始帧。
- `inspect_video` / `process_video`：检查本地素材、按时间抽帧、截取拼接、画面适配，以及字幕和配乐合成，保留原文件。
- 逐帧直接送入编码器，减少中间 PNG；修复冷启动首帧、舞台重排、末尾取帧与色彩范围问题。成片检查实际元数据、音轨和完整解码，失败保留源码及诊断。

### 配音、字幕与音轨

- `synthesize_voice` 通过用户配置的 MiniMax 认证生成真实配音和句级/词级时间戳。
- 支持配音、音乐、音效多轨混音、偏移与淡入淡出；拒绝截断或循环旁白。
- 独立源码同步播放、暂停和定位音轨与字幕，字幕空档不保留上一句；修复数字发音片段导致的重复字幕。

### 聊天视频播放器

- 固定控制条提供播放/暂停、进度、时间、音量/静音、倍速、全屏与下载。
- 兼容历史视频结果，后续正文更新保持播放位置；切换会话、离开页面或隐藏标签页时停止声音，多视频互斥播放。
- 避免视频被折叠的工具分析区域隐藏，同一画布的重复导出只展示最新成片。

### 易用性与兼容性

- 插件设置增加视频环境检查；缺少浏览器或编码器时给出明确提示，不自动下载大型运行时。
- 改善节点编辑的多余空父级字段、单项传输包装、可选 JSON 空字符串与媒体回执兼容性，未知字段直接指出名称。
- 兼容 DeepSeek Harness Web / Desktop `0.2.1-rc.1`，保留 `0.2.0-rc.2` 兼容范围。

视频功能需要本机 Chrome/Edge 或 Playwright Chromium、FFmpeg、FFprobe；MiniMax 配音会调用相应 API。视频需显式请求，普通对话 UI 不自动转为视频。设计效果与制作成功率仍取决于模型及实际素材，预览和技术检查不等同于美术质量验收。

## 0.7.1 — 2026-10-14

Motion UI 现在可以用更短的调用交付完整界面，并更准确地定位和修改已有内容。这次更新保持现有文档协议与参数保存兼容。

### 常见需求直接交付

新增 `render_scene`，支持步骤流程、方案对比、比例分配和旅行预算。模型提供任务数据，插件生成完整节点、控件和公式，复用所选风格、只读流式预览与参数保存；其他需求继续使用原生组件或自由 HTML/SVG。

### 减少接口摩擦

兼容代码块冗余的复制标记、字面数字公式，以及与 state 一致的控件范围。缺少图表数据、嵌套公式错误会指向具体字段；不补猜金额，不改写源码或任意数据，冲突值仍会拒绝。

### 检查与修改更准确

视觉观察新增透明背景对比度、文字裁切和明显尾部空白，并返回局部定位；未覆盖和截断内容明确标记。`inspect_ui` 支持按文字、标签和组件类型查找节点，提供位置与可编辑字段，方便修改原界面并保留当前参数。

### 提示词与回归整理

收拢重复指导，完整手册按需读取；引导模式保留设计、风格和短案例，自由模式不注入风格案例。增加纯文字、主动 UI、多块 UI和保参修改的固定模型回归，不新增模型思考或输出限制。

验证：129 项单元/集成测试及24组回归通过。MiniMax M3.1 Flash 最终轮4个固定场景全部完成，无工具错误；这是单轮样本，不代表所有模型均能首次成功。视觉观察属于启发式检查，不代替完整设计或无障碍验收。

## 0.7.0 — 2026-10-13

这次更新让 Motion UI 从统一配色的组件集合，进一步扩展为有不同排版语言、真实交互反馈和机制图解能力的对话界面插件。日常说明仍可轻量交付；内部结构、工作原理和机械运动可以直接生成可调整的图解。

### 六种风格拥有各自的排版语言

- 重做清爽阅读、柔和彩色、技术图解、活力展示、明亮扁平的构图、文字层级、分组、表面和控件外观，新增柔光渐彩。默认继续使用明亮扁平，已有风格配置保持兼容。
- 风格同时覆盖原生文字、卡片、指标、表单、流程、表格、复制块和相关画布示例。
- 设置中提供文字说明、双列对比、分隔列表、数据摘要、控件表单、流程图解六类预览，方便比较。预览采用实际组件样式，保持只读。
- 视觉风格仅作用于引导模式；自由模式继续由模型自主设计。

### 全局交互与动效

- 分段选择支持方向键、Home/End；滑块按实际数值填充，并改善步进、开关、复制与按钮反馈。
- 动效覆盖各风格和自由模式的相关原生控件，反馈节奏适配风格。精确读数即时更新，图形与装饰可以平滑过渡。
- 增加按需动态案例和设置页本地交互演示。尊重减少动态效果、只读状态与实际操作结果，不模拟下载进度或工具成功。
- 切换风格保留参数和输入焦点；原生标题与文档标题相同时避免重复展示。

### 结构拆解、工作原理与机械动画

- 新增 `render_mechanism` 快捷工具：以少量参数直接交付分层装配、齿轮传动或曲柄连杆，插件生成图形、控件与共享状态绑定，减少模型复制长源码带来的失败。
- 支持部件/分组选择、拆解进度、隐藏外壳，以及转速、齿数、曲柄半径、手动角度、播放和暂停。
- 齿轮转速与中心距、连杆位置与行程由同源运动学计算，图形和实时读数保持一致。
- 自定义画布可显式启用 `libraries:["mechanism"]`，组合 box、cylinder、gear、rod、spring，并使用局部姿态更新与运动计算函数。
- 提供精简模型指引和按需目录；静态轮廓可先预览，整轮回复完成、参数恢复后启用交互。支持状态保存、减少动态效果、离屏挂起和独立 HTML 导出。

### 计算与易用性修复

- 支持 `ceil` / `floor`，改善奇数人数订房等常见计算；图表和表格支持行内响应式公式单元格。
- 二维表格行可按明确列定义无损适配，改善复杂表达式的重复预算计算与错误定位。
- 明确提示缺失版本、节点和控件等问题，保留普通文字回退及原有源码大小、权限和隔离边界。

### 验证与适用范围

- 117 项单元/集成测试、23 组构建及浏览器回归；覆盖 PC 深浅主题、窄宽度、键盘、状态恢复、只读渐进预览、隔离与离线导出。
- MiniMax M3.1 Flash Preview 在测试工作区完成自然齿轮提问和曲柄连杆两组实测，均零工具报错；单组小样本不代表所有模型的成功率。
- 机制库使用 Anatomy 的 MIT 投影与轮廓数学，保留固定版本、来源和许可证；场景、状态桥接、渲染与交互为 Motion UI 的集成实现。相关交互参考同样保留 MIT 声明。
- 机制图解提供教学几何与运动学；简化齿形、按层/深度排序和隐藏外壳不构成制造精度、碰撞/受力验证或任意实体剖切。动画瞬时相位可在刷新后重置，声明的用户参数仍保存。

安装/更新：DSH 首页 → 插件，添加 `dsh-motion-ui`。现有安装请卸载后重新安装新版；DSH 当前插件安装流程尚不提供自动更新。


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

### 未发布：依据本地案例校正（2026-10-13）
- 柔光渐彩改为暖白实色表面，重点渐变留给控件；移除不必要的磁吸禁止指导。
- 主按钮渐变从图标圆点扩散，文字上下滚动、轻磁吸；数字输入提供增减按钮、指标滚动强调；开关可拖拽并拉伸回弹。
- 增加三个原生按需案例和动态画布示例，保留真实行为与 MIT 来源声明。


### 本地开发修正：动效与风格解耦

原生按钮的磁吸/填充/文字换位、开关拖拽回弹、数字步进和指标更新反馈适用于所有风格；自由模式保留原生交互反馈且不注入视觉风格。柔光渐彩统一文字层级、卡片、指标、表单、表格、流程与复制块外观。五类风格预览移除额外演示按钮，直接展示布局材质。默认仍为明亮扁平，本次不发布或增加版本号。


### 本地开发：计算器首次交付修复

针对会话 d696983a 的七次失败：明确缺失 document.nodes/version 和嵌套 children 的路径，图表错误给出行号、缺失字段及已有列；新增安全原生 ceil/floor；chart/table 支持内联 ref/expr 公式单元格，避免短构成图使用复杂 map。更新工具 Schema、Skill 与协议参考，静态 data 仍为字面数据，不猜测或补造金额。默认 4620 元、1..12 人奇偶房间数、动态图表和刷新恢复加入回归。不增加版本号、不发布。

进一步实测修正：重复表达式按不同结构计入静态复杂度，运行步数/深度限制保留；已声明且唯一的字符串列键支持等宽二维表格，按列顺序无损转换。真实模型第一份失败文档加入回归，可一次通过并保留项目名、规则和动态金额。


### 本地开发：视觉风格系统重构

六种稳定风格 ID 和明亮扁平默认值保留。新增构图、文字层级、表面、控件、反例的统一风格语法；原生文字/卡片/指标/表单/流程/表格/复制块与扩展卡片/指标有独立形态。所有风格保留共享交互动效，反馈幅度/节奏适配语言，减少动态效果仍优先。设置提供六种布局预览（含控件表单），直接复用生产组件 CSS，预览不包含可操作控件。相同内容的深浅主题、黑白对照、显式文字样式优先、输入焦点及数值保留加入回归。自由模式不注入这些风格。当前保持 0.6.0，本轮不发布。

模型实测补充：六种风格均实际交付；部分调用发生格式错误后由模型修正，记录不计为一次成功。进一步提示模型沿用风格默认字号/颜色，并在首个 heading 与文档标题完全相同时仅显示一个标题，保留显式文字样式和源文档。
