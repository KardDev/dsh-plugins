/**
 * i18n runtime — the single source of user-facing text for the browser half.
 *
 * Every string the USER reads (panel chrome, primitive labels, template
 * center, achievements, component chrome, in-page error text) resolves
 * through `t(key)` instead of being written into the component. Two
 * dictionaries ship: `en` and `zh`.
 *
 * Locale resolution, in priority order:
 *  1. An explicit {@link setLocale} call — the host locale bridge uses this
 *     to mirror the DSH language preference.
 *  2. The browser's ordered language list (`navigator.languages`).
 *  3. {@link FALLBACK_LOCALE} (English).
 *
 * English is also the per-key fallback: a key missing from the active
 * dictionary resolves against `en` before degrading to the key itself, so a
 * partially translated dictionary can never blank out the UI.
 *
 * MODEL-FACING text is deliberately NOT routed through here. The `[genui-action]`
 * prompts and the fence vocabulary injected into the system prompt are a
 * protocol between the plugin and the model, not chrome the user reads;
 * translating them would change model behaviour rather than the UI language.
 */
import { EN } from './en.ts'
import { ZH } from './zh.ts'

/** Locale ids this package ships dictionaries for. */
export type LocaleId = 'en' | 'zh'

/** The locale used when nothing else resolves, and the per-key fallback. */
export const FALLBACK_LOCALE: LocaleId = 'en'

/** Locale ids in display order. */
export const LOCALE_IDS: readonly LocaleId[] = ['en', 'zh']

/** A flat dictionary: key → template string with `{name}` placeholders. */
export type LocaleDict = Record<string, string>

/** Key domain of the shipped dictionaries (English is the complete set). */
export type GenuiTextKey = keyof typeof EN

const DICTS: Record<LocaleId, LocaleDict> = { en: EN, zh: ZH }

/** Narrow an arbitrary BCP 47-ish tag onto a shipped locale, or undefined. */
export function normalizeLocale(tag: string | undefined | null): LocaleId | undefined {
  if (typeof tag !== 'string' || tag === '') return undefined
  // Match on the primary subtag so `zh-CN`, `zh-Hant`, `en-GB` all resolve.
  const primary = tag.toLowerCase().split(/[-_]/)[0]
  return LOCALE_IDS.find(id => id === primary)
}

/** Resolve the browser's preferred shipped locale, else the fallback. */
export function detectLocale(): LocaleId {
  if (typeof navigator === 'undefined') return FALLBACK_LOCALE
  const nav = navigator as Navigator & { languages?: readonly string[] }
  const tags: readonly string[] = Array.isArray(nav.languages) && nav.languages.length > 0
    ? nav.languages
    : [nav.language]
  for (const tag of tags) {
    const hit = normalizeLocale(tag)
    if (hit !== undefined) return hit
  }
  return FALLBACK_LOCALE
}

let active: LocaleId = detectLocale()
/** Monotonic counter: the uSES snapshot every localized surface subscribes to. */
let revision = 0
const listeners = new Set<() => void>()

/** The active locale id. */
export function getLocale(): LocaleId {
  return active
}

/**
 * Snapshot for `useSyncExternalStore`: bumped on every locale change, so a
 * component reading text through {@link t} re-renders when the user switches
 * language. Stable between changes (uSES-safe).
 */
export function getLocaleRevision(): number {
  return revision
}

/** Subscribe to locale changes. Returns an idempotent unsubscribe. */
export function subscribeLocale(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/**
 * Switch the active locale. Unknown or unshipped tags are ignored (the UI
 * keeps whatever it had rather than blanking out). Re-setting the current
 * locale is a no-op: republishing would churn every subscriber for nothing.
 */
export function setLocale(tag: string | LocaleId): void {
  const next = normalizeLocale(tag)
  if (next === undefined || next === active) return
  active = next
  revision += 1
  for (const fn of [...listeners]) fn()
}

/** Interpolate `{name}` placeholders; a missing param keeps its placeholder. */
function interpolate(template: string, params?: Record<string, unknown>): string {
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name]
    return value === undefined ? whole : String(value)
  })
}

/**
 * Translate a key in the active locale.
 *
 * Lookup chain: active dictionary → English → the key itself. Returning the
 * key (rather than an empty string) keeps an untranslated surface diagnosable
 * in a screenshot instead of silently blank.
 */
export function t(key: GenuiTextKey | string, params?: Record<string, unknown>): string {
  const template = DICTS[active][key] ?? DICTS[FALLBACK_LOCALE][key] ?? key
  return interpolate(template, params)
}

/** Read a full dictionary (the host locale bridge registers these). */
export function dictOf(id: LocaleId): LocaleDict {
  return DICTS[id]
}
