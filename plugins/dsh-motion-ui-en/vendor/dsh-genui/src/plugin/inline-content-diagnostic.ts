import type { GenuiNode, GenuiSpec } from '../client/spec.ts'

export interface InlineContentWarning {
  path: string
  kind: 'fenced_code' | 'markdown_table'
  replacement: 'code' | 'table'
}

/** 识别文字字段中的连续代码围栏标记。 */
function hasFencedCode(value: string): boolean {
  return /`{3,}|~{3,}/.test(value)
}

/** 判断相邻表头下方的 Markdown 表格分隔行。 */
function isMarkdownTableSeparator(line: string): boolean {
  let value = line.trim()
  if (value.startsWith('|')) value = value.slice(1)
  if (value.endsWith('|')) value = value.slice(0, -1)
  const cells = value.split('|').map(cell => cell.trim())
  return cells.length >= 2 && cells.every(cell => /^:?-{2,}:?$/.test(cell))
}

/** 仅在相邻表头和分隔行构成表格时报告。 */
function hasMarkdownTable(value: string): boolean {
  const lines = value.split(/\r?\n/)
  for (let i = 0; i + 1 < lines.length; i++) {
    if (lines[i]!.includes('|') && isMarkdownTableSeparator(lines[i + 1]!)) return true
  }
  return false
}

/** 按组件结构检查需要块级内容诊断的 canonical 显示字段。 */
export function collectInlineContentWarnings(spec: GenuiSpec): InlineContentWarning[] {
  const warnings: InlineContentWarning[] = []

  /** 将一个可见文字字段中的块级 Markdown 记录为稳定诊断。 */
  function check(value: string | undefined, path: string): void {
    if (value === undefined) return
    if (hasFencedCode(value)) warnings.push({ path, kind: 'fenced_code', replacement: 'code' })
    if (hasMarkdownTable(value)) warnings.push({ path, kind: 'markdown_table', replacement: 'table' })
  }

  /** 只沿 GenUI 组件的子节点字段访问下一层。 */
  function visit(node: GenuiNode, path: string): void {
    switch (node.type) {
      case 'text': check(node.content, `${path}.content`); break
      case 'card':
        check(node.title, `${path}.title`)
        node.items.forEach((child, i) => visit(child, `${path}.items[${i}]`))
        break
      case 'row':
      case 'col':
      case 'grid':
        node.items.forEach((child, i) => visit(child, `${path}.items[${i}]`))
        break
      case 'button':
      case 'checkbox':
      case 'link':
      case 'badge':
      case 'switch':
      case 'submit':
        check(node.label, `${path}.label`)
        break
      case 'input':
      case 'select':
      case 'slider':
      case 'textarea':
        check(node.label, `${path}.label`)
        break
      case 'radio':
        check(node.label, `${path}.label`)
        node.options.forEach((option, i) => check(option, `${path}.options[${i}]`))
        if (typeof node.answer === 'string') check(node.answer, `${path}.answer`)
        check(node.explanation, `${path}.explanation`)
        break
      case 'image':
      case 'audio':
      case 'video':
        check(node.alt, `${path}.alt`)
        break
      case 'hero':
        for (const field of ['label', 'value', 'delta', 'title', 'subtitle'] as const) check(node[field], `${path}.${field}`)
        break
      case 'stat':
        for (const field of ['label', 'value', 'delta'] as const) check(node[field], `${path}.${field}`)
        break
      case 'progress':
        check(node.label, `${path}.label`)
        check(node.valueLabel, `${path}.valueLabel`)
        break
      case 'list':
        node.items.forEach((item, i) => {
          const itemPath = `${path}.items[${i}]`
          if (typeof item === 'string') check(item, itemPath)
          else if ('type' in item && typeof item.type === 'string') visit(item as GenuiNode, itemPath)
          else {
            check(item.title, `${itemPath}.title`)
            check(item.desc, `${itemPath}.desc`)
          }
        })
        break
      case 'table':
        node.columns.forEach((column, i) => check(column, `${path}.columns[${i}]`))
        node.rows.forEach((row, i) => {
          const detail = node.details?.[i] ?? null
          row.forEach((cell, j) => {
            if (node.types?.[j] === 'index' && (j !== 0 || detail === null)) return
            if (typeof cell === 'string') check(cell, `${path}.rows[${i}][${j}]`)
          })
        })
        node.details?.forEach((detail, i) => detail?.forEach((child, j) => visit(child, `${path}.details[${i}][${j}]`)))
        break
      case 'chart':
        node.series?.forEach((series, i) => check(series.label, `${path}.series[${i}].label`))
        break
      case 'tabs':
        node.tabs.forEach((tab, i) => {
          check(tab.label, `${path}.tabs[${i}].label`)
          tab.items.forEach((child, j) => visit(child, `${path}.tabs[${i}].items[${j}]`))
        })
        break
      case 'accordion':
        node.items.forEach((item, i) => {
          check(item.title, `${path}.items[${i}].title`)
          item.items.forEach((child, j) => visit(child, `${path}.items[${i}].items[${j}]`))
        })
        break
      case 'callout':
        check(node.title, `${path}.title`)
        check(node.content, `${path}.content`)
        break
      case 'steps':
        node.steps.forEach((step, i) => {
          check(step.title, `${path}.steps[${i}].title`)
          check(step.desc, `${path}.steps[${i}].desc`)
        })
        break
      case 'keyvalue':
        node.pairs.forEach((pair, i) => {
          check(pair.key, `${path}.pairs[${i}].key`)
          check(pair.value, `${path}.pairs[${i}].value`)
        })
        break
      case 'timeline':
        node.items.forEach((item, i) => {
          check(item.title, `${path}.items[${i}].title`)
          check(item.time, `${path}.items[${i}].time`)
          check(item.desc, `${path}.items[${i}].desc`)
        })
        break
      case 'breadcrumb':
        node.items.forEach((item, i) => check(item, `${path}.items[${i}]`))
        break
      case 'quiz':
        check(node.question, `${path}.question`)
        node.options.forEach((option, i) => {
          check(option.label, `${path}.options[${i}].label`)
          check(option.feedback, `${path}.options[${i}].feedback`)
        })
        check(node.explanation, `${path}.explanation`)
        break
      case 'plot':
      case 'echart':
      case 'diagram':
      case 'scene3d':
      case 'svg':
        check(node.title, `${path}.title`)
        break
      case 'copy':
        check(node.label, `${path}.label`)
        break
    }
  }

  check(spec.title, 'title')
  spec.items.forEach((node, i) => visit(node, `items[${i}]`))
  return warnings
}
