/** Deterministic GenUI alias and structural normalization. */
import { COMPONENT_SCHEMAS } from './schema.ts'
import type { ComponentRecordSchema } from './schema.ts'
import { isComponentRoot } from '../spec.ts'
import type { GenuiDiagnostic } from './diagnostics.ts'
import { isTableDetailReachable } from '../table-details.ts'

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function isNode(value: unknown): value is Record<string, unknown> {
  const candidate = record(value)
  return candidate !== undefined && typeof candidate.type === 'string'
}

/** Fields a `stat` keeps when a metric record is folded into its own node. */
const STAT_METRIC_FIELDS = ['label', 'value', 'delta', 'spark', 'size'] as const
const LIST_ITEM_ALIASES = { label: 'title', name: 'title', description: 'desc', content: 'desc', text: 'desc', body: 'desc', detail: 'desc' } as const

/**
 * Normalize one metric record of a stat group into a single-metric `stat`
 * node, or null when the entry is not a metric at all.
 */
function statMetricsOf(
  entries: readonly unknown[],
  path: string,
  normalizeChild: (child: unknown, childPath: string) => unknown,
): unknown[] | null {
  if (entries.length === 0) return null
  const metrics: unknown[] = []
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index]
    const metric = record(entry)
    if (metric === undefined) return null
    // An entry that is already a node passes through: the model enumerated
    // its own components instead of bare metrics.
    if (isNode(entry)) {
      metrics.push(normalizeChild(entry, `${path}.items[${index}]`))
      continue
    }
    if (typeof metric.label !== 'string' && typeof metric.value !== 'string') return null
    const stat: Record<string, unknown> = { type: 'stat' }
    for (const field of STAT_METRIC_FIELDS) {
      if (metric[field] !== undefined) stat[field] = metric[field]
    }
    metrics.push(stat)
  }
  return metrics
}

function normalizeAliasFields(value: Record<string, unknown>, path: string, type: string, warnings: GenuiDiagnostic[]): Record<string, unknown> {
  const definition = COMPONENT_SCHEMAS[type]
  if (definition === undefined) return value
  const out: Record<string, unknown> = { ...value }
  for (const [alias, canonical] of Object.entries(definition.aliases)) {
    if (!(alias in out)) continue
    const aliasPath = `${path}.${alias}`
    const keptCanonical = canonical in out
    if (!keptCanonical) out[canonical] = out[alias]
    delete out[alias]
    warnings.push({
      kind: 'alias',
      path: aliasPath,
      message: keptCanonical
        ? `${aliasPath} is ignored because canonical field '${canonical}' is present`
        : `${aliasPath} normalized/adopted as '${canonical}'`,
      type,
      field: alias,
      canonical,
    })
  }
  for (const [field, values] of Object.entries(definition.valueAliases)) {
    const written = out[field]
    if (typeof written !== 'string') continue
    const canonical = values[written]
    if (canonical === undefined || canonical === written) continue
    out[field] = canonical
    warnings.push({
      kind: 'alias',
      path: `${path}.${field}`,
      message: `${path}.${field} '${written}' normalized to '${canonical}'`,
      type,
      field,
      canonical,
    })
  }
  return out
}

/**
 * Apply a nested record schema's field aliases to a record tree: every entry
 * of an array (and every nested record collection below it) is rewritten in
 * place-equivalent copies, so validation, repair, and diagnostics all see the
 * canonical record fields (`keyvalue.pairs[].label → key`,
 * `file-tree.items[].label → name`, issue #186).
 */
function normalizeRecordTree(
  value: unknown,
  definition: ComponentRecordSchema,
  at: string,
  type: string,
  warnings: GenuiDiagnostic[],
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry, index) => normalizeRecordTree(entry, definition, `${at}[${index}]`, type, warnings))
  }
  const holder = record(value)
  if (holder === undefined) return value
  const out = { ...holder }
  for (const [alias, canonical] of Object.entries(definition.aliases)) {
    if (!(alias in out) || canonical in out) continue
    out[canonical] = out[alias]
    delete out[alias]
    warnings.push({
      kind: 'alias',
      path: `${at}.${alias}`,
      message: `${at}.${alias} normalized/adopted as '${canonical}'`,
      type,
      field: alias,
      canonical,
    })
  }
  for (const [field, nested] of Object.entries(definition.nested)) {
    if (out[field] !== undefined) out[field] = normalizeRecordTree(out[field], nested, `${at}.${field}`, type, warnings)
  }
  return out
}

/**
 * file-tree parents without a `type`: a record that carries `children` is a
 * directory in every model-written tree, and the renderer's collapse
 * affordance depends on the marker (issue #186).
 */
function defaultFileTreeDirectories(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(defaultFileTreeDirectories)
  const holder = record(value)
  if (holder === undefined) return value
  const out = { ...holder }
  if (out.type === undefined && Array.isArray(out.children)) out.type = 'dir'
  if (out.children !== undefined) out.children = defaultFileTreeDirectories(out.children)
  return out
}

function normalizeNode(value: unknown, path: string, warnings: GenuiDiagnostic[]): unknown {
  if (!isNode(value)) return value
  const type = value.type as string
  const definition = COMPONENT_SCHEMAS[type]
  // Custom nodes are opaque by contract: don't inspect or rewrite their data.
  if (definition === undefined) return value
  const out = normalizeAliasFields(value, path, type, warnings)
  // Nested data records (keyvalue pairs, file-tree items, …) carry their own
  // field aliases — apply them before validation/repair see the records.
  for (const [field, nested] of Object.entries(definition.nested)) {
    if (out[field] !== undefined) out[field] = normalizeRecordTree(out[field], nested, `${path}.${field}`, type, warnings)
  }
  const normalizeNodeValue = (child: unknown, childPath: string): unknown => normalizeNode(child, childPath, warnings)
  const normalizeNodeArray = (children: unknown, childPath: string): unknown => Array.isArray(children)
    ? children.map((child, index) => normalizeNodeValue(child, `${childPath}[${index}]`))
    : children

  if (type === 'file-tree' && out.items !== undefined) {
    out.items = defaultFileTreeDirectories(out.items)
  }

  if (type === 'stat' && Array.isArray(out.items) && out.label === undefined && out.value === undefined) {
    // Model-side generalization: one `stat` carrying a metric list
    // ({type:'stat',items:[{label,value},…]}) means "these metrics, side by
    // side". Normalize it into a row of single-metric stats, the documented
    // multi-stat idiom (SKILL.md), instead of letting repair drop the node and
    // reject the whole fence (issue #172, case A). A group that also declares
    // `label`/`value` is a single stat with stray fields and stays untouched.
    const metrics = statMetricsOf(out.items, path, normalizeNodeValue)
    if (metrics !== null) {
      warnings.push({
        kind: 'alias',
        path: `${path}.items`,
        message: `${path}.items normalized into a row of 'stat' nodes`,
        type,
        field: 'items',
        canonical: 'row',
      })
      return { type: 'row', items: metrics, ...(out.span !== undefined ? { span: out.span } : {}) }
    }
  }

  if (type === 'row' || type === 'col' || type === 'grid' || type === 'card' || type === 'file-tree' || type === 'timeline' || type === 'breadcrumb') {
    if (type !== 'file-tree' && type !== 'timeline' && type !== 'breadcrumb') out.items = normalizeNodeArray(out.items, `${path}.items`)
  } else if (type === 'list' && Array.isArray(out.items)) {
    // List records and nested nodes share items; aliases only belong to records.
    out.items = out.items.map((child, index) => {
      if (isNode(child)) return normalizeNodeValue(child, `${path}.items[${index}]`)
      if (Array.isArray(child) && child.length === 1 && typeof child[0] === 'string') return child[0]
      const holder = record(child)
      if (holder === undefined) return child
      const normalizedHolder = { ...holder }
      const itemPath = `${path}.items[${index}]`
      for (const [alias, canonical] of Object.entries(LIST_ITEM_ALIASES)) {
        if (!(alias in normalizedHolder)) continue
        const keptCanonical = canonical in normalizedHolder
        if (!keptCanonical) normalizedHolder[canonical] = normalizedHolder[alias]
        delete normalizedHolder[alias]
        warnings.push({
          kind: 'alias', path: `${itemPath}.${alias}`, type, field: alias, canonical,
          message: keptCanonical
            ? `${itemPath}.${alias} is ignored because canonical field '${canonical}' is present`
            : `${itemPath}.${alias} normalized/adopted as '${canonical}'`,
        })
      }
      if (!('title' in normalizedHolder) && typeof normalizedHolder.desc === 'string') {
        normalizedHolder.title = normalizedHolder.desc
        delete normalizedHolder.desc
        warnings.push({ kind: 'alias', path: `${itemPath}.desc`, type, field: 'desc', canonical: 'title', message: `${itemPath}.desc normalized/adopted as 'title'` })
      }
      return normalizedHolder
    })
  } else if (type === 'keyvalue' && Array.isArray(out.pairs)) {
    // Pair-as-array (`[[key, value], …]` or `[[key], …]`) is what a model
    // writes when it treats keyvalue as a 2-column list. Canonicalize before
    // validation: the record validator rejects every array entry ("must be an
    // object"), and those errors take the whole fence down even though repair
    // could read the data.
    if (out.pairs.length > 0 && out.pairs.every(pair => Array.isArray(pair))) {
      out.pairs = out.pairs.map(pair => {
        const cells = pair as unknown[]
        return { key: cells[0], value: cells.length > 1 ? cells[1] : '' }
      })
    }
  } else if (type === 'tabs' && Array.isArray(out.tabs)) {
    out.tabs = out.tabs.map((tab, index) => {
      const holder = record(tab)
      if (holder === undefined) return tab
      const normalizedHolder = { ...holder }
      if ('content' in normalizedHolder) {
        const tabPath = `${path}.tabs[${index}].content`
        const hasItems = 'items' in normalizedHolder
        if (!hasItems) normalizedHolder.items = normalizedHolder.content
        delete normalizedHolder.content
        warnings.push({
          kind: 'alias',
          path: tabPath,
          message: hasItems
            ? `${tabPath} is ignored because canonical field 'items' is present`
            : `${tabPath} normalized/adopted as 'items'`,
          type,
          field: 'content',
          canonical: 'items',
        })
      }
      normalizedHolder.items = Array.isArray(normalizedHolder.items)
        ? normalizedHolder.items.map((child, childIndex) => normalizeNodeValue(child, `${path}.tabs[${index}].items[${childIndex}]`))
        : normalizedHolder.items === undefined
          ? []
          : [normalizeNodeValue(normalizedHolder.items, `${path}.tabs[${index}].items[0]`)]
      return normalizedHolder
    })
  } else if (type === 'accordion' && Array.isArray(out.items)) {
    out.items = out.items.map((item, index) => {
      const holder = record(item)
      if (holder === undefined) return item
      return { ...holder, items: Array.isArray(holder.items) ? holder.items.map((child, childIndex) => normalizeNodeValue(child, `${path}.items[${index}].items[${childIndex}]`)) : holder.items }
    })
  } else if (type === 'table' && Array.isArray(out.details)) {
    const table = { columns: out.columns, rows: out.rows, types: out.types }
    out.details = out.details.map((detail, rowIndex) => {
      if (!Array.isArray(detail) || !isTableDetailReachable(table, rowIndex)) return detail
      return detail.map((child, childIndex) => normalizeNodeValue(child, `${path}.details[${rowIndex}][${childIndex}]`))
    })
  }
  return out
}

/**
 * Normalize a raw GenUI value into canonical field names.
 *
 * Only deterministic aliases and structural aliases are changed. Resource
 * limits, type repair, security filtering, and semantic validation remain in
 * the guard layer. Unknown component types are returned opaque.
 *
 * @param value - Raw GenUI spec or bare native component.
 * @returns Canonical value and stable alias diagnostics.
 */
export function normalizeGenuiSpec(value: unknown): { value: unknown; warnings: GenuiDiagnostic[] } {
  const warnings: GenuiDiagnostic[] = []
  if (typeof value === 'string') {
    // Double-encoded body (issue #186): the model escaped the whole spec into
    // a JSON string. Decode exactly once — anything deeper is quoted prose,
    // not a spec, and stays unrenderable.
    try {
      const decoded: unknown = JSON.parse(value)
      if (record(decoded) !== undefined || Array.isArray(decoded)) {
        value = decoded
        warnings.push({
          kind: 'alias',
          path: 'spec',
          message: 'double-encoded JSON string unwrapped into a spec value',
        })
      }
    } catch {
      // Not JSON text: leave as-is; repair rejects the root as usual.
    }
  }
  if (Array.isArray(value) && value.length > 0) {
    // A root-level component list is the envelope minus its braces (issue
    // #186): adopt it as `items` instead of rejecting the whole fence. An
    // empty list has nothing to render and stays an invalid root.
    value = { items: value }
    warnings.push({
      kind: 'alias',
      path: 'items',
      message: 'root array normalized into an items envelope',
    })
  }
  const root = record(value)
  if (root === undefined) return { value, warnings }
  const out = { ...root }
  // A bare component root is normalized as a node, not as an envelope whose
  // `items` are its children: for a data component (steps/list/timeline/…)
  // `items` is the record list and its aliases must still apply (issue #172).
  if (isComponentRoot(out)) {
    return { value: normalizeNode(out, 'spec', warnings), warnings }
  }
  if (Array.isArray(out.items)) {
    out.items = out.items.map((item, index) => normalizeNode(item, `items[${index}]`, warnings))
  }
  return { value: out, warnings }
}
