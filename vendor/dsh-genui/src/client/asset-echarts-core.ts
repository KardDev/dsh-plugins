/**
 * ECharts CORE asset bundle — the tree-shaken engine used by the common
 * presets (bar / line / area / pie / scatter / bigline).
 *
 * Progressive disclosure for the engine: the full ECharts build is ~1 MB, and
 * most answers only ever draw a bar or line chart. This bundle registers the
 * same `createChart` surface with only the chart types and components those
 * presets touch, so a basic chart downloads a fraction of the payload; the
 * full engine (`echarts-full.js`) is fetched only when a spec needs a type
 * outside this set or ships a raw `option`.
 * @module @changfenhuang/dsh-genui/client/asset-echarts-core
 */
import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart, ScatterChart } from 'echarts/charts'
import {
  DataZoomComponent, DatasetComponent, GridComponent, LegendComponent, MarkAreaComponent,
  MarkLineComponent, MarkPointComponent, TitleComponent, TooltipComponent, TransformComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption, EChartsType } from 'echarts/core'

echarts.use([
  BarChart, LineChart, PieChart, ScatterChart,
  GridComponent, TooltipComponent, LegendComponent, TitleComponent,
  DataZoomComponent, MarkLineComponent, MarkAreaComponent, MarkPointComponent,
  DatasetComponent, TransformComponent,
  CanvasRenderer,
])

function createChart(el: HTMLElement, option: EChartsCoreOption, opts?: { height?: number }): EChartsType {
  const initOpts = opts !== undefined && opts.height !== undefined ? { height: opts.height } : undefined
  const instance = echarts.init(el, undefined, initOpts)
  instance.setOption(option)
  return instance
}

const win = globalThis as unknown as { __GenuiAssets__?: Record<string, unknown> }
const assets = win.__GenuiAssets__ ?? (win.__GenuiAssets__ = {})
assets.echartsCore = { createChart }
