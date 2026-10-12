const FILE_ADDRESS_PREFIX = 'dsh-resource://file/'

/** Encode one address segment while keeping a Windows drive colon readable. */
function encodeSegment(segment: string): string {
  return encodeURIComponent(segment).replace(/%3A/gi, ':')
}

/** Encode each path segment independently so separators retain their structure. */
function encodePath(path: string): string {
  return path.split('/').map(encodeSegment).join('/')
}

/** Check whether a path uses a Windows drive or UNC spelling. */
function isWindowsStylePath(value: string): boolean {
  return /^[A-Za-z]:[/\\]/.test(value) || value.startsWith('\\\\')
}

/** Check whether a path is absolute in a spelling accepted by the host. */
function isAbsoluteWorkspacePath(path: string): boolean {
  return path.startsWith('/') || isWindowsStylePath(path)
}

/** Build a session resource address while preserving encoded path segments. */
export function sessionFileAddress(sessionId: string, path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/^(?:\.\/)+/, '')
  return `${FILE_ADDRESS_PREFIX}session/${encodeSegment(sessionId)}/${encodePath(normalized)}`
}

/** Resolve workspace absolute paths to session-relative resource addresses. */
export function fileAddressFor(sessionId: string, cwd: string | undefined, path: string): string {
  const normalized = path.replace(/\\/g, '/')
  if (!isAbsoluteWorkspacePath(normalized)) return sessionFileAddress(sessionId, normalized)
  const root = cwd === undefined ? '' : cwd.replace(/\\/g, '/').replace(/\/+$/, '')
  if (root !== '' && normalized === root) return sessionFileAddress(sessionId, '')
  if (root !== '' && normalized.startsWith(`${root}/`)) return sessionFileAddress(sessionId, normalized.slice(root.length + 1))
  return sessionFileAddress(sessionId, normalized)
}
