import { GENUI_LIMITS } from './genui-runtime/index.ts'

/** 保存 repair 所需的原始 table 字段。 */
export interface TableDetailSource {
  columns?: unknown
  rows?: unknown
  data?: unknown
  types?: unknown
}

/** 保存 repair 后的 table 列和行。 */
export interface PreparedTableRows {
  columns: string[]
  rows: Array<Array<string | number>>
}

/** 使用 table repair 相同的转换规则处理列和行。 */
export function prepareTableRows(table: TableDetailSource): PreparedTableRows | null {
  const declaredColumns = table.columns
  const columnsSpecified = Array.isArray(declaredColumns) && declaredColumns.length > 0
  const rawColumns = columnsSpecified && Array.isArray(declaredColumns)
    && typeof declaredColumns[0] === 'object' && declaredColumns[0] !== null
    ? declaredColumns.map(columnHeaderText)
    : declaredColumns
  let columns = repairColumnValues(rawColumns)
  let rawRows = table.rows !== undefined ? table.rows : table.data

  if (Array.isArray(rawRows) && rawRows.length > 0
    && typeof rawRows[0] === 'object' && rawRows[0] !== null && !Array.isArray(rawRows[0])) {
    const keys = Array.isArray(table.columns) && table.columns.length > 0
      && typeof table.columns[0] === 'object' && table.columns[0] !== null
      ? table.columns.map(columnKeyOf).filter((key): key is string => key !== undefined)
      : Object.keys(rawRows[0] as Record<string, unknown>)
    rawRows = rawRows.map(row => keys.map(key => cellText((row as Record<string, unknown>)[key])))
  }

  let derived: PreparedTableRows | null = null
  if (!columnsSpecified && Array.isArray(rawRows) && rawRows.length > 0 && Array.isArray(rawRows[0])) {
    const grid = repairRows(rawRows)
    const candidate = grid.length === 0 ? null : deriveTableColumns(grid)
    if (candidate !== null && repairRows(candidate.rows).length === candidate.rows.length) {
      derived = candidate
      columns = candidate.columns.map(column => column.slice(0, 128))
    }
  }

  if (columns.length === 0 && !Array.isArray(table.columns)) return null
  const rows = repairRows(derived === null ? rawRows : derived.rows)
  if (!Array.isArray(rawRows)) return null
  return { columns: columns.slice(0, GENUI_LIMITS.maxTableCols), rows }
}

/** 返回 repair 后可显示详情的 table 行。 */
export function tableRowsForDetails<Row = unknown>(table: TableDetailSource): Row[] {
  return (prepareTableRows(table)?.rows ?? []) as Row[]
}

/** 按照 table renderer 的规则识别分组标题行。 */
export function isTableGroupHeaderRow(row: unknown, types: unknown): boolean {
  if (!Array.isArray(row) || !Array.isArray(types) || types[0] !== 'group') return false
  return String(row[0] ?? '').trim() !== ''
    && row.slice(1).every(cell => String(cell ?? '').trim() === '')
}

/** 判断详情索引对应的行是否可展开并显示。 */
export function isTableDetailReachable(table: TableDetailSource, rowIndex: number): boolean {
  const rows = tableRowsForDetails(table)
  return rowIndex >= 0
    && rowIndex < rows.length
    && !isTableGroupHeaderRow(rows[rowIndex], table.types)
}

/** 按照 guard 接受的 object alias 规则修复 table 列。 */
function repairColumnValues(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const columns: string[] = []
  for (const item of value) {
    if (columns.length >= GENUI_LIMITS.maxTableCols) break
    if (typeof item === 'string') columns.push(item.slice(0, 128))
    else if (item !== null && typeof item === 'object') {
      const column = item as Record<string, unknown>
      const label = typeof column.label === 'string' ? column.label
        : typeof column.value === 'string' ? column.value
          : typeof column.title === 'string' ? column.title
            : JSON.stringify(item)
      columns.push(label.slice(0, 128))
    }
  }
  return columns
}

/** 按照 table repair 的单元格规则裁剪并清理行。 */
function repairRows(value: unknown): Array<Array<string | number>> {
  if (!Array.isArray(value)) return []
  const rows: Array<Array<string | number>> = []
  for (const row of value) {
    if (rows.length >= GENUI_LIMITS.maxTableRows) break
    if (!Array.isArray(row)) continue
    const cells: Array<string | number> = []
    for (const cell of row) {
      if (cells.length >= GENUI_LIMITS.maxTableCols) break
      if (typeof cell === 'string') cells.push(cell.slice(0, 256))
      else if (typeof cell === 'number' && Number.isFinite(cell)) cells.push(cell)
    }
    if (cells.length > 0) rows.push(cells)
  }
  return rows
}

/** 从有效的首行表头生成 table 列。 */
function deriveTableColumns(rows: Array<Array<string | number>>): PreparedTableRows | null {
  const header = rows[0]
  if (header === undefined || header.length === 0) return null
  const body = rows.slice(1)
  if (body.length === 0) {
    const columns = header.map(cell => String(cell).trim())
    return columns.every(column => column !== '') ? { columns, rows: [] } : null
  }
  if (body.every(row => row.length === header.length)) {
    return { columns: header.map(cell => String(cell).trim()), rows: body }
  }
  return { columns: Array.from({ length: header.length }, (_unused, index) => `列${index + 1}`), rows }
}

/** 读取 object row 映射到列时使用的 key。 */
function columnKeyOf(value: unknown): string | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const column = value as Record<string, unknown>
  for (const key of ['key', 'dataIndex', 'title', 'label'] as const) {
    if (typeof column[key] === 'string' && column[key] !== '') return column[key]
  }
  return undefined
}

/** 将 object row 中的值转换为 table 单元格，并保留列位置。 */
function cellText(value: unknown): string | number {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value === null || value === undefined) return ''
  return JSON.stringify(value)
}

/** 读取 object column 显示的标题。 */
function columnHeaderText(value: unknown): string {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return String(value)
  const column = value as Record<string, unknown>
  for (const key of ['title', 'label', 'key', 'dataIndex'] as const) {
    if (typeof column[key] === 'string' && column[key] !== '') return column[key]
  }
  return JSON.stringify(value)
}
