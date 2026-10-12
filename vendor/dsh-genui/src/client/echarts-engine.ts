import type { GenuiEChart } from './spec.ts'

export const CORE_PRESETS: ReadonlySet<string> = new Set(['bar', 'line', 'area', 'pie', 'scatter', 'bigline'])

/** 依照 renderer 共用的 preset 规则选择 ECharts 资源。 */
export function echartEngineFor(node: GenuiEChart): 'echarts-core' | 'echarts-full' {
  if (node.option !== undefined) return 'echarts-full'
  return CORE_PRESETS.has(node.preset ?? 'bar') ? 'echarts-core' : 'echarts-full'
}
