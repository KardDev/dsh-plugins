/** Shared primitive sanitizers used by the GenUI guard. */

/** Is `value` one of `values`? */
function inEnum<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value)
}

/** String field: truncate a string to `cap`, or undefined when not a string. */
export function str(value: unknown, cap: number): string | undefined {
  return typeof value === 'string' ? value.slice(0, cap) : undefined
}

/**
 * Color field: the value lands in an inline `style` (background/stroke) or
 * THREE.Color. Arbitrary CSS values are an exfiltration channel, so only
 * literal color formats and host design tokens are accepted.
 */
const SAFE_COLOR_RE = /^(?:#[\da-fA-F]{3,8}|rgba?\([^)]{0,64}\)|hsla?\([^)]{0,64}\)|var\(--dsw-[\w-]+(?:,\s*#[0-9a-fA-F]{3,8})?\))$/

export function color(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized.length <= 64 && SAFE_COLOR_RE.test(normalized) ? normalized : undefined
}

/** Keep only http(s) and mailto link targets. */
export function safeHref(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  if (normalized.length > 2048) return undefined
  return /^https?:\/\//i.test(normalized) || /^mailto:[^@\s]+@[^@\s]+$/i.test(normalized) ? normalized : undefined
}

/** Keep browser-reachable http(s) or same-origin relative media paths. */
export function safeMediaSrc(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  if (normalized === '' || normalized.length > 2048) return undefined
  if (/^https?:\/\//i.test(normalized)) return normalized
  if (/^[a-z][a-z0-9+.-]*:/i.test(normalized) || /^[/\\]{2}/.test(normalized)) return undefined
  return normalized
}

/** Finite-number field: clamp into [min, max], or undefined when not finite. */
export function num(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : undefined
}

/** Integer field: clamp into [min, max], or undefined when not a finite number. */
export function int(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.trunc(value))) : undefined
}

/** Optional enum field: the value when it matches, otherwise undefined. */
export function enu<T extends string>(value: unknown, values: readonly T[]): T | undefined {
  return inEnum(value, values) ? value : undefined
}

/** Plain object (not array, not null). */
export function obj(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

/** Preserve an optional field only when its value exists. */
export function opt<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : { [key]: value } as Partial<Record<K, V>>
}
