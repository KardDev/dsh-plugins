import { createContext, createElement, useContext, useMemo, useSyncExternalStore, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { fileAddressFor } from './file-address.ts'
import { resolveViewedSessionId } from './session-resolver.ts'
import css from './GenuiBlock.module.css'

interface SidebarRightService {
  openResource(address: string, options?: { params: { line: number } }): void
}

interface FileLinkHostContext {
  get(name: 'sidebarRight', strict?: false): SidebarRightService | undefined
  sessions: {
    list: { getSnapshot(): unknown }
  }
}

interface FileLinkScope {
  get(name: 'sidebarRight'): SidebarRightService | undefined
  effect(callback: () => void | (() => void), name?: string): unknown
}

export interface FileLinkCordisContext extends FileLinkHostContext {
  inject(services: ['sidebarRight'], callback: (scope: FileLinkScope) => void): unknown
}

export interface FileLinkAvailability {
  subscribe(listener: () => void): () => void
  getSnapshot(): boolean
}

export const FileLinkOpenContext = createContext<((path: string, line?: number) => void) | undefined>(undefined)

/** Track an optional host service through arrival, removal, and plugin unload. */
export function createFileLinkAvailability(ctx: FileLinkCordisContext): FileLinkAvailability {
  let available = ctx.get('sidebarRight', false)?.openResource !== undefined
  const listeners = new Set<() => void>()
  const notify = (): void => {
    for (const listener of listeners) listener()
  }
  const setAvailable = (next: boolean): void => {
    if (available === next) return
    available = next
    notify()
  }

  ctx.inject(['sidebarRight'], (scope) => {
    scope.effect(() => {
      setAvailable(scope.get('sidebarRight')?.openResource !== undefined)
      return () => setAvailable(false)
    }, 'genui: file-link sidebarRight')
  })

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    getSnapshot: () => available,
  }
}

/** Provide one fence's session-scoped file opener to descendant components. */
function FileLinkProvider({ ctx, availability, sessionId, streaming, children }: {
  ctx: FileLinkHostContext
  availability: FileLinkAvailability
  sessionId: string | undefined
  streaming: boolean
  children?: ReactNode
}) {
  const available = useSyncExternalStore(availability.subscribe, availability.getSnapshot, () => false)
  const open = useMemo(() => {
    if (!available || streaming || sessionId === undefined) return undefined
    return (path: string, line?: number): void => {
      const snapshot = ctx.sessions.list.getSnapshot()
      if (resolveViewedSessionId(snapshot) !== sessionId) return
      const sessions = snapshot as { byId?: Record<string, { cwd?: string } | undefined> }
      const cwd = sessions.byId?.[sessionId]?.cwd
      const address = fileAddressFor(sessionId, cwd, path)
      const sidebar = ctx.get('sidebarRight', false)
      if (sidebar?.openResource === undefined) return
      if (line === undefined) sidebar.openResource(address)
      else sidebar.openResource(address, { params: { line } })
    }
  }, [available, ctx, sessionId, streaming])

  return createElement(FileLinkOpenContext.Provider, { value: open }, children)
}

/** Render a file link as an accessible host navigation button when available. */
export function FileLink({ path, line, label, children }: { path: string; line?: number; label: string; children?: ReactNode }) {
  const open = useContext(FileLinkOpenContext)
  if (open === undefined) return createElement('span', { title: path }, children)
  return createElement('button', {
    type: 'button',
    className: css.inlineFileLink,
    title: path,
    'aria-label': `${label} (${path})`,
    onClick: (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      open(path, line)
    },
  }, children)
}

/** Add session-scoped file navigation to one fence render tree. */
export function withFileLinkContext(
  ctx: FileLinkHostContext,
  availability: FileLinkAvailability,
  sessionId: string | undefined,
  streaming: boolean,
  children: ReactNode,
): ReactNode {
  return createElement(FileLinkProvider, { ctx, availability, sessionId, streaming, children })
}
