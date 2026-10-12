/** GenUI runtime diagnostics for aliases and unknown fields. */
import { COMPONENT_SCHEMAS, GENUI_SPEC_SCHEMA } from './schema.ts'
import { isComponentRoot } from '../spec.ts'
import type { ComponentRecordSchema, ComponentSchema } from './schema.ts'
import { isTableDetailReachable } from '../table-details.ts'

export interface GenuiDiagnostic {
  readonly kind: 'alias' | 'unknown-field'
  readonly path: string
  readonly message: string
  readonly type?: string
  readonly field?: string
  readonly canonical?: string
}


function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function isNode(value: unknown): value is Record<string, unknown> {
  const candidate = record(value)
  return candidate !== undefined && typeof candidate.type === 'string'
}

function visitNativeNodes(value: unknown, path: string, visit: (node: Record<string, unknown>, path: string, schema: ComponentSchema) => void): void {
  if (!isNode(value)) return
  const type = value.type as string
  const definition = COMPONENT_SCHEMAS[type]
  if (definition === undefined) return
  visit(value, path, definition)
  const children = (child: unknown, childPath: string): void => visitNativeNodes(child, childPath, visit)
  if ((type === 'row' || type === 'col' || type === 'grid' || type === 'card') && Array.isArray(value.items)) {
    value.items.forEach((child, index) => children(child, `${path}.items[${index}]`))
  } else if (type === 'list' && Array.isArray(value.items)) {
    value.items.forEach((child, index) => children(child, `${path}.items[${index}]`))
  } else if (type === 'tabs' && Array.isArray(value.tabs)) {
    value.tabs.forEach((tab, index) => {
      const holder = record(tab)
      if (holder === undefined) return
      if (Array.isArray(holder.items)) holder.items.forEach((child, childIndex) => children(child, `${path}.tabs[${index}].items[${childIndex}]`))
      else children(holder.items, `${path}.tabs[${index}].items`)
    })
  } else if (type === 'accordion' && Array.isArray(value.items)) {
    value.items.forEach((item, index) => {
      const holder = record(item)
      if (holder?.items !== undefined && Array.isArray(holder.items)) holder.items.forEach((child, childIndex) => children(child, `${path}.items[${index}].items[${childIndex}]`))
    })
  } else if (type === 'table' && Array.isArray(value.details)) {
    const table = { columns: value.columns, rows: value.rows, types: value.types }
    value.details.forEach((detail, rowIndex) => {
      if (Array.isArray(detail) && isTableDetailReachable(table, rowIndex)) {
        detail.forEach((child, childIndex) => children(child, `${path}.details[${rowIndex}][${childIndex}]`))
      }
    })
  }
}

function pushUnknownField(
  warnings: GenuiDiagnostic[],
  path: string,
  field: string,
  type: string,
): void {
  warnings.push({
    kind: 'unknown-field',
    path: `${path}.${field}`,
    message: `${path}.${field}: unknown field for '${type}'`,
    type,
    field,
  })
}

function diagnoseRecordFields(
  value: unknown,
  path: string,
  definition: ComponentRecordSchema,
  type: string,
  warnings: GenuiDiagnostic[],
): void {
  const holder = record(value)
  if (holder === undefined) return
  for (const field of Object.keys(holder)) {
    if (field in definition.fields) continue
    pushUnknownField(warnings, path, field, type)
  }
  for (const [field, nested] of Object.entries(definition.nested)) {
    const nestedValue = holder[field]
    if (Array.isArray(nestedValue)) {
      nestedValue.forEach((item, index) => diagnoseRecordFields(item, `${path}.${field}[${index}]`, nested, type, warnings))
    } else if (nestedValue !== undefined) {
      diagnoseRecordFields(nestedValue, `${path}.${field}`, nested, type, warnings)
    }
  }
}

function diagnoseNestedFields(
  node: Record<string, unknown>,
  path: string,
  definition: ComponentSchema,
  warnings: GenuiDiagnostic[],
): void {
  for (const [field, nested] of Object.entries(definition.nested)) {
    const nestedValue = node[field]
    if (Array.isArray(nestedValue)) {
      nestedValue.forEach((item, index) => diagnoseRecordFields(item, `${path}.${field}[${index}]`, nested, node.type as string, warnings))
    } else if (nestedValue !== undefined) {
      diagnoseRecordFields(nestedValue, `${path}.${field}`, nested, node.type as string, warnings)
    }
  }
}

/**
 * Diagnose unknown direct fields on native nodes.
 *
 * Unknown types are intentionally skipped so custom renderers retain their
 * opaque extension payloads. Native unknown fields are warnings, not errors.
 *
 * @param value - Canonical or raw GenUI value.
 * @returns Stable field diagnostics in tree order.
 */
export function diagnoseUnknownGenuiFields(value: unknown): GenuiDiagnostic[] {
  const warnings: GenuiDiagnostic[] = []
  const root = record(value)
  if (root === undefined) return warnings
  const visit = (node: Record<string, unknown>, path: string, definition: ComponentSchema): void => {
    for (const field of Object.keys(node)) {
      if (field === 'type' || field in definition.fields) continue
      pushUnknownField(warnings, path, field, node.type as string)
    }
    diagnoseNestedFields(node, path, definition, warnings)
    if (node.type === 'list' && Array.isArray(node.items)) {
      node.items.forEach((item, index) => {
        if (isNode(item)) return
        const holder = record(item)
        if (holder === undefined) return
        for (const field of Object.keys(holder)) {
          if (field === 'title' || field === 'desc') continue
          const itemPath = `${path}.items[${index}]`
          warnings.push({ kind: 'unknown-field', path: `${itemPath}.${field}`, message: `${itemPath}.${field}: list items render 'title' and 'desc' only — '${field}' is dropped`, type: 'list', field })
        }
      })
    }
  }
  if (Array.isArray(root.items) && !isComponentRoot(root)) {
    for (const field of Object.keys(root)) {
      if (field in GENUI_SPEC_SCHEMA.fields) continue
      pushUnknownField(warnings, 'spec', field, 'spec')
    }
    root.items.forEach((item, index) => visitNativeNodes(item, `items[${index}]`, visit))
  } else if (typeof root.type === 'string') {
    // A bare component root is a documented shorthand, so its `type` belongs
    // to the native node schema rather than the root specification schema —
    // including data components whose `items` is their record list (#172).
    visitNativeNodes(root, 'spec', visit)
  } else {
    for (const field of Object.keys(root)) {
      if (field in GENUI_SPEC_SCHEMA.fields) continue
      pushUnknownField(warnings, 'spec', field, 'spec')
    }
  }
  return warnings
}
