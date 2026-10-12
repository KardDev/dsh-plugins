---
name: genui
description: "Render structured interactive UI inline through the dsh-ui fence. Use for key points, emphasis, comparisons, flows, steps, status, data, demos, and interactions whenever structured presentation would be clearer than prose. Preserve conversation language for all user-visible text."
---

# GenUI — 生成式 UI 输出规范

**Language:** Match the user's requested language (otherwise the language of their message) in both surrounding prose and all user-visible UI text: titles, labels, content, options, and explanations. Chinese examples below illustrate the schema only; do not switch the conversation to Chinese after loading this skill. Keep JSON keys, component types, IDs, and actions unchanged. An English request gets English prose and UI text; a Chinese request gets Chinese prose and UI text. `<user-language ...>` tokens are meta-placeholders only. Replace every one with actual content in the conversation language; never emit these placeholders literally.

你可以**在回答正文中间**输出可交互 UI 组件：写一个 `dsh-ui` 围栏（fenced block with language tag `dsh-ui`），内含 JSON 规格，渲染器会把这一整块画成真实组件，文字照常穿插在前后。组件**就是回答的一部分**，不是工具调用。

```dsh-ui
{"title":"<user-language text>","gap":14,"items":[...]}
```

公式：`$...$` / `\(...\)` 为行内公式，`$$...$$` / `\[...\]` 为独立公式；支持矩阵、分段函数、多行对齐推导，以及加粗/高亮内的公式。正文、列表、键值、表头/单元格、卡片/步骤/时间线/标签页标题、题目与说明、按钮与表单标签、指标、媒体说明和图表外层标题共用此能力。JSON 字符串中的反斜杠必须双写，如 `"content": "\\(\\frac{a}{b}\\)"`。代码源码、输入值/占位符、原生下拉选项和图表引擎内部绘图文本仍遵循各自的原生格式，不解析富文本。数学语法以 KaTeX 为准，不执行 HTML、外部资源或脚本；不支持 LaTeX 文档编译、加载任意宏包。

## 组件词汇（只允许这些 type）

布局：`text` `row` `col` `grid` `card` `divider` `spacer`
展示：`stat` `badge` `progress` `list` `table` `keyvalue` `avatar` `image` `audio` `video` `timeline` `file-tree` `breadcrumb` `diff` `json` `code` `callout` `steps`
图表：`chart`（bars/line/donut，可多序列）`plot`（数学函数图）`echart`（ECharts 全功能图表）
交互：`button` `input` `select` `checkbox` `radio` `switch` `textarea` `tabs` `accordion` `copy`

### 布局
- text: `{"type":"text","size":"h1|h2|h3|body|muted|caption","content":"...","center":true?}`
- row / col: `{"type":"row"|"col","items":[...],"wrap":true?,"spacer":true?,"gap":n?}`
- grid: `{"type":"grid","cols":n,"items":[...]}`
- hero: `{"type":"hero","title":"<user-language title>","subtitle":"<user-language text>","value":"99.96%","label":"<user-language metric>","delta":"+0.02%","spark":[...],"tone":"accent|success|warning|danger"}` — **封面块**：eyebrow + 超大数字（52px，带入场计数）+ 标题 + 副标题 + tone 渐变底色。**一条回答最多用一个**，放在最前面当视觉锚点
- span: 任意节点都可加 `"span":2`（grid 子节点占几列）——bento 排版的唯一原语：一张 `span:2` 宽卡配一张窄卡，比一列方块堆下去好看得多
- card: `{"type":"card","title":"...","items":[...]}`；`"accent":"#f59e0b"` 指定强调色（边框 + 标题 + 极淡底色）
- palette: `chart` / `echart` 都支持 `"palette":["#ff8800","#3ecf8e"]` 覆盖分类色板（默认跟随宿主主题）。**只有语义上需要指定颜色时才写**（成本=红、收益=绿），否则跟随主题更稳；`"tone":"info|success|warning|danger"` 给卡片底色（用于结论卡/风险卡）
- divider: `{"type":"divider"}`; spacer: `{"type":"spacer"}`

### 展示
- stat: `{"type":"stat","label":"...","value":"...","delta":"+12.4%|-3%"}`（`-` 开头自动红、`+` 绿）；可选 `"spark":[3,5,4,8,6]` 画一条微趋势线（2–60 个有限数值）；`"size":"hero"` 渲染超大数字（一条回答最多用一次，作为视觉锚点）
- badge: `{"type":"badge","label":"...","tone":"success|warn|danger|accent","icon":"emoji?"}`
- progress: `{"type":"progress","label":"...","value":0-100,"valueLabel":"70%"}`；`"variant":"ring"` 画环形进度，`"target":70` 在轨道上标出目标刻度
- avatar: `{"type":"avatar","name":"...","color":"#hex?"}`
- image: `{"type":"image","src":"/mmx-files/result.png","alt":"<user-language description>"}` — 展示浏览器可访问的 http(s) 或同源相对图片地址；懒加载；不支持 `file:`/`data:` 等本地或主动协议
- audio: `{"type":"audio","src":"/mmx-files/result.mp3","alt":"<user-language description>","loop":true?}` — 原生控制条；用户主动播放，不自动播放；仅 http(s) 或同源相对地址
- video: `{"type":"video","src":"/mmx-files/result.mp4","alt":"<user-language description>","poster":"/mmx-files/poster.jpg"?,"loop":true?,"muted":true?,"aspectRatio":"16:9|4:3|1:1|9:16"?}` — 原生播放/音量/全屏控制；不自动播放
- list: `{"type":"list","items":["..."] 或 [{"title":"...","desc":"..."}] 或嵌套节点(如 {"type":"badge","label":"TS"})}` — 行内可嵌节点（计入节点预算）；记录中的 `label`/`name` 归一化为 `title`，`description`/`content`/`text`/`body`/`detail` 归一化为 `desc`；只有正文时将正文用作标题，未知字段会收到警告
- table: `{"type":"table","columns":["..."],"rows":[["...","..."]],"types":["text|num|delta|bar|badge"]?,"details":[[...]]?,"total":true?}` — 表头点击本地排序（升/降/还原，零往返）；数值感知：千分位（`1,234`）、`k/m/b`、`万/亿`、`%`、货币符号都能按真实数值比较，纯数值列自动右对齐；**带符号单元格自动着色**（`+12.4%` 绿、`-3` 红，无需额外字段）；`types` 可按列指定 `bar`（0-100 内联进度条）、`ring`（0-100 小环）、`spark`（单元格写 `"3,5,4,8"` 画微趋势线）、`badge`（胶囊标签）、`delta`（强制涨跌色）、`num`（强制右对齐）、`index`（行号）、`group`（首列当分组标题：该行只有第一格有内容时渲染成跨列小标题）；`"total":true` 追加合计行（数值列自动求和）；**`"export":true`**：表格上方出现「复制 Markdown / 复制 CSV」两个小按钮（纯本地剪贴板，不发请求）；**`"filter":"输入框id"`**：把表格和某个 input/select 绑定，读者输入即时过滤（`filterColumn` 可限定列）——数据多时**默认就该配一个**；**`"sortField":"下拉id"`** 用下拉的值（列名）排序；**`"details"` 与 rows 同序**，第 i 项是该行展开后的内容（可放任意组件，`null` = 该行不可展开）——首列出现 chevron，点开在整行下方展开明细，适合「主表 + 明细」
- keyvalue: `{"type":"keyvalue","pairs":[{"key":"...","value":"..."}]}`
- timeline: `{"type":"timeline","items":[{"title":"...","desc":"...","time":"..."}]}`
- file-tree: `{"type":"file-tree","items":[{"name":"...","type":"file|dir","children":[...]?}]}` — 目录行可点击折叠/展开（本地，零往返）
- breadcrumb: `{"type":"breadcrumb","items":["<user-language text>","<user-language text>","<user-language text>"]}`
- diff: `{"type":"diff","diffs":[{"path":"...","oldText":"..."|null,"newText":"..."}]}`
- json: `{"type":"json","value":...}`（JSON 树查看器）
- code: `{"type":"code","lang":"ts","code":"..."}`
- callout: `{"type":"callout","tone":"info|success|warning|error","title":"...","content":"..."}`
- steps: `{"type":"steps","current":n,"steps":[{"title":"...","desc":"..."}]}`

### 图表
- chart: `{"type":"chart","kind":"bars|line|donut","data":[{"label":"...","value":n,"color":"#hex?"}],"series":[{"label":"...","data":[...]}]?,"horizontal":true?}` — bars 默认；line 趋势；donut 占比；**series：bars 是分组柱，line 是多序列折线**；**`horizontal:true` 画横向柱**（排行/长标签首选）；**`stacked:true` 把 series 堆叠**（构成/占比随时间）；堆叠段够高时数值直接印在段内，鼠标悬停任意柱/段/点/扇区都会弹出即时 tooltip（堆叠显示该段数值 + 合计）。v3 渲染：宽度自适应、Y 轴 1/2/5 刻度、单序列负值在零线以下真实绘制、line 带面积渐变与抽稀 X 标签、donut 图例显示数值与百分比。**≤8 个点的快速对比用 chart；多序列、需要缩放/交互或数据量大时用 echart**
- plot: `{"type":"plot","series":[{"expr":"a*sin(b*x)","label":"...","color":"#hex?","params":[{"name":"a","value":1,"min":0,"max":5,"animateTo":3,"durationMs":4000,"loop":true},{"name":"b","value":1,"min":0.5,"max":5}]}],"xMin":-6.28,"xMax":6.28,"title":"..."}` — SVG 函数图；**series 可带 `"kind":"line|area|scatter"`**（缺省 line；area 填色到基线；scatter 散点）；**params 渲染成实时滑块**（拖动即时重绘，**y 轴锁定**=只变曲线不变数轴）；**animateTo 参数会显示播放按钮**（自动动画演示）；SVG 可拖拽平移、滚轮缩放；表达式支持 sin/cos/tan/asin/acos/atan/sqrt/cbrt/exp/log/ln/abs/floor/ceil/round/min/max/pow，常量 pi/e/tau，变量 x（其他字母=参数）
- echart: `{"type":"echart","title":"...","height":300,"preset":"bar|line|area|pie|scatter","data":[{"label":"...","value":n}],"series":[...]?}` — **ECharts 全功能图表**，视觉效果远超 `chart`（渐变、tooltip、动画、图例交互）；**preset 模式**：用和 `chart` 一样的 `data`/`series` 格式，自动构建主题化的 ECharts 配置（颜色跟随宿主主题）；**preset 一览**（只写 preset + data/series/links，主题自动跟随）：
`bar` · `line` · `area` · `pie` · `scatter` · **`radar`**（每 series 一个多边形，指标取第一条 series 的 label）· **`gauge`**（每个 datum 一个仪表，适合单 KPI）· **`funnel`**（漏斗/转化）· **`treemap`**（体积/层级占比）· **`sankey`**（流向，用 `links:[{from,to,value}]`）· **`graph`**（关系图，`links` 驱动，节点大小随连接数）· **`heatmap`**（`series` 当行、第一条 series 的 label 当列）· **`bigline`**（长序列 + 内置缩放）· **`wordCloud`**（词云，`data:[{label,value}]` 的 value 表示权重；颜色跟随 `palette` 或主题调色板）
**full option 模式**：传 `"option":{...}` 直接写 ECharts 原生配置（支持 ECharts 内置图表及已注册的 `wordCloud` 词云扩展；其他第三方扩展不保证可用），option 中的函数会被过滤（只接受数据）。选择原则：**chart 轻量（无额外下载）适合 ≤8 点的快速对比；echart 视觉更丰富（渐变、tooltip、图例交互、dataZoom），但会按需下载约 1MB 引擎，多序列/大屏/交互场景优先**

### 交互
**本地优先（v2.6）**：UI 自己能做的状态变化——判卷、判题、重置、展开、选中——一律本地即时完成，**零模型往返**。action 只用于必须模型参与的事（生成新内容、执行工具、下一步建议）。**交互组件必须带 action：不带 action 的按钮渲染为禁用态，用户点不了；带 action 的按钮点击后有「已触发」本地反馈。**
- button: `{"type":"button","label":"...","tone":"primary|danger|success|ghost","full":true?,"small":true?,"icon":"emoji?","action":"refresh"?}`
- **秘密禁令**：不得索取或生成密码、API Key、访问令牌、恢复码等秘密输入；遇到此类需求直接拒绝并解释
- input: `{"type":"input","label":"...","placeholder":"...","inputType":"text|email|color","value":"...","action":"name"?,"id":"field-id"?}` — `color` 使用浏览器原生取色器，值使用 `#RRGGBB`；action 在失焦**和回车**时触发（回车带 `submit:true`）；**blur 仅值有变化才发送**（聚焦又离开不产生空往返）；payload 带 `id` 帮模型定位字段；带 `id` 的值刷新后保留、并被 submit 收集进 `fields`
- select: `{"type":"select","label":"...","options":["...","..."],"selected":下标?,"action":"pick"?,"id":"field-id"?}` — `selected` 预选某选项（缺省显示「请选择…」占位，不静默预选第一项）；带 `id` 的选择跨刷新保留并进 submit 的 `fields`
- checkbox: `{"type":"checkbox","label":"<user-language option>","checked":true?,"action":"toggle"?,"group":"group-id"?}` — 默认保持逐次 `action` 行为；**加 `group` 进入多选聚合模式**：同组 checkbox 可反复勾选/取消，变化只在本地记录、不发逐次 action，兄弟 `submit` 一次性把该组已选 label 作为字符串数组放进 `answers`（例如 `{"styles":["<user-language option>","<user-language option>"]}`）
- slider: `{"type":"slider","label":"...","min":0,"max":100,"step":1,"value":n?,"action":"name"?,"id":"field-id"?}` — 数值表单滑块：实时显示数值；带 `id` 跨刷新保留并进 submit 的 `fields`（拖拽经防抖合并成一次 action）
- radio: `{"type":"radio","label":"<user-language label>","options":["<user-language option>","<user-language option>"],"selected":n?,"action":"pick"?}` — 单选；**加 `"group":"group-id"` 进入聚合模式**：选择只本地记录、不发往返；可设置 `"answer":正确下标或标签` 和 `"explanation":"<user-language explanation>"`，在纯 radio 且没有其他待发送表单状态时本地判卷
- link: `{"type":"link","label":"...","href":"https://..."?}` — 仅 http(s)/mailto 协议被接受；无 `href` 时渲染为纯文本样式（不会假装可点）
- submit: `{"type":"submit","label":"<user-language action>","action":"grade","groups":["q1","styles"],"resetAction":"redo"?}` — 聚合按钮：`groups` 引用当前 block 中的 submission member key，来源为 `radio.group`、`checkbox.group`、`input.id`、`textarea.id`、`select.id`、`slider.id`；radio 需已选择，checkbox 组需至少选择一项，普通 field 的值需在 trim 后非空。`groups` 控制提交所需成员与完成进度；未设置时，至少有一个已完成成员即可提交。纯 radio 范围含 `answer` 且本次没有范围外 payload 时可本地判卷；其余场景一次发送 `[genui-action]`，payload 继续收集当前 block 中已填写的表单状态，字段名称保持 `answers`、`fields`、`total`、`answered`
- switch: `{"type":"switch","label":"...","checked":true?,"action":"toggle"?}`
- textarea: `{"type":"textarea","label":"...","placeholder":"...","rows":n?,"value":"...","action":"save"?,"id":"field-id"?}` — action 在失焦和 **Ctrl/Cmd+Enter** 时触发；blur 仅值有变化才发送；带 `id` 的值刷新后保留
- tabs: `{"type":"tabs","tabs":[{"label":"...","items":[...]}]}` — 空 tab 可以省略 `items`，会按空数组处理
- accordion: `{"type":"accordion","items":[{"title":"...","items":[...]}]}`
- copy: `{"type":"copy","label":"<user-language action>","text":"<user-language text>"}`

**状态持久化（v2.7）**：radio 答案、checkbox 分组选择、交卷锁定、输入值按「会话 + 内容指纹」自动保存——用户刷新页面/重开会话，同一块 UI 的状态原样恢复；你重渲染**相同内容**会保留用户状态，渲染**新内容**（换题等）自动从头开始。

**卷子模式（多道选择题）**：每题一个 radio（带唯一 `group` + `answer` + `explanation`），最后放一个 submit（`groups` 列出全部题号）——用户全部选完点交卷，**分数和对错当场在 UI 里出现**，不用等你。只有换新题/进阶建议才发 action。不要每题单独发 action（会刷屏）。

### 高级
- svg: `{"type":"svg","title":"<user-language title>","height":300,"code":"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 200 100\"><rect width=\"200\" height=\"100\" fill=\"#534ab7\"/></svg>"}` — 独立 SVG 图片预览；`title`/`height` 可省略，height 为 100–800，code 最多 12,000 字符。必须提供完整 SVG 文档（含 xmlns），建议带 viewBox。使用隔离图片模式，不支持脚本、宿主 CSS 或外部资源；图形无法加载时显示源码和提示。**放在 dsh-ui 围栏中；这不是 ECharts renderer 配置。**
- 也可以直接输出 ```svg 代码围栏（不带 dsh-ui 包装）：会自动显示为「预览/源码」切换的图形预览，源码可复制；无法解析时保留源码并提示。
- mermaid: `{"type":"mermaid","code":"graph TD\\nA-->B"}` — flowchart/sequence/class/gantt/pie/er/state/journey；主题自动跟随宿主（暗/浅）
- diagram: `{"type":"diagram","kind":"architecture","title":"<user-language title>","variant":"light|dark|editorial","nodes":[...],"edges":[...],"theme":{...}}` — **编辑级品牌图**（移植自 diagram-design 的 27 种视觉类型）。节点: `{"id":"a","label":"<user-language label>","type":"focal|backend|store|external|input|optional|security","x":40,"y":40,"w":128,"h":48,"sub":"<user-language text>","tag":"<user-language text>"}`；边: `{"from":"a","to":"b","label":"<user-language label>","kind":"solid|dashed|accent|link"}`。**规则由渲染器强制**: 正交连接器（r=8 弯折、禁止斜线）、4px 网格、语义 token（paper/ink/muted/accent）、焦点色 ≤2 个、复杂度预算（≤9 节点/≤12 边）、z-order（箭头在节点后）、边标签 6-10px 间隙。27 种 kind：architecture / it-state / flowchart / sequence / state / er / timeline / swimlane / quadrant / radar / loop / nested / tree / org-chart / layers / venn / pyramid / bar / line / gantt / scatter / high-level / process / medallion / data-flow / dp-integration / dp-security-matrix。**坐标类 kind**（architecture/it-state/high-level/process/medallion/data-flow/dp-integration）用 x/y/w/h 精确定位；**规则类 kind** 只给数据自动排版。架构/流程/层次结构优先用 diagram 而非 mermaid（自动布局用 mermaid，编辑级排版用 diagram）。
- scene3d: `{"type":"scene3d","title":"...","meshes":[{"shape":"box|sphere|cone|cylinder|torus","color":"#hex?","size":n|[w,h,d]?,"position":[x,y,z]?,"rotation":[rx,ry,rz]?,"scale":n?|[...]?}],"ambient":0-2?,"background":"#hex?"}` — 3D WebGL，可拖拽旋转、滚轮缩放；mesh 数量 1–5 个
- quiz: `{"type":"quiz","question":"...","options":[{"label":"...","correct":true?,"feedback":"..."?}],"explanation":"...","id":"..."?,"action":"answer"?}` — 教学问答：点选即判题、可重试；`id` 变化时重置；带 action 时另回传 `{type:'quiz',question,answer,correct}`

## 什么时候用：内容类型 → 组件映射

**判断口诀**：这段内容换成结构化组件，会不会比纯文字更好扫、更好懂、更好操作？会 → 就用，**不需要等用户开口要 UI**。

**硬触发（出现就至少出一个围栏，不要退回纯文字段落）**：
- ≥3 条并列要点 → `list`；≥2 组数字对比 → `table`；指标/进度/状态 → `stat`/`progress`/`badge`
- 步骤/时间线 → `steps`/`timeline`/`mermaid`；架构/流程 → `diagram`/`mermaid`；风险/结论 → `callout`；代码/改动 → `code`/`diff`/`json`
- 趋势/占比 → `chart`（≤8 点）或 `echart`（多序列/要交互/数据量大）
- 收尾自检：回答超过约 10 行时确认至少有一个围栏；同一份信息不要既写文字又重复出组件；纯问答不套 UI。

| 你要呈现的内容 | 用这些组件 |
|---|---|
| 关键结论 / 要点罗列（≥2 条） | `list`、`keyvalue`、`callout` |
| 重点强调 / 警告 / 注意事项 | `callout`（info/success/warning/error）、`badge`、`stat` |
| 数据对比 / 趋势 / 占比 | `chart`（bars/line/donut）、`echart`（ECharts 全功能）、`table` |
| 关键指标数字 / 进度状态 | `stat`、`progress`、`badge` |
| 回答的视觉锚点（第一个组件） | `hero`（封面块，一条回答最多一个） |
| 想排版不呆板 | `grid` + 子节点 `span`（bento：宽窄混排） |
| 数据多、需要读者自己找 | `input`（id）+ `table`/`chart`/`list` 的 `filter` 绑定 |
| 流程 / 步骤 / 阶段 / 时间线 | `steps`、`timeline`、`mermaid`（flowchart/sequence/gantt） |
| 架构 / 系统拓扑 / 数据流 / 品牌图 | `diagram`（编辑级，27 种类型；自动布局需求才用 `mermaid`） |
| 目录 / 文件结构 / 层级关系 | `file-tree`、`mermaid`、`accordion` |
| 状态一览 / 检查结果 | `badge` + `table` + `progress` 组合 |
| 代码 / 配置 / 改动对比 | `code`、`diff`、`json` |
| 图片 / 截图 / 图表预览 | `image` |
| 语音 / 音乐 / AI 视频 / 演示录像 | `audio`、`video` |
| 两个方案 / 选项对比 | `table`、`tabs`、`diff` |
| 教学 / 自测 / 判断题 | `quiz` |
| 数学函数 / 曲线关系 | `plot`（可带参数滑块、动画） |
| 需要用户操作 / 筛选 / 反馈 | `button`、`input`、`select`、`checkbox`、`radio`、`switch`、`tabs` |
| 3D 物体 / 空间布局 | `scene3d` |

**别用的情况**：一句话能说清的事、纯闲聊、用户明确说不要 UI、以及"为了炫技硬塞"——组件服务内容，不是内容服务组件。

## 行内富文本（文字类回答的底座）

`text.content`、`list` 项、`table` 文本列、`keyvalue` 值、`callout` 标题与正文里可以直接写四种行内标记——**重点留在句子里，不必为一个词单起一个组件**：

| 写法 | 渲染 |
|---|---|
| `` `code` `` | 行内代码胶囊 |
| `**加粗**` | 强调（不换行、不成块） |
| `==高亮==` | 极淡底色标记 |
| `[文字](https://…)` | 行内链接（http/https/mailto；围栏会话中的本地文件链接支持右侧栏打开与行号定位；无效目标及独立 HTML artifact 中的本地文件链接显示为普通文字） |
| JSON `"\n"`（真实换行符） | 换行——**多段文字写同一个字段**，不要为换行拆成多个节点 |

不嵌套、不解析 HTML（每个标记生成 React 元素，不走 innerHTML；`<br>` 字面显示，换行用 `"\n"`）；标记没闭合时原样显示。表格文本、`badge`、`delta` 单元格只识别本地文件链接，外部链接与无效目标显示为普通文字；`bar`、`spark`、`ring`、`index` 等专用数值单元格保持原有展示。

文字字段只支持行内富文本。`text.content`、`callout.content`、`list` 项、`keyvalue` 值、`table` 单元格等字段中不要嵌入 Markdown 表格或连续三个及以上反引号、波浪号组成的代码围栏；表格使用 `table`，代码使用 `code`，代码改动使用 `diff`，结构化 JSON 使用 `json`。误写入文字字段的代码围栏连同内部标记保持原文，未闭合时从围栏标记开始保持原文。`validate_dsh_ui` 返回 `warning=block_markdown` 时，按照 `replacement` 改写结构节点并重新验证。

## 回答级版式：默认无卡，焦点唯一

**规则来自设计规范，不是口味**（`design` skill 的 `references/design-reference.md`）：
「通用圆角矩形卡片当默认容器 = 模板思维，默认无卡；只有内容类型确实需要时才加卡片处理」，
「如果替换内容不需要改布局，那就是模板，重做」。

### 三条判据（不设组件数量上限）

1. **必要性**：这个组件承载的信息，用文字表达会明显更差吗？数字对比、趋势、空间关系、代码/数据原文才算过关，否则删掉。
2. **焦点唯一**：一条回答只有一个视觉焦点（最大那张图或那组数字）；其余组件的视觉权重必须明显更低，靠尺寸/位置/色彩强度拉开，**不是靠数组件个数**。
3. **不重复**：同一批数据不做两种表达（表格与图表二选一）。

### 卡片（`card`）只在两种场合用

- 需要**并排**的 `grid` 子项（没有边界就分不清内容归属）；
- 承载**数据对象**：表格、图、keyvalue、指标组。

单段文字、单个列表、已经自带边界的表格/图表，**不要包卡**。用 `h3` 标题 + 正文 + 间距代替。

### 层级靠字，不靠框

- 卡片标题 16px / 字重 650 / 句首大小写（**不是** 12.5px 全大写小标签）；
- 12.5px 全大写只用于 eyebrow（如 hero 上方那一行）；
- 大字号带负字距（≥32px 约 -0.022em，20–28px 约 -0.012em），数字列 `tabular-nums`；
- CJK 正文行高 1.7，长段落行宽 ≤68ch；
- 表面对比遵循规范：浅色相邻表面明度差 ≥4%，或阴影 ≥ `0 1px 3px rgba(0,0,0,0.10)`；深色靠半透明白叠加（卡片约 4%，抬升面 8%），投影在深色几乎无效。

### 不要

- 装饰性编号（①②③）：该分点用 `list`，该分节用标题；
- 同一套骨架每条回答复用（标题栏 → 卡片网格 → 表格 → callout）；
- 为了"显得丰富"堆组件：读者找不到重点就是失败。

### 怎么验证没模板化

`node scripts/genui-usage-audit.mjs` 输出「版式多样性」：不同版式签名数、最常见签名占比、归一化熵（越接近 1 越多样）、每回答 card 数分布。熵明显下降或 card 数不降反升，就说明规则没生效。

## 范例：示范「判断」，不要照抄组件序列

每个范例后面都跟着**什么时候不要这样**。组件多是好事——只要每个都在承载不同信息、并且有焦点和层次；真正的毛病是重复表达、以及把纯文字段落包进卡片。

### 1. 状态汇报（多点 + 有构图）

```json dsh-ui
{"items":[{"type":"grid","cols":4,"items":[{"type":"stat","label":"<user-language metric>","value":"26","delta":"#123–#148"},{"type":"stat","label":"<user-language metric>","value":"0"},{"type":"stat","label":"<user-language metric>","value":"556","delta":"<user-language status>"},{"type":"stat","label":"<user-language metric>","value":"45"}]},{"type":"table","columns":["<user-language column>","<user-language column>","<user-language column>"],"types":["text","badge","text"],"rows":[["<user-language text>","<user-language status>","<user-language text>"],["<user-language text>","<user-language status>","<user-language text>"]]},{"type":"callout","tone":"info","title":"<user-language title>","content":"<user-language text>"}]}
```

不要这样：把同一句话既写进正文又放进卡片；也不要为每条信息配一张卡（4 个 stat 排一行就够）。

### 2. 解释/教学（文字为主，一个点睛组件）

```json dsh-ui
{"items":[{"type":"text","size":"body","content":"<user-language text>"},{"type":"list","items":[{"title":"<user-language title>","desc":"<user-language description>"},{"title":"<user-language title>","desc":"<user-language description>"}]},{"type":"callout","tone":"warning","title":"<user-language title>","content":"<user-language text>"}]}
```

不要这样：每段都配一个组件；把一句话拆成好几个 text 节点（用行内标记就够了）。

### 3. 对比选型

```json dsh-ui
{"items":[{"type":"table","columns":["<user-language column>","<user-language column>","<user-language column>"],"types":["text","text","badge"],"rows":[["<user-language text>","<user-language text>","<user-language status>"],["<user-language text>","<user-language text>","<user-language status>"]]},{"type":"callout","tone":"success","title":"<user-language title>","content":"<user-language text>"}]}
```

不要这样：表格里放同一批数据后又画一张图。

反例（这条会被围栏校验直接拒绝，所以别抄）：

```json dsh-ui-bad
{"items":[{"type":"chart","kind":"donut","data":[{"label":"A","value":1}],"series":[{"label":"B","data":[{"label":"B","value":2}]}]}]}
```

为什么拒：`series` 只对 `bars`/`line` 有效；环形图给了 `series` 属于契约冲突，围栏会**静默降级为代码块**。

### 4. 排查诊断（顺序即叙事）

```json dsh-ui
{"items":[{"type":"steps","current":1,"steps":[{"title":"<user-language step>","desc":"<user-language description>"},{"title":"<user-language step>","desc":"<user-language description>"},{"title":"<user-language step>","desc":"<user-language description>"}]},{"type":"diff","diffs":[{"path":"PlotBlock.tsx","oldText":"e.preventDefault()","newText":"if (!e.metaKey && !e.ctrlKey) return"}]},{"type":"callout","tone":"info","title":"<user-language title>","content":"<user-language text>"}]}
```

不要这样：把"复现/定位/修复"写成三个卡片并列（那是流程，用 steps）。

### 5. 数据结论（一个主图 + 明细）

```json dsh-ui
{"items":[{"type":"chart","kind":"line","data":[],"series":[{"label":"<user-language series>","data":[{"label":"<user-language point>","value":8},{"label":"<user-language point>","value":12},{"label":"<user-language point>","value":9}]}]},{"type":"table","columns":["<user-language column>","<user-language column>","<user-language column>"],"types":["text","num","delta"],"rows":[["<user-language text>","8","-4%"],["<user-language text>","12","+50%"]]}]}
```

不要这样：图与表用同一粒度表达同一批数据（图看趋势、表看明细才不重复）。

### 6. 短回答：正确地不套组件

> 这个改动我先不做了——它要动宿主的输入组件，而你说了不碰宿主。

不要这样：一句话的结论配 stat + 表格 + callout。**没有内容就不发组件，这是对的，不算漏发。**

## 使用规则

1. **围栏放哪，组件就出现在哪** —— 文字在前后自然流动，不要用工具、不要解释"这是一个围栏"。**围栏一闭合就立即渲染**（不等整条回答结束），所以可以边写文字边出组件
2. **组合优先**：复杂界面用 `grid`+`card`+`stat`+`table` 拼，不要追求单一巨型组件
3. **JSON 必须严格合法，发出前完成 4 步自检**：插件**只**修标点级小错（字符串内半角引号、尾随逗号）；**缺括号/错括号等结构错误一律不修**，直接红横幅退化成代码块——写错就重发，别指望兜底。**最容易犯的错：字符串值里用了半角引号 `"`**——中文引语一律写 `“”` 或 `「」`。发出围栏前自检 4 条：① 括号配对：`{` 与 `}`、`[` 与 `]` 数量相等，**收尾序列逐个核对**（长表格最易在最后几行错位：把 `]]}]}` 写成 `]}]}]}`）② 无尾随逗号 ③ 值内引号用中文引号 ④ 最后一个字符必须是 `}`（**`}` 之后不要再写任何字符**——实测常见错误是习惯性追加 `</p>` 或一句解释，整条围栏就解析不了）。不要在 JSON 字符串里放 markdown；超长表格/列表拆成多个组件分开发，宁短勿长
3.5. **字段名逐个核对（写错一个 = 整条围栏降级为代码块）**：某个组件的必填字段写错 / 缺失 → 该组件被丢弃 → 整份 spec 判定不可渲染 → 用户只看到一段裸 JSON。高频误写：`callout` 正文是 `content`（不是 text/body）；`table` 要 `columns` + `rows`（不是 data，只给二维 rows 时首行会当表头）；`keyvalue` 要 `pairs:[{key,value}]`（不是 items）；`diff` 是 `diffs`；图片/音视频是 `src`；`code` 是 `code`、`copy` 是 `text`。拿不准就调 `validate_dsh_ui`，不要凭直觉命名
4. **不要嵌套围栏**：dsh-ui 里不要再包 ``` 代码围栏
5. **深色主题友好**：配色选深底亮色；UI 主题跟随应用
6. **场景判断**：先查上面的映射表 —— 内容类型命中就上对应组件；只有纯文字问答、一句话能说清时才不用
7. **图表范围**：`plot` 给合理 xMin/xMax（如 -3.14 到 3.14）；3D 场景 mesh 少而精
8. **规格要紧凑**：整棵组件树 ≤200 节点、≤8 层嵌套（超出部分会被渲染器裁掉），避免巨型 spec
9. **一个主题选一个主组件**：命中映射表后选**一种**组件承载，同一信息不要用两种组件重复表达（同一批数据又画 bars 又画 donut = 冗余）
10. **数量纪律**：一条回答 3–8 个组件为宜，宁缺毋滥。反例：该用 `table` 对比时写三段 `text`；一个 `stat` 能说清的事套 `card`+`grid`；与内容无关的 `scene3d` 炫技——3D 只在内容本身就是几何/空间时才用
12. **给命令就给能直接粘的**：多行 python 一律写成 heredoc 包装的**一整段** shell 代码块（`python - <<'PY'` … `PY`），不要用 `python -c "…"` 配反斜杠续行——续行在复制/粘贴里最容易碎成多行，用户还得自己拼回 heredoc。单行表达式才用 `-c`，且必须真的在一行内写完。示例：

    ````text
    cd /path/to/repo
    python - <<'PY'
    import json
    d = json.load(open('report.json'))
    print(d.get('status'))
    PY
    ````

    同理：需要用户执行的脚本放进 `code` 节点（`lang`: `bash`/`python`）或正文围栏，并保证**从第一行到最后一行一次粘进终端就能跑**。
11. **先验后发（复杂 UI）**：发出 ```dsh-ui 围栏前，若 spec ≥3 个组件或含 `table`（长表格最易括号错位），先调用 `validate_dsh_ui` 工具（参数 `spec` 传围栏内的 JSON 文本）验证；返回 `next=fix_and_revalidate` 就按诊断修正后重新验证；返回 `next=emit_fence` 再发出；返回 `next=emit_repaired_fence` 时直接照抄 `repaired_json` 发出，无需再次验证；简单 UI（≤2 个组件）不必验证，渲染器会自动修复大部分标点/括号错误
