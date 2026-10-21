// Honest, portable examples: none of these represent real measurements or tasks.
const copy = (id, text, tone) => ({ id, type: 'text', text, ...(tone ? { tone } : {}) });
const metric = (id, label, value, unit, tone = 'accent') => ({ id, type: 'metric', label, value, unit, tone, decimals: 0 });
const card = (id, title, children, surface = 'outline') => ({ id, type: 'card', title, children, surface });
const example = (layout, accent, title, nodes, extra = {}) => ({ version: 1, title, fallback: '这是布局与交互示例，数据为演示数据；不代表实际测试、任务进度或推荐结论。', presentation: { layout, accent }, nodes, ...extra });
export const sceneExamples = [
  example('dashboard', 'blue', '分析仪表盘 · 示例', [
    { id: 'source', type: 'badge', text: '演示数据', tone: 'neutral', icon: 'database' },
    { id: 'metrics', type: 'row', children: [metric('count', '测试样本', 120, '项'), metric('pass', '通过样本', 108, '项', 'success'), metric('review', '待复核', 12, '项', 'warning')] },
    { id: 'chart', type: 'chart', kind: 'bar', label: '各组通过样本', unit: '项', rows: { ref: 'data.groups' }, labelKey: 'name', valueKey: 'passed' },
    card('conclusion', '观察与下一步', [copy('observation', 'B 组通过样本较少；需要查看失败类型和各组总样本，才能判断差异原因。')], 'soft')
  ], { data: { groups: [{ name: 'A 组', passed: 38 }, { name: 'B 组', passed: 32 }, { name: 'C 组', passed: 38 }] } }),
  example('workbench', 'teal', '参数工作台 · 下载时间估算', [
    copy('assumption', '理想持续速度估算，不含协议开销、限速与波动。', 'warning'),
    card('parameters', '输入参数', [{ id: 'size', type: 'input', label: '文件大小 GiB', bind: 'state.size' }, { id: 'speed', type: 'slider', label: '持续速度 MiB/s', bind: 'state.speed' }]),
    { id: 'time', type: 'metric', label: '理论用时', value: { ref: 'derived.minutes' }, unit: '分钟', decimals: 1, icon: 'gauge' },
    { id: 'detail', type: 'details', title: '计算方式', children: [copy('formula', '分钟 = GiB × 1024 ÷ MiB/s ÷ 60。速度需使用实际持续传输速度。')] }
  ], { state: { size: { type: 'number', default: 24, min: 1, max: 500, step: 1 }, speed: { type: 'number', default: 80, min: 5, max: 200, step: 5 } }, derived: { minutes: { op: 'div', args: [{ op: 'mul', args: [{ ref: 'state.size' }, { const: 1024 }] }, { op: 'mul', args: [{ ref: 'state.speed' }, { const: 60 }] }] } } }),
  example('comparison', 'violet', '方案对比 · 存储取舍示例', [
    copy('note', '以下为假设场景；应结合实际读写、价格和数据重要性决策。', 'warning'),
    { id: 'plans', type: 'row', children: [
      card('local', '本地方案', [{ id: 'localTag', type: 'badge', text: '优先低延迟', tone: 'accent', icon: 'cpu' }, metric('capacityA', '示例可用容量', 2, 'TiB'), copy('localCopy', '直接访问、延迟低。需要自行安排异地备份。')]),
      card('hybrid', '混合方案', [{ id: 'hybridTag', type: 'badge', text: '优先异地副本', tone: 'accent', icon: 'layers' }, metric('capacityB', '示例可用容量', 2, 'TiB'), copy('hybridCopy', '本地工作副本与远端备份。需考虑带宽和持续费用。')], 'featured')
    ] },
    copy('decision', '强调卡片表示当前讨论重点，不自动代表最佳或最便宜的方案。')
  ]),
  example('guide', 'amber', '步骤指南 · 开发环境准备', [
    { id: 'tag', type: 'badge', text: '操作清单示例', tone: 'neutral', icon: 'target' },
    copy('note', '步骤状态仅用于演示；插件不会自动执行这些操作。'),
    { id: 'steps', type: 'steps', items: [
      { title: '确认版本', description: '记录宿主版本、插件版本和所用配置目录。', status: 'pending' },
      { title: '准备隔离环境', description: '备份配置，使用独立开发会话和演示数据。', status: 'pending' },
      { title: '构建并验收', description: '验证交互、刷新恢复、深浅主题和窄屏布局。', status: 'pending' }
    ] },
    { id: 'details', type: 'details', title: '验收时记录什么', children: [copy('criteria', '记录明确的输入、可观察结果、错误以及尚未验证的范围。')] }
  ]),
  example('status', 'teal', '状态面板 · 批次统计示例', [
    { id: 'tag', type: 'badge', text: '演示快照 · 非实时任务', tone: 'warning', icon: 'info' },
    { id: 'counts', type: 'row', children: [metric('done', '示例已处理', 72, '项', 'success'), metric('remaining', '示例待处理', 28, '项')] },
    { id: 'progress', type: 'progress', label: '示例处理进度', value: 72, max: 100, unit: '项', tone: 'accent' },
    { id: 'steps', type: 'steps', items: [{ title: '读取示例清单', status: 'done' }, { title: '处理示例批次', description: '当前快照停留在这一阶段。', status: 'active' }, { title: '汇总结果', status: 'pending' }] }
  ]),
  example('report', 'rose', '阅读报告 · 评估结论组织', [
    { id: 'tag', type: 'badge', text: '报告结构示例', tone: 'neutral', icon: 'info' },
    copy('lead', '先写结论及适用条件，再展示支持它的数据。将事实、推测与待验证项分开陈述，方便读者判断结论的边界。'),
    card('findings', '主要发现', [copy('findingText', '本示例展示信息层级，不包含真实模型评估结论。正式报告应说明样本、设置与测量方式。')]),
    card('limits', '适用范围', [copy('limitText', '单个样例无法代表整体能力；速度与质量结果应关联具体配置。')]),
    { id: 'appendix', type: 'details', title: '方法与复现信息', children: [copy('method', '记录版本、提示词、采样参数、样本来源和失败案例，提供可复核证据。')] }
  ])
];
