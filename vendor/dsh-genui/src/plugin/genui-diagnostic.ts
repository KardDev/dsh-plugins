/**
 * GenUI 节点诊断共享逻辑。
 * @module @changfenhuang/dsh-genui/plugin/genui-diagnostic
 */

import type { GenuiProcessResult } from '../client/guard.ts'
import { COMPONENT_SCHEMAS } from '../client/genui-runtime/schema.ts'

/** 获取指定组件类型已知字段，保持提示顺序稳定。 */
function knownFieldsOf(type: string): string[] {
  const schema = COMPONENT_SCHEMAS[type]
  if (schema === undefined) return []
  return [...schema.required, ...Object.keys(schema.optional)]
}

/** 获取校验错误对应的节点路径。 */
function nodePathOf(error: string): string | null {
  const match = /^(items\[\d+\](?:\.items\[\d+\])*)(?=:|\.items\[|$)/.exec(error)
  return match === null ? null : match[1]!
}

/** 根据节点路径读取模型声明的节点对象。 */
function declaredNodeAt(value: unknown, path: string): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const root = value as Record<string, unknown>
  const normalized = path.replace(/^items/, '')
  let current: unknown = normalized === '' ? root : root.items
  for (const step of normalized.replace(/^\./, '').split('.').filter(part => part !== '')) {
    const matched = /(?:items)?\[(\d+)\]/.exec(step)
    const index = matched === null ? Number.NaN : Number(matched[1])
    if (!Number.isInteger(index) || !Array.isArray(current)) return undefined
    current = current[index]
  }
  return typeof current === 'object' && current !== null && !Array.isArray(current)
    ? current as Record<string, unknown>
    : undefined
}

/** 将校验错误转换为固定协议字段。 */
function fieldSymptom(error: string, path: string, type: string): string {
  const rest = error.slice(path.length)
  const unknown = /^\.([A-Za-z0-9_-]+): unknown field\b/.exec(rest)
  if (unknown !== null) {
    const known = knownFieldsOf(type)
    return [`error=unknown_field`, `field=${unknown[1]}`, ...(known.length === 0 ? [] : [`allowed=${known.join(',')}`])].join('\n')
  }
  const missing = /requires ([A-Za-z0-9_-]+)/.exec(rest)
  if (missing !== null) return `error=missing_required_field\nfield=${missing[1]}`
  return `error=validation_error\ndetail=${JSON.stringify(rest.replace(/^:\s*/, '').slice(0, 120))}`
}

/** 获取校验错误中声明的组件类型。 */
function errorTypeOf(error: string): string | undefined {
  return /type '([^']+)'/.exec(error)?.[1]
}

/** 生成被丢弃节点的路径、类型和字段诊断。 */
function droppedNodeDiagnosis(processed: GenuiProcessResult, raw: unknown): string[] {
  const byPath = new Map<string, string[]>()
  for (const error of processed.errors) {
    const path = nodePathOf(error)
    if (path === null) continue
    const bucket = byPath.get(path)
    if (bucket === undefined) byPath.set(path, [error])
    else bucket.push(error)
  }
  const lines: string[] = []
  for (const [path, errors] of byPath) {
    const node = declaredNodeAt(raw, path)
    const type = (typeof node?.type === 'string' ? node.type : undefined)
      ?? errors.map(errorTypeOf).find(candidate => candidate !== undefined)
    if (type !== undefined && repairedContainsType(processed.repaired, type)) continue
    const emitted = node === undefined ? [] : Object.keys(node).filter(key => key !== 'type')
    const symptoms = [...new Set(errors.map(error => fieldSymptom(error, path, type ?? 'unknown')))]
    lines.push([
      `node=${path}`,
      `type=${type ?? 'unknown'}`,
      ...symptoms,
      ...(emitted.length === 0 ? [] : [`written=${emitted.join(',')}`]),
    ].join('\n'))
  }
  return lines
}

/** 检查修复后的组件树中是否仍然存在指定类型的原生节点。 */
function repairedContainsType(node: unknown, type: string): boolean {
  if (Array.isArray(node)) return node.some(child => repairedContainsType(child, type))
  if (typeof node !== 'object' || node === null) return false
  const record = node as Record<string, unknown>
  if (record.type === type) return true
  return Object.values(record).some(child => repairedContainsType(child, type))
}

/**
 * 报告被丢弃的组件，并保留模型可以直接修正的字段信息。
 *
 * @param processed - 节点处理结果。
 * @param raw - 节点处理使用的原始值。
 * @returns 可嵌入调用方协议的诊断字段；没有节点被丢弃时返回 undefined。
 */
export function droppedNodeFailure(processed: GenuiProcessResult, raw: unknown): string[] | undefined {
  if (!processed.errors.some(error => error.startsWith('repair dropped '))) return undefined
  const dropped = processed.declaredNativeCount - processed.renderedNativeCount
  const diagnosis = droppedNodeDiagnosis(processed, raw)
  return [
    `declared=${processed.declaredNativeCount}`,
    `rendered=${processed.renderedNativeCount}`,
    `dropped=${dropped}`,
    ...diagnosis.flatMap(line => [line, '']),
    ...processed.errors.map(error => `diagnostic=${JSON.stringify(error)}`),
  ]
}
