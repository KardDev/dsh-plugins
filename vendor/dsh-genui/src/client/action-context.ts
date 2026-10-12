/**
 * GenUI action context, plugin-owned.
 *
 * Contract hosts (`dsh-host-0812-contract` and later) ship the same context
 * in `@deepseek-ai/dsh-client-ui-primitives` and MarkdownText installs the
 * provider around fence renders — the renderer MUST consume that exact
 * context instance so the host's action wiring reaches our components.
 * Pristine hosts (the stock snapshot line) export no such symbol; the DOM
 * render channel then falls back to the local context and installs its own
 * provider (this package wraps every tree it mounts).
 *
 * Absent provider = v1 behavior: interactive components are display-only
 * (their `action` is ignored). The hook never throws.
 */
import { createContext, useContext } from 'react'
import type { Context } from 'react'
import * as primitives from './primitive-adapter.ts'

/** v2 action handler: component action + its collected data. */
export type GenuiActionHandler = (action: string, payload: Record<string, unknown>) => void

/** Local fallback context (pristine hosts). */
const localContext = createContext<GenuiActionHandler | undefined>(undefined)

/** Host-provided context when the deployment ships it, else the local one. */
export const GenuiActionContext: Context<GenuiActionHandler | undefined> =
  (primitives as unknown as { GenuiActionContext?: Context<GenuiActionHandler | undefined> }).GenuiActionContext ?? localContext

/** Read the installed action handler, if any. */
export function useGenuiAction(): GenuiActionHandler | undefined {
  return useContext(GenuiActionContext)
}
