/** Runtime metadata shared by GenUI normalization and diagnostics. */

export type ComponentFieldKind =
  | 'string'
  | 'string-or-null'
  | 'number'
  | 'boolean'
  | 'nodes'
  | 'array'
  | 'object'
  | 'unknown'

/** A conditional rule for fields whose presence depends on another field. */
export interface ComponentConditionalRule {
  readonly kind: 'required-if'
  readonly when: { readonly field: string; readonly equals: unknown }
  readonly required: readonly string[]
  readonly message?: string
}

/** A field rule that requires at least one member of a field group. */
export interface ComponentOneOfRule {
  readonly kind: 'one-of-required'
  readonly fields: readonly string[]
  readonly message?: string
}

/** Runtime metadata naming a component-specific semantic validator. */
export interface ComponentValidatorMetadata {
  readonly name: string
  readonly [key: string]: unknown
}

/** Runtime schema for an object nested inside a native component field. */
export interface ComponentRecordSchema {
  readonly required: readonly string[]
  readonly fields: Readonly<Record<string, ComponentFieldKind>>
  readonly enums: Readonly<Record<string, readonly string[]>>
  readonly nested: Readonly<Record<string, ComponentRecordSchema>>
  /** Field-name aliases applied to each record before validation/repair. */
  readonly aliases: Readonly<Record<string, string>>
}

export interface ComponentSchema {
  readonly required: readonly string[]
  readonly fields: Readonly<Record<string, ComponentFieldKind>>
  readonly enums: Readonly<Record<string, readonly string[]>>
  /** Explicit optional field kinds; `fields` remains the complete field map. */
  readonly optional: Readonly<Record<string, ComponentFieldKind>>
  readonly aliases: Readonly<Record<string, string>>
  /** Written enum values deterministically mapped to canonical ones (field → value → canonical). */
  readonly valueAliases: Readonly<Record<string, Readonly<Record<string, string>>>>
  readonly oneOfRequired: readonly (readonly string[])[]
  readonly conditionalRequired: readonly ComponentConditionalRule[]
  readonly rules: readonly (ComponentOneOfRule | ComponentConditionalRule)[]
  readonly nested: Readonly<Record<string, ComponentRecordSchema>>
  readonly validator?: ComponentValidatorMetadata
}


/** Canonical enum domains shared by schema validation and repair. */
export const TEXT_SIZES = ['h1', 'h2', 'h3', 'body', 'muted', 'caption'] as const
export const BUTTON_TONES = ['primary', 'danger', 'success', 'ghost'] as const
export const BADGE_TONES = ['success', 'warn', 'danger', 'accent'] as const
export const INPUT_TYPES = ['text', 'email', 'password', 'color'] as const
export const CALLOUT_TONES = ['info', 'success', 'warning', 'error'] as const
export const CHART_KINDS = ['bars', 'line', 'donut'] as const
export const PLOT_KINDS = ['line', 'area', 'scatter'] as const
export const MEDIA_ASPECT_RATIOS = ['16:9', '4:3', '1:1', '9:16'] as const
export const MESH_SHAPES = ['box', 'sphere', 'cone', 'cylinder', 'torus'] as const
export const FILE_TYPES = ['file', 'dir'] as const
export const DIAGRAM_KINDS = [
  'architecture', 'it-state', 'flowchart', 'sequence', 'state', 'er', 'timeline',
  'swimlane', 'quadrant', 'radar', 'loop', 'nested', 'tree', 'org-chart', 'layers',
  'venn', 'pyramid', 'bar', 'line', 'gantt', 'scatter', 'high-level', 'process',
  'medallion', 'data-flow', 'dp-integration', 'dp-security-matrix',
] as const
export const DIAGRAM_NODE_TYPES = ['focal', 'backend', 'store', 'external', 'input', 'optional', 'security'] as const
export const DIAGRAM_VARIANTS = ['light', 'dark', 'editorial'] as const
export const DIAGRAM_EDGE_KINDS = ['solid', 'dashed', 'accent', 'link'] as const
export const DIAGRAM_ROUTES = ['auto', 'orthogonal', 'straight'] as const
export const ECHART_PRESETS = [
  'bar', 'line', 'area', 'pie', 'scatter',
  'radar', 'gauge', 'funnel', 'treemap', 'sankey', 'graph', 'heatmap', 'bigline', 'wordCloud',
] as const
/** Oversized single-number stat (one per fence as the visual anchor). */
export const STAT_SIZES = ['hero'] as const
/** Progress shapes: a track (default) or a circular gauge. */
export const PROGRESS_VARIANTS = ['bar', 'ring'] as const
/** Semantic card surfaces. */
export const CARD_TONES = ['info', 'success', 'warning', 'danger'] as const
/** Hero cover tones. */
export const HERO_TONES = ['accent', 'success', 'warning', 'danger'] as const
/** Table cell renderers (`table.types`, one entry per column). */
export const TABLE_CELL_TYPES = ['text', 'num', 'delta', 'bar', 'badge', 'spark', 'ring', 'index', 'group'] as const

const schema = (
  required: readonly string[],
  fields: Readonly<Record<string, ComponentFieldKind>>,
  aliases: Readonly<Record<string, string>> = {},
  options: {
    oneOfRequired?: readonly (readonly string[])[]
    conditionalRequired?: readonly ComponentConditionalRule[]
    nested?: Readonly<Record<string, ComponentRecordSchema>>
    enums?: Readonly<Record<string, readonly string[]>>
    valueAliases?: Readonly<Record<string, Readonly<Record<string, string>>>>
    validator?: ComponentValidatorMetadata
  } = {},
): ComponentSchema => {
  const optional = Object.fromEntries(
    Object.entries(fields).filter(([field]) => field !== 'type' && !required.includes(field)),
  ) as Record<string, ComponentFieldKind>
  const oneOfRequired = options.oneOfRequired ?? []
  const conditionalRequired = options.conditionalRequired ?? []
  const rules: Array<ComponentOneOfRule | ComponentConditionalRule> = [
    ...oneOfRequired.map(fieldsInRule => ({ kind: 'one-of-required' as const, fields: fieldsInRule })),
    ...conditionalRequired,
  ]
  return {
    required,
    fields,
    optional,
    aliases,
    valueAliases: options.valueAliases ?? {},
    oneOfRequired,
    conditionalRequired,
    rules,
    enums: options.enums ?? {},
    nested: options.nested ?? {},
    ...(options.validator === undefined ? {} : { validator: options.validator }),
  }
}

const recordSchema = (
  required: readonly string[],
  fields: Readonly<Record<string, ComponentFieldKind>>,
  nested: Readonly<Record<string, ComponentRecordSchema>> = {},
  enums: Readonly<Record<string, readonly string[]>> = {},
  aliases: Readonly<Record<string, string>> = {},
): ComponentRecordSchema => ({ required, fields, enums, nested, aliases })

const nodeFields = { type: 'string', span: 'number', id: 'string' } as const

const chartDatumSchema = recordSchema(['label', 'value'], {
  label: 'string',
  value: 'number',
  color: 'string',
})

const chartSeriesSchema = recordSchema(['label', 'data'], {
  label: 'string',
  color: 'string',
  data: 'array',
}, { data: chartDatumSchema })

const stepsRecordSchema = recordSchema(['title'], { title: 'string', desc: 'string' })
// `label` is what models write for the left-hand column (issue #186); the
// record otherwise fails "requires key" and the whole keyvalue drops.
const keyValueRecordSchema = recordSchema(['key', 'value'], { key: 'string', value: 'string' }, {}, {}, { label: 'key' })
const timelineRecordSchema = recordSchema(['title'], { title: 'string', desc: 'string', time: 'string' })
const diffRecordSchema = recordSchema(['path', 'newText'], { path: 'string', oldText: 'string-or-null', newText: 'string' })
const plotParamSchema = recordSchema(['name', 'value'], {
  name: 'string', value: 'number', min: 'number', max: 'number', step: 'number', animateTo: 'number', durationMs: 'number', loop: 'boolean',
})
const plotSeriesSchema = recordSchema(['expr'], {
  expr: 'string', label: 'string', color: 'string', kind: 'string', params: 'array',
}, { params: plotParamSchema }, { kind: PLOT_KINDS })
const sceneMeshSchema = recordSchema(['shape'], {
  shape: 'string', color: 'string', position: 'array', rotation: 'array', scale: 'unknown', size: 'unknown',
}, {}, { shape: MESH_SHAPES })

function fileTreeRecordSchema(depth: number): ComponentRecordSchema {
  return recordSchema(
    ['name'],
    { name: 'string', type: 'string', children: 'array' },
    depth > 0 ? { children: fileTreeRecordSchema(depth - 1) } : {},
    { type: FILE_TYPES },
    // Tree records read like outline items to models: they reach for `label`
    // (and `desc`) instead of `name` (issue #186).
    { label: 'name' },
  )
}

const fileTreeNodeSchema = fileTreeRecordSchema(6)

const tabHolderSchema = recordSchema(['label', 'items'], {
  label: 'string',
  items: 'nodes',
  content: 'nodes',
})

const accordionHolderSchema = recordSchema(['title', 'items'], {
  title: 'string',
  items: 'nodes',
})

const diagramNodeSchema = recordSchema(['id', 'label'], {
  id: 'string',
  label: 'string',
  sub: 'string',
  type: 'string',
  x: 'number',
  y: 'number',
  w: 'number',
  h: 'number',
  tag: 'string',
}, {}, { type: DIAGRAM_NODE_TYPES })

const diagramEdgeSchema = recordSchema(['from', 'to'], {
  from: 'string',
  to: 'string',
  label: 'string',
  kind: 'string',
  route: 'string',
}, {}, { kind: DIAGRAM_EDGE_KINDS, route: DIAGRAM_ROUTES })

const diagramZoneSchema = recordSchema(['label'], {
  label: 'string',
  x: 'number',
  y: 'number',
  w: 'number',
  h: 'number',
})

const diagramThemeSchema = recordSchema([], {
  paper: 'string',
  'paper-2': 'string',
  ink: 'string',
  muted: 'string',
  soft: 'string',
  rule: 'string',
  accent: 'string',
  'accent-tint': 'string',
  link: 'string',
})

/** Root GenUI specification metadata used by diagnostics. */
export const GENUI_SPEC_SCHEMA = schema(['items'], {
  title: 'string',
  gap: 'number',
  panel: 'boolean',
  append: 'boolean',
  items: 'nodes',
})

/** Backwards-friendly short alias for the root specification schema. */
export const SPEC_SCHEMA = GENUI_SPEC_SCHEMA

/**
 * Native component field metadata.
 *
 * This is intentionally explicit rather than inferred from TypeScript
 * interfaces: the registry is also consumed at runtime by normalization and
 * diagnostics, where erased interfaces are unavailable.
 */
export const COMPONENT_SCHEMAS: Readonly<Record<string, ComponentSchema>> = {
  accordion: schema(['items'], { ...nodeFields, items: 'array' }, {}, { nested: { items: accordionHolderSchema } }),
  audio: schema(['src'], { ...nodeFields, src: 'string', alt: 'string', loop: 'boolean' }, { url: 'src', link: 'src' }),
  avatar: schema(['name'], { ...nodeFields, name: 'string', color: 'string' }),
  badge: schema(['label'], { ...nodeFields, label: 'string', tone: 'string', icon: 'string' }, { text: 'label', value: 'label' }, { enums: { tone: BADGE_TONES } }),
  breadcrumb: schema(['items'], { ...nodeFields, items: 'array' }),
  button: schema(['label'], { ...nodeFields, label: 'string', tone: 'string', full: 'boolean', small: 'boolean', icon: 'string', action: 'string' }, {}, { enums: { tone: BUTTON_TONES } }),
  // `text`/`body`/`desc` are the model's default names for "the callout's
  // prose": a callout missing `content` is dropped by repair, which takes the
  // WHOLE fence down with it (issue: dsh-ui 围栏字段名). Adopt them as aliases.
  // `tone` value aliases: card/hero/badge/button all accept `danger` (and
  // badge uses `warn`), so models cross-write them onto callout — map them
  // onto the closest canonical tone instead of failing the enum (issue #186).
  callout: schema(['content'], { ...nodeFields, title: 'string', content: 'string', tone: 'string' }, { kind: 'tone', text: 'content', body: 'content', desc: 'content' }, { enums: { tone: CALLOUT_TONES }, valueAliases: { tone: { danger: 'error', warn: 'warning' } } }),
  card: schema(['items'], { ...nodeFields, title: 'string', items: 'nodes', tone: 'string', accent: 'string' }, { label: 'title', content: 'items' }, { enums: { tone: CARD_TONES } }),
  chart: schema([], {
    ...nodeFields,
    kind: 'string',
    data: 'array',
    series: 'array',
    horizontal: 'boolean',
    stacked: 'boolean',
    filter: 'string',
    palette: 'array',
  }, {}, {
    oneOfRequired: [['data', 'series']],
    // `line` may carry its points in `series` (multi-series line); only the
    // donut is a single-series shape that always needs `data`.
    conditionalRequired: [
      { kind: 'required-if', when: { field: 'kind', equals: 'donut' }, required: ['data'] },
    ],
    nested: { data: chartDatumSchema, series: chartSeriesSchema },
    enums: { kind: CHART_KINDS },
    validator: { name: 'chart-renderability' },
  }),
  checkbox: schema(['label'], { ...nodeFields, label: 'string', checked: 'boolean', action: 'string', group: 'string' }),
  code: schema(['code'], { ...nodeFields, lang: 'string', code: 'string', title: 'string', wrap: 'boolean' }, { content: 'code', text: 'code' }),
  col: schema(['items'], { ...nodeFields, items: 'nodes', gap: 'number' }),
  copy: schema(['text'], { ...nodeFields, label: 'string', text: 'string' }, { content: 'text', code: 'text', value: 'text' }),
  diagram: schema(['kind', 'nodes'], { ...nodeFields, kind: 'string', variant: 'string', title: 'string', nodes: 'array', edges: 'array', zones: 'array', theme: 'object' }, {}, {
    nested: { nodes: diagramNodeSchema, edges: diagramEdgeSchema, zones: diagramZoneSchema, theme: diagramThemeSchema },
    enums: { kind: DIAGRAM_KINDS, variant: DIAGRAM_VARIANTS },
  }),
  // `items` is the container field name every other component uses, so models
  // reach for it here too; without the alias the whole node (and fence) drops.
  diff: schema(['diffs'], { ...nodeFields, diffs: 'array' }, { items: 'diffs', files: 'diffs' }, { nested: { diffs: diffRecordSchema } }),
  divider: schema([], nodeFields),
  echart: schema([], { ...nodeFields, title: 'string', height: 'number', preset: 'string', data: 'array', series: 'array', links: 'array', palette: 'array', option: 'object' }, {}, {
    // `links` alone is valid: the sankey/graph presets are edge-driven.
    oneOfRequired: [['option', 'data', 'series', 'links']],
    enums: { preset: ECHART_PRESETS },
  }),
  'file-tree': schema(['items'], { ...nodeFields, items: 'array' }, { nodes: 'items' }, { nested: { items: fileTreeNodeSchema } }),
  grid: schema(['items'], { ...nodeFields, cols: 'number', items: 'nodes' }),
  image: schema(['src'], { ...nodeFields, src: 'string', alt: 'string' }, { url: 'src', link: 'src' }),
  input: schema([], { ...nodeFields, label: 'string', placeholder: 'string', value: 'string', inputType: 'string', action: 'string', id: 'string' }, {}, { enums: { inputType: INPUT_TYPES } }),
  json: schema(['value'], { ...nodeFields, value: 'unknown' }),
  keyvalue: schema(['pairs'], { ...nodeFields, pairs: 'array' }, { items: 'pairs', rows: 'pairs', entries: 'pairs' }, { nested: { pairs: keyValueRecordSchema } }),
  link: schema(['label'], { ...nodeFields, label: 'string', href: 'string' }),
  list: schema(['items'], { ...nodeFields, items: 'array', filter: 'string' }),
  mermaid: schema(['code'], { ...nodeFields, code: 'string' }),
  svg: schema(['code'], { ...nodeFields, code: 'string', title: 'string', height: 'number' }),
  plot: schema(['series'], { ...nodeFields, series: 'array', xMin: 'number', xMax: 'number', yMin: 'number', yMax: 'number', title: 'string' }, {}, { nested: { series: plotSeriesSchema } }),
  progress: schema(['value'], { ...nodeFields, value: 'number', label: 'string', valueLabel: 'string', variant: 'string', target: 'number' }, {}, { enums: { variant: PROGRESS_VARIANTS } }),
  // `items` joins the §175 aliases: it is the field name models reach for when
  // they enumerate a component's choices, and without it the node (and with it
  // the whole fence) is dropped.
  quiz: schema(['question', 'options'], { ...nodeFields, question: 'string', options: 'array', explanation: 'string', id: 'string', action: 'string' }, { title: 'question', text: 'question', choices: 'options', items: 'options' }),
  radio: schema(['options'], { ...nodeFields, label: 'string', options: 'array', selected: 'number', action: 'string', group: 'string', answer: 'unknown', explanation: 'string' }, { items: 'options' }),
  row: schema(['items'], { ...nodeFields, items: 'nodes', wrap: 'boolean', spacer: 'boolean' }),
  scene3d: schema(['meshes'], { ...nodeFields, title: 'string', meshes: 'array', ambient: 'number', background: 'string' }, {}, { nested: { meshes: sceneMeshSchema } }),
  select: schema(['options'], { ...nodeFields, label: 'string', options: 'array', action: 'string', selected: 'number', id: 'string' }, { items: 'options' }),
  slider: schema([], { ...nodeFields, label: 'string', min: 'number', max: 'number', step: 'number', value: 'number', action: 'string', id: 'string' }),
  spacer: schema([], nodeFields),
  hero: schema(['title'], {
    ...nodeFields,
    title: 'string',
    subtitle: 'string',
    value: 'string',
    label: 'string',
    delta: 'string',
    spark: 'array',
    tone: 'string',
  }, {}, { enums: { tone: HERO_TONES } }),
  stat: schema(['label', 'value'], { ...nodeFields, label: 'string', value: 'string', delta: 'string', spark: 'array', size: 'string' }, {}, { enums: { size: STAT_SIZES } }),
  steps: schema(['steps'], { ...nodeFields, steps: 'array', current: 'number' }, { items: 'steps' }, { nested: { steps: stepsRecordSchema } }),
  submit: schema(['label'], { ...nodeFields, label: 'string', action: 'string', resetAction: 'string', groups: 'array' }),
  switch: schema(['label'], { ...nodeFields, label: 'string', checked: 'boolean', action: 'string' }),
  table: schema(['columns', 'rows'], { ...nodeFields, columns: 'array', rows: 'array', types: 'array', total: 'boolean', details: 'array', filter: 'string', filterColumn: 'number', sortField: 'string', export: 'boolean' }, { headers: 'columns', data: 'rows', items: 'rows' }),
  tabs: schema(['tabs'], { ...nodeFields, tabs: 'array' }, {}, { nested: { tabs: tabHolderSchema } }),
  text: schema(['content'], { ...nodeFields, content: 'string', size: 'string', center: 'boolean', copyable: 'boolean', title: 'string' }, { text: 'content' }, { enums: { size: TEXT_SIZES } }),
  textarea: schema([], { ...nodeFields, label: 'string', placeholder: 'string', rows: 'number', value: 'string', action: 'string', id: 'string' }),
  timeline: schema(['items'], { ...nodeFields, items: 'array' }, {}, { nested: { items: timelineRecordSchema } }),
  video: schema(['src'], { ...nodeFields, src: 'string', alt: 'string', poster: 'string', loop: 'boolean', muted: 'boolean', aspectRatio: 'string' }, { url: 'src', link: 'src' }, { enums: { aspectRatio: MEDIA_ASPECT_RATIOS } }),
} as const

export const GENUI_NATIVE_TYPES: ReadonlySet<string> = new Set(Object.keys(COMPONENT_SCHEMAS))
