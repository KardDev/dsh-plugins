/**
 * Minimal ambient declarations for the node: builtins the plugin node half
 * uses (asset route: http/fs/path/url). The package compiles with
 * `"types": []` and ships no @types/node devDependency, so these shims are
 * the typecheck surface; tsdown bundles the real node modules at build time
 * (platform: node). Declarations cover exactly the members in use.
 * @module @changfenhuang/dsh-genui/plugin/node-shims
 */

declare module 'node:http' {
  export interface IncomingMessage {
    method?: string
    url?: string
  }
  export interface ServerResponse {
    writeHead(statusCode: number, headers?: Record<string, string>): ServerResponse
    end(data?: string | Buffer): void
  }
}

declare module 'node:fs/promises' {
  export function readFile(path: string): Promise<Buffer>
}

declare module 'node:path' {
  export function join(...paths: string[]): string
}

declare module 'node:url' {
  export function fileURLToPath(url: URL): string
}
