/**
 * i18n public face: the translate function, the React binding, and the host
 * locale bridge.
 *
 * @module i18n
 */
import { useSyncExternalStore } from 'react'
import {
  dictOf,
  getLocale,
  getLocaleRevision,
  LOCALE_IDS,
  setLocale,
  subscribeLocale,
  t,
  type LocaleId,
} from './runtime.ts'

export {
  detectLocale,
  dictOf,
  FALLBACK_LOCALE,
  getLocale,
  getLocaleRevision,
  LOCALE_IDS,
  normalizeLocale,
  setLocale,
  subscribeLocale,
  t,
  type GenuiTextKey,
  type LocaleDict,
  type LocaleId,
} from './runtime.ts'

/**
 * Subscribe a component to locale changes.
 *
 * Returns the translate function itself (stable identity — `t` reads the
 * active locale at call time), so a component calls `const t = useT()` and
 * re-renders whenever the language switches.
 */
export function useT(): typeof t {
  useSyncExternalStore(subscribeLocale, getLocaleRevision, getLocaleRevision)
  return t
}

/**
 * Subscribe to locale changes and return the current revision.
 *
 * `t` keeps a STABLE identity on purpose (so it can ride inject surfaces
 * without breaking memoization), which means it cannot serve as a `useMemo`
 * dependency. Use this revision instead when a memoized value embeds
 * translated text.
 */
export function useLocaleRevision(): number {
  return useSyncExternalStore(subscribeLocale, getLocaleRevision, getLocaleRevision)
}

/** The minimal shape this package needs from the host locale runtime. */
interface HostLocaleRuntime {
  getLocale?: () => { active?: string }
  subscribe?: (fn: () => void) => () => void
  register?: (ns: string, locale: string, dict: Record<string, string>) => () => void
}

/** Namespace this package registers its dictionaries under on the host. */
export const GENUI_LOCALE_NS = 'genui'

/**
 * Bridge this package's locale to the DSH host language preference.
 *
 * Hosts that ship `@deepseek-ai/dsh-client-locale` own the user's language
 * choice; GenUI must follow it rather than keep a second, divergent setting.
 * The bridge:
 *  - publishes both dictionaries into the host registry (so host-side
 *    surfaces can read GenUI keys), and
 *  - mirrors the host's active locale into this runtime, now and on change.
 *
 * Hosts WITHOUT the locale service degrade silently to browser detection —
 * the service is read optionally, never declared in `inject`, because a
 * declared-but-absent service parks the fiber forever and would kill all
 * GenUI rendering on pristine hosts.
 *
 * @param ctx - client cordis context (read optionally).
 * @returns disposer removing the registrations and the subscription.
 */
export function bridgeHostLocale(ctx: { get?: (name: string) => unknown }): () => void {
  const locale = typeof ctx.get === 'function'
    ? (ctx.get('locale') as HostLocaleRuntime | undefined)
    : undefined
  if (locale === undefined) return () => {}

  const disposers: Array<() => void> = []

  // Publish our dictionaries under the plugin's own namespace. Untyped form:
  // `genui` is not merged into the host's LocaleNamespaceMap.
  if (typeof locale.register === 'function') {
    for (const id of LOCALE_IDS) {
      try {
        disposers.push(locale.register(GENUI_LOCALE_NS, id, { ...dictOf(id) }))
      } catch {
        // A duplicate (ns, locale) registration throws — another GenUI
        // instance already owns the namespace. Rendering is unaffected:
        // this package always reads its own runtime, not the host registry.
      }
    }
  }

  // Mirror the host's active locale, now and on every change.
  const sync = (): void => {
    const active = locale.getLocale?.().active
    if (typeof active === 'string') setLocale(active)
  }
  sync()
  if (typeof locale.subscribe === 'function') disposers.push(locale.subscribe(sync))

  return () => {
    for (const dispose of disposers) dispose()
  }
}

/** Current locale id, for non-React call sites. */
export function currentLocale(): LocaleId {
  return getLocale()
}
