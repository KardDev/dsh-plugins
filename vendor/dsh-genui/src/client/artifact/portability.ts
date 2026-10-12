import { echartEngineFor } from '../echarts-engine.ts'
import type { GenuiNode, GenuiSpec } from '../spec.ts'
import { GENUI_NATIVE_TYPES } from '../genui-runtime/schema.ts'
import { safeMediaSrc } from '../genui-runtime/value-utils.ts'
import type { GenuiPortabilityReport, GenuiStandaloneAsset } from './types.ts'

const ASSET_ORDER: GenuiStandaloneAsset[] = ['mermaid', 'three', 'echarts-core', 'echarts-full']

/** 递归收集当前节点树依赖的引擎和媒体信息。 */
function scan(items: unknown[], report: GenuiPortabilityReport, assets: Set<GenuiStandaloneAsset>): void {
  for (const item of items) {
    if (typeof item !== 'object' || item === null || !('type' in item) || typeof item.type !== 'string') continue
    const node = item as GenuiNode & Record<string, unknown>
    if (!GENUI_NATIVE_TYPES.has(node.type)) report.customTypes.push(node.type)
    if (node.type === 'mermaid') assets.add('mermaid')
    if (node.type === 'scene3d') assets.add('three')
    if (node.type === 'echart') assets.add(echartEngineFor(node as Extract<GenuiNode, { type: 'echart' }>))
    if (typeof node.action === 'string' || node.type === 'submit' && (typeof node.action === 'string' || typeof node.resetAction === 'string')) report.hasModelActions = true
    if (node.type === 'image' || node.type === 'audio' || node.type === 'video') {
      const src = safeMediaSrc(node.src)
      if (src !== undefined) report.externalMedia.push(src)
      if (node.type === 'video') {
        const poster = safeMediaSrc(node.poster)
        if (poster !== undefined) report.externalMedia.push(poster)
      }
    }
    if (Array.isArray(node.items)) {
      if (node.type === 'list') scan(node.items.filter(child => typeof child === 'object' && child !== null && 'type' in child) as unknown[], report, assets)
      else if (node.type === 'accordion') {
        for (const section of node.items) if (typeof section === 'object' && section !== null && 'items' in section && Array.isArray(section.items)) scan(section.items, report, assets)
      } else scan(node.items, report, assets)
    }
    if (Array.isArray(node.tabs)) for (const tab of node.tabs) if (typeof tab === 'object' && tab !== null && 'items' in tab && Array.isArray(tab.items)) scan(tab.items, report, assets)
    if (node.type === 'table' && Array.isArray(node.details)) for (const row of node.details) if (Array.isArray(row)) scan(row, report, assets)
  }
}

/** 扫描嵌套 GenUI 节点，选择运行资源并列出独立页面限制。 */
export function analyzeGenuiPortability(spec: GenuiSpec): GenuiPortabilityReport {
  const report: GenuiPortabilityReport = { requiredAssets: [], customTypes: [], externalMedia: [], hasModelActions: false }
  const assets = new Set<GenuiStandaloneAsset>()
  scan(spec.items, report, assets)
  report.requiredAssets = ASSET_ORDER.filter(name => assets.has(name))
  report.customTypes = [...new Set(report.customTypes)]
  report.externalMedia = [...new Set(report.externalMedia)]
  return report
}
