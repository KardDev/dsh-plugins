/**
 * GenUI spec guard: resource limits, structural validation, and deterministic
 * repair for ```dsh-ui fence specs.
 *
 * The renderer path runs every fence body through `repairGenuiSpec` before
 * rendering, so a pathological or hostile spec — deep nesting, thousands of
 * nodes, oversized strings, out-of-range numbers — degrades gracefully instead
 * of stalling the UI. Repair is deterministic and prefix-stable: a component
 * that survives repair of a partial stream keeps its position when later
 * chunks arrive, so streaming re-renders stay consistent.
 *
 * Policy:
 * - Unknown node `type`s pass through untouched (plugin-registered custom
 *   components via `registerGenuiComponent` are opaque to this package).
 * - Known types: required fields must have the right type or the node is
 *   dropped; numbers are clamped into range; strings truncated; arrays
 *   sliced to their caps; containers recursed with a depth budget.
 * - The whole spec carries a node budget; once exhausted, remaining siblings
 *   are elided.
 */
import type { GenuiFileTreeNode, GenuiList, GenuiNode, GenuiPlot, GenuiPlotSeries, GenuiScene3D, GenuiSpec, GenuiDiagram, GenuiDiagramTheme, GenuiDiagramKind } from './spec.ts'
import { isComponentRoot, wrapSingleComponentRoot } from './spec.ts'
import {
  BADGE_TONES, BUTTON_TONES, CALLOUT_TONES, CARD_TONES, CHART_KINDS, COMPONENT_SCHEMAS, HERO_TONES,
  DIAGRAM_EDGE_KINDS, DIAGRAM_KINDS, DIAGRAM_NODE_TYPES, DIAGRAM_ROUTES, DIAGRAM_VARIANTS,
  ECHART_PRESETS, FILE_TYPES, GENUI_NATIVE_TYPES, GENUI_SPEC_SCHEMA, INPUT_TYPES,
  MEDIA_ASPECT_RATIOS, MESH_SHAPES, PLOT_KINDS, PROGRESS_VARIANTS, TABLE_CELL_TYPES, TEXT_SIZES,
} from './genui-runtime/schema.ts'
import type { ComponentFieldKind, ComponentRecordSchema, ComponentSchema } from './genui-runtime/schema.ts'
import { normalizeGenuiSpec } from './genui-runtime/normalize.ts'
import { diagnoseUnknownGenuiFields } from './genui-runtime/diagnostics.ts'
import type { GenuiDiagnostic } from './genui-runtime/diagnostics.ts'
import { GENUI_LIMITS } from './genui-runtime/limits.ts'
import { analyzeSubmissionRegistry } from './submission-registry.ts'
import { isTableDetailReachable, prepareTableRows, tableRowsForDetails } from './table-details.ts'
import { color, enu, int, num, obj, opt, safeMediaSrc, str } from './genui-runtime/value-utils.ts'
import { classifyLinkTarget } from './file-link.ts'

/** Result of `validateGenuiSpec`. */
export interface GenuiValidation {
  ok: boolean
  /** Human-readable problems, empty when `ok`. */
  errors: string[]
}

/* ---------------- schema field helpers ---------------- */

function fieldKindMatches(value: unknown, kind: ComponentFieldKind): boolean {
  switch (kind) {
    case 'string': return typeof value === 'string'
    case 'string-or-null': return value === null || typeof value === 'string'
    case 'number': return typeof value === 'number' && Number.isFinite(value)
    case 'boolean': return typeof value === 'boolean'
    case 'nodes': return Array.isArray(value)
    case 'array': return Array.isArray(value)
    case 'object': return obj(value) !== undefined
    case 'unknown': return true
  }
}

function fieldKindLabel(kind: ComponentFieldKind): string {
  switch (kind) {
    case 'string-or-null': return 'a string or null'
    case 'number': return 'a finite number'
    case 'boolean': return 'a boolean'
    case 'nodes': case 'array': return 'an array'
    case 'object': return 'an object'
    case 'unknown': return 'a value'
    default: return 'a string'
  }
}

/** Detect an existing field diagnostic using both canonical and legacy messages. */
function hasFieldError(errors: readonly string[], at: string, field: string): boolean {
  return errors.some(error =>
    error.startsWith(`${at}.${field} `) || error.includes(`'${field}'`) || error.includes(`requires ${field}`))
}

/** Validate present fields against the runtime schema without duplicating errors. */
function validateSchemaFieldKinds(
  value: Record<string, unknown>,
  at: string,
  definition: ComponentSchema,
  errors: string[],
  excludedFields: readonly string[] = [],
): void {
  for (const [field, kind] of Object.entries(definition.fields)) {
    if (excludedFields.includes(field) || value[field] === undefined) continue
    if (!fieldKindMatches(value[field], kind) && !hasFieldError(errors, at, field)) {
      errors.push(`${at}.${field} must be ${fieldKindLabel(kind)}`)
    }
  }
  for (const [field, values] of Object.entries(definition.enums)) {
    if (excludedFields.includes(field) || value[field] === undefined || !fieldKindMatches(value[field], 'string')) continue
    if (!values.includes(value[field] as string) && !hasFieldError(errors, at, field)) {
      errors.push(`${at}.${field} must be one of ${values.join(', ')}`)
    }
  }
}

/** Validate one schema-declared nested record and all records below it. */
function validateRecordSchema(
  value: unknown,
  at: string,
  definition: ComponentRecordSchema,
  errors: string[],
): void {
  const holder = obj(value)
  if (holder === undefined) {
    errors.push(`${at} must be an object`)
    return
  }
  for (const field of definition.required) {
    const kind = definition.fields[field]
    if (holder[field] === undefined) {
      if (!hasFieldError(errors, at, field)) errors.push(`${at}: requires ${field}${kind === undefined ? '' : ` (${fieldKindLabel(kind)})`}`)
    } else if (kind !== undefined && !fieldKindMatches(holder[field], kind)) {
      if (!hasFieldError(errors, at, field)) errors.push(`${at}.${field} must be ${fieldKindLabel(kind)}`)
    }
  }
  for (const [field, kind] of Object.entries(definition.fields)) {
    if (holder[field] !== undefined && !fieldKindMatches(holder[field], kind)) {
      if (!hasFieldError(errors, at, field)) errors.push(`${at}.${field} must be ${fieldKindLabel(kind)}`)
    }
  }
  for (const [field, values] of Object.entries(definition.enums)) {
    if (holder[field] !== undefined && typeof holder[field] === 'string' && !values.includes(holder[field])) {
      if (!hasFieldError(errors, at, field)) errors.push(`${at}.${field} must be one of ${values.join(', ')}`)
    }
  }
  for (const [field, nested] of Object.entries(definition.nested)) {
    const nestedValue = holder[field]
    if (nestedValue === undefined) continue
    if (Array.isArray(nestedValue)) {
      nestedValue.forEach((item, index) => validateRecordSchema(item, `${at}.${field}[${index}]`, nested, errors))
    } else {
      validateRecordSchema(nestedValue, `${at}.${field}`, nested, errors)
    }
  }
}

/** Validate registry-declared nested records before repair can discard them. */
function validateNestedRecordSchemas(
  value: Record<string, unknown>,
  at: string,
  definition: ComponentSchema,
  errors: string[],
): void {
  for (const [field, nested] of Object.entries(definition.nested)) {
    const nestedValue = value[field]
    if (nestedValue === undefined) continue
    if (Array.isArray(nestedValue)) {
      nestedValue.forEach((item, index) => validateRecordSchema(item, `${at}.${field}[${index}]`, nested, errors))
    } else {
      validateRecordSchema(nestedValue, `${at}.${field}`, nested, errors)
    }
  }
}

/**
 * Does this table state its columns implicitly, in a 2D `rows`/`data` body?
 * Repair turns the leading row into the header (see `deriveTableColumns`), so
 * validation must not report the missing `columns` that repair is about to
 * supply — while still reporting it for bodies repair cannot read (a scalar
 * `rows`, an empty array, a 1D list).
 */
function hasDerivableTableColumns(value: Record<string, unknown>): boolean {
  const rows = value.rows !== undefined ? value.rows : value.data
  if (!Array.isArray(rows) || rows.length === 0) return false
  return Array.isArray(rows[0])
}

/** Validate the registry-declared presence and primitive shape of a native node. */
function validateRegistryFields(
  value: Record<string, unknown>,
  at: string,
  definition: ComponentSchema,
  errors: string[],
): void {
  const type = String(value.type)
  const alreadyReported = (field: string): boolean => hasFieldError(errors, at, field)
  const derivableField = type === 'table' && hasDerivableTableColumns(value) ? 'columns' : null
  for (const field of definition.required) {
    const kind = definition.fields[field]
    if (kind === undefined || value[field] === undefined) {
      if (field !== derivableField && !alreadyReported(field)) errors.push(`${at}: type '${type}' requires ${field}${kind === undefined ? '' : ` (${fieldKindLabel(kind)})`}`)
      continue
    }
    if (!fieldKindMatches(value[field], kind) && !alreadyReported(field)) errors.push(`${at}.${field} must be ${fieldKindLabel(kind)}`)
  }
  validateSchemaFieldKinds(value, at, definition, errors, ['type'])
  for (const group of definition.oneOfRequired) {
    if (!group.some(field => value[field] !== undefined)
      && !errors.some(error => error.includes(`requires ${group.join(' or ')}`))) {
      errors.push(`${at}: type '${type}' requires one of ${group.join(' or ')}`)
    }
  }
  for (const rule of definition.conditionalRequired) {
    if (value[rule.when.field] !== rule.when.equals) continue
    for (const field of rule.required) {
      if (value[field] === undefined && !alreadyReported(field)) {
        errors.push(`${at}: type '${type}' requires ${field}${rule.message === undefined ? '' : ` (${rule.message})`}`)
      }
    }
  }
  validateNestedRecordSchemas(value, at, definition, errors)
}

/* ---------------- repair ---------------- */

interface RepairCtx {
  /** Nodes left in the budget; 0 stops the walk. */
  remaining: number
}

/** Walk `list` with the shared node budget; drops invalid entries. */
function repairItems(list: unknown, ctx: RepairCtx, depth: number): GenuiNode[] {
  if (!Array.isArray(list)) return []
  const out: GenuiNode[] = []
  for (const item of list) {
    if (ctx.remaining <= 0) break
    ctx.remaining -= 1
    const node = repairNode(item, ctx, depth)
    if (node !== null) out.push(node)
  }
  return out
}

/** Optional explicit palette: up to 12 validated colour values. */
function paletteValues(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out: string[] = []
  for (const item of v.slice(0, 12)) {
    const value = color(item)
    if (value === undefined) continue
    out.push(value)
  }
  return out.length > 0 ? out : undefined
}

/** Optional `stat.spark` series: finite numbers only, 2..60 points. */
function sparkValues(v: unknown): number[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out: number[] = []
  for (const item of v.slice(0, 60)) {
    const n = typeof item === 'number' ? item : Number(item)
    if (!Number.isFinite(n)) return undefined
    out.push(n)
  }
  return out.length >= 2 ? out : undefined
}

/** Layout hints are component-agnostic: `span` survives repair on ANY node
 *  (the renderer applies it inside a grid). Kept out of the per-case switches
 *  so a new component type cannot forget it. */
function repairNode(value: unknown, ctx: RepairCtx, depth: number): GenuiNode | null {
  const node = repairNodeFields(value, ctx, depth)
  if (node === null) return null
  const span = int(obj(value)?.span, 2, 12)
  const id = str(obj(value)?.id, 64)
  return { ...node, ...opt('span', span), ...opt('id', id) } as GenuiNode
}

function repairNodeFields(value: unknown, ctx: RepairCtx, depth: number): GenuiNode | null {
  if (depth > GENUI_LIMITS.maxDepth) return null
  const v = obj(value)
  if (v === undefined) return null
  const type = v.type
  if (typeof type !== 'string') return null
  switch (type) {
    case 'text': {
      const content = str(v.content, GENUI_LIMITS.maxString) ?? str(v.text, GENUI_LIMITS.maxString)
      if (content === undefined) return null
      return { type: 'text', content, ...opt('copyable', v.copyable === true ? true : undefined), ...opt('title', str(v.title, GENUI_LIMITS.maxString)), ...opt('size', enu(v.size, TEXT_SIZES)), ...opt('center', v.center === true ? true : undefined) }
    }
    case 'row': {
      return { type: 'row', items: repairItems(v.items, ctx, depth + 1), ...opt('wrap', v.wrap === true ? true : undefined), ...opt('spacer', v.spacer === true ? true : undefined) }
    }
    case 'col': {
      return { type: 'col', items: repairItems(v.items, ctx, depth + 1), ...opt('gap', num(v.gap, 0, 96)) }
    }
    case 'grid': {
      return { type: 'grid', cols: int(v.cols, 1, GENUI_LIMITS.maxGridCols) ?? 1, items: repairItems(v.items, ctx, depth + 1) }
    }
    case 'card': {
      return {
        type: 'card',
        items: repairItems(v.items, ctx, depth + 1),
        ...opt('title', str(v.title, GENUI_LIMITS.maxString)),
        ...opt('tone', enu(v.tone, CARD_TONES)),
        ...opt('accent', color(v.accent)),
      }
    }
    case 'button': {
      const label = str(v.label, GENUI_LIMITS.maxString)
      if (label === undefined) return null
      return {
        type: 'button', label,
        ...opt('tone', enu(v.tone, BUTTON_TONES)),
        ...opt('full', v.full === true ? true : undefined),
        ...opt('small', v.small === true ? true : undefined),
        ...opt('icon', str(v.icon, 64)),
        ...opt('action', str(v.action, 200)),
      }
    }
    case 'input': {
      return {
        type: 'input',
        ...opt('label', str(v.label, GENUI_LIMITS.maxString)),
        ...opt('placeholder', str(v.placeholder, GENUI_LIMITS.maxString)),
        ...opt('value', str(v.value, GENUI_LIMITS.maxString)),
        ...opt('inputType', enu(v.inputType, INPUT_TYPES)),
        ...opt('action', str(v.action, 200)),
        ...opt('id', str(v.id, 200)),
      }
    }
    case 'select': {
      const options = repairStrings(v.options, GENUI_LIMITS.maxOptions, GENUI_LIMITS.maxString)
      if (options === undefined) return null
      return {
        type: 'select', options,
        ...opt('label', str(v.label, GENUI_LIMITS.maxString)),
        ...opt('action', str(v.action, 200)),
        ...opt('selected', int(v.selected, 0, options.length - 1)),
        ...opt('id', str(v.id, 200)),
      }
    }
    case 'checkbox': {
      const label = str(v.label, GENUI_LIMITS.maxString)
      if (label === undefined) return null
      return {
        type: 'checkbox', label,
        ...opt('checked', v.checked === true ? true : undefined),
        ...opt('action', str(v.action, 200)),
        ...opt('group', str(v.group, 200)),
      }
    }
    case 'link': {
      const label = str(v.label, GENUI_LIMITS.maxString)
      if (label === undefined) return null
      const target = classifyLinkTarget(v.href)
      const href = target.type === 'external' ? target.href : target.type === 'file' ? String(v.href).trim() : undefined
      return { type: 'link', label, ...opt('href', href) }
    }
    case 'image': {
      const src = safeMediaSrc(v.src)
      if (src === undefined) return null
      return {
        type: 'image', src,
        ...opt('alt', str(v.alt, GENUI_LIMITS.maxString)),
      }
    }
    case 'audio': {
      const src = safeMediaSrc(v.src)
      if (src === undefined) return null
      return {
        type: 'audio', src,
        ...opt('alt', str(v.alt, GENUI_LIMITS.maxString)),
        ...opt('loop', v.loop === true ? true : undefined),
      }
    }
    case 'video': {
      const src = safeMediaSrc(v.src)
      if (src === undefined) return null
      return {
        type: 'video', src,
        ...opt('alt', str(v.alt, GENUI_LIMITS.maxString)),
        ...opt('poster', safeMediaSrc(v.poster)),
        ...opt('loop', v.loop === true ? true : undefined),
        ...opt('muted', v.muted === true ? true : undefined),
        ...opt('aspectRatio', enu(v.aspectRatio, MEDIA_ASPECT_RATIOS)),
      }
    }
    case 'badge': {
      const label = str(v.label, GENUI_LIMITS.maxString) ?? str(v.text, GENUI_LIMITS.maxString) ?? str(v.value, GENUI_LIMITS.maxString)
      if (label === undefined) return null
      return { type: 'badge', label, ...opt('tone', enu(v.tone, BADGE_TONES)), ...opt('icon', str(v.icon, 64)) }
    }
    case 'hero': {
      const title = str(v.title, GENUI_LIMITS.maxString)
      if (title === undefined) return null
      return {
        type: 'hero', title,
        ...opt('subtitle', str(v.subtitle, GENUI_LIMITS.maxString)),
        ...opt('value', str(v.value, 128)),
        ...opt('label', str(v.label, GENUI_LIMITS.maxString)),
        ...opt('delta', str(v.delta, 64)),
        ...opt('spark', sparkValues(v.spark)),
        ...opt('tone', enu(v.tone, HERO_TONES)),
      }
    }
    case 'stat': {
      const label = str(v.label, GENUI_LIMITS.maxString)
      const value = str(v.value, 128)
      if (label === undefined || value === undefined) return null
      return {
        type: 'stat', label, value,
        ...opt('delta', str(v.delta, 64)),
        ...opt('spark', sparkValues(v.spark)),
        ...opt('size', v.size === 'hero' ? 'hero' as const : undefined),
      }
    }
    case 'progress': {
      const value = num(v.value, 0, 100)
      if (value === undefined) return null
      return {
        type: 'progress', value,
        ...opt('label', str(v.label, GENUI_LIMITS.maxString)),
        ...opt('valueLabel', str(v.valueLabel, 64)),
        ...opt('variant', enu(v.variant, PROGRESS_VARIANTS)),
        ...opt('target', num(v.target, 0, 100)),
      }
    }
    case 'divider': return { type: 'divider' }
    case 'spacer': return { type: 'spacer' }
    case 'avatar': {
      const name = str(v.name, 64)
      if (name === undefined) return null
      return { type: 'avatar', name, ...opt('color', color(v.color)) }
    }
    case 'list': {
      const items = repairListItems(v.items, GENUI_LIMITS.maxListItems, ctx, depth + 1)
      if (items === undefined) return null
      return { type: 'list', items, ...opt('filter', str(v.filter, 64)) }
    }
    case 'table': {
      const prepared = prepareTableRows(v)
      if (prepared === null) return null
      const { columns, rows } = prepared
      // Optional per-column cell types; unknown entries degrade to 'text'.
      const rawTypes = Array.isArray(v.types) ? v.types : undefined
      const types = rawTypes === undefined
        ? undefined
        : columns.map((_c, i) => {
          const raw = rawTypes[i]
          return typeof raw === 'string' && (TABLE_CELL_TYPES as readonly string[]).includes(raw)
            ? raw as typeof TABLE_CELL_TYPES[number]
            : 'text'
        })
      // Master-detail payload: positionally aligned with `rows`. Entries that
      // repair to nothing stay null so the renderer never shows an empty
      // expander; extra entries beyond the row count are dropped.
      const rawDetails = Array.isArray(v.details) ? v.details : undefined
      const details = rawDetails === undefined
        ? undefined
        : rows.map((_row, i) => {
          if (!isTableDetailReachable({ columns, rows, types }, i)) return null
          const entry = repairItems(rawDetails[i], ctx, depth + 1)
          return entry.length === 0 ? null : entry
        })
      return {
        type: 'table', columns, rows,
        ...opt('types', types),
        ...opt('total', v.total === true ? true : undefined),
        ...opt('export', v.export === true ? true : undefined),
        ...opt('filter', str(v.filter, 64)),
        ...opt('filterColumn', int(v.filterColumn, 0, GENUI_LIMITS.maxTableCols - 1)),
        ...opt('sortField', str(v.sortField, 64)),
        ...opt('details', details !== undefined && details.some(d => d !== null) ? details : undefined),
      }
    }
    case 'chart': {
      const data = repairChartData(v.data, GENUI_LIMITS.maxChartPoints)
      const series = Array.isArray(v.series) ? repairSeries(v.series, GENUI_LIMITS.maxPlotSeries, GENUI_LIMITS.maxChartPoints) : undefined
      // `data` is required by the type but grouped bars may ship `series`
      // alone; a series-only chart gets an empty data array (the renderer
      // reads `series` in that case).
      if (data === undefined && series === undefined) return null
      return {
        type: 'chart', data: data ?? [],
        ...opt('kind', enu(v.kind, CHART_KINDS)),
        ...opt('series', series),
        ...opt('horizontal', v.horizontal === true ? true : undefined),
        ...opt('stacked', v.stacked === true ? true : undefined),
        ...opt('filter', str(v.filter, 64)),
        ...opt('palette', paletteValues(v.palette)),
      }
    }
    case 'tabs': {
      const tabs = repairTabs(v.tabs, ctx, depth)
      if (tabs === undefined) return null
      return { type: 'tabs', tabs }
    }
    case 'plot': {
      const series = repairPlotSeries(v.series, GENUI_LIMITS.maxPlotSeries)
      if (series === undefined) return null
      return {
        type: 'plot', series,
        ...opt('xMin', num(v.xMin, -1e6, 1e6)),
        ...opt('xMax', num(v.xMax, -1e6, 1e6)),
        ...opt('yMin', num(v.yMin, -1e9, 1e9)),
        ...opt('yMax', num(v.yMax, -1e9, 1e9)),
        ...opt('title', str(v.title, GENUI_LIMITS.maxString)),
      }
    }
    case 'callout': {
      const content = str(v.content, GENUI_LIMITS.maxString)
      if (content === undefined) return null
      return { type: 'callout', content, ...opt('tone', enu(v.tone, CALLOUT_TONES)), ...opt('title', str(v.title, GENUI_LIMITS.maxString)) }
    }
    case 'steps': {
      const steps = repairSteps(v.steps)
      if (steps === undefined) return null
      return { type: 'steps', steps, ...opt('current', int(v.current, 0, steps.length)) }
    }
    case 'keyvalue': {
      const pairs = repairPairs(v.pairs, GENUI_LIMITS.maxKeyValuePairs)
      if (pairs === undefined) return null
      return { type: 'keyvalue', pairs }
    }
    case 'diff': {
      const diffs = repairDiffs(v.diffs)
      if (diffs === undefined) return null
      return { type: 'diff', diffs }
    }
    case 'json': {
      // Any JSON value is acceptable; only the node itself is validated.
      if (!('value' in v)) return null
      return { type: 'json', value: v.value }
    }
    case 'code': {
      const code = str(v.code, GENUI_LIMITS.maxCode)
      if (code === undefined) return null
      return { type: 'code', code, ...opt('lang', str(v.lang, 64)), ...opt('title', str(v.title, GENUI_LIMITS.maxString)), ...opt('wrap', v.wrap === true ? true : undefined) }
    }
    case 'radio': {
      const options = repairStrings(v.options, GENUI_LIMITS.maxOptions, GENUI_LIMITS.maxString)
      if (options === undefined) return null
      return {
        type: 'radio', options,
        ...opt('label', str(v.label, GENUI_LIMITS.maxString)),
        ...opt('selected', int(v.selected, 0, options.length - 1)),
        ...opt('action', str(v.action, 200)),
        ...opt('group', str(v.group, 200)),
        // answer: option index (number) or label (string); out-of-range
        // indices are DROPPED (clamping would silently grade against the
        // wrong option)
        ...opt('answer', typeof v.answer === 'number' && Number.isFinite(v.answer)
          && v.answer >= 0 && v.answer < options.length
          ? Math.trunc(v.answer)
          : typeof v.answer === 'string' ? v.answer.slice(0, 512) : undefined),
        ...opt('explanation', str(v.explanation, GENUI_LIMITS.maxString)),
      }
    }
    case 'submit': {
      const label = str(v.label, GENUI_LIMITS.maxString)
      // 本地判卷可以不设置 action；不满足判卷条件时，渲染器会禁用无 action 的按钮。
      const action = str(v.action, 200)
      if (label === undefined) return null
      return {
        type: 'submit', label,
        ...opt('action', action),
        ...opt('resetAction', str(v.resetAction, 200)),
        ...opt('groups', repairStrings(v.groups, GENUI_LIMITS.maxOptions, 200)),
      }
    }
    case 'switch': {
      const label = str(v.label, GENUI_LIMITS.maxString)
      if (label === undefined) return null
      return { type: 'switch', label, ...opt('checked', v.checked === true ? true : undefined), ...opt('action', str(v.action, 200)) }
    }
    case 'slider': {
      const min = num(v.min, -1e9, 1e9) ?? 0
      const max = num(v.max, -1e9, 1e9) ?? 100
      const lo = Math.min(min, max)
      const hi = Math.max(min, max)
      const step = num(v.step, 1e-9, Math.max(hi - lo, 1e-9))
      const value = num(v.value, lo, hi) ?? lo
      return {
        type: 'slider',
        min: lo,
        max: hi,
        ...opt('step', step),
        value,
        ...opt('label', str(v.label, GENUI_LIMITS.maxString)),
        ...opt('action', str(v.action, 200)),
        ...opt('id', str(v.id, 200)),
      }
    }
    case 'textarea': {
      return {
        type: 'textarea',
        ...opt('label', str(v.label, GENUI_LIMITS.maxString)),
        ...opt('placeholder', str(v.placeholder, GENUI_LIMITS.maxString)),
        ...opt('rows', int(v.rows, 1, 30)),
        ...opt('value', str(v.value, GENUI_LIMITS.maxString)),
        ...opt('action', str(v.action, 200)),
        ...opt('id', str(v.id, 200)),
      }
    }
    case 'accordion': {
      const items = repairAccordion(v.items, ctx, depth)
      if (items === undefined) return null
      return { type: 'accordion', items }
    }
    case 'copy': {
      const text = str(v.text, GENUI_LIMITS.maxCode)
      if (text === undefined) return null
      return { type: 'copy', text, ...opt('label', str(v.label, 128)) }
    }
    case 'svg': {
      const code = str(v.code, GENUI_LIMITS.maxCode)
      if (code === undefined) return null
      return { type: 'svg', code, ...opt('title', str(v.title, GENUI_LIMITS.maxString)), ...opt('height', int(v.height, 100, 800)) }
    }
    case 'mermaid': {
      const code = str(v.code, GENUI_LIMITS.maxMermaid)
      if (code === undefined) return null
      return { type: 'mermaid', code }
    }
    case 'scene3d': {
      const meshes = repairMeshes(v.meshes)
      if (meshes === undefined) return null
      return { type: 'scene3d', meshes, ...opt('title', str(v.title, GENUI_LIMITS.maxString)), ...opt('ambient', num(v.ambient, 0, 2)), ...opt('background', color(v.background)) }
    }
    case 'diagram': {
      const repaired = repairDiagram(v)
      return repaired
    }
    case 'timeline': {
      const items = repairTimeline(v.items, GENUI_LIMITS.maxTimelineItems)
      if (items === undefined) return null
      return { type: 'timeline', items }
    }
    case 'file-tree': {
      const items = repairTree(v.items, GENUI_LIMITS.maxListItems)
      if (items === undefined) return null
      return { type: 'file-tree', items }
    }
    case 'breadcrumb': {
      const items = repairStrings(v.items, GENUI_LIMITS.maxBreadcrumbItems, GENUI_LIMITS.maxString)
      if (items === undefined) return null
      return { type: 'breadcrumb', items }
    }
    case 'quiz': {
      const question = str(v.question, GENUI_LIMITS.maxString)
      const options = repairQuizOptions(v.options, v.answer)
      if (question === undefined || options === undefined) return null
      return {
        type: 'quiz', question, options,
        ...opt('explanation', str(v.explanation, GENUI_LIMITS.maxString)),
        ...opt('id', str(v.id, 200)),
        ...opt('action', str(v.action, 200)),
      }
    }
    case 'echart': {
      // Preset shorthand data/series reuse the chart repair helpers.
      const data = v.data !== undefined ? repairChartData(v.data, GENUI_LIMITS.maxChartPoints) : undefined
      const series = v.series !== undefined && Array.isArray(v.series)
        ? repairSeries(v.series, GENUI_LIMITS.maxPlotSeries, GENUI_LIMITS.maxChartPoints)
        : undefined
      // sankey / graph edges: `from`/`to` must be strings, `value` a number.
      const links = Array.isArray(v.links)
        ? v.links.slice(0, GENUI_LIMITS.maxChartPoints).flatMap(entry => {
          const e = obj(entry)
          const from = e === undefined ? undefined : str(e.from, 64)
          const to = e === undefined ? undefined : str(e.to, 64)
          if (from === undefined || to === undefined) return []
          return [{ from, to, ...opt('value', num(e!.value, 0, 1e9)) }]
        })
        : undefined
      // Full option: depth-bounded pass-through (the model writes the ECharts
      // option object; the guard walks it to cap nesting but does not
      // validate ECharts semantics — that is echarts' own job).
      const sanitized = v.option !== undefined
        ? sanitizeEChartOption(v.option, 0, { count: GENUI_LIMITS.maxEChartOptionNodes })
        : undefined
      // A chart option root is always a plain object; a scalar root is
      // invalid, so degrade to preset/data/series handling (option dropped).
      const option: Record<string, unknown> | undefined =
        sanitized === undefined || typeof sanitized !== 'object' || sanitized === null || Array.isArray(sanitized)
          ? undefined
          : sanitized as Record<string, unknown>
      // At least one of preset+data, links or option must be present.
      if (option === undefined && data === undefined && series === undefined
        && (links === undefined || links.length === 0)) return null
      return {
        type: 'echart',
        ...opt('title', str(v.title, GENUI_LIMITS.maxString)),
        ...opt('height', int(v.height, 100, 800)),
        ...opt('preset', enu(v.preset, ECHART_PRESETS)),
        ...opt('data', data),
        ...opt('series', series),
        ...opt('links', links !== undefined && links.length > 0 ? links : undefined),
        ...opt('palette', paletteValues(v.palette)),
        ...opt('option', option),
      }
    }
    default:
      // Plugin-registered custom node types are opaque to the guard: pass
      // through unchanged (the renderer's default branch resolves them).
      return value as GenuiNode
  }
}

/* ---------------- per-type sub-repairers ---------------- */

function repairStrings(v: unknown, cap: number, strCap: number): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out: string[] = []
  for (const item of v) {
    if (out.length >= cap) break
    if (typeof item === 'string') {
      out.push(item.slice(0, strCap))
    } else if (item !== null && typeof item === 'object') {
      // 兼容模型误用对象数组（如把 ask_user_question 的 {label,description}
      // 格式错用到 select/radio 的 options）——提取可读字段，而不是静默丢
      // 掉整个选项，让用户看到「选项没列举出来」的空列表。
      const o = item as Record<string, unknown>
      const s = typeof o.label === 'string' ? o.label
        : typeof o.value === 'string' ? o.value
        : typeof o.title === 'string' ? o.title
        : JSON.stringify(item)
      out.push(s.slice(0, strCap))
    }
  }
  return out
}

function repairListItems(
  v: unknown,
  cap: number,
  ctx: RepairCtx,
  depth: number,
): GenuiList['items'] | undefined {
  if (!Array.isArray(v)) return undefined
  const out: GenuiList['items'] = []
  for (const item of v) {
    if (out.length >= cap) break
    if (typeof item === 'string') {
      out.push(item.slice(0, GENUI_LIMITS.maxString))
      continue
    }
    const o = obj(item)
    if (o !== undefined && typeof o.type === 'string') {
      // Typed children are GenuiNodes: charge them against the shared node
      // budget (module header promise — exhausted budget elides remaining
      // siblings). Strings and {title,desc} objects are list-item shapes,
      // not nodes, so they never consume budget.
      if (ctx.remaining <= 0) break
      ctx.remaining -= 1
      const node = repairNode(o, ctx, depth)
      if (node !== null) out.push(node)
      continue
    }
    const title = o === undefined ? undefined : str(o.title, GENUI_LIMITS.maxString)
    if (title !== undefined) {
      out.push({ title, ...opt('desc', str(o?.desc, GENUI_LIMITS.maxString)) })
    }
  }
  return out
}

function repairChartData(v: unknown, cap: number): Array<{ label: string; value: number; color?: string }> | undefined {
  if (!Array.isArray(v)) return undefined
  const out: Array<{ label: string; value: number; color?: string }> = []
  for (const datum of v) {
    if (out.length >= cap) break
    const o = obj(datum)
    const label = o === undefined ? undefined : str(o.label, 128)
    const value = o === undefined ? undefined : num(o.value, -1e12, 1e12)
    if (label === undefined || value === undefined) continue
    out.push({ label, value, ...opt('color', o === undefined ? undefined : color(o.color)) })
  }
  return out
}

function repairSeries(v: unknown, cap: number, pointCap: number): Array<{ label: string; color?: string; data: Array<{ label: string; value: number; color?: string }> }> | undefined {
  if (!Array.isArray(v)) return undefined
  const out: Array<{ label: string; color?: string; data: Array<{ label: string; value: number; color?: string }> }> = []
  for (const s of v) {
    if (out.length >= cap) break
    const o = obj(s)
    const label = o === undefined ? undefined : str(o.label, 128)
    const data = o === undefined ? undefined : repairChartData(o.data, pointCap)
    if (label === undefined || data === undefined) continue
    out.push({ label, data, ...opt('color', o === undefined ? undefined : color(o.color)) })
  }
  return out
}

function repairTabs(v: unknown, ctx: RepairCtx, depth: number): Array<{ label: string; items: GenuiNode[] }> | undefined {
  if (!Array.isArray(v)) return undefined
  const out: Array<{ label: string; items: GenuiNode[] }> = []
  for (const tab of v) {
    if (out.length >= GENUI_LIMITS.maxTabs) break
    const o = obj(tab)
    const label = o === undefined ? undefined : str(o.label, 128)
    if (label === undefined || o === undefined) continue
    // `content` is accepted as an `items` alias (single component or array) —
    // models routinely emit tabs[].content and losing it empties every tab.
    const rawItems = o.items !== undefined ? o.items
      : o.content !== undefined ? (Array.isArray(o.content) ? o.content : [o.content])
      : undefined
    out.push({ label, items: repairItems(rawItems, ctx, depth + 1) })
  }
  return out
}

function repairPlotSeries(v: unknown, cap: number): GenuiPlot['series'] | undefined {
  if (!Array.isArray(v)) return undefined
  const out: GenuiPlot['series'] = []
  for (const s of v) {
    if (out.length >= cap) break
    const o = obj(s)
    const expr = o === undefined ? undefined : str(o.expr, 512)
    if (expr === undefined || o === undefined) continue
    const params: NonNullable<GenuiPlotSeries['params']> = []
    if (Array.isArray(o.params)) {
      for (const p of o.params) {
        if (params.length >= GENUI_LIMITS.maxPlotParams) break
        const po = obj(p)
        const name = po === undefined ? undefined : str(po.name, 64)
        const value = po === undefined ? undefined : num(po.value, -1e9, 1e9)
        if (name === undefined || value === undefined) continue
        params.push({
          name, value,
          ...opt('min', po === undefined ? undefined : num(po.min, -1e9, 1e9)),
          ...opt('max', po === undefined ? undefined : num(po.max, -1e9, 1e9)),
          ...opt('step', po === undefined ? undefined : num(po.step, 1e-9, 1e9)),
          ...opt('animateTo', po === undefined ? undefined : num(po.animateTo, -1e9, 1e9)),
          ...opt('durationMs', po === undefined ? undefined : num(po.durationMs, 1, 120_000)),
          ...opt('loop', po === undefined ? undefined : po.loop === true ? true : undefined),
        })
      }
    }
    out.push({ expr, ...opt('label', str(o.label, 128)), ...opt('color', color(o.color)), ...opt('kind', enu(o.kind, PLOT_KINDS)), ...opt('params', params.length > 0 ? params : undefined) })
  }
  return out
}

function repairSteps(v: unknown): Array<{ title: string; desc?: string }> | undefined {
  if (!Array.isArray(v)) return undefined
  const out: Array<{ title: string; desc?: string }> = []
  for (const s of v) {
    if (out.length >= GENUI_LIMITS.maxSteps) break
    const o = obj(s)
    const title = o === undefined ? undefined : str(o.title, 256)
    if (title === undefined) continue
    out.push({ title, ...opt('desc', o === undefined ? undefined : str(o.desc, GENUI_LIMITS.maxString)) })
  }
  return out
}

function repairPairs(v: unknown, cap: number): Array<{ key: string; value: string }> | undefined {
  if (!Array.isArray(v)) return undefined
  const out: Array<{ key: string; value: string }> = []
  for (const p of v) {
    if (out.length >= cap) break
    const o = obj(p)
    const key = o === undefined ? undefined : str(o.key, 256)
    const value = o === undefined ? undefined : str(o.value, GENUI_LIMITS.maxString)
    if (key === undefined || value === undefined) continue
    out.push({ key, value })
  }
  return out
}

function repairDiffs(v: unknown): Array<{ path: string; oldText: string | null; newText: string }> | undefined {
  if (!Array.isArray(v)) return undefined
  const out: Array<{ path: string; oldText: string | null; newText: string }> = []
  for (const d of v) {
    if (out.length >= 24) break
    const o = obj(d)
    const path = o === undefined ? undefined : str(o.path, 1024)
    const newText = o === undefined ? undefined : str(o.newText, 20_000)
    if (path === undefined || newText === undefined) continue
    const old = o === undefined ? undefined : o.oldText
    out.push({ path, newText, oldText: old === null || typeof old !== 'string' ? null : old.slice(0, 20_000) })
  }
  return out
}

function repairAccordion(v: unknown, ctx: RepairCtx, depth: number): Array<{ title: string; items: GenuiNode[] }> | undefined {
  if (!Array.isArray(v)) return undefined
  const out: Array<{ title: string; items: GenuiNode[] }> = []
  for (const item of v) {
    if (out.length >= GENUI_LIMITS.maxAccordionItems) break
    const o = obj(item)
    const title = o === undefined ? undefined : str(o.title, 256)
    if (title === undefined || o === undefined) continue
    out.push({ title, items: repairItems(o.items, ctx, depth + 1) })
  }
  return out
}

function repairMeshes(v: unknown): GenuiScene3D['meshes'] | undefined {
  if (!Array.isArray(v)) return undefined
  const out: GenuiScene3D['meshes'] = []
  for (const m of v) {
    if (out.length >= GENUI_LIMITS.maxMeshes) break
    const o = obj(m)
    const shape = o === undefined ? undefined : enu(o.shape, MESH_SHAPES)
    if (shape === undefined) continue
    const scale = o === undefined ? undefined : num(o.scale, -1e6, 1e6) ?? tuple3(o.scale)
    const size = o === undefined ? undefined : num(o.size, -1e6, 1e6) ?? tuple3(o.size)
    out.push({
      shape,
      ...opt('color', o === undefined ? undefined : color(o.color)),
      ...opt('position', o === undefined ? undefined : tuple3(o.position)),
      ...opt('rotation', o === undefined ? undefined : tuple3(o.rotation)),
      ...opt('scale', scale),
      ...opt('size', size),
    })
  }
  return out
}

function tuple3(v: unknown): [number, number, number] | undefined {
  if (!Array.isArray(v) || v.length !== 3) return undefined
  const [a, b, c] = v
  if (typeof a !== 'number' || !Number.isFinite(a) || typeof b !== 'number' || !Number.isFinite(b)
    || typeof c !== 'number' || !Number.isFinite(c)) return undefined
  return [Math.min(1e6, Math.max(-1e6, a)), Math.min(1e6, Math.max(-1e6, b)), Math.min(1e6, Math.max(-1e6, c))]
}

/* ---------------- diagram (editorial) sub-repairers ---------------- */

/** Clamp a coordinate/size to the 4px editorial grid. */
function grid4(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(v / 4) * 4))
}

function repairDiagramNodes(v: unknown): GenuiDiagram['nodes'] | undefined {
  if (!Array.isArray(v)) return undefined
  const out: GenuiDiagram['nodes'] = []
  const seen = new Set<string>()
  for (const raw of v) {
    if (out.length >= GENUI_LIMITS.maxDiagramNodes) break
    const o = obj(raw)
    if (o === undefined) continue
    const id = str(o.id, 128)
    const label = str(o.label, GENUI_LIMITS.maxString)
    if (id === undefined || label === undefined) continue
    if (seen.has(id)) continue
    seen.add(id)
    const nodeType = enu(o.type, DIAGRAM_NODE_TYPES)
    // Coordinate fields are clamped to a sane canvas and rounded to 4px.
    const x = o.x === undefined ? undefined : grid4(num(o.x, -1e6, 1e6) ?? 0, 0, 1e6)
    const y = o.y === undefined ? undefined : grid4(num(o.y, -1e6, 1e6) ?? 0, 0, 1e6)
    const w = o.w === undefined ? undefined : grid4(num(o.w, -1e6, 1e6) ?? 96, 40, 2000)
    const h = o.h === undefined ? undefined : grid4(num(o.h, -1e6, 1e6) ?? 48, 24, 1200)
    out.push({
      id, label,
      ...opt('sub', str(o.sub, 256)),
      ...opt('type', nodeType),
      ...opt('x', x),
      ...opt('y', y),
      ...opt('w', w),
      ...opt('h', h),
      ...opt('tag', str(o.tag, 32)),
    })
  }
  return out
}

function repairDiagramEdges(v: unknown): GenuiDiagram['edges'] | undefined {
  if (v === undefined) return []
  if (!Array.isArray(v)) return undefined
  const out: GenuiDiagram['edges'] = []
  for (const raw of v) {
    if (out.length >= GENUI_LIMITS.maxDiagramEdges) break
    const o = obj(raw)
    if (o === undefined) continue
    const from = str(o.from, 128)
    const to = str(o.to, 128)
    if (from === undefined || to === undefined) continue
    out.push({
      from, to,
      ...opt('label', str(o.label, GENUI_LIMITS.maxDiagramLabel)),
      ...opt('kind', enu(o.kind, DIAGRAM_EDGE_KINDS)),
      ...opt('route', enu(o.route, DIAGRAM_ROUTES)),
    })
  }
  return out
}

function repairDiagramTheme(v: unknown): GenuiDiagramTheme | undefined {
  const o = obj(v)
  if (o === undefined) return undefined
  const out: GenuiDiagramTheme = {}
  for (const key of ['paper', 'paper-2', 'ink', 'muted', 'soft', 'rule', 'accent', 'accent-tint', 'link'] as const) {
    const c = color(o[key])
    if (c !== undefined) out[key] = c
  }
  return Object.keys(out).length === 0 ? undefined : out
}

function repairDiagramZones(v: unknown): GenuiDiagram['zones'] | undefined {
  if (v === undefined) return []
  if (!Array.isArray(v)) return undefined
  const out: GenuiDiagram['zones'] = []
  for (const raw of v) {
    if (out.length >= GENUI_LIMITS.maxDiagramZones) break
    const o = obj(raw)
    if (o === undefined) continue
    const label = str(o.label, 64)
    if (label === undefined) continue
    out.push({
      label,
      ...opt('x', o.x === undefined ? undefined : grid4(num(o.x, -1e6, 1e6) ?? 0, 0, 1e6)),
      ...opt('y', o.y === undefined ? undefined : grid4(num(o.y, -1e6, 1e6) ?? 0, 0, 1e6)),
      ...opt('w', o.w === undefined ? undefined : grid4(num(o.w, -1e6, 1e6) ?? 100, 40, 2000)),
      ...opt('h', o.h === undefined ? undefined : grid4(num(o.h, -1e6, 1e6) ?? 100, 40, 1200)),
    })
  }
  return out
}

function repairDiagram(v: unknown): GenuiDiagram | null {
  const o = obj(v)
  if (o === undefined) return null
  const kind = enu(o.kind, DIAGRAM_KINDS as unknown as readonly GenuiDiagramKind[])
  if (kind === undefined) return null
  const nodes = repairDiagramNodes(o.nodes)
  if (nodes === undefined) return null
  const edges = repairDiagramEdges(o.edges)
  if (edges === undefined) return null
  const zones = repairDiagramZones(o.zones)
  if (zones === undefined) return null
  return {
    // `zones` is optional: emitting `zones: []` made every diagram node differ
    // from its input for no reason (and broke the "gallery survives the guard
    // unchanged" contract).
    type: 'diagram', kind, nodes, edges,
    ...opt('zones', zones.length > 0 ? zones : undefined),
    ...opt('variant', enu(o.variant, DIAGRAM_VARIANTS)),
    ...opt('title', str(o.title, 256)),
    ...opt('theme', repairDiagramTheme(o.theme)),
  }
}

function repairTimeline(v: unknown, cap: number): Array<{ title: string; desc?: string; time?: string }> | undefined {
  if (!Array.isArray(v)) return undefined
  const out: Array<{ title: string; desc?: string; time?: string }> = []
  for (const item of v) {
    if (out.length >= cap) break
    const o = obj(item)
    const title = o === undefined ? undefined : str(o.title, 256)
    if (title === undefined) continue
    out.push({
      title,
      ...opt('desc', o === undefined ? undefined : str(o.desc, GENUI_LIMITS.maxString)),
      ...opt('time', o === undefined ? undefined : str(o.time, 128)),
    })
  }
  return out
}

function repairTree(v: unknown, cap: number): GenuiFileTreeNode[] | undefined {
  // Recursion is bounded by GENUI_LIMITS.maxTreeDepth (see the inner walk).
  return walkTree(v, cap, GENUI_LIMITS.maxTreeDepth)
}

function walkTree(v: unknown, cap: number, depthLeft: number): GenuiFileTreeNode[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out: GenuiFileTreeNode[] = []
  for (const item of v) {
    if (out.length >= cap) break
    const o = obj(item)
    const name = o === undefined ? undefined : str(o.name, 256)
    if (name === undefined) continue
    const children = o !== undefined && depthLeft > 0 && Array.isArray(o.children) ? walkTree(o.children, cap, depthLeft - 1) : undefined
    out.push({ name, ...opt('type', o === undefined ? undefined : enu(o.type, FILE_TYPES)), ...opt('children', children) })
  }
  return out
}

function repairQuizOptions(v: unknown, answer?: unknown): Array<{ label: string; correct?: boolean; feedback?: string }> | undefined {
  if (!Array.isArray(v)) return undefined
  const out: Array<{ label: string; correct?: boolean; feedback?: string }> = []
  for (const optItem of v) {
    if (out.length >= GENUI_LIMITS.maxQuizOptions) break
    const o = obj(optItem)
    const label = typeof optItem === 'string' ? str(optItem, 512) : o === undefined ? undefined : str(o.label, 512)
    if (label === undefined) continue
    out.push({
      label,
      ...opt('correct', o === undefined ? undefined : o.correct === true ? true : undefined),
      ...opt('feedback', o === undefined ? undefined : str(o.feedback, GENUI_LIMITS.maxString)),
    })
  }
  // Nothing recoverable (empty array, all-non-string non-object items): return
  // undefined rather than an empty list, so repairNode drops the whole quiz
  // instead of half-rendering a question with no options — the same
  // silently-unusable state the string-options case produces when kept.
  if (out.length === 0) return undefined

  // The canonical quiz shape stores correctness on each option. Models
  // commonly emit the simpler { options: string[], answer } form; only
  // use that alias when no canonical correct marker was supplied.
  if (out.some(option => option.correct === true)) return out
  const answerIndex = typeof answer === 'number' && Number.isFinite(answer)
    ? Math.trunc(answer)
    : typeof answer === 'string'
      ? out.findIndex(option => option.label === answer.slice(0, 512))
      : -1
  if (answerIndex < 0 || answerIndex >= out.length) return out
  return out.map((option, index) => index === answerIndex ? { ...option, correct: true } : option)
}

/**
 * Patterns that indicate HTML/script injection in a string field. ECharts
 * default `tooltip.renderMode: 'html'` writes tooltip content via
 * `innerHTML`; even with renderMode forced to 'richText' (see below),
 * filtering these patterns is defense-in-depth — a model (or a
 * prompt-injected model) should never emit `<script>`, `onerror=`, or
 * `javascript:` inside a chart option string.
 */
const ECHART_HTML_DANGER_RE = /<(?:script|img|svg|iframe|video|audio|object|embed|source)\b|on[a-z]+\s*=|javascript:/i

/**
 * Mutable budget counter for the sanitize walk — passed by reference so
 * every recursion shares one pool.
 */
interface EChartSanitizeBudget { count: number }

/**
 * Sanitize an ECharts option object: depth-bounded, budget-bounded
 * pass-through that strips dangerous values (functions, `url()` in styles,
 * HTML/script injection patterns in strings) but preserves the object shape
 * ECharts needs. Scalars are KEPT: ECharts options are full of them,
 * including inside `data` arrays (`data: [120, 150, 180]`,
 * `xAxis.data: ['1月', '2月']`). Previously a scalar hit the plain-object
 * gate below and returned undefined, so every primitive-valued array was
 * filtered to empty and dropped — a chart with a full `option` rendered
 * with empty series (blank canvas). This is a safety walk, not an ECharts
 * semantic validator.
 *
 * Security: `tooltip.renderMode` is forced to `'richText'` on every tooltip
 * object. ECharts' default `'html'` mode writes tooltip content via
 * `innerHTML`, which is an XSS vector when the option originates from model
 * output — a prompt-injected model could emit
 * `{"tooltip":{"formatter":"<img src=x onerror=...>"}}` and execute
 * arbitrary script. `richText` renders as text, never touching innerHTML.
 */
function sanitizeEChartOption(v: unknown, depth: number, budget: EChartSanitizeBudget): unknown {
  if (budget.count <= 0) return undefined
  budget.count -= 1
  if (depth > GENUI_LIMITS.maxEChartOptionDepth) return undefined
  // Scalars pass through: numbers/strings/booleans/null are legal ECharts
  // values both as object fields and as array elements.
  if (typeof v === 'string') {
    const s = v.slice(0, GENUI_LIMITS.maxString)
    // Reject strings containing HTML/script injection patterns or CSS url()
    // (exfiltration channel). Preserves legitimate ECharts string values
    // (labels, plain-text formatter templates, etc.).
    if (s.toLowerCase().includes('url(') || ECHART_HTML_DANGER_RE.test(s)) return undefined
    return s
  }
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'boolean') return v
  if (v === null) return null
  if (Array.isArray(v)) {
    const cap = Math.min(v.length, GENUI_LIMITS.maxEChartArrayLen)
    const arr: unknown[] = []
    for (let i = 0; i < cap; i++) {
      const s = sanitizeEChartOption(v[i], depth + 1, budget)
      if (s !== undefined) arr.push(s)
    }
    return arr.length > 0 || v.length === 0 ? arr : undefined
  }
  const o = obj(v)
  if (o === undefined) return undefined
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(o)) {
    const s = sanitizeEChartOption(val, depth + 1, budget)
    if (s === undefined) continue
    // Force tooltip.renderMode: 'richText' to prevent ECharts from writing
    // tooltip content via innerHTML (the default 'html' mode is an XSS
    // vector when the option comes from model output).
    if (key === 'tooltip' && typeof s === 'object' && s !== null && !Array.isArray(s)) {
      (s as Record<string, unknown>).renderMode = 'richText'
    }
    out[key] = s
  }
  // Empty axes/tooltip enable ECharts defaults; an empty data array clears it.
  // Keep intentional empties, while still dropping objects stripped by guards.
  return Object.keys(out).length > 0 || Object.keys(o).length === 0 ? out : undefined
}

/**
 * Deterministically repair a raw spec value into a renderable GenuiSpec.
 * Returns null only when the root is not an object with an `items` array
 * (a bare component root is wrapped into a col first — the documented fence
 * vocabulary allows single-component bodies); every other defect is healed by
 * dropping/clamping/truncating. Idempotent: repairing a repaired spec is a
 * no-op.
 */
function repairCanonicalGenuiSpec(value: unknown): GenuiSpec | null {
  const v = obj(value)
  if (v === undefined) return null
  // A bare component root (including data components whose `items` is their
  // record list — steps/list/timeline/…) wraps first; the wrapper is a plain
  // spec, so this recursion cannot wrap twice (issue #172).
  if (isComponentRoot(value)) {
    const wrapped = wrapSingleComponentRoot(value)
    if (wrapped === null) return null
    return repairCanonicalGenuiSpec(wrapped)
  }
  if (!Array.isArray(v.items)) return null
  const ctx: RepairCtx = { remaining: GENUI_LIMITS.maxNodes }
  return {
    ...opt('title', str(v.title, GENUI_LIMITS.maxString)),
    ...opt('gap', num(v.gap, 0, 96)),
    ...opt('panel', v.panel === true ? true : undefined),
    ...opt('append', v.append === true ? true : undefined),
    items: repairItems(v.items, ctx, 0),
  }
}

/**
 * Deterministically repair a raw spec into a renderable GenuiSpec.
 *
 * Alias normalization is performed before the existing resource, type, and
 * security repair rules. The result remains idempotent and keeps the legacy
 * public API used by the fence renderer and client components.
 *
 * @param value - Raw GenUI spec or bare component.
 * @returns Repaired canonical spec, or null for an invalid root.
 */
export function repairGenuiSpec(value: unknown): GenuiSpec | null {
  return repairCanonicalGenuiSpec(normalizeGenuiSpec(value).value)
}

/* ---------------- validation ---------------- */

/**
 * Count the nodes of a spec tree (every item, descending into tabs /
 * accordion / file-tree / list containers — the same descent
 * `validateGenuiSpec` walks). Shared by the panel fold (node-budget gate)
 * and validation, so the panel never runs a second, divergent traversal.
 * `cap` bounds the walk for hostile inputs; the panel passes
 * `PANEL_LIMITS.maxNodes + 1` to detect overflow without counting the whole
 * tree.
 */
export function countGenuiNodes(value: unknown, cap = Number.POSITIVE_INFINITY): number {
  let count = 0
  const walk = (list: unknown): void => {
    if (!Array.isArray(list)) return
    for (const item of list) {
      if (count >= cap) return
      count += 1
      const v = obj(item)
      if (v === undefined) continue
      if (v.type === 'tabs' && Array.isArray(v.tabs)) {
        for (const t of v.tabs) {
          if (count >= cap) return
          const to = obj(t)
          if (to !== undefined) walk(to.items)
        }
      } else if (v.type === 'accordion' && Array.isArray(v.items)) {
        for (const it of v.items) {
          if (count >= cap) return
          const io = obj(it)
          if (io !== undefined) walk(io.items)
        }
      } else if ((v.type === 'row' || v.type === 'col' || v.type === 'grid' || v.type === 'card') && Array.isArray(v.items)) {
        // Layout containers hold real children; skipping them undercounted
        // the tree and hid silent drops from validate_dsh_ui (issue #42).
        walk(v.items)
      } else if (v.type === 'file-tree') {
        // file-tree.items are data records, not GenUI children.
      } else if (v.type === 'list' && Array.isArray(v.items)) {
        // Typed list children are nodes too (repair charges them against the
        // budget); strings and {title,desc} shapes are skipped.
        for (const li of v.items) {
          if (count >= cap) return
          const lo = obj(li)
          if (lo !== undefined && typeof lo.type === 'string') walk([lo])
        }
      } else if (v.type === 'table' && Array.isArray(v.details)) {
        const rowCount = tableRowsForDetails(v).length
        for (let rowIndex = 0; rowIndex < Math.min(v.details.length, rowCount); rowIndex++) {
          if (count >= cap) return
          const detail = v.details[rowIndex]
          if (Array.isArray(detail) && isTableDetailReachable(v, rowIndex)) walk(detail)
        }
      }
    }
  }
  const root = obj(value)
  walk(root === undefined ? [] : root.items)
  return count
}

/** Every white-listed node `type`. Keep in sync with the repairNode switch —
 * validate_dsh_ui uses it to tell declared GenUI nodes apart from unrelated
 * `"type"` strings (e.g. file-tree's `{type:'file'}` children). */
export const GENUI_NODE_TYPES: ReadonlySet<string> = GENUI_NATIVE_TYPES

/**
 * Visit and count declared nodes in a raw spec tree: objects whose `type` is a
 * white-listed string, descending the same containers `countGenuiNodes`
 * walks. Callers can inspect field semantics or compare the count with the
 * repaired tree without maintaining another traversal.
 */
function visitDeclaredGenuiNodes(
  value: unknown,
  cap: number,
  visit: (node: Record<string, unknown>, at: string) => void,
): number {
  let count = 0
  const declared = (candidate: unknown): boolean => {
    const o = obj(candidate)
    return o !== undefined && typeof o.type === 'string' && GENUI_NODE_TYPES.has(o.type)
  }
  function walk(list: unknown, path: string): void {
    if (!Array.isArray(list)) return
    for (let index = 0; index < list.length; index++) {
      walkNode(list[index], `${path}[${index}]`)
      if (count >= cap) return
    }
  }
  function walkNode(item: unknown, at: string): void {
    if (count >= cap || !declared(item)) return
    const v = obj(item)
    if (v === undefined) return
    count += 1
    visit(v, at)
    if (v.type === 'tabs' && Array.isArray(v.tabs)) {
      for (let tab = 0; tab < v.tabs.length; tab++) {
        walkItemsOf(v.tabs[tab], `${at}.tabs[${tab}]`)
      }
    } else if (v.type === 'accordion' && Array.isArray(v.items)) {
      for (let row = 0; row < v.items.length; row++) {
        walkItemsOf(v.items[row], `${at}.items[${row}]`)
      }
    } else if ((v.type === 'row' || v.type === 'col' || v.type === 'grid' || v.type === 'card') && Array.isArray(v.items)) {
      walk(v.items, `${at}.items`)
    } else if (v.type === 'list' && Array.isArray(v.items)) {
      for (let row = 0; row < v.items.length; row++) {
        walkNode(v.items[row], `${at}.items[${row}]`)
      }
    } else if (v.type === 'table' && Array.isArray(v.details)) {
      const rowCount = tableRowsForDetails(v).length
      for (let row = 0; row < Math.min(v.details.length, rowCount); row++) {
        if (Array.isArray(v.details[row]) && isTableDetailReachable(v, row)) walk(v.details[row], `${at}.details[${row}]`)
      }
    }
  }
  function walkItemsOf(holder: unknown, path: string): void {
    const o = obj(holder)
    if (o === undefined) return
    const items = o.items !== undefined ? o.items : o.content
    if (Array.isArray(items)) walk(items, `${path}.items`)
    else walkNode(items, `${path}.items`)
  }
  const root = obj(value)
  if (root === undefined) return count
  // Component root: the root itself is the declared node, whether or not it
  // carries an `items` data array (issue #172).
  if (isComponentRoot(root) && declared(value)) walkNode(value, 'spec')
  else walk(root.items, 'items')
  return count
}

/**
 * Count white-listed nodes declared by a raw spec before repair drops invalid entries.
 * @param value - raw GenUI spec.
 * @param cap - traversal ceiling.
 * @returns declared node count up to the ceiling.
 */
export function countDeclaredGenuiNodes(value: unknown, cap = Number.POSITIVE_INFINITY): number {
  return visitDeclaredGenuiNodes(value, cap, () => {})
}

/** Count native nodes that survived repair, excluding opaque custom nodes. */
export function countRenderedNativeGenuiNodes(value: unknown, cap = Number.POSITIVE_INFINITY): number {
  return countDeclaredGenuiNodes(value, cap)
}

/**
 * Return field-level chart errors without changing other repairable component families.
 * @param value - raw GenUI spec.
 * @returns chart semantic errors in tree order.
 */
export function validateGenuiChartSemantics(value: unknown): string[] {
  const errors: string[] = []
  visitDeclaredGenuiNodes(value, GENUI_LIMITS.maxNodes + 1, (node, at) => {
    if (node.type !== 'chart') return
    validateChartNode(node, at, errors)
  })
  return errors
}

/**
 * Validate a raw spec value against the white list and limits, collecting
 * human-readable problems. Unlike repair this never mutates: it is a
 * diagnostic for tests and tooling. Unknown `type`s are reported (a plugin
 * custom type is valid only when a renderer is registered — the guard cannot
 * know, so it flags them as warnings).
 *
 * @param value - 未经过别名转换的 GenUI 文档。
 * @returns 完整结构与字段校验结果。
 */
export function validateCanonicalGenuiSpec(value: unknown): GenuiValidation {
  const errors: string[] = []
  const v = obj(value)
  if (v === undefined) return { ok: false, errors: ['spec root must be an object'] }
  // Single-component root: validate through the wrapped form so the tool
  // agrees with the renderer about what is a valid fence body.
  if (isComponentRoot(value)) {
    const wrapped = wrapSingleComponentRoot(value)
    if (wrapped !== null) return validateCanonicalGenuiSpec(wrapped)
    return { ok: false, errors: ['spec.items must be an array'] }
  }
  if (!Array.isArray(v.items)) return { ok: false, errors: ['spec.items must be an array'] }
  validateSchemaFieldKinds(v, 'spec', GENUI_SPEC_SCHEMA, errors, ['items'])
  let count = 0
  let capped = false
  const walk = (list: unknown, depth: number, path: string): void => {
    if (capped) return
    if (!Array.isArray(list)) {
      errors.push(`${path} must be an array`)
      return
    }
    for (let i = 0; i < list.length; i++) {
      if (capped || count >= GENUI_LIMITS.maxNodes) {
        if (!capped) {
          errors.push(`spec exceeds ${GENUI_LIMITS.maxNodes} nodes; tail elided`)
          capped = true
        }
        return
      }
      count += 1
      const at = `${path}[${i}]`
      validateNode(list[i], depth, at, errors, walk)
    }
  }
  walk(v.items, 0, 'items')
  if (errors.length === 0) errors.push(...analyzeSubmissionRegistry(v as unknown as GenuiSpec).diagnostics)
  const uniqueErrors = [...new Set(errors)]
  return { ok: uniqueErrors.length === 0, errors: uniqueErrors }
}

/**
 * Validate a raw GenUI value after deterministic alias normalization.
 *
 * Validation therefore only sees canonical fields; repairable aliases do not
 * produce false required-field errors. Structural and semantic defects remain
 * errors, while native unknown fields are exposed by the warning diagnostics
 * returned from `processGenuiSpec`.
 *
 * @param value - Raw GenUI spec or bare component.
 * @returns Validation result with human-readable errors.
 */
export function validateGenuiSpec(value: unknown): GenuiValidation {
  return validateCanonicalGenuiSpec(normalizeGenuiSpec(value).value)
}

export interface GenuiProcessResult {
  /** Canonical alias-normalized input value. */
  value: unknown
  /** Alias-normalized value, provided as an explicit descriptive alias. */
  normalized: unknown
  /** Canonical repaired value consumed by the renderer. */
  repaired: GenuiSpec | null
  /** Renderer-facing alias for `repaired`. */
  spec: GenuiSpec | null
  /** Structural and semantic validation errors. */
  errors: string[]
  /** Alias and native unknown-field warnings. */
  warnings: GenuiDiagnostic[]
  /** Native nodes declared in the canonical input, before repair drops. */
  declaredCount: number
  /** Nodes present in the repaired tree. */
  renderedCount: number
  /** Native nodes declared before repair, excluding custom payloads. */
  declaredNativeCount: number
  /** Native nodes present after repair, excluding custom and file-tree data. */
  renderedNativeCount: number
  /** All rendered component nodes, including opaque custom nodes. */
  renderedTotalCount: number
}

/**
 * Run the shared canonical GenUI pipeline.
 *
 * The pipeline normalizes aliases, applies the existing deterministic repair
 * and security filters, validates the canonical input, and reports native
 * declarations that disappeared during repair. Custom nodes stay opaque and
 * do not participate in native unknown-field diagnostics.
 *
 * @param value - Raw GenUI spec or bare component.
 * @returns Canonical input, repaired output, diagnostics, and node counts.
 */
export function processGenuiSpec(value: unknown): GenuiProcessResult {
  const normalized = normalizeGenuiSpec(value)
  const repaired = repairCanonicalGenuiSpec(normalized.value)
  const validation = validateCanonicalGenuiSpec(normalized.value)
  const declaredNativeCount = countDeclaredGenuiNodes(normalized.value, GENUI_LIMITS.maxNodes + 1)
  const renderedNativeCount = repaired === null ? 0 : countRenderedNativeGenuiNodes(repaired)
  const renderedTotalCount = repaired === null ? 0 : countGenuiNodes(repaired)
  // The shared public validator preserves its historical diagnostic for an
  // unknown type. The processing pipeline is renderer-aware by contract:
  // custom nodes stay opaque and must not fail native schema validation.
  const errors = validation.errors.filter(error => !error.includes(': unknown type '))
  if (repaired !== null && errors.length === 0) {
    errors.push(...analyzeSubmissionRegistry(repaired).diagnostics)
  }
  if (declaredNativeCount > renderedNativeCount) {
    errors.push(`repair dropped ${declaredNativeCount - renderedNativeCount} declared native node(s): declared ${declaredNativeCount}, rendered ${renderedNativeCount}`)
  }
  return {
    value: normalized.value,
    normalized: normalized.value,
    repaired,
    spec: repaired,
    errors: [...new Set(errors)],
    warnings: [...normalized.warnings, ...diagnoseUnknownGenuiFields(normalized.value)],
    // Compatibility fields retain their historical meanings: declaredCount
    // is native declarations, while renderedCount is the total rendered tree.
    declaredCount: declaredNativeCount,
    renderedCount: renderedTotalCount,
    declaredNativeCount,
    renderedNativeCount,
    renderedTotalCount,
  }
}

/** Return whether the only process errors describe an intentional budget tail cut. */
export function isIntentionalBudgetCut(processed: GenuiProcessResult): boolean {
  return processed.errors.length > 0
    && processed.errors.every(error => error.startsWith('spec exceeds ') || error.startsWith('repair dropped '))
    && processed.renderedNativeCount === GENUI_LIMITS.maxNodes
    && processed.declaredNativeCount === GENUI_LIMITS.maxNodes + 1
}

/** Decide whether a repaired spec is safe to expose to any GenUI renderer. */
export function isRenderableProcess(processed: GenuiProcessResult): boolean {
  return processed.spec !== null && (processed.errors.length === 0 || isIntentionalBudgetCut(processed))
}

/* ---------------- partial fence rendering (issue #186) ---------------- */

/** Longest node or aligned table-detail slot path a validation error points at. */
const DECLARED_NODE_PATH_RE = /^(items\[\d+\](?:\.(?:items\[\d+\]|tabs\[\d+\]\.items\[\d+\]|details\[\d+\](?:\[\d+\])?))*)/

function errorNodePath(error: string): string | null {
  const match = DECLARED_NODE_PATH_RE.exec(error)
  return match === null ? null : match[1] ?? null
}

interface NodeSlot {
  array: unknown[]
  index: number
  /** Detail row slots align with table rows; pruning must not shift them. */
  preserveIndex: boolean
}

/** Where the node or table-detail slot at a validation path lives. */
function nodeSlotAt(root: Record<string, unknown>, path: string): NodeSlot | undefined {
  const steps = [...path.matchAll(/(?:^|\.)(items|tabs|details)\[(\d+)\]|\[(\d+)\]/g)]
  if (steps.length === 0 || steps[steps.length - 1]![1] === 'tabs') return undefined
  let current: unknown = root
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!
    // A detail child has a second index without a property: details[row][node].
    const list = step[1] === undefined ? current : obj(current)?.[step[1]]
    const index = Number(step[2] ?? step[3])
    if (!Array.isArray(list) || index >= list.length) return undefined
    if (i === steps.length - 1) return { array: list, index, preserveIndex: step[1] === 'details' }
    current = list[index]
    if (current === undefined) return undefined
  }
  return undefined
}

/** Deep-clone a JSON value for pruning; null when it cannot round-trip. */
function cloneJsonValue(value: unknown): Record<string, unknown> | null {
  try {
    return obj(JSON.parse(JSON.stringify(value))) ?? null
  } catch {
    return null
  }
}

/**
 * Best-effort repair for a spec whose strict validation failed: drop the
 * declared nodes the errors point at and re-run the whole pipeline once.
 *
 * The fence channels call this after the strict gate refuses, so ONE bad
 * component no longer degrades the whole fence to a code block — the
 * behaviour the capability map documents ("坏节点静默丢弃…不会拖垮界面") and
 * that validate_dsh_ui keeps diagnosing for the model. Bounded to a single
 * retry: a second failing pass is a genuinely pathological tree and keeps
 * today's full-fence fallback. Chart semantics stay protected the same way —
 * an undrawable chart is DROPPED here, never repaired into a blank canvas.
 */
export function partialRepairGenuiSpec(processed: GenuiProcessResult): GenuiSpec | null {
  if (isRenderableProcess(processed)) return processed.spec
  if (processed.spec === null) return null
  const root = obj(processed.value)
  if (root === undefined) return null
  const paths = new Set<string>()
  const overhangPaths = new Set<string>()
  for (const error of processed.errors) {
    if (error.startsWith('spec exceeds ')) continue
    const nodePath = errorNodePath(error)
    if (nodePath === null) continue
    if (error === `${nodePath}.details must not contain more entries than rows`) {
      overhangPaths.add(nodePath)
    } else paths.add(nodePath)
  }
  if (paths.size === 0 && overhangPaths.size === 0) return null
  // Validation wraps a bare component first. Prune the same shape so its
  // detail paths resolve even when the table is the only declared node.
  const pruned = cloneJsonValue(isComponentRoot(root) ? wrapSingleComponentRoot(root) : root)
  if (pruned === null) return null
  // Resolve every slot BEFORE the first splice: each drop shifts the later
  // siblings of the same array, so a resolve-after-splice (deepest-first or
  // not) lands on the wrong row whenever two erroring nodes share a parent.
  // A resolved slot keeps its own array reference, so a parent drop cannot
  // invalidate an already-resolved child slot; per array, splicing
  // highest-index first keeps the remaining indexes valid (issue #190).
  const slots = [...paths]
    .map((path) => nodeSlotAt(pruned, path))
    .filter((slot): slot is NodeSlot => slot !== undefined)
  const overhangSlots = [...overhangPaths]
    .map((path) => nodeSlotAt(pruned, path))
    .filter((slot): slot is NodeSlot => slot !== undefined)
  // Extra details are unreachable. Mirror table repair's existing truncation
  // only for this exact diagnostic, then validate the whole candidate again.
  for (const { array, index } of overhangSlots) {
    const table = obj(array[index])
    if (table?.type === 'table' && Array.isArray(table.details)) {
      table.details.length = Math.min(table.details.length, tableRowsForDetails(table).length)
    }
  }
  const byArray = new Map<unknown[], number[]>()
  for (const { array, index, preserveIndex } of slots) {
    if (preserveIndex) {
      array[index] = null
      continue
    }
    const indexes = byArray.get(array)
    if (indexes === undefined) byArray.set(array, [index])
    else indexes.push(index)
  }
  for (const [array, indexes] of byArray) {
    indexes.sort((a, b) => b - a)
    for (const index of indexes) array.splice(index, 1)
  }
  const retry = processGenuiSpec(pruned)
  if (!isRenderableProcess(retry) || retry.renderedNativeCount === 0) return null
  return retry.spec
}

type Walker = (list: unknown, depth: number, path: string) => void

function validateChartData(value: unknown, at: string, errors: string[]): void {
  if (!Array.isArray(value)) return
  for (let index = 0; index < value.length; index++) {
    const datum = obj(value[index])
    const path = `${at}[${index}]`
    if (datum === undefined) {
      errors.push(`${path} must be an object`)
      continue
    }
    if (typeof datum.label !== 'string') errors.push(`${path}.label must be a string`)
    if (typeof datum.value !== 'number' || !Number.isFinite(datum.value)) {
      errors.push(`${path}.value must be a finite number`)
    }
    if (datum.color !== undefined && typeof datum.color !== 'string') {
      errors.push(`${path}.color must be a string`)
    }
  }
}

function validateChartSeries(value: unknown, at: string, errors: string[]): void {
  if (!Array.isArray(value)) return
  for (let index = 0; index < value.length; index++) {
    const series = obj(value[index])
    const path = `${at}[${index}]`
    if (series === undefined) {
      errors.push(`${path} must be an object`)
      continue
    }
    if (typeof series.label !== 'string') errors.push(`${path}.label must be a string`)
    if (series.color !== undefined && typeof series.color !== 'string') {
      errors.push(`${path}.color must be a string`)
    }
    if (!Array.isArray(series.data)) errors.push(`${path}.data must be an array`)
    validateChartData(series.data, `${path}.data`, errors)
  }
}

function validateChartNode(v: Record<string, unknown>, at: string, errors: string[]): void {
  if (!Array.isArray(v.data) && !Array.isArray(v.series)) {
    errors.push(`${at}: type 'chart' requires data or series (array)`)
  }
  if (v.variant !== undefined) errors.push(`${at}.variant is unsupported; use kind`)
  if (v.data !== undefined && !Array.isArray(v.data)) errors.push(`${at}.data must be an array`)
  if (v.series !== undefined && !Array.isArray(v.series)) errors.push(`${at}.series must be an array`)
  if (v.kind !== undefined
    && (typeof v.kind !== 'string'
      || !CHART_KINDS.includes(v.kind as typeof CHART_KINDS[number]))) {
    errors.push(`${at}.kind must be bars, line, or donut`)
  }
  const kind = v.kind === undefined ? 'bars' : v.kind
  const series = Array.isArray(v.series) ? v.series : undefined
  // Grouped bars legitimately carry `data: []` and keep every point in
  // `series`; only an empty data array with NO series is undrawable.
  if (Array.isArray(v.data) && v.data.length === 0 && (series === undefined || series.length === 0)) {
    errors.push(`${at}.data must not be empty`)
  }
  if (series !== undefined) {
    if (series.length === 0) errors.push(`${at}.series must not be empty`)
    // A line chart accepts `series` (one line per entry); the donut is a
    // share-of-total shape and stays single-series.
    if (kind === 'donut') errors.push(`${at}.series is only supported for bars and line`)
    for (let index = 0; index < series.length; index++) {
      const entry = obj(series[index])
      if (entry !== undefined && Array.isArray(entry.data) && entry.data.length === 0) {
        errors.push(`${at}.series[${index}].data must not be empty`)
      }
    }
  }
  if (kind === 'donut' && v.data === undefined) {
    errors.push(`${at}.data is required for donut`)
  }
  if (kind === 'line' && v.data === undefined && (series === undefined || series.length === 0)) {
    errors.push(`${at}.data is required for line (or provide series)`)
  }
  validateChartData(v.data, `${at}.data`, errors)
  validateChartSeries(v.series, `${at}.series`, errors)
}

/** Validate table rows before repair can silently remove malformed cells. */
function validateTableRows(value: unknown, at: string, errors: string[]): void {
  if (!Array.isArray(value)) return
  for (let rowIndex = 0; rowIndex < value.length; rowIndex++) {
    const row = value[rowIndex]
    if (obj(row) !== undefined) continue
    if (!Array.isArray(row)) {
      errors.push(`${at}[${rowIndex}] must be an array or object`)
      continue
    }
    for (let cellIndex = 0; cellIndex < row.length; cellIndex++) {
      const cell = row[cellIndex]
      if (typeof cell !== 'string' && (typeof cell !== 'number' || !Number.isFinite(cell))) {
        errors.push(`${at}[${rowIndex}][${cellIndex}] must be a string or finite number`)
      }
    }
  }
}

function validateNode(value: unknown, depth: number, at: string, errors: string[], walk: Walker): void {
  if (depth > GENUI_LIMITS.maxDepth) {
    errors.push(`${at}: exceeds max depth ${GENUI_LIMITS.maxDepth}`)
    return
  }
  const v = obj(value)
  if (v === undefined) {
    errors.push(`${at}: must be an object`)
    return
  }
  const type = v.type
  if (typeof type !== 'string') {
    errors.push(`${at}: missing string 'type'`)
    return
  }
  const isStr = (name: string): void => { if (v[name] !== undefined && typeof v[name] !== 'string') errors.push(`${at}: '${name}' must be a string`) }
  const isNum = (name: string): void => { if (v[name] !== undefined && (typeof v[name] !== 'number' || !Number.isFinite(v[name]))) errors.push(`${at}: '${name}' must be a finite number`) }
  switch (type) {
    case 'text':
      if (typeof v.content !== 'string' && typeof v.text !== 'string') {
        errors.push(`${at}: type 'text' requires content or text (string)`)
      }
      isStr('content')
      isStr('text')
      break
    case 'row': case 'col': case 'card': case 'grid':
      if (!Array.isArray(v.items)) errors.push(`${at}: type '${type}' requires items (array)`)
      walk(v.items, depth + 1, `${at}.items`)
      if (type === 'grid') isNum('cols')
      break
    case 'button': case 'checkbox': case 'link': case 'switch':
      if (typeof v.label !== 'string') errors.push(`${at}: type '${type}' requires label (string)`)
      isStr('label')
      break
    case 'image': case 'audio': case 'video':
      if (typeof v.src !== 'string') errors.push(`${at}: type '${type}' requires src (string)`)
      isStr('src')
      isStr('alt')
      if (type === 'video') isStr('poster')
      break
    case 'slider':
      isStr('label')
      isNum('min'); isNum('max'); isNum('step'); isNum('value')
      break
    case 'input': case 'textarea':
      isStr('label'); isStr('placeholder'); isStr('value')
      break
    case 'select': case 'radio':
      if (!Array.isArray(v.options)) errors.push(`${at}: type '${type}' requires options (array)`)
      break
    case 'submit':
      if (typeof v.label !== 'string') errors.push(`${at}: type 'submit' requires label (string)`)
      // 本地判卷可以不设置 action；不满足判卷条件时，渲染器会禁用无 action 的按钮。
      break
    case 'badge':
      if (typeof v.label !== 'string' && typeof v.text !== 'string' && typeof v.value !== 'string') {
        errors.push(`${at}: type 'badge' requires label, text, or value (string)`)
      }
      isStr('label')
      isStr('text')
      isStr('value')
      break
    case 'hero':
      if (typeof v.title !== 'string') errors.push(`${at}: type 'hero' requires title (string)`)
      isStr('subtitle')
      break
    case 'stat':
      if (typeof v.label !== 'string') errors.push(`${at}: type 'stat' requires label (string)`)
      if (typeof v.value !== 'string') errors.push(`${at}: type 'stat' requires value (string)`)
      isStr('delta')
      break
    case 'progress':
      if (typeof v.value !== 'number' || !Number.isFinite(v.value) || (v.value as number) < 0 || (v.value as number) > 100) {
        errors.push(`${at}: type 'progress' requires value (number 0..100)`)
      }
      isNum('value')
      break
    case 'avatar':
      if (typeof v.name !== 'string') errors.push(`${at}: type 'avatar' requires name (string)`)
      break
    case 'list':
      if (!Array.isArray(v.items)) errors.push(`${at}: type 'list' requires items (array)`)
      if (Array.isArray(v.items)) {
        // Descend into typed children so validation agrees with repair and
        // rendering (they recurse into list items as GenuiNodes). Strings and
        // {title,desc} list-item shapes are not nodes and are skipped.
        for (let i = 0; i < v.items.length; i++) {
          const item = obj(v.items[i])
          if (item !== undefined && typeof item.type === 'string') {
            validateNode(item, depth + 1, `${at}.items[${i}]`, errors, walk)
          }
        }
      }
      break
    case 'table':
      // `columns` may be satisfied by the 2D body itself (repair derives the
      // header from the leading row); only a body that cannot state its
      // columns is a contract error.
      if (!Array.isArray(v.columns) && !hasDerivableTableColumns(v)) errors.push(`${at}: type 'table' requires columns (array)`)
      if (!Array.isArray(v.rows)) errors.push(`${at}: type 'table' requires rows (array)`)
      if (v.types !== undefined && !Array.isArray(v.types)) {
        errors.push(`${at}.types must be an array of column cell types`)
      }
      if (v.details !== undefined && !Array.isArray(v.details)) {
        errors.push(`${at}.details must be an array aligned with rows`)
      }
      if (Array.isArray(v.details)) {
        const table = { columns: v.columns, rows: v.rows, types: v.types }
        const rowCount = tableRowsForDetails(table).length
        if (v.details.length > rowCount) errors.push(`${at}.details must not contain more entries than rows`)
        for (let i = 0; i < Math.min(v.details.length, rowCount); i++) {
          const detail = v.details[i]
          if (detail === null || !isTableDetailReachable(table, i)) continue
          if (!Array.isArray(detail)) {
            errors.push(`${at}.details[${i}] must be an array or null`)
            continue
          }
          walk(detail, depth + 1, `${at}.details[${i}]`)
        }
      }
      validateTableRows(v.rows, `${at}.rows`, errors)
      break
    case 'chart':
      validateChartNode(v, at, errors)
      break
    case 'tabs': {
      if (!Array.isArray(v.tabs)) errors.push(`${at}: type 'tabs' requires tabs (array)`)
      if (Array.isArray(v.tabs)) {
        for (let i = 0; i < v.tabs.length; i++) {
          const t = obj(v.tabs[i])
          if (t === undefined) { errors.push(`${at}.tabs[${i}] must be an object`); continue }
          if (typeof t.label !== 'string') errors.push(`${at}.tabs[${i}].label must be a string`)
          walk(t.items, depth + 1, `${at}.tabs[${i}].items`)
        }
      }
      break
    }
    case 'plot':
      if (!Array.isArray(v.series)) errors.push(`${at}: type 'plot' requires series (array)`)
      break
    case 'callout':
      if (typeof v.content !== 'string') errors.push(`${at}: type 'callout' requires content (string)`)
      break
    case 'steps':
      if (!Array.isArray(v.steps)) errors.push(`${at}: type 'steps' requires steps (array)`)
      break
    case 'keyvalue':
      if (!Array.isArray(v.pairs)) errors.push(`${at}: type 'keyvalue' requires pairs (array)`)
      break
    case 'diff':
      if (!Array.isArray(v.diffs)) errors.push(`${at}: type 'diff' requires diffs (array)`)
      break
    case 'json':
      if (!('value' in v)) errors.push(`${at}: type 'json' requires value`)
      break
    case 'code':
      if (typeof v.code !== 'string') errors.push(`${at}: type 'code' requires code (string)`)
      break
    case 'accordion':
      if (!Array.isArray(v.items)) errors.push(`${at}: type 'accordion' requires items (array)`)
      if (Array.isArray(v.items)) {
        for (let i = 0; i < v.items.length; i++) {
          const item = obj(v.items[i])
          if (item === undefined) { errors.push(`${at}.items[${i}] must be an object`); continue }
          if (typeof item.title !== 'string') errors.push(`${at}.items[${i}].title must be a string`)
          walk(item.items, depth + 1, `${at}.items[${i}].items`)
        }
      }
      break
    case 'copy':
      if (typeof v.text !== 'string') errors.push(`${at}: type 'copy' requires text (string)`)
      break
    case 'svg':
      if (typeof v.code !== 'string') errors.push(`${at}: type 'svg' requires code (string)`)
      isNum('height')
      break
    case 'mermaid':
      if (typeof v.code !== 'string') errors.push(`${at}: type 'mermaid' requires code (string)`)
      break
    case 'scene3d':
      if (!Array.isArray(v.meshes)) errors.push(`${at}: type 'scene3d' requires meshes (array)`)
      break
    case 'timeline':
      if (!Array.isArray(v.items)) errors.push(`${at}: type 'timeline' requires items (array)`)
      break
    case 'file-tree':
      if (!Array.isArray(v.items)) errors.push(`${at}: type 'file-tree' requires items (array)`)
      break
    case 'breadcrumb':
      if (!Array.isArray(v.items)) errors.push(`${at}: type 'breadcrumb' requires items (array)`)
      break
    case 'quiz':
      if (typeof v.question !== 'string') errors.push(`${at}: type 'quiz' requires question (string)`)
      if (!Array.isArray(v.options)) errors.push(`${at}: type 'quiz' requires options (array)`)
      break
    case 'diagram':
      if (typeof v.kind !== 'string') errors.push(`${at}: type 'diagram' requires kind (string)`)
      if (!Array.isArray(v.nodes)) errors.push(`${at}: type 'diagram' requires nodes (array)`)
      if (v.edges !== undefined && !Array.isArray(v.edges)) errors.push(`${at}: type 'diagram' requires edges (array) when present`)
      break

    case 'echart':
      // `links` alone is a valid payload: the sankey/graph presets are driven
      // by edges only. Missing it here rejected the whole fence as
      // un-renderable (the render gate turns any error into "render nothing").
      if (v.option === undefined && v.data === undefined && v.series === undefined
        && (!Array.isArray(v.links) || v.links.length === 0)) {
        errors.push(`${at}: type 'echart' requires option, data, series, or links`)
      }
      isNum('height')
      break
    default:
      // Unknown type: plugin-registered custom nodes are valid when a
      // renderer exists; the guard cannot know, so report as a warning.
      errors.push(`${at}: unknown type '${type}' (custom renderer?)`)
  }
  const definition = COMPONENT_SCHEMAS[type]
  if (definition !== undefined) {
    validateRegistryFields(v, at, definition, errors)
  }
}
