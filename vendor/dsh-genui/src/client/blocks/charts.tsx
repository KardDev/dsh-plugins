import {useWidgetState} from '../widget-state.tsx'
/**
 * Chart family: categorical palette, the sortable table, and the bars / line
 * / donut renderers. All local-first; no model round trips.
 *
 * Design system v3: the native charts draw in REAL CSS pixels — the plot width
 * is measured from the container and the SVG viewBox matches it 1:1 — instead
 * of a fixed 460×150 viewBox whose axis text scaled with the container (wide
 * screens got oversized labels, narrow ones got unreadable ones). Every chart
 * gets a y-axis with nice 1/2/5 ticks, and single-series bars render against a
 * true zero line so negative values are drawn, not clamped away.
 * @module @changfenhuang/dsh-genui/client/blocks/charts
 */
import { Fragment, memo, useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactNode, RefObject } from 'react'
import { writeClipboard } from '../primitive-adapter.ts'
import { renderInline } from '../inline.ts'
// Aliased: `t` is already used throughout this module as a tick-value
// local (ticks.map(t => …)), so the translator rides a distinct name.
import { t as tr, useT } from '../i18n/index.ts'
import css from '../GenuiBlock.module.css'
import { GENUI_LIMITS } from '../genui-runtime/index.ts'
import type { GenuiChart, GenuiTable } from '../spec.ts'
import { isTableGroupHeaderRow, tableRowsForDetails } from '../table-details.ts'

export const CHART_COLORS = [
  'var(--dsw-static-deepseek-400)',
  'var(--dsw-static-green-400)',
  'var(--dsw-static-amber-400)',
  'var(--dsw-static-red-400)',
  'var(--dsw-static-blue-450)',
  'var(--dsw-static-deepseek-450)',
  'var(--dsw-static-neutral-bluish-400)',
  'var(--dsw-static-deepseek-300)',
]

/** Series color: explicit color wins; then an explicit `palette` from the
 *  spec; then the host categorical tokens. */
const seriesColor = (i: number, n: number, c?: string, palette?: readonly string[]): string | undefined =>
  c ?? (palette !== undefined && palette.length > 0
    ? palette[i % palette.length]
    : n > 1 ? CHART_COLORS[i % CHART_COLORS.length] : undefined)

/**
 * Sortable numeric value of a cell. Human-written table cells are rarely
 * plain numbers, so the sort accepts the usual decorations:
 * `1,234` / `1，234`（千分位）、`1.2k`/`3M`/`5b`、`3.5万`/`2亿`、`0.3%`、
 * `¥99`/`$12`。A cell that cannot be read as a number returns NaN and the
 * row falls back to the text comparison — mixed columns sort deterministically
 * (numbers first, then text).
 */
export function parseSortableNumber(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN
  if (typeof v !== 'string') return NaN
  let s = v.trim()
  if (s === '') return NaN
  s = s.replace(/^[¥$€£]/, '')
  const pct = s.endsWith('%')
  if (pct) s = s.slice(0, -1)
  // 中文单位在前：3.5万 → 35000、2亿 → 200000000；再是 k/m/b 后缀。
  let mult = 1
  if (s.endsWith('万')) { mult = 10_000; s = s.slice(0, -1) }
  else if (s.endsWith('亿')) { mult = 100_000_000; s = s.slice(0, -1) }
  else if (/[kmb]$/i.test(s)) {
    const unit = s.slice(-1).toLowerCase()
    mult = unit === 'k' ? 1e3 : unit === 'm' ? 1e6 : 1e9
    s = s.slice(0, -1)
  }
  s = s.replace(/[,，\s]/g, '')
  const n = Number(s)
  if (!Number.isFinite(n)) return NaN
  return n * mult
}

/** A column is numeric when every non-empty cell parses to a finite number —
 * those columns right-align with tabular numerals (the table's data voice). */
function numericColumns(rows: GenuiTable['rows'], nCols: number): boolean[] {
  return Array.from({ length: nCols }, (_, j) => {
    let any = false
    for (const row of rows) {
      const cell = row[j]
      if (cell === undefined || cell === null || cell === '') continue
      if (!Number.isFinite(parseSortableNumber(cell))) return false
      any = true
    }
    return any
  })
}

/**
 * Does this cell carry real line breaks? Table cells default to `nowrap` (the
 * data voice), which also collapses the leading whitespace of a pasted code
 * block — indentation is lost and the snippet no longer runs. Cells that do
 * contain a line break get `pre-line` (see `.tdMultiline`), so the line
 * structure survives and the text still copies back as multiple lines.
 */
function hasLineBreak(value: string | number): boolean {
  return typeof value === 'string' && /[\n\r]/.test(value)
}

/**
 * Is this cell code rather than prose? Only then is leading indentation
 * significant (`pre-wrap`), while a prose line break stays `pre-line` so its
 * surrounding spaces collapse exactly like the rest of the UI.
 */
function isCodeCell(value: string | number): boolean {
  if (typeof value !== 'string') return false
  return /(^|\n)[ \t]/.test(value) || value.includes('```')
}

/** The whitespace class a multi-line cell needs, or undefined for single-line. */
function cellWrapClass(value: string | number): string | undefined {
  if (!hasLineBreak(value)) return undefined
  return isCodeCell(value) ? css.tdCode : css.tdMultiline
}

/** Signed cell text (`+12.4%`, `-3`, `−2.1k`) reads as a delta without any
 *  new spec field — the renderer classifies the string. */
function deltaTone(value: unknown): 'up' | 'down' | null {
  if (typeof value !== 'string') return null
  const s = value.trim()
  if (!/^[+][\s]*[\d.]/.test(s) && !/^[-−][\s]*[\d.]/.test(s)) return null
  return s.startsWith('+') ? 'up' : 'down'
}

/** `types: ["spark"]` cell: comma/space separated numbers drawn as a micro
 *  trend line (area wash + end dot, same geometry as stat.spark). */
function CellSpark({ cell }: { cell: string | number }) {
  const values = String(cell).split(/[\s,;]+/).map(Number).filter(Number.isFinite)
  if (values.length < 2) return <>{renderInline(String(cell), false)}</>
  const W = 88
  const H = 22
  const pad = 2
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = (W - pad * 2) / (values.length - 1)
  const coords = values.map((v, i) => [pad + i * step, H - pad - ((v - min) / span) * (H - pad * 2)] as const)
  const points = coords.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ')
  const last = coords[coords.length - 1]!
  const area = `M ${pad},${H - pad} L ${points.split(' ').join(' L ')} L ${last[0].toFixed(1)},${H - pad} Z`
  return (
    <svg className={css.cellSpark} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={area} fill="var(--dsl-g-accent)" opacity="0.14" />
      <polyline points={points} fill="none" stroke="var(--dsl-g-accent)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d={`M ${last[0].toFixed(1)} ${last[1].toFixed(1)} L ${last[0].toFixed(1)} ${last[1].toFixed(1)}`} stroke="var(--dsl-g-accent)" strokeWidth={4} strokeLinecap="round" vectorEffect="non-scaling-stroke" fill="none" />
    </svg>
  )
}

/** `types: ["ring"]` cell: a 28px ring gauge read as 0-100. */
function CellRing({ cell }: { cell: string | number }) {
  const n = parseSortableNumber(cell)
  const pct = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0
  const R = 11
  const C = 2 * Math.PI * R
  return (
    <span className={css.cellRing}>
      <svg width={28} height={28} viewBox="0 0 28 28" aria-hidden="true">
        <circle cx={14} cy={14} r={R} fill="none" strokeWidth={4} className={css.ringTrack} />
        <circle
          cx={14} cy={14} r={R} fill="none" strokeWidth={4} strokeLinecap="round" className={css.ringFill}
          strokeDasharray={`${(pct / 100) * C} ${C}`} transform="rotate(-90 14 14)"
        />
      </svg>
      <span className={css.cellRingText}>{renderInline(String(cell), false)}</span>
    </span>
  )
}

/** Markdown table text for the 复制 Markdown chip (pipes escaped). */
export function tableToMarkdown(columns: string[], rows: Array<Array<string | number>>): string {
  const escape = (v: unknown): string => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
  const head = `| ${columns.map(escape).join(' | ')} |`
  const rule = `| ${columns.map(() => '---').join(' | ')} |`
  const body = rows.map(row => `| ${columns.map((_c, i) => escape(row[i])).join(' | ')} |`)
  return [head, rule, ...body].join('\n')
}

/** RFC 4180 CSV text for the 复制 CSV chip. */
export function tableToCsv(rows: Array<Array<string | number>>): string {
  const cell = (v: unknown): string => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return rows.map(row => row.map(cell).join(',')).join('\n')
}

/** Copy chips above a table (`table.export`). Local clipboard only — no action,
 *  no round trip; the label confirms for a moment and then resets. */
function TableExportChips({ columns, rows }: { columns: string[]; rows: Array<Array<string | number>> }) {
  useT()
  const [copied, setCopied] = useState<'md' | 'csv' | null>(null)
  const copy = (kind: 'md' | 'csv'): void => {
    const text = kind === 'md' ? tableToMarkdown(columns, rows) : tableToCsv(rows)
    void writeClipboard(text).then(ok => {
      if (!ok) return
      setCopied(kind)
      window.setTimeout(() => setCopied(null), 1200)
    })
  }
  return (
    <div className={css.tableTools}>
      <button type="button" className={css.tableTool} onClick={() => copy('md')}>
        {copied === 'md' ? tr('label.copiedDone') : tr('block.copyMarkdown')}
      </button>
      <button type="button" className={css.tableTool} onClick={() => copy('csv')}>
        {copied === 'csv' ? tr('label.copiedDone') : tr('block.copyCsv')}
      </button>
    </div>
  )
}

/** `types: ["bar"]` cell: an inline 0-100 track with the value printed on it. */
function CellBar({ cell }: { cell: string | number }) {
  const n = parseSortableNumber(cell)
  const pct = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0
  return (
    <span className={css.cellBar}>
      <span className={css.cellBarFill} style={{ width: `${pct}%` }} />
      <span className={css.cellBarText}>{renderInline(String(cell), false)}</span>
    </span>
  )
}

export const TableNode = memo(function TableNode({ node, renderDetail, filterValue, sortValue }: {
  node: GenuiTable
  /** Live value of `node.filter`: substring-match rows locally. */
  filterValue?: string | undefined
  /** Live value of `node.sortField`: a column header to sort by. */
  sortValue?: string | undefined
  /** Renders a row's detail nodes. Supplied by render-node so the table never
   *  has to import the renderer back (import cycle). */
  renderDetail?: ((items: NonNullable<GenuiTable['details']>[number] & object[]) => ReactNode) | undefined
}) {
  useT()
  const columns = node.columns.slice(0, GENUI_LIMITS.maxTableCols)
  const rows = tableRowsForDetails<GenuiTable['rows'][number]>(node)
  const types = node.types ?? []
  const [sort, setSort] = useWidgetState<{col:number;dir:1|-1}|null>('table-sort',null,v=>v===null||!!v&&typeof v==='object'&&Number.isInteger((v as {col:number}).col)&&(v as {col:number}).col>=0&&(v as {col:number}).col<node.columns.length&&[1,-1].includes((v as {dir:number}).dir))
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(() => new Set())
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set())

  const compare = (a: GenuiTable['rows'][number], b: GenuiTable['rows'][number], col: number, dir: 1 | -1): number => {
    const an = parseSortableNumber(a[col])
    const bn = parseSortableNumber(b[col])
    if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return (an - bn) * dir
    if (Number.isFinite(an) !== Number.isFinite(bn)) return Number.isFinite(an) ? -dir : dir
    const as = String(a[col] ?? '')
    const bs = String(b[col] ?? '')
    return (as < bs ? -1 : as > bs ? 1 : 0) * dir
  }

  // Group header rows: with `types[0] === 'group'`, a row whose first cell is
  // filled and every other cell empty opens a section. Data rows after it are
  // its CHILDREN — indented, counted, and collapsible — so the relationship is
  // unmistakable instead of "one more row at the same level".
  const isGroupRow = (row: GenuiTable['rows'][number]): boolean => isTableGroupHeaderRow(row, types)

  // Local filtering (bound control): the model ships the full data set once and
  // the reader narrows it live — no round trip, no re-generation.
  const needle = filterValue?.trim().toLowerCase()
  const filtered = needle === undefined || needle === ''
    ? rows.map((row, index) => ({ row, index }))
    : rows.map((row, index) => ({ row, index })).filter(({ row }) => {
      const cells = node.filterColumn === undefined
        ? row
        : [row[node.filterColumn]]
      return cells.some(cell => String(cell ?? '').toLowerCase().includes(needle))
    })
  const visibleRows = filtered.map(entry => entry.row)
  const hiddenCount = rows.length - visibleRows.length

  interface Section { header: { row: GenuiTable['rows'][number]; index: number } | null; children: Array<{ row: GenuiTable['rows'][number]; index: number }> }
  const sections: Section[] = []
  visibleRows.forEach((row, index) => {
    if (isGroupRow(row)) { sections.push({ header: { row, index }, children: [] }); return }
    if (sections.length === 0 || sections[sections.length - 1]!.header === null) {
      if (sections.length === 0) sections.push({ header: null, children: [] })
    }
    sections[sections.length - 1]!.children.push({ row, index })
  })

  // Sorting keeps sections intact: each section's children sort among
  // themselves, so a grouped table can never scramble its own structure.
  // `sortField` is a select whose value is a column header: apply it as the
  // active sort (a click on the header still overrides it).
  const boundSortCol = sortValue === undefined ? -1 : columns.indexOf(sortValue)
  const effectiveSort = sort !== null ? sort : (boundSortCol >= 0 ? { col: boundSortCol, dir: 1 as const } : null)

  const sortedSections = sections.map(section => ({
    header: section.header,
    children: effectiveSort === null
      ? section.children
      : [...section.children].sort((a, b) => compare(a.row, b.row, effectiveSort.col, effectiveSort.dir)),
  }))

  const numeric = numericColumns(visibleRows, columns.length)
  const toggleSection = (index: number): void => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }
  const toggleDetail = (index: number): void => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }
  const clickHeader = (i: number): void => {
    setSort(prev => prev !== null && prev.col === i
      ? prev.dir === 1 ? { col: i, dir: -1 } : null
      : { col: i, dir: 1 })
  }
  // Optional 合计 footer: sums every numeric column (section headers excluded).
  const totals = columns.map((_c, j) => {
    if (!numeric[j]) return null
    let sum = 0
    for (const row of visibleRows) {
      if (isGroupRow(row)) continue
      const n = parseSortableNumber(row[j])
      if (Number.isFinite(n)) sum += n
    }
    return sum
  })
  const hasTotals = node.total === true && totals.some(t => t !== null)
  const formatTotal = (n: number): string =>
    Number.isInteger(n) ? n.toLocaleString('en-US') : String(Math.round(n * 100) / 100)

  const renderCell = (cell: string | number, j: number, rowIndex: number): ReactNode => {
    const type = types[j]
    const wrap = cellWrapClass(cell)
    const tone = type === 'delta'
      ? (String(cell).trim().startsWith('-') ? 'down' : 'up')
      : deltaTone(cell)
    return (
      <td
        key={j}
        className={[numeric[j] || type === 'num' ? css.tdNum : undefined, wrap]
          .filter(part => part !== undefined)
          .join(' ') || undefined}
      >
        {type === 'badge'
          ? <span className={css.cellBadge}>{renderInline(String(cell), 'file')}</span>
          : type === 'bar'
            ? <CellBar cell={cell} />
            : type === 'spark'
              ? <CellSpark cell={cell} />
              : type === 'ring'
                ? <CellRing cell={cell} />
                : type === 'index'
                  ? <span className={css.cellIndex}>{rowIndex + 1}</span>
                  : tone === null
                    // Format displayed text without changing sorting or exported data.
                    ? renderInline(String(cell), 'file')
                    : <span className={`${css.tdDelta} ${tone === 'up' ? css.tdDeltaUp : css.tdDeltaDown}`}>{renderInline(String(cell), 'file')}</span>}
      </td>
    )
  }

  return (
    <div className={css.tableWrap}>
      {node.export === true && <TableExportChips columns={columns} rows={rows} />}
      <table className={css.table}>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th
                key={i}
                className={[numeric[i] ? css.thNum : undefined, cellWrapClass(c)]
                  .filter(part => part !== undefined)
                  .join(' ') || undefined}
                aria-sort={sort !== null && sort.col === i ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
              >
                <button type="button" className={css.thSort} onClick={() => clickHeader(i)}>
                  {renderInline(c, false)}
                  {sort !== null && sort.col === i && <span className={css.thSortMark} aria-hidden>{sort.dir === 1 ? ' ▲' : ' ▼'}</span>}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedSections.map((section, si) => {
            const headerIndex = section.header?.index ?? si
            const isCollapsed = collapsed.has(headerIndex)
            return (
              <Fragment key={section.header === null ? `s-${si}` : `g-${section.header.index}`}>
                {section.header !== null && (
                  <tr className={css.groupRow}>
                    <td colSpan={columns.length} className={cellWrapClass(String(section.header.row[0]))}>
                      <button
                        type="button"
                        className={css.groupToggle}
                        aria-label={tr(isCollapsed ? 'block.table.expandGroup' : 'block.table.collapseGroup', {
                          label: String(section.header.row[0]).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'),
                        })}
                        aria-expanded={!isCollapsed}
                        onClick={() => toggleSection(headerIndex)}
                      >
                        <span className={css.groupChevron} aria-hidden>{isCollapsed ? '▸' : '▾'}</span>
                      </button>
                      <span className={css.groupLabel} onClick={event => {
                        if (event.target instanceof Element && event.target.closest('button')) return
                        toggleSection(headerIndex)
                      }}>
                        {renderInline(String(section.header.row[0]), 'file')}
                        <span className={css.groupCount}>{section.children.length}</span>
                      </span>
                    </td>
                  </tr>
                )}
                {!isCollapsed && section.children.map(child => {
                  const detail = node.details?.[child.index] ?? null
                  const open = expanded.has(child.index)
                  return (
                    <Fragment key={child.index}>
                      <tr className={section.header === null ? undefined : css.groupChild}>
                        {child.row.slice(0, columns.length).map((cell, j) => (
                          j === 0 && detail !== null
                            ? (
                              <td key={j} className={css.detailCell}>
                                <button
                                  type="button"
                                  className={css.detailToggle}
                                  aria-label={tr(open ? 'block.table.collapseDetails' : 'block.table.expandDetails', {
                                    label: String(cell).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'),
                                  })}
                                  aria-expanded={open}
                                  onClick={() => toggleDetail(child.index)}
                                >
                                  <span className={css.detailChevron} data-open={open} aria-hidden>▸</span>
                                </button>
                                <span className={css.detailContent} onClick={event => {
                                  if (event.target instanceof Element && event.target.closest('button')) return
                                  toggleDetail(child.index)
                                }}>
                                  {renderInline(String(cell), 'file')}
                                </span>
                              </td>
                            )
                            : renderCell(cell, j, child.index)
                        ))}
                      </tr>
                      {open && detail !== null && (
                        <tr className={css.detailRow}>
                          <td colSpan={columns.length}>
                            <div className={css.detailBody}>
                              {renderDetail === undefined ? null : renderDetail(detail)}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </Fragment>
            )
          })}
        </tbody>
        {hiddenCount > 0 && (
          <tfoot>
            <tr className={css.filterRow}>
              <td colSpan={columns.length}>{tr('block.filteredRows', { visible: visibleRows.length, total: rows.length })}</td>
            </tr>
          </tfoot>
        )}
        {hasTotals && (
          <tfoot>
            <tr>
              {columns.map((_c, j) => (
                <td key={j} className={numeric[j] ? css.tdNum : undefined}>
                  {j === 0 ? tr('block.total') : totals[j] === null ? '' : formatTotal(totals[j]!)}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
})

/** One tooltip line: label on the left, value on the right. */
type TipRow = [string, string]

interface TipState { x: number; y: number; rows: TipRow[] }

/**
 * Instant, self-drawn hover readout. The browser's native `title` takes about
 * a second to appear and cannot show a stacked breakdown, which is exactly
 * what a stacked bar needs ("hover 上去要会显示各自部分的具体数值").
 */
function useChartTip(): {
  tip: TipState | null
  show: (event: ReactMouseEvent<Element>, rows: TipRow[]) => void
  hide: () => void
} {
  const [tip, setTip] = useState<TipState | null>(null)
  const show = useCallback((event: ReactMouseEvent<Element>, rows: TipRow[]) => {
    const target = event.currentTarget as Element
    const host = target.closest('[data-genui-chart], [data-genui-line], [data-genui-donut]')
    if (host === null) return
    const hostRect = host.getBoundingClientRect()
    const rect = target.getBoundingClientRect()
    setTip({
      x: rect.left - hostRect.left + rect.width / 2,
      y: rect.top - hostRect.top,
      rows,
    })
  }, [])
  const hide = useCallback(() => setTip(null), [])
  return { tip, show, hide }
}

function ChartTip({ tip }: { tip: TipState | null }) {
  if (tip === null) return null
  return (
    <div className={css.chartTip} style={{ left: `${tip.x}px`, top: `${tip.y}px` }} role="tooltip">
      {tip.rows.map(([label, value], i) => (
        <span key={`${label}-${i}`} className={css.chartTipRow}>
          <span>{renderInline(label)}</span>
          <span className={css.chartTipValue}>{renderInline(String(value))}</span>
        </span>
      ))}
    </div>
  )
}

/** Measured plot width. Charts draw in CSS pixels: 1 SVG unit = 1px, so axis
 *  text keeps its designed size at every container width. */
function useMeasuredWidth(): [RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(560)
  useLayoutEffect(() => {
    const el = ref.current
    if (el === null) return
    const measure = (): void => {
      const next = el.clientWidth
      if (next > 0) setWidth(next)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

/** Axis ticks on 1/2/5×10^n steps covering [min, max] inclusively. */
function niceTicks(min: number, max: number, target = 4): number[] {
  const lo = Math.min(min, 0)
  const hi = Math.max(max, 0)
  if (lo === hi) return [0, 1]
  const raw = (hi - lo) / Math.max(target, 1)
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(raw, Number.MIN_VALUE))))
  const normalized = raw / magnitude
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude
  const start = Math.floor(lo / step) * step
  const end = Math.ceil(hi / step) * step
  const ticks: number[] = []
  for (let t = start; t <= end + step / 2; t += step) ticks.push(Math.abs(t) < step / 1e6 ? 0 : t)
  return ticks
}

/** Compact tick text: 1200 → 1.2k, 0.5 → 0.5, integers bare. */
function formatTick(t: number): string {
  const abs = Math.abs(t)
  if (abs >= 1e9) return `${(t / 1e9).toFixed(abs % 1e9 === 0 ? 0 : 1)}b`
  if (abs >= 1e6) return `${(t / 1e6).toFixed(abs % 1e6 === 0 ? 0 : 1)}m`
  if (abs >= 1000) return `${(t / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}k`
  if (Number.isInteger(t)) return String(t)
  return String(Math.round(t * 100) / 100)
}

/** 计算数字用普通或指数形式表示时所需的小数位数。 */
export function fractionDigits(value: number): number {
  if (!Number.isFinite(value)) return 0
  const [coefficient, exponentText] = String(value).toLowerCase().split('e')
  const decimalDigits = coefficient!.split('.')[1]?.length ?? 0
  const exponent = exponentText === undefined ? 0 : Number(exponentText)
  return Math.max(decimalDigits - exponent, 0)
}

/** 按参与计算的原始数值精度格式化图表合计。 */
export function formatChartValue(value: number, maxFractionDigits: number): string {
  if (!Number.isFinite(value)) return String(value)
  if (Math.abs(value) >= 1e21 || maxFractionDigits > 100) return String(value)
  const formatted = value.toFixed(maxFractionDigits)
  return formatted.includes('.') ? formatted.replace(/\.?0+$/, '') : formatted
}

/** Shared y-axis gutter: ticks positioned against the same percentage scale
 *  the plot uses, so labels line up with the gridlines. */
function YAxis({ ticks, lo, span }: { ticks: number[]; lo: number; span: number }) {
  return (
    <div className={css.chartYAxis} style={{ height: 160 }}>
      {ticks.map(t => (
        <span key={t} className={css.chartYTick} style={{ bottom: `${((t - lo) / span) * 100}%` }}>
          {formatTick(t)}
        </span>
      ))}
    </div>
  )
}

/** Chart: bars (default), line (trend), or donut (share); multi-series bars via `series`. */
export const ChartNode = memo(function ChartNode({ chart, filterValue }: {
  chart: GenuiChart
  /** Live value of the control bound via `chart.filter`; keeps matching
   *  categories only (label substring), so a chart is explorable locally. */
  filterValue?: string | undefined
}) {
  const filtered = useMemo(() => applyChartFilter(chart, filterValue), [chart, filterValue])
  const kind = filtered.kind ?? 'bars'
  if (kind === 'donut') return <DonutNode chart={filtered} />
  if (kind === 'line') return <LineChartNode chart={filtered} />
  return <BarsNode chart={filtered} />
})

/** Keep the categories whose label matches the bound filter (case-insensitive).
 *  Bars/donut filter `data`, line filters each series' points. */
function applyChartFilter(chart: GenuiChart, filterValue: string | undefined): GenuiChart {
  const needle = filterValue?.trim().toLowerCase()
  if (needle === undefined || needle === '') return chart
  const keep = (datum: { label: string }): boolean => datum.label.toLowerCase().includes(needle)
  const data = chart.data.filter(keep)
  if (chart.series === undefined) return data.length === chart.data.length ? chart : { ...chart, data }
  const series = chart.series.map(entry => ({ ...entry, data: entry.data.filter(keep) }))
  return { ...chart, data, series }
}

/** Bars: one column per datum (grouped bars when `series` is present).
 *  Single-series bars render against a true zero line, so negative values
 *  draw downward instead of clamping to zero height. */
export const BarsNode = memo(function BarsNode({ chart }: { chart: GenuiChart }) {
  useT()
  const { tip, show, hide } = useChartTip()
  const grouped = chart.series !== undefined ? chart.series.slice(0, GENUI_LIMITS.maxPlotSeries) : undefined
  const isGrouped = grouped !== undefined && grouped.length > 0
  const data = chart.data.slice(0, GENUI_LIMITS.maxChartPoints)
  const labels = isGrouped ? grouped[0]!.data.map(d => d.label) : data.map(d => d.label)
  const seriesValues = isGrouped
    ? grouped.map(s => s.data.map(d => Number(d.value) || 0))
    : [data.map(d => Number(d.value) || 0)]
  const colors = seriesValues.map((_values, si) =>
    seriesColor(si, seriesValues.length, isGrouped ? grouped[si]?.color : undefined, chart.palette) ?? 'var(--dsw-alias-state-business-primary, #4f8ef7)')
  const flat = seriesValues.flat()
  const showValues = labels.length <= 12
  const stacked = chart.stacked === true && isGrouped
  const categoryTotals = labels.map((_l, i) => seriesValues.reduce((sum, values) => sum + Math.max(0, values[i] ?? 0), 0))
  const categoryFractionDigits = labels.map((_label, i) => Math.max(...seriesValues.map(values => fractionDigits(values[i] ?? 0)), 0))
  const positiveMax = stacked ? Math.max(...categoryTotals, 0) : Math.max(...flat, 0)

  // Horizontal: label column + one track per series. The axis is always
  // 0..max (a horizontal track has no zero line to cross).
  if (chart.horizontal === true) {
    const scale = Math.max(positiveMax, 1)
    const legend = isGrouped
      ? (
        <div className={css.chartLegend}>
          {grouped.map((entry, si) => (
            <span key={si} className={css.legendItem}>
              <span className={css.legendSwatch} style={{ background: colors[si] }} />
              {renderInline(entry.label)}
            </span>
          ))}
        </div>
      )
      : null
    return (
      <div className={css.chart} data-genui-chart="bars" role="img" aria-label={tr('block.chart.barsAria', { count: labels.length })} onMouseLeave={hide}>
        <div className={css.hbars}>
          {labels.map((label, i) => (
            <div key={i} className={css.hbarRow}>
              <span className={css.hbarLabel} title={label}>{renderInline(label)}</span>
              <div className={css.hbarTracks}>
                {stacked
                  ? (
                    <div className={css.hbarTrack} title={`${label}: ${formatChartValue(categoryTotals[i] ?? 0, categoryFractionDigits[i] ?? 0)}`}>
                      {seriesValues.map((values, si) => {
                        const v = Math.max(0, values[i] ?? 0)
                        const total = categoryTotals[i] ?? 0
                        const width = total === 0 ? 0 : (v / total) * Math.max(0, Math.min(100, (total / scale) * 100))
                        return (
                          <div
                            key={si}
                            className={css.hbarSeg}
                            style={{ width: `${width}%`, background: colors[si] }}
                            onMouseEnter={event => show(event, [[grouped[si]!.label, String(v)], [tr('block.total'), formatChartValue(total, categoryFractionDigits[i] ?? 0)]])}
                            onMouseMove={event => show(event, [[grouped[si]!.label, String(v)], [tr('block.total'), formatChartValue(total, categoryFractionDigits[i] ?? 0)]])}
                          />
                        )
                      })}
                    </div>
                  )
                  : seriesValues.map((values, si) => {
                    const v = values[i] ?? 0
                    const width = Math.max(0, Math.min(100, (Math.max(0, v) / scale) * 100))
                    return (
                      <div key={si} className={css.hbarTrack}>
                        <div
                          className={css.hbarFill}
                          style={{ width: `${width}%`, background: colors[si] }}
                          onMouseEnter={event => show(event, isGrouped ? [[grouped[si]!.label, String(v)], [tr('block.total'), formatChartValue(categoryTotals[i] ?? 0, categoryFractionDigits[i] ?? 0)]] : [[label, String(v)]])}
                          onMouseMove={event => show(event, isGrouped ? [[grouped[si]!.label, String(v)], [tr('block.total'), formatChartValue(categoryTotals[i] ?? 0, categoryFractionDigits[i] ?? 0)]] : [[label, String(v)]])}
                        />
                      </div>
                    )
                  })}
              </div>
              {showValues && (
                <span className={css.hbarValue}>
                  {isGrouped ? formatChartValue(categoryTotals[i] ?? 0, categoryFractionDigits[i] ?? 0) : String(data[i]?.value ?? '')}
                </span>
              )}
            </div>
          ))}
        </div>
        {legend}
        <ChartTip tip={tip} />
      </div>
    )
  }

  // Vertical: grouped bars clamp negatives (the flex layout stacks upward), so
  // the axis starts at zero for that shape; single-series bars render against
  // a true zero line and draw negatives downward.
  const ticks = niceTicks(isGrouped ? 0 : Math.min(...flat, 0), positiveMax, 4)
  const lo = ticks[0]!
  const hi = ticks[ticks.length - 1]!
  const span = hi - lo || 1
  const pct = (v: number): number => ((v - lo) / span) * 100
  const zero = pct(0)
  const summary = tr('block.chart.barsSummary', { count: labels.length, max: formatTick(Math.max(...flat, 0)) })
  return (
    <div className={css.chart} data-genui-chart="bars" role="img" aria-label={summary} onMouseLeave={hide}>
      <ChartTip tip={tip} />
      <div className={css.chartBody}>
        <YAxis ticks={ticks} lo={lo} span={span} />
        <div className={css.chartPlot}>
          {ticks.map(t => (
            <span key={t} className={t === 0 ? css.baseline : css.gridline} style={{ bottom: `${pct(t)}%` }} />
          ))}
          {labels.map((label, i) => (
            <div key={i} className={css.barCol}>
              {stacked
                ? (
                  <>
                    {showValues && (
                      <span className={css.barValue} style={{ bottom: `calc(${pct(categoryTotals[i] ?? 0)}% + 4px)` }}>
                        {formatChartValue(categoryTotals[i] ?? 0, categoryFractionDigits[i] ?? 0)}
                      </span>
                    )}
                    <div className={css.stack} style={{ height: `${Math.max(0, pct(categoryTotals[i] ?? 0))}%` }}>
                      {grouped.map((entry, si) => {
                        const datum = entry.data[i]
                        const raw = datum === undefined ? 0 : Number(datum.value) || 0
                        const v = Math.max(0, raw)
                        const total = categoryTotals[i] ?? 0
                        const segHeight = total === 0 ? 0 : (v / total) * pct(total)
                        const rows: TipRow[] = [[entry.label, String(raw)], [tr('block.total'), formatChartValue(total, categoryFractionDigits[i] ?? 0)]]
                        return (
                          <div
                            key={si}
                            className={css.stackSeg}
                            style={{ height: total === 0 ? '0%' : `${(v / total) * 100}%`, background: colors[si] }}
                            onMouseEnter={event => show(event, rows)}
                            onMouseMove={event => show(event, rows)}
                          >
                            {segHeight >= 11 && <span className={css.stackValue}>{raw}</span>}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )
                : isGrouped
                ? (
                  <div className={css.groupedBars}>
                    {grouped.map((entry, si) => {
                      const datum = entry.data[i]
                      const v = datum === undefined ? 0 : Number(datum.value) || 0
                      return (
                        <div key={si} className={css.groupedBar}>
                          {showValues && <span className={css.groupValue}>{datum === undefined ? '' : String(datum.value)}</span>}
                          <div
                            className={css.groupedFill}
                            style={{
                              height: `${Math.max(0, pct(Math.max(0, v)))}%`,
                              background: colors[si],
                            }}
                            onMouseEnter={event => show(event, [[entry.label, String(datum?.value ?? '')], [tr('block.total'), formatChartValue(categoryTotals[i] ?? 0, categoryFractionDigits[i] ?? 0)]])}
                            onMouseMove={event => show(event, [[entry.label, String(datum?.value ?? '')], [tr('block.total'), formatChartValue(categoryTotals[i] ?? 0, categoryFractionDigits[i] ?? 0)]])}
                          />
                        </div>
                      )
                    })}
                  </div>
                )
                : (() => {
                  const v = seriesValues[0]![i] ?? 0
                  const top = Math.max(pct(v), zero)
                  const bottom = Math.min(pct(v), zero)
                  return (
                    <>
                      {showValues && (
                        <span className={css.barValue} style={{ bottom: `calc(${top}% + 4px)` }}>{String(data[i]?.value ?? '')}</span>
                      )}
                      <div
                        className={css.barFill}
                        style={{
                          bottom: `${bottom}%`,
                          height: `${Math.max(top - bottom, 0.6)}%`,
                          ...(v < 0 ? { borderRadius: '0 0 5px 5px' } : {}),
                          ...(data[i]?.color !== undefined ? { background: data[i]!.color } : {}),
                        }}
                        onMouseEnter={event => show(event, [[label, String(data[i]?.value ?? '')]])}
                        onMouseMove={event => show(event, [[label, String(data[i]?.value ?? '')]])}
                      />
                    </>
                  )
                })()}
            </div>
          ))}
        </div>
      </div>
      <div className={css.chartLabels}>
        {labels.map((label, i) => <span key={`${label}-${i}`} className={css.barLabel}>{renderInline(label)}</span>)}
      </div>
      {isGrouped && (
        <div className={css.chartLegend}>
          {grouped.map((entry, si) => (
            <span key={si} className={css.legendItem}>
              <span className={css.legendSwatch} style={{ background: colors[si] }} />
              {renderInline(entry.label)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
})

/** Line: responsive polyline with an area wash, nice y ticks and sampled x
 *  labels drawn in SVG at their real size. */
export const LineChartNode = memo(function LineChartNode({ chart }: { chart: GenuiChart }) {
  useT()
  const [ref, measured] = useMeasuredWidth()
  const { tip, show, hide } = useChartTip()
  const gradientId = `genui-line-${useId().replace(/:/g, '')}`
  const grouped = chart.series !== undefined && chart.series.length > 0
    ? chart.series.slice(0, GENUI_LIMITS.maxPlotSeries)
    : undefined
  const data = chart.data.slice(0, GENUI_LIMITS.maxChartPoints)
  const labels = grouped !== undefined ? grouped[0]!.data.map(d => d.label) : data.map(d => d.label)
  const seriesValues = grouped !== undefined
    ? grouped.map(entry => entry.data.map(d => Number(d.value) || 0))
    : [data.map(d => Number(d.value) || 0)]
  const colors = seriesValues.map((_values, si) =>
    seriesColor(si, seriesValues.length, grouped !== undefined ? grouped[si]?.color : undefined, chart.palette) ?? 'var(--dsl-g-accent)')
  const multi = seriesValues.length > 1
  const flat = seriesValues.flat()
  const pointCount = Math.max(...seriesValues.map(values => values.length), 0)
  const W = Math.max(measured, 260)
  const H = 176
  const padL = 44
  const padR = 12
  const padT = 14
  const padB = 26
  const ticks = niceTicks(Math.min(...flat, 0), Math.max(...flat, 0), 4)
  const lo = ticks[0]!
  const hi = ticks[ticks.length - 1]!
  const span = hi - lo || 1
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const x = (i: number): number => padL + (pointCount <= 1 ? innerW / 2 : (i / (pointCount - 1)) * innerW)
  const y = (v: number): number => padT + (1 - (v - lo) / span) * innerH
  const paths = seriesValues.map(values =>
    values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' '))
  const area = !multi && pointCount > 1
    ? `${paths[0]} L ${x(pointCount - 1).toFixed(1)} ${y(lo).toFixed(1)} L ${x(0).toFixed(1)} ${y(lo).toFixed(1)} Z`
    : null
  // Keep x labels readable: at most one per ~64px of plot width.
  const labelStep = Math.max(1, Math.ceil(pointCount / Math.max(1, Math.floor(innerW / 64))))
  const summary = tr(multi ? 'block.chart.lineSeries' : 'block.chart.linePoints', {
    count: multi ? seriesValues.length : pointCount,
    min: formatTick(Math.min(...flat, 0)),
    max: formatTick(Math.max(...flat, 0)),
  })
  return (
    <div className={css.lineChart} data-genui-chart="line" data-genui-line ref={ref} role="img" aria-label={summary} onMouseLeave={hide}>
      <ChartTip tip={tip} />
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--dsl-g-accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--dsl-g-accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => {
          const ty = y(t)
          return (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={ty} y2={ty} className={i === 0 ? css.lineGridAxis : css.lineGrid} />
              <text x={padL - 8} y={ty + 4} textAnchor="end" className={css.lineTick}>{formatTick(t)}</text>
            </g>
          )
        })}
        {area !== null && <path d={area} fill={`url(#${gradientId})`} />}
        {paths.map((d, si) => <path key={si} d={d} className={css.linePath} style={{ stroke: colors[si] }} />)}
        {seriesValues.map((values, si) => values.map((v, i) => {
          const rows: TipRow[] = multi
            ? [[grouped![si]!.label, String(v)], [tr('block.chart.node'), labels[i] ?? '']]
            : [[labels[i] ?? '', String(v)]]
          return (
            <circle
              key={`${si}-${i}`}
              cx={x(i)}
              cy={y(v)}
              r={multi ? 3 : 3.5}
              className={css.lineDot}
              style={{ fill: colors[si] }}
              onMouseEnter={event => show(event, rows)}
              onMouseMove={event => show(event, rows)}
            />
          )
        }))}
        {labels.map((label, i) => (
          i % labelStep === 0
            ? <text key={`l-${i}`} x={x(i)} y={H - 8} textAnchor="middle" className={css.lineLabel}>{label}</text>
            : null
        ))}
      </svg>
      {multi && (
        <div className={css.chartLegend}>
          {grouped!.map((entry, si) => (
            <span key={si} className={css.legendItem}>
              <span className={css.legendSwatch} style={{ background: colors[si] }} />
              {renderInline(entry.label)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
})

/** Donut: share of total with a center total and a legend that shows each
 *  slice's value AND percentage (the old legend was unstyled text). */
export const DonutNode = memo(function DonutNode({ chart }: { chart: GenuiChart }) {
  useT()
  const { tip, show, hide } = useChartTip()
  const data = chart.data.slice(0, GENUI_LIMITS.maxChartPoints)
  const clamped = data.map(d => ({ ...d, v: Math.max(0, Number(d.value) || 0) }))
  const total = clamped.reduce((s, d) => s + d.v, 0) || 1
  // Center total: 1 decimal for fractional sums — a share-of-total figure
  // like 3.3/9.9 used to print the raw float as 6.6000000000000005.
  const totalText = total >= 1000
    ? `${Math.round(total / 100) / 10}k`
    : Number.isInteger(total) ? String(total) : total.toFixed(1)
  const R = 62
  const STROKE = 18
  const SIZE = 160
  const C = 2 * Math.PI * R
  let offset = 0
  const summary = tr('block.chart.donutSummary', { count: clamped.length, total: totalText })
  return (
    <div className={css.donut} data-genui-chart="donut" data-genui-donut role="img" aria-label={summary} onMouseLeave={hide}>
      <ChartTip tip={tip} />
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" strokeWidth={STROKE} className={css.donutTrack} />
        {clamped.map((d, i) => {
          const frac = d.v / total
          const len = frac * C
          const el = (
            <circle
              key={i}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              strokeWidth={STROKE}
              className={css.donutSeg}
              style={{ stroke: seriesColor(i, data.length, d.color, chart.palette) ?? 'var(--dsw-alias-state-business-primary, #4f8ef7)' }}
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              onMouseEnter={event => show(event, [[d.label, `${String(d.value)} · ${(frac * 100).toFixed(1)}%`]])}
              onMouseMove={event => show(event, [[d.label, `${String(d.value)} · ${(frac * 100).toFixed(1)}%`]])}
            />
          )
          offset += len
          return el
        })}
        <text x={SIZE / 2} y={SIZE / 2 - 2} textAnchor="middle" className={css.donutTotal}>{totalText}</text>
        <text x={SIZE / 2} y={SIZE / 2 + 16} textAnchor="middle" className={css.donutTotalLabel}>{tr('block.total')}</text>
      </svg>
      <div className={css.donutLegend}>
        {clamped.map((d, i) => (
          <span key={i} className={css.legendItem}>
            <span className={css.legendSwatch} style={{ background: seriesColor(i, data.length, d.color, chart.palette) ?? 'var(--dsw-alias-state-business-primary, #4f8ef7)' }} />
            <span>{renderInline(d.label)}</span>
            <span className={css.donutPct}>{String(d.value)} · {(d.v / total * 100).toFixed(1)}%</span>
          </span>
        ))}
      </div>
    </div>
  )
})
