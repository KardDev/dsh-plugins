/**
 * Editorial diagram theme: the diagram-design semantic-token system ported
 * into the dsh-genui renderer. Every diagram draws from these roles — never
 * from inline hex in the layout code — and a spec-level `theme` override
 * merges over the defaults, mirroring diagram-design's style-guide.md.
 *
 * Two skins ship: light and dark (the dark palette is the jet-black
 * inversion, same roles). The `editorial` variant is the full skin and
 * defaults to light unless the host theme is dark.
 * @module @changfenhuang/dsh-genui/client/blocks/diagram/theme
 */
import type { GenuiDiagramTheme, GenuiDiagramVariant } from '../../spec.ts'

export interface DiagramPalette {
  paper: string
  paper2: string
  ink: string
  muted: string
  soft: string
  rule: string
  accent: string
  accentTint: string
  link: string
}

/** diagram-design default skin (style-guide.md § Tokens). */
const LIGHT: DiagramPalette = {
  paper: '#f5f5f5',
  paper2: '#ececec',
  ink: '#2d3142',
  muted: '#4f5d75',
  soft: '#7a8399',
  rule: 'rgba(45,49,66,0.12)',
  accent: '#eb6c36',
  accentTint: 'rgba(235,108,54,0.08)',
  link: '#2e5aa8',
}

/** Dark inversion: jet-black paper, white-smoke ink, silver muted. */
const DARK: DiagramPalette = {
  paper: '#2d3142',
  paper2: '#393e53',
  ink: '#f5f5f5',
  muted: '#bfc0c0',
  soft: '#8e98ac',
  rule: 'rgba(245,245,245,0.12)',
  accent: '#f08a59',
  accentTint: 'rgba(240,138,89,0.10)',
  link: '#6a95d8',
}

/** Native SVG paint values keep inherited host tokens live across theme changes. */
export function hostPalette(): DiagramPalette {
  const accent = 'var(--dsw-alias-state-business-primary, #4f8ef7)'
  return {
    paper: 'var(--dsw-alias-bg-layer-2, #ffffff)',
    paper2: 'var(--dsw-alias-bg-layer-3, #f5f5f5)',
    ink: 'var(--dsw-alias-label-primary, #2d3142)',
    muted: 'var(--dsw-alias-label-secondary, #4f5d75)',
    soft: 'var(--dsw-alias-label-tertiary, #7a8399)',
    rule: 'var(--dsw-alias-border-l2, rgba(45,49,66,0.12))',
    accent,
    accentTint: `color-mix(in srgb, ${accent} 10%, transparent)`,
    link: accent,
  }
}

/** Resolve the active palette from variant + optional theme overrides. */
export function resolvePalette(variant: GenuiDiagramVariant | undefined, theme: GenuiDiagramTheme | undefined): DiagramPalette {
  // No explicit variant -> follow the host theme; an explicit variant keeps the
  // editorial skin (that is what the field is for).
  const base = variant === undefined ? hostPalette() : variant === 'dark' ? DARK : LIGHT
  if (theme === undefined) return base
  return {
    paper: theme.paper ?? base.paper,
    paper2: theme['paper-2'] ?? base.paper2,
    ink: theme.ink ?? base.ink,
    muted: theme.muted ?? base.muted,
    soft: theme.soft ?? base.soft,
    rule: theme.rule ?? base.rule,
    accent: theme.accent ?? base.accent,
    accentTint: theme['accent-tint'] ?? base.accentTint,
    link: theme.link ?? base.link,
  }
}

/** Node treatment → { fill, stroke, dashed } per diagram-design §5. */
export function nodeTreatment(type: string | undefined, p: DiagramPalette): { fill: string; stroke: string; dashed?: boolean } {
  switch (type) {
    case 'focal': return { fill: p.accentTint, stroke: p.accent }
    case 'store': return { fill: inkAt(p.ink, 0.05), stroke: p.muted }
    case 'external': return { fill: inkAt(p.ink, 0.03), stroke: inkAt(p.ink, 0.30) }
    case 'input': return { fill: inkAt(p.muted, 0.10), stroke: p.soft }
    case 'optional': return { fill: inkAt(p.ink, 0.02), stroke: inkAt(p.ink, 0.20), dashed: true }
    case 'security': return { fill: inkAt(p.accent, 0.05), stroke: inkAt(p.accent, 0.50), dashed: true }
    default: return { fill: p.paper, stroke: p.ink }
  }
}

/** Edge stroke color per semantic kind. */
export function edgeStroke(kind: string | undefined, p: DiagramPalette): string {
  switch (kind) {
    case 'accent': return p.accent
    case 'link': return p.link
    default: return p.muted
  }
}

/** Apply opacity while retaining live host-token references. */
export function inkAt(color: string, opacity: number): string {
  if (color.startsWith('var(')) return `color-mix(in srgb, ${color} ${opacity * 100}%, transparent)`
  if (color.startsWith('#')) {
    const hex = color.slice(1)
    const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex
    const r = parseInt(full.slice(0, 2), 16)
    const g = parseInt(full.slice(2, 4), 16)
    const b = parseInt(full.slice(4, 6), 16)
    return `rgba(${r},${g},${b},${opacity})`
  }
  // rgba(...) input: replace the alpha component.
  return color.replace(/rgba?\(([^)]*)\)/, (_, inner: string) => {
    const parts = inner.split(',').map(s => s.trim())
    if (parts.length === 3) return `rgba(${parts.join(',')},${opacity})`
    if (parts.length === 4) return `rgba(${parts[0]},${parts[1]},${parts[2]},${opacity})`
    return color
  })
}
