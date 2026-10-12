/**
 * GenUI gallery: canonical broad-coverage sample of built-in node types.
 * Docs, demos, and renderer tests reuse it as the component gallery fence.
 */
import type { GenuiSpec } from './spec.ts'

/** Canonical gallery spec for the built-in GenUI component vocabulary. */
export const gallerySpec: GenuiSpec = {
  title: 'GenUI · 组件画廊',
  gap: 14,
  items: [
    { type: 'hero', label: '可用率 · 近 30 天', value: '99.96%', delta: '+0.02%', tone: 'accent', spark: [99.8, 99.85, 99.9, 99.88, 99.94, 99.96], title: 'hero 封面块', subtitle: '一条回答最多一个：eyebrow + 超大数字 + 标题 + 副标题，带 tone 渐变底色。' },
    { type: 'grid', cols: 3, items: [
      { type: 'card', title: '默认', items: [{ type: 'text', size: 'body', content: '不写 accent：中性表面。' }] },
      { type: 'card', accent: '#f59e0b', title: 'accent #f59e0b', items: [{ type: 'text', size: 'body', content: '只有边框与标题带上色相，表面保持中性。' }] },
      { type: 'card', accent: '#3ecf8e', title: 'accent #3ecf8e', items: [{ type: 'text', size: 'body', content: '深色主题下不会发脏。' }] },
    ] },
    { type: 'grid', cols: 3, items: [
      { type: 'card', span: 2, title: 'span:2 · 宽卡', items: [
        { type: 'text', size: 'body', content: 'grid 子节点加 span 就能跨列：一张宽卡 + 一张窄卡。卡片高度由该行最高的一张决定，内容会自动撑满或居中。' },
        { type: 'chart', kind: 'line', data: [], series: [
          { label: '本周', data: [{ label: '一', value: 8 }, { label: '二', value: 12 }, { label: '三', value: 9 }, { label: '四', value: 14 }] },
          { label: '上周', data: [{ label: '一', value: 6 }, { label: '二', value: 9 }, { label: '三', value: 7 }, { label: '四', value: 10 }] }] }] },
      { type: 'card', title: 'span:1', items: [{ type: 'chart', kind: 'donut', data: [{ label: '视觉', value: 42 }, { label: '采纳', value: 33 }, { label: '可靠', value: 25 }] }] },
    ] },
    { type: 'text', size: 'h1', content: '排版层级' },
    { type: 'text', size: 'h2', content: '二级标题' },
    { type: 'text', size: 'h3', content: '三级标题' },
    { type: 'text', size: 'body', content: '正文：组件白名单渲染，不经过任意 HTML 路径。' },
    { type: 'text', size: 'muted', content: '弱化文本' },
    { type: 'text', size: 'caption', content: '说明文字', center: true },
    { type: 'row', items: [
      { type: 'badge', label: '成功', tone: 'success' },
      { type: 'badge', label: '警告', tone: 'warn' },
      { type: 'badge', label: '危险', tone: 'danger' },
      { type: 'badge', label: '强调', tone: 'accent', icon: '★' },
      { type: 'avatar', name: 'Alice' },
      { type: 'avatar', name: 'Bob', color: '#3d9e8f' },
      { type: 'link', label: '详情链接' },
    ], wrap: true },
    { type: 'divider' },
    { type: 'image', src: '/demo-image.png', alt: '图片展示演示' },
    { type: 'audio', src: '/demo-audio.mp3', alt: '音频播放器演示' },
    { type: 'video', src: '/demo-video.mp4', alt: '视频播放器演示', poster: '/demo-video.jpg', aspectRatio: '16:9' },
    { type: 'grid', cols: 3, items: [
      { type: 'stat', label: '在线率', value: '99.96%', size: 'hero', delta: '+0.02%' },
      { type: 'stat', label: 'CPU', value: '42%', delta: '+3.1%', spark: [31, 38, 35, 44, 40, 42] },
      { type: 'stat', label: '内存', value: '6.8 GB', delta: '-1.2%' },
      { type: 'stat', label: '请求数', value: '128.4k', spark: [90, 104, 98, 121, 116, 128] },
    ] },
    { type: 'progress', label: '训练进度', value: 72, valueLabel: '72%' },
    { type: 'progress', label: '覆盖率', value: 64, target: 80, valueLabel: '64% / 目标 80%' },
    { type: 'progress', variant: 'ring', value: 72, label: '本轮完成度', valueLabel: '第 3 / 4 轮' },
    { type: 'card', title: '性能指标', items: [
      // 表头可点击排序：数值感知（千分位 / k / 万 / % 都能正确比较），
      // 数值列自动右对齐。
      { type: 'table', columns: ['指标', 'Q1', 'Q2', 'Q3'], rows: [
        ['延迟', 92, 87, 81], ['吞吐', '1.2k', '1.4k', '1.6k'], ['错误率', '0.3%', '0.2%', '0.1%'],
        ['营收', '3.5万', '4.1万', '5.2万'], ['注册', '1,234', '2,345', '3,456'],
      ] },
      { type: 'keyvalue', pairs: [
        { key: '版本', value: 'v0.1.0' }, { key: '环境', value: 'production' }, { key: '区域', value: 'cn-east' },
      ] },
    ] },
    { type: 'list', items: [
      { title: '标题项', desc: '带描述的列表项' },
      '纯文本列表项',
      { title: '另一个标题' },
    ] },
    { type: 'chart', kind: 'bars', data: [
      { label: '一', value: 10 }, { label: '二', value: 20 }, { label: '三', value: 15 },
    ] },
    { type: 'chart', kind: 'line', data: [
      { label: '周一', value: 8 }, { label: '周二', value: 12 }, { label: '周三', value: 9 },
    ] },
    { type: 'chart', kind: 'donut', data: [
      { label: 'A', value: 30 }, { label: 'B', value: 70 },
    ] },
    { type: 'chart', data: [], series: [
      { label: '本月', data: [{ label: 'Q1', value: 3 }, { label: 'Q2', value: 5 }] },
      { label: '上月', data: [{ label: 'Q1', value: 2 }, { label: 'Q2', value: 4 }] },
    ] },
    { type: 'chart', kind: 'line', data: [], series: [
      { label: '本月', data: [{ label: '一', value: 8 }, { label: '二', value: 12 }, { label: '三', value: 9 }] },
      { label: '上月', data: [{ label: '一', value: 6 }, { label: '二', value: 9 }, { label: '三', value: 7 }] },
    ] },
    { type: 'chart', kind: 'bars', data: [], stacked: true, series: [
      { label: '已完成', data: [{ label: 'Q1', value: 42 }, { label: 'Q2', value: 58 }, { label: 'Q3', value: 61 }] },
      { label: '进行中', data: [{ label: 'Q1', value: 18 }, { label: 'Q2', value: 14 }, { label: 'Q3', value: 9 }] },
    ] },
    { type: 'chart', horizontal: true, data: [
      { label: '自然搜索', value: 82 }, { label: '直接访问', value: 64 }, { label: '社交媒体', value: 41 },
    ] },
    { type: 'input', label: '筛选服务 / 状态', placeholder: '输入关键字即时过滤下表', id: 'gallery-filter' },
    { type: 'table', columns: ['服务', 'P95', '状态'], types: ['text', 'num', 'badge'], filter: 'gallery-filter', rows: [
      ['API 网关', '128', '正常'],
      ['搜索', '190', '关注'],
      ['推荐', '250', '偏高'],
    ] },
    { type: 'table', columns: ['服务', 'P95', '状态'], types: ['text', 'num', 'badge'], details: [
      [{ type: 'keyvalue', pairs: [{ key: '负责人', value: '平台组' }, { key: 'SLO', value: 'P95 < 150ms' }] },
       { type: 'text', size: 'body', content: '展开行可以放任意组件：指标、图表、列表、表单都可以。' }],
      null,
      [{ type: 'progress', value: 91, target: 80, label: '负载水位', valueLabel: '91% / 目标 80%' }],
    ], rows: [
      ['API 网关', '128', '正常'],
      ['搜索', '190', '关注'],
      ['推荐', '250', '偏高'],
    ] },
    { type: 'table', columns: ['区域', 'Q1', 'Q2', 'Q3'], types: ['group', 'num', 'num', 'num'], total: true, rows: [
      ['华东', '', '', ''],
      ['上海', '120', '138', '151'],
      ['杭州', '96', '104', '118'],
      ['华北', '', '', ''],
      ['北京', '88', '95', '103'],
    ] },
    { type: 'card', tone: 'success', title: '已通过', items: [
      { type: 'text', size: 'body', content: '分组表：首列为 group 时，只有第一格有内容的行会渲染成跨列小标题；total 追加一行合计。' },
    ] },
    { type: 'table', columns: ['#', '服务', '近 6 期延迟', '可用率', '负载', '状态'], types: ['index', 'text', 'spark', 'ring', 'bar', 'badge'], rows: [
      ['1', 'API 网关', '180,164,150,140,133,128', '99.96', '62', '正常'],
      ['2', '搜索', '220,210,230,205,198,190', '99.82', '78', '关注'],
      ['3', '推荐', '310,340,300,280,260,250', '99.41', '91', '偏高'],
    ] },
    { type: 'table', columns: ['渠道', '完成度', '状态'], types: ['text', 'bar', 'badge'], rows: [
      ['自然搜索', '82', '健康'], ['直接访问', '64', '关注'], ['社交媒体', '41', '偏低'],
    ] },
    { type: 'tabs', tabs: [
      { label: '概览', items: [{ type: 'text', content: '标签页一的内容' }] },
      { label: '明细', items: [{ type: 'list', items: ['明细 A', '明细 B'] }] },
      { label: '图表', items: [{ type: 'chart', kind: 'donut', data: [{ label: 'X', value: 40 }, { label: 'Y', value: 60 }] }] },
    ] },
    { type: 'col', gap: 8, items: [
      { type: 'button', label: '主按钮', tone: 'primary' },
      { type: 'button', label: '危险', tone: 'danger', small: true },
      { type: 'button', label: '成功', tone: 'success' },
      { type: 'button', label: '幽灵', tone: 'ghost', icon: '↗' },
    ] },
    { type: 'row', items: [
      { type: 'input', label: '名称', placeholder: '输入…' },
      { type: 'select', label: '环境', options: ['dev', 'staging', 'production'] },
    ], wrap: true },
    { type: 'row', items: [
      { type: 'checkbox', label: '自动保存', checked: true },
      { type: 'switch', label: '通知', checked: true },
      { type: 'radio', label: '主题', options: ['浅色', '深色', '跟随系统'] },
    ], wrap: true },
    { type: 'textarea', label: '备注', placeholder: '多行输入…', rows: 3 },
    { type: 'accordion', items: [
      { title: '第一项', items: [{ type: 'json', value: { ok: true, count: 3 } }] },
      { title: '第二项', items: [{ type: 'code', lang: 'ts', code: 'export const x = 1' }] },
    ] },
    { type: 'copy', label: '复制令牌', text: 'sk-1234567890' },
    { type: 'echart', preset: 'bar', title: 'echart · preset:bar（只下载 core 引擎）', height: 240, data: [
      { label: '自然搜索', value: 82 }, { label: '直接访问', value: 64 }, { label: '社交媒体', value: 41 },
    ] },
    { type: 'echart', preset: 'radar', title: 'echart · preset:radar（按需拉完整引擎）', height: 280, series: [
      { label: '本轮', data: [{ label: '视觉', value: 86 }, { label: '可用', value: 92 }, { label: '性能', value: 74 }, { label: '采纳', value: 88 }, { label: '稳定', value: 90 }] },
      { label: '上轮', data: [{ label: '视觉', value: 62 }, { label: '可用', value: 70 }, { label: '性能', value: 58 }, { label: '采纳', value: 61 }, { label: '稳定', value: 72 }] },
    ] },
    { type: 'echart', preset: 'sankey', title: 'echart · preset:sankey（links 驱动）', height: 260, links: [
      { from: '入口', to: 'API', value: 40 },
      { from: '入口', to: '缓存', value: 25 },
      { from: 'API', to: '渲染', value: 32 },
      { from: '渲染', to: '完成', value: 30 },
      { from: '缓存', to: '完成', value: 28 },
    ] },
    { type: 'echart', preset: 'wordCloud', title: 'echart · preset:wordCloud（词云，完整引擎 + 扩展）', height: 240, data: [
      { label: '系统', value: 90 }, { label: '用户', value: 70 }, { label: '权限', value: 60 },
      { label: '模块', value: 50 }, { label: '数据', value: 45 }, { label: '安全', value: 40 },
      { label: '扩展', value: 30 }, { label: '渲染', value: 25 },
    ] },
    { type: 'svg', title: 'svg · 独立图片预览（隔离渲染）', height: 160, code: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 120"><rect width="220" height="120" rx="10" fill="#534ab7"/><rect x="16" y="16" width="88" height="40" rx="6" fill="#7f74f2"/><text x="60" y="42" text-anchor="middle" fill="#fff" font-size="13">网关</text><rect x="116" y="64" width="88" height="40" rx="6" fill="#3ecf8e"/><text x="160" y="90" text-anchor="middle" fill="#fff" font-size="13">服务</text><path d="M104 56 L116 76" stroke="#fff" stroke-width="2"/></svg>' },
    { type: 'plot', title: '波动叠加', xMin: -6.28, xMax: 6.28, series: [
      { expr: 'sin(x)', label: 'sin(x)', color: '#4f8ef7' },
      { expr: '0.8*cos(x)', label: 'cos', color: '#3ecf8e' },
    ] },
    { type: 'callout', tone: 'info', title: '提示', content: '画廊覆盖全部组件词汇。' },
    { type: 'steps', current: 2, steps: [
      { title: '起草', desc: '写规格' }, { title: '渲染', desc: '画组件' }, { title: '验证', desc: '跑测试' },
    ] },
    { type: 'diff', diffs: [
      { path: 'a.ts', oldText: 'const x = 1', newText: 'const x = 2' },
    ] },
    { type: 'code', lang: 'json', code: '{"hello": "world"}' },
    { type: 'mermaid', code: 'graph TD\nA[模型] --> B[渲染器]\nB --> C[组件]' },
    { type: 'diagram', kind: 'architecture', title: '架构图（配色跟随宿主令牌）', nodes: [
      { id: 'm', label: '模型', type: 'external', x: 20, y: 40, w: 100, h: 44 },
      { id: 'f', label: '围栏 JSON', type: 'focal', x: 160, y: 40, w: 112, h: 44 },
      { id: 'g', label: 'guard', type: 'backend', x: 312, y: 40, w: 104, h: 44 },
      { id: 's', label: '组件库', type: 'store', x: 456, y: 40, w: 100, h: 44 },
    ], edges: [{ from: 'm', to: 'f' }, { from: 'f', to: 'g' }, { from: 'g', to: 's' }] },
    { type: 'scene3d', title: '几何演示', ambient: 1, meshes: [
      { shape: 'box', color: '#4f8ef7', position: [-1.4, 0, 0], rotation: [0.5, 0.8, 0] },
      { shape: 'sphere', color: '#3ecf8e', position: [0, 0, 0] },
      { shape: 'cone', color: '#e0a458', position: [1.4, 0, 0] },
    ] },
    { type: 'timeline', items: [
      { title: '发布 v0.1', desc: '首个可用版本', time: '08-01' },
      { title: '事件循环', desc: 'action 回流', time: '08-08' },
    ] },
    { type: 'file-tree', items: [
      { name: 'src', type: 'dir', children: [
        { name: 'client', type: 'dir', children: [{ name: 'GenuiBlock.tsx', type: 'file' }] },
        { name: 'spec.ts', type: 'file' },
      ] },
      { name: 'README.md', type: 'file' },
    ] },
    { type: 'breadcrumb', items: ['首页', '组件', '画廊'] },
    { type: 'quiz', question: '1 + 1 = ?', id: 'gallery-q1', options: [
      { label: '1', feedback: '再想想' }, { label: '2', correct: true }, { label: '3' },
    ], explanation: '二进制里 1+1=10，十进制里是 2。' },
    { type: 'spacer' },
  ],
}
