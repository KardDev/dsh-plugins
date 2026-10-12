import {useWidgetState} from './widget-state.tsx'
/**
 * PlotBlock: renders one or more math functions as an SVG line chart. The
 * model supplies expressions (e.g. "sin(x)") which are evaluated by the
 * SafeMath white-listed evaluator — never eval — and sampled into polylines.
 * Pure SVG: linear x/y scales computed in place, no chart library.
 *
 * v2 interactivity: series may declare `params` (e.g. {a: 2} in "a*sin(x)")
 * which render as live sliders under the chart — dragging re-samples the
 * curve in place. The plot itself supports drag-to-pan and wheel-to-zoom.
 */
import { renderInline } from './inline.ts'
import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import { sampleExpr } from './safe-math.ts'
import css from './PlotBlock.module.css'

export interface PlotSeriesParam {
  name: string
  value: number
  min?: number | undefined
  max?: number | undefined
  step?: number | undefined
  /** v1.5: animate this parameter from its initial value to this target. */
  animateTo?: number | undefined
  /** Animation duration in ms (default 4000). */
  durationMs?: number | undefined
  /** Loop the animation (default false). */
  loop?: boolean | undefined
}

export interface PlotSeries {
  /** Math expression in x. */
  expr: string
  /** Optional label shown in a legend row. */
  label?: string | undefined
  /** Stroke color; defaults to the accent token (multi-series auto-assign). */
  color?: string | undefined
  /** v2.9 draw shape: line (default), area (fill to baseline), scatter. */
  kind?: 'line' | 'area' | 'scatter' | undefined
  /** v2: adjustable parameters, one slider each, live re-render. */
  params?: PlotSeriesParam[] | undefined
}

/** Categorical palette for multi-series plots: host static tokens only
 * (design system v2 — same families as the chart/avatar palettes in
 * GenuiBlock, no off-theme hexes). CSS custom properties resolve inside
 * inline `style` on SVG strokes and legend swatches. */
export const PLOT_COLORS = [
  'var(--dsw-static-deepseek-400)',
  'var(--dsw-static-green-400)',
  'var(--dsw-static-amber-400)',
  'var(--dsw-static-red-400)',
  'var(--dsw-static-blue-450)',
  'var(--dsw-static-deepseek-450)',
  'var(--dsw-static-neutral-bluish-400)',
  'var(--dsw-static-deepseek-300)',
]

/** Series color: explicit wins; multi-series auto-assign from the palette. */
const seriesColor = (i: number, n: number, c?: string): string | undefined =>
  c ?? (n > 1 ? PLOT_COLORS[i % PLOT_COLORS.length] : undefined)

export interface PlotBlockProps {
  /** Functions to draw, in draw order. */
  series: PlotSeries[]
  /** Horizontal range, inclusive. */
  xMin?: number | undefined
  xMax?: number | undefined
  /** Vertical bounds; omitted = auto-fit to the sampled data. */
  yMin?: number | undefined
  yMax?: number | undefined
  /** Chart title. */
  title?: string | undefined
}

const WIDTH = 480
const HEIGHT = 220
const PAD_L = 34
const PAD_R = 10
const PAD_T = 14
const PAD_B = 24
const SAMPLES = 240

/** Auto-fit y-range from finite samples with a small margin. */
function fitY(points: ReadonlyArray<readonly [number, number]>): [number, number] {
  let lo = Infinity
  let hi = -Infinity
  for (const [, y] of points) {
    if (y < lo) lo = y
    if (y > hi) hi = y
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [-1, 1]
  if (lo === hi) { lo -= 1; hi += 1 }
  const pad = (hi - lo) * 0.08
  return [lo - pad, hi + pad]
}

function niceTicks(min: number, max: number, count = 5): number[] {
  const span = max - min
  if (!Number.isFinite(span) || span <= 0) return []
  const step = Math.pow(10, Math.floor(Math.log10(span / count)))
  const err = span / count / step
  const mult = err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1
  const size = step * mult
  const ticks: number[] = []
  for (let v = Math.ceil(min / size) * size; v <= max + size * 1e-9; v += size) {
    ticks.push(Math.round(v * 1e9) / 1e9)
  }
  return ticks
}

function formatTick(v: number): string {
  if (Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-3 && v !== 0)) return v.toExponential(1)
  return String(Math.round(v * 100) / 100)
}

/** Polyline with manual points sync: React 18 does not reliably update the
 * SVG `points` attribute when only the value changes (the element is diffed
 * but the attribute write is skipped), so this wrapper writes it through a
 * ref on every render. */
function Polyline({ points, className, color }: { points: string; className: string | undefined; color?: string | undefined }) {
  // React 18 does not reliably update the SVG `points` attribute when the
  // value changes on an existing element (the DOM write is skipped). Keying
  // the element on a prefix of the points string forces a fresh element per
  // distinct curve, which sidesteps the update entirely. The prefix must
  // change whenever the curve changes: include the first and last point.
  const key = points.length > 40 ? `${points.slice(0, 16)}|${points.slice(-16)}` : points
  return (
    <polyline
      key={key}
      points={points}
      className={className}
      style={color !== undefined ? { stroke: color } : undefined}
    />
  )
}

/** Render one plot: grid, axes, one polyline per series, legend, sliders. */
export const PlotBlock = memo(function PlotBlock({
  series, xMin: propXMin = -5, xMax: propXMax = 5, yMin, yMax, title,
}: PlotBlockProps) {
  // Pan/zoom view state: x range plus a LOCKED y range. The y range is fit
  // ONCE from the initial parameters and then fixed, so dragging a parameter
  // slider changes the curve's SHAPE (amplitude/slope) instead of rescaling
  // the axis every time — the user sees the function move, not the numbers.
  const [view, setView] = useWidgetState('plot-view',() => {
    // Fit y from the default parameter values (the same fallback the render
    // path uses), so the initial axis already frames the default curve.
    const defaults: Record<string, number> = {}
    for (const [si, s] of series.entries()) {
      for (const p of s.params ?? []) {
        if (p !== null && p !== undefined) defaults[`${si}:${p.name}`] = p.value
      }
    }
    const probe = series.map((s, si) => {
      const p: Record<string, number> = {}
      for (const param of s.params ?? []) {
        if (param === null || param === undefined) continue
        p[param.name] = defaults[`${si}:${param.name}`] ?? param.value
      }
      return sampleExpr(s.expr, propXMin, propXMax, SAMPLES, p)
    })
    const [autoLo, autoHi] = fitY(probe.flatMap(p => p))
    return {
      xMin: propXMin,
      xMax: propXMax,
      yMin: yMin ?? autoLo,
      yMax: yMax ?? autoHi,
    }
  })
  const dragRef = useRef<{ startX: number; startY: number; xMin: number; xMax: number } | null>(null)

  // Parameter values keyed by series index + param name; slider drag updates.
  // Deliberately starts EMPTY: the initializer must never read series props
  // (a parent re-mount can rebuild them mid-interaction), so every value
  // falls back to the param's declared default at render time. This makes
  // remounts during slider drags crash-proof.
  const [params, setParams, setParamsTransient] = useWidgetState<Record<string,number>>('plot-params',{},v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.entries(v).every(([key,value])=>{const [si,name]=key.split(':');const p=series[Number(si)]?.params?.find(p=>p.name===name);return !!p&&typeof value==='number'&&Number.isFinite(value)&&value>=(p.min??-Infinity)&&value<=(p.max??Infinity)}))

  // Animation: pick the first parameter that declares animateTo. A play/pause
  // button drives it from its current value to animateTo over durationMs
  // using requestAnimationFrame; the curve moves in place (y axis is locked).
  const animParam = (() => {
    for (const [si, s] of series.entries()) {
      for (const p of s.params ?? []) {
        if (p !== null && p !== undefined && p.animateTo !== undefined) {
          return { si, param: p }
        }
      }
    }
    return null
  })()
  const [playing, setPlaying] = useState(false)
  const [animProgress, setAnimProgress] = useState(0)
  const animRef = useRef<number | null>(null)

  useEffect(() => {
    if (!playing || animParam === null) return
    const key = `${animParam.si}:${animParam.param.name}`
    let cycleFrom = params[key] ?? animParam.param.value
    const to = animParam.param.animateTo!
    const duration = Math.max(0, animParam.param.durationMs ?? 4000)
    let cycleStart = performance.now()
    const tick = (now: number): void => {
      const t = duration === 0 ? 1 : Math.min(1, Math.max(0, (now - cycleStart) / duration))
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      const value = cycleFrom + (to - cycleFrom) * eased
      setParamsTransient(prev => ({ ...prev, [key]: value }))
      setAnimProgress(t)
      if (t < 1) {
        animRef.current = requestAnimationFrame(tick)
      } else if (animParam.param.loop === true) {
        cycleFrom = animParam.param.value
        cycleStart = now
        setParamsTransient(prev => ({ ...prev, [key]: cycleFrom }))
        setAnimProgress(0)
        animRef.current = requestAnimationFrame(tick)
      } else {
        animRef.current = null
        setPlaying(false)
      }
    }
    animRef.current = requestAnimationFrame(tick)
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current)
      animRef.current = null
    }
  }, [
    playing,
    animParam?.si,
    animParam?.param.name,
    animParam?.param.value,
    animParam?.param.animateTo,
    animParam?.param.durationMs,
    animParam?.param.loop,
  ])

  const xMin = view.xMin
  const xMax = view.xMax
  const lo = view.yMin
  const hi = view.yMax
  const plotW = WIDTH - PAD_L - PAD_R
  const plotH = HEIGHT - PAD_T - PAD_B
  const fromX = (px: number): number => xMin + ((px - PAD_L) / plotW) * (xMax - xMin)
  const toX = (x: number): number => PAD_L + ((x - xMin) / (xMax - xMin)) * plotW
  const toY = (y: number): number => PAD_T + (1 - (y - lo) / (hi - lo)) * plotH

  // Sample with current parameter values, then convert to screen coordinates
  // in one pass against the LOCKED y range — the `points` string changes with
  // the parameters, so the curve's shape visibly responds to the slider.
  const sampled = series.map((s, si) => {
    const p: Record<string, number> = {}
    for (const param of s.params ?? []) {
      if (param === null || param === undefined) continue
      p[param.name] = params[`${si}:${param.name}`] ?? param.value
    }
    const pts = sampleExpr(s.expr, xMin, xMax, SAMPLES, p)
    return {
      series: s,
      points: pts.map(([x, y]) => `${toX(x).toFixed(2)},${toY(y).toFixed(2)}`).join(' '),
    }
  })

  const xTicks = niceTicks(xMin, xMax)
  const yTicks = niceTicks(lo, hi)
  const hasData = sampled.some(p => p.points.length > 1)
  const hasValidRange = Number.isFinite(xMin) && Number.isFinite(xMax) && xMax > xMin && Number.isFinite(hi) && Number.isFinite(lo) && hi > lo

  // v2.9 draw shapes: line (polyline), area (fill to the locked baseline),
  // scatter (dots only). Colors stay on the shared categorical palette.
  const renderSeries = (s: PlotSeries, i: number, points: string): ReactNode => {
    const color = seriesColor(i, sampled.length, s.color) ?? 'var(--dsw-alias-state-business-primary, #4f8ef7)'
    const kind = s.kind ?? 'line'
    if (kind === 'scatter') {
      const coords = points === '' ? [] : points.split(' ').map(pt => {
        const [x, y] = pt.split(',')
        return [Number(x), Number(y)] as const
      })
      return (
        <g key={i}>
          {coords.map(([cx, cy], k) => <circle key={k} cx={cx} cy={cy} r={2.6} className={css.scatterDot} style={{ fill: color }} />)}
        </g>
      )
    }
    if (kind === 'area') {
      if (points === '') return <Polyline key={i} points="" className={css.line} color={color} />
      const firstX = points.slice(0, points.indexOf(' ')).split(',')[0]!
      const lastX = points.slice(points.lastIndexOf(' ') + 1).split(',')[0]!
      const baseY = toY(lo)
      const poly = `${firstX},${baseY.toFixed(2)} ${points} ${lastX},${baseY.toFixed(2)}`
      return <polygon key={i} points={poly} className={css.area} style={{ fill: color }} />
    }
    return <Polyline key={i} points={points} className={css.line} color={color} />
  }

  // Drag-to-pan and wheel-to-zoom on the SVG surface. Pan/zoom move the x
  // window only; the y range stays locked so parameter changes stay visible.
  const onPointerDown = (e: React.PointerEvent): void => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, xMin, xMax }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent): void => {
    const d = dragRef.current
    if (d === null) return
    // A few pixels of slack: a plain click or a text-selection drag must not
    // shift the domain.
    if (Math.abs(e.clientX - d.startX) < 4) return
    const span = d.xMax - d.xMin
    const dx = ((d.startX - e.clientX) / plotW) * span
    setView(prev => ({ xMin: d.xMin + dx, xMax: d.xMax + dx, yMin: prev.yMin, yMax: prev.yMax }))
  }
  const onPointerUp = (): void => { dragRef.current = null }

  // Wheel-to-zoom must not scroll the enclosing dialog (#63): React attaches
  // onWheel as a passive listener, where preventDefault() is ignored and the
  // event bubbles up to the scroll container. Register natively with
  // { passive: false } instead — the same pattern as the 3D scene viewer.
  // Wheel zoom requires a modifier (Cmd/Ctrl). Without one the wheel is left
  // alone so the CONVERSATION scrolls: an unmodified wheel over the chart used
  // to be swallowed by the plot, so scrolling the page silently rescaled the
  // chart instead (a reader could end up looking at a domain nobody asked for,
  // with no way back). The #63 requirement still holds for the modified case —
  // a native non-passive listener keeps the event from reaching the host.
  const svgRef = useRef<SVGSVGElement | null>(null)
  useEffect(() => {
    const el = svgRef.current
    if (el === null) return
    const onWheel = (e: WheelEvent): void => {
      if (!e.metaKey && !e.ctrlKey) return
      e.preventDefault()
      const span = xMax - xMin
      const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15
      const next = span * factor
      const rect = el.getBoundingClientRect()
      const cx = fromX(((e.clientX - rect.left) / rect.width) * WIDTH)
      const left = cx - ((cx - xMin) / span) * next
      setView(prev => ({ xMin: left, xMax: left + next, yMin: prev.yMin, yMax: prev.yMax }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [xMin, xMax, fromX])

  const hasParams = series.some(s => (s.params?.length ?? 0) > 0)

  // Zoom/pan move the x window; without a way back a reader who zoomed by
  // accident was stuck with a domain nobody asked for. The header therefore
  // shows the CURRENT domain whenever it differs from the initial one and
  // offers a one-click return.
  const initialX = useRef({ min: propXMin, max: propXMax })
  const viewMoved = Math.abs(xMin - initialX.current.min) > 1e-6 || Math.abs(xMax - initialX.current.max) > 1e-6
  const resetView = (): void => {
    setView(prev => ({ ...prev, xMin: initialX.current.min, xMax: initialX.current.max }))
  }

  return (
    <div className={css.block} data-genui-plot>
      {title !== undefined && <div className={css.title}>{renderInline(title)}</div>}
      {hasData && hasValidRange && (
        <div className={css.plotTools}>
          <span className={css.plotHint}>
            {viewMoved
              ? `x ∈ [${formatTick(xMin)}, ${formatTick(xMax)}]`
              : '⌘/Ctrl + 滚轮缩放 · 拖拽平移'}
          </span>
          {viewMoved && (
            <button type="button" className={css.plotReset} onClick={resetView}>↺ 回到初始区间</button>
          )}
        </div>
      )}
      {hasData && hasValidRange ? (
        <svg
          width="100%"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={title ?? 'function plot'}
          className={css.surface}
          ref={svgRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {/* y grid */}
          {yTicks.map(t => (
            <g key={`y${t}`}>
              <line x1={PAD_L} x2={WIDTH - PAD_R} y1={toY(t)} y2={toY(t)} className={css.gridLine} />
              <text x={PAD_L - 6} y={toY(t) + 4} className={css.tick} textAnchor="end">{formatTick(t)}</text>
            </g>
          ))}
          {/* x grid */}
          {xTicks.map(t => (
            <g key={`x${t}`}>
              <line x1={toX(t)} x2={toX(t)} y1={PAD_T} y2={HEIGHT - PAD_B} className={css.gridLine} />
              <text x={toX(t)} y={HEIGHT - PAD_B + 14} className={css.tick} textAnchor="middle">{formatTick(t)}</text>
            </g>
          ))}
          {/* axes */}
          <line x1={PAD_L} x2={WIDTH - PAD_R} y1={HEIGHT - PAD_B} y2={HEIGHT - PAD_B} className={css.axis} />
          <line x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={HEIGHT - PAD_B} className={css.axis} />
          {/* series */}
          {sampled.map(({ series: s, points }, i) => renderSeries(s, i, points))}
        </svg>
      ) : (
        <div className={css.empty}>
          {series.map((s, i) => <div key={i} className={css.emptyRow}>{s.expr} — 无法绘制（表达式无效或范围非法）</div>)}
        </div>
      )}
      {hasParams && (
        <div className={css.sliders}>
          <div className={css.slidersHead}>
            <span className={css.slidersTitle}>参数调节</span>
            <button
              type="button"
              className={css.resetBtn}
              onClick={() => {
                setPlaying(false)
                const reset: Record<string, number> = {}
                for (const [si, s] of series.entries()) {
                  for (const p of s.params ?? []) {
                    if (p !== null && p !== undefined) reset[`${si}:${p.name}`] = p.value
                  }
                }
                setParams(reset)
                setAnimProgress(0)
              }}
            >
              ↺ 重置
            </button>
          </div>
          {series.map((s, si) => (s.params ?? []).map(p => {
            if (p === null || p === undefined) return null
            const key = `${si}:${p.name}`
            const value = params[key] ?? p.value
            return (
              <label key={key} className={css.sliderRow}>
                <span className={css.sliderName}>{s.label ?? s.expr} · {p.name}</span>
                <input
                  type="range"
                  className={css.slider}
                  min={p.min ?? 0}
                  max={p.max ?? 10}
                  step={p.step ?? 0.1}
                  value={value}
                  onChange={e => {
                    // Read the value synchronously: React 18 may null out
                    // currentTarget after the handler in concurrent renders.
                    const next = Number(e.currentTarget.value)
                    setParams(prev => ({ ...prev, [key]: next }))
                  }}
                />
                <span className={css.sliderValue}>{Math.round(value * 100) / 100}</span>
              </label>
            )
          }))}
        </div>
      )}
      {animParam !== null && (
        <div className={css.animBar}>
          <button
            type="button"
            className={css.playBtn}
            onClick={() => {
              if (playing) { setPlaying(false) }
              else {
                // Reset to the declared start value before playing.
                setParams(prev => ({ ...prev, [`${animParam.si}:${animParam.param.name}`]: animParam.param.value }))
                setAnimProgress(0)
                setPlaying(true)
              }
            }}
          >
            {playing ? '⏸ 暂停' : '▶ 播放动画'}
          </button>
          {playing && (
            <div className={css.animTrack}>
              <div className={css.animFill} style={{ width: `${animProgress * 100}%` }} />
            </div>
          )}
        </div>
      )}
      {(series.length > 1 || hasParams) && (
        <div className={css.legend}>
          {series.map((s, i) => (
            <span key={i} className={css.legendItem}>
              <span className={css.legendSwatch} style={{ background: seriesColor(i, series.length, s.color) ?? 'var(--dsw-alias-state-business-primary, #4f8ef7)' }} />
              {s.label ?? s.expr}
            </span>
          ))}
        </div>
      )}
    </div>
  )
})
