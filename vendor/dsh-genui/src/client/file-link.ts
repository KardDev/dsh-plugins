import { safeHref } from './genui-runtime/value-utils.ts'

export interface ParsedFileLink {
  path: string
  line?: number
}

export type LinkTarget =
  | { type: 'external'; href: string }
  | { type: 'file'; file: ParsedFileLink }
  | { type: 'invalid' }

/** Decode a local file destination and its optional first line fragment. */
export function parseFileLink(value: string): ParsedFileLink | undefined {
  if (value.length > 2048) return undefined
  const hash = value.indexOf('#')
  const destination = hash < 0 ? value : value.slice(0, hash)
  if (destination.includes('?')) return undefined

  let path: string
  try {
    path = decodeURIComponent(destination)
  } catch {
    return undefined
  }

  if (path === '' || /[\u0000-\u001f\u007f]/.test(path) || /^[\\/]{2}/.test(path)
    || (/^[a-z][a-z\d+.-]*:/i.test(path) && !/^[a-z]:[\\/]/i.test(path))) return undefined
  if (hash < 0) return { path }

  const match = /^L([1-9]\d*)(?:-L([1-9]\d*))?$/.exec(value.slice(hash + 1))
  if (match === null) return undefined
  const line = Number(match[1])
  const end = match[2] === undefined ? line : Number(match[2])
  if (!Number.isSafeInteger(line) || !Number.isSafeInteger(end) || end < line) return undefined
  return { path, line }
}

/** Classify a link destination while preserving the existing external URL policy. */
export function classifyLinkTarget(value: unknown): LinkTarget {
  const external = safeHref(value)
  if (external !== undefined) return { type: 'external', href: external }
  if (typeof value !== 'string') return { type: 'invalid' }
  const file = parseFileLink(value.trim())
  return file === undefined ? { type: 'invalid' } : { type: 'file', file }
}
