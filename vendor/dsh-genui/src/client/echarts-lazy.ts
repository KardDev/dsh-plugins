/**
 * Runtime loader for the ECharts engine. The heavy echarts bundle ships as a
 * separate asset (`lib/assets/echarts.js`, served by the plugin's own HTTP
 * route) and is fetched ONLY when a spec contains an `echart` node — the
 * main client bundle stays small and most conversations never download
 * echarts at all. On a host that does not serve the asset the load rejects
 * and the EChartNode shows its fallback.
 * @module @changfenhuang/dsh-genui/client/echarts-lazy
 */
import { loadGenuiAsset } from './asset-loader.ts'
export { CORE_PRESETS } from './echarts-engine.ts'

/** The ECharts instance surface (the subset the component uses). */
export interface EChartsInstance {
  setOption: (opt: unknown, notMerge?: boolean) => void
  resize: () => void
  dispose: () => void
}

/** The engine surface registered by the echarts asset bundle. */
interface EChartsAssetApi {
  createChart: (el: HTMLElement, option: unknown, opts?: { height?: number }) => EChartsInstance
}

/**
 * Create an ECharts instance on `el` with the given option (engine loaded on
 * demand). The caller owns the returned instance and must dispose it.
 * @param el - the DOM node to host the chart canvas.
 * @param option - the ECharts option object.
 * @param opts - optional height override.
 * @returns the ECharts instance (setOption/resize/dispose).
 */
export async function createChart(
  el: HTMLElement,
  option: unknown,
  opts?: { height?: number },
  engine: 'core' | 'full' = 'core',
): Promise<EChartsInstance> {
  const api = await loadGenuiAsset<EChartsAssetApi>(engine === 'full' ? 'echarts-full' : 'echarts-core')
  return api.createChart(el, option, opts)
}
