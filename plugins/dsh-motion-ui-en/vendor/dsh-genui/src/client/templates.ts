/**
 * templates.ts — template center data.
 *
 * Each template = a natural-language `instruction` (inserted into the
 * composer on "try it", so the model generates the matching interface via the
 * genui skill) + a VALID `demo` spec (rendered directly by GenuiBlock in the
 * preview, so the user sees the result before deciding). Fields track the
 * real schema in spec.ts / guard.ts (tests/templates.spec.ts validates each
 * one with validateGenuiSpec).
 *
 * Templates double as documentation: they cover layout, data, charts,
 * interaction, quizzes and the advanced families.
 *
 * All display text resolves through the i18n dictionaries, so the list is
 * built PER CALL from the active locale rather than frozen at module load.
 */
import type { GenuiSpec } from './spec.ts'
import { t } from './i18n/index.ts'

/** Stable, locale-independent category ids. */
export const TEMPLATE_CATEGORIES = [
  'dashboard', 'data', 'flow', 'chart', 'interactive', 'quiz', 'advanced',
] as const

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]

/** Dictionary key carrying a category's display name. */
export function categoryLabelKey(category: TemplateCategory | 'all'): string {
  return `tpl.category.${category}`
}

export interface GenuiTemplate {
  id: string
  /** Stable id; the display name comes from {@link categoryLabelKey}. */
  category: TemplateCategory
  name: string
  description: string
  /** Natural-language instruction inserted into the composer on "try it". */
  instruction: string
  /** Valid preview spec (≤200 nodes, ≤8 levels deep). */
  demo: GenuiSpec
}

/**
 * Build the template list in the ACTIVE locale.
 *
 * A function rather than a constant: the user can switch language at runtime,
 * and a module-level array would pin whatever locale happened to be active
 * when the bundle first loaded.
 */
export function genuiTemplates(): readonly GenuiTemplate[] {
  return [
    {
      id: 'tpl-dashboard',
      category: 'dashboard',
      name: t('tpl.dashboard.name'),
      description: t('tpl.dashboard.desc'),
      instruction: t('tpl.dashboard.instruction'),
      demo: {
        title: t('tpl.dashboard.demo.title'),
        gap: 12,
        items: [
          { type: 'card', title: t('tpl.dashboard.demo.metrics'), items: [
            { type: 'grid', cols: 2, items: [
              { type: 'stat', label: t('tpl.dashboard.demo.done'), value: '12 / 18', delta: '+4' },
              { type: 'stat', label: t('tpl.dashboard.demo.blocked'), value: '2', delta: '-1' },
              { type: 'stat', label: t('tpl.dashboard.demo.duration'), value: '3.2h', delta: '-8%' },
              { type: 'stat', label: t('tpl.dashboard.demo.coverage'), value: '86%' },
            ] },
          ] },
          { type: 'card', title: t('tpl.dashboard.demo.progress'), items: [
            { type: 'progress', label: t('tpl.dashboard.demo.milestone'), value: 68, valueLabel: '68 / 100' },
          ] },
          { type: 'card', title: t('tpl.dashboard.demo.todo'), items: [
            { type: 'list', items: [
              t('tpl.dashboard.demo.todo1'),
              t('tpl.dashboard.demo.todo2'),
              t('tpl.dashboard.demo.todo3'),
            ] },
          ] },
        ],
      },
    },
    {
      id: 'tpl-compare',
      category: 'data',
      name: t('tpl.compare.name'),
      description: t('tpl.compare.desc'),
      instruction: t('tpl.compare.instruction'),
      demo: {
        title: t('tpl.compare.demo.title'),
        items: [
          { type: 'callout', tone: 'info', title: t('tpl.compare.demo.conclusion'), content: t('tpl.compare.demo.body') },
          { type: 'table', columns: [
            t('tpl.compare.demo.dimension'),
            t('tpl.compare.demo.optionA'),
            t('tpl.compare.demo.optionB'),
            t('tpl.compare.demo.optionC'),
          ], rows: [
            [t('tpl.compare.demo.cost'), t('tpl.compare.demo.high'), t('tpl.compare.demo.medium'), t('tpl.compare.demo.low')],
            [t('tpl.compare.demo.complexity'), t('tpl.compare.demo.high'), t('tpl.compare.demo.medium'), t('tpl.compare.demo.low')],
            [t('tpl.compare.demo.risk'), t('tpl.compare.demo.low'), t('tpl.compare.demo.low'), t('tpl.compare.demo.high')],
            [t('tpl.compare.demo.payoff'), t('tpl.compare.demo.large'), t('tpl.compare.demo.medium'), t('tpl.compare.demo.small')],
          ] },
        ],
      },
    },
    {
      id: 'tpl-steps',
      category: 'flow',
      name: t('tpl.steps.name'),
      description: t('tpl.steps.desc'),
      instruction: t('tpl.steps.instruction'),
      demo: {
        title: t('tpl.steps.demo.title'),
        items: [
          { type: 'badge', label: t('tpl.steps.demo.badge'), tone: 'accent' },
          { type: 'steps', current: 2, steps: [
            { title: t('tpl.steps.demo.s1'), desc: t('tpl.steps.demo.s1desc') },
            { title: t('tpl.steps.demo.s2'), desc: t('tpl.steps.demo.s2desc') },
            { title: t('tpl.steps.demo.s3'), desc: t('tpl.steps.demo.s3desc') },
            { title: t('tpl.steps.demo.s4'), desc: t('tpl.steps.demo.s4desc') },
            { title: t('tpl.steps.demo.s5'), desc: t('tpl.steps.demo.s5desc') },
          ] },
        ],
      },
    },
    {
      id: 'tpl-quiz',
      category: 'quiz',
      name: t('tpl.quiz.name'),
      description: t('tpl.quiz.desc'),
      instruction: t('tpl.quiz.instruction'),
      demo: {
        title: t('tpl.quiz.demo.title'),
        gap: 10,
        items: [
          { type: 'text', content: t('tpl.quiz.demo.hint'), size: 'muted' },
          { type: 'quiz', id: 'q-dsh', question: t('tpl.quiz.demo.q1'), options: [
            { label: t('tpl.quiz.demo.q1a') },
            { label: t('tpl.quiz.demo.q1b'), correct: true, feedback: t('tpl.quiz.demo.q1bfx') },
            { label: t('tpl.quiz.demo.q1c') },
          ], explanation: t('tpl.quiz.demo.q1exp') },
          { type: 'quiz', id: 'q-fence', question: t('tpl.quiz.demo.q2'), options: [
            { label: t('tpl.quiz.demo.q2a') },
            { label: t('tpl.quiz.demo.q2b'), correct: true, feedback: t('tpl.quiz.demo.q2bfx') },
            { label: t('tpl.quiz.demo.q2c') },
          ], explanation: t('tpl.quiz.demo.q2exp') },
          { type: 'quiz', id: 'q-panel', question: t('tpl.quiz.demo.q3'), options: [
            { label: t('tpl.quiz.demo.q3a') },
            { label: t('tpl.quiz.demo.q3b'), correct: true, feedback: t('tpl.quiz.demo.q3bfx') },
            { label: t('tpl.quiz.demo.q3c') },
          ] },
        ],
      },
    },
    {
      id: 'tpl-stats',
      category: 'data',
      name: t('tpl.stats.name'),
      description: t('tpl.stats.desc'),
      instruction: t('tpl.stats.instruction'),
      demo: {
        title: t('tpl.stats.demo.title'),
        items: [
          { type: 'keyvalue', pairs: [
            { key: t('tpl.stats.demo.done'), value: '12' },
            { key: t('tpl.stats.demo.late'), value: '1' },
            { key: t('tpl.stats.demo.risk'), value: t('tpl.stats.demo.riskValue') },
          ] },
          { type: 'progress', label: t('tpl.stats.demo.planned'), value: 75, valueLabel: '75%' },
          { type: 'progress', label: t('tpl.stats.demo.actual'), value: 82, valueLabel: '82%' },
          { type: 'timeline', items: [
            { title: t('tpl.stats.demo.mon'), desc: t('tpl.stats.demo.monDesc'), time: '08-25' },
            { title: t('tpl.stats.demo.wed'), desc: t('tpl.stats.demo.wedDesc'), time: '08-27' },
            { title: t('tpl.stats.demo.fri'), desc: t('tpl.stats.demo.friDesc'), time: '08-29' },
          ] },
        ],
      },
    },
    {
      id: 'tpl-chart',
      category: 'chart',
      name: t('tpl.chart.name'),
      description: t('tpl.chart.desc'),
      instruction: t('tpl.chart.instruction'),
      demo: {
        title: t('tpl.chart.demo.title'),
        items: [
          { type: 'text', content: t('tpl.chart.demo.conclusion') },
          { type: 'chart', kind: 'line', data: [
            { label: 'W21', value: 8 },
            { label: 'W22', value: 10 },
            { label: 'W23', value: 9 },
            { label: 'W24', value: 12 },
            { label: 'W25', value: 15 },
            { label: 'W26', value: 18 },
          ] },
        ],
      },
    },
    {
      id: 'tpl-tabs',
      category: 'interactive',
      name: t('tpl.tabs.name'),
      description: t('tpl.tabs.desc'),
      instruction: t('tpl.tabs.instruction'),
      demo: {
        title: t('tpl.tabs.demo.title'),
        items: [
          { type: 'tabs', tabs: [
            { label: t('tpl.tabs.demo.overview'), items: [{ type: 'text', content: t('tpl.tabs.demo.overviewBody') }] },
            { label: t('tpl.tabs.demo.details'), items: [{ type: 'list', items: [
              t('tpl.tabs.demo.d1'),
              t('tpl.tabs.demo.d2'),
              t('tpl.tabs.demo.d3'),
            ] }] },
            { label: 'FAQ', items: [{ type: 'text', content: t('tpl.tabs.demo.faqBody') }] },
          ] },
        ],
      },
    },
    {
      id: 'tpl-checklist',
      category: 'flow',
      name: t('tpl.checklist.name'),
      description: t('tpl.checklist.desc'),
      instruction: t('tpl.checklist.instruction'),
      demo: {
        title: t('tpl.checklist.demo.title'),
        items: [
          { type: 'badge', label: t('tpl.checklist.demo.badge'), tone: 'warn' },
          { type: 'list', items: [
            { type: 'checkbox', label: t('tpl.checklist.demo.c1') },
            { type: 'checkbox', label: t('tpl.checklist.demo.c2') },
            { type: 'checkbox', label: t('tpl.checklist.demo.c3') },
            { type: 'checkbox', label: t('tpl.checklist.demo.c4') },
          ] },
        ],
      },
    },
    {
      id: 'tpl-accordion',
      category: 'advanced',
      name: t('tpl.accordion.name'),
      description: t('tpl.accordion.desc'),
      instruction: t('tpl.accordion.instruction'),
      demo: {
        title: t('tpl.accordion.demo.title'),
        items: [
          { type: 'accordion', items: [
            { title: t('tpl.accordion.demo.q1'), items: [{ type: 'text', content: t('tpl.accordion.demo.a1') }] },
            { title: t('tpl.accordion.demo.q2'), items: [{ type: 'text', content: t('tpl.accordion.demo.a2') }] },
            { title: t('tpl.accordion.demo.q3'), items: [{ type: 'text', content: t('tpl.accordion.demo.a3') }] },
          ] },
        ],
      },
    },
    {
      id: 'tpl-diagram',
      category: 'advanced',
      name: t('tpl.diagram.name'),
      description: t('tpl.diagram.desc'),
      instruction: t('tpl.diagram.instruction'),
      demo: {
        title: t('tpl.diagram.demo.title'),
        items: [
          { type: 'diagram', kind: 'flowchart', title: t('tpl.diagram.demo.caption'), nodes: [
            { id: 'a', label: t('tpl.diagram.demo.model'), x: 20, y: 20, w: 120, h: 48 },
            { id: 'b', label: t('tpl.diagram.demo.plugin'), x: 20, y: 120, w: 120, h: 48 },
            { id: 'c', label: t('tpl.diagram.demo.host'), x: 200, y: 70, w: 120, h: 48 },
          ], edges: [
            { from: 'a', to: 'b' },
            { from: 'b', to: 'c' },
          ] },
        ],
      },
    },
    {
      id: 'tpl-3d',
      category: 'advanced',
      name: t('tpl.3d.name'),
      description: t('tpl.3d.desc'),
      instruction: t('tpl.3d.instruction'),
      demo: {
        title: t('tpl.3d.demo.title'),
        items: [
          { type: 'text', content: t('tpl.3d.demo.note'), size: 'muted' },
          { type: 'scene3d', title: t('tpl.3d.demo.scene'), meshes: [
            { shape: 'box', size: 1, color: '#4FC3F7', position: [-1.2, 0, 0] },
            { shape: 'sphere', size: 0.6, color: '#81C784', position: [1.2, 0, 0] },
          ] },
        ],
      },
    },
    {
      id: 'tpl-breadcrumb',
      category: 'data',
      name: t('tpl.breadcrumb.name'),
      description: t('tpl.breadcrumb.desc'),
      instruction: t('tpl.breadcrumb.instruction'),
      demo: {
        title: t('tpl.breadcrumb.demo.title'),
        items: [
          { type: 'breadcrumb', items: [t('tpl.breadcrumb.demo.workspace'), 'dsh-genui', 'src', 'client'] },
          { type: 'file-tree', items: [
            { name: 'src', type: 'dir', children: [
              { name: 'client', type: 'dir', children: [
                { name: 'panel.tsx' },
                { name: 'templates.ts' },
              ] },
              { name: 'index.tsx' },
            ] },
            { name: 'tests', type: 'dir', children: [
              { name: 'templates.spec.ts' },
            ] },
          ] },
        ],
      },
    },
  ]
}
