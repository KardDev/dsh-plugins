/**
 * Asset-bundle loader: fetches one of the plugin's lazy engine bundles
 * (`lib/assets/mermaid.js` / `lib/assets/three.js`) by script injection and
 * hands back the engine surface the bundle registered on
 * `window.__GenuiAssets__`.
 *
 * The bundles are served by the plugin's OWN node-half HTTP route
 * (`/plugins/@changfenhuang/dsh-genui/assets/*`), registered through the host
 * webserver service — no host source change needed, and the longest-prefix
 * rule lets this route win over the generic `/plugins` bundle route. Each
 * file is loaded at most once per page (promise memoized); a rejection is
 * final for the page (the node's fallback UI takes over).
 *
 * The rev query rides the boot graph: the plugin's own row in
 * `window.__DSH_BOOT__` carries the client bundle rev, so a plugin rebuild
 * busts the asset cache together with the main bundle. Absent graph = no
 * query; the route serves no-cache anyway.
 * @module @changfenhuang/dsh-genui/client/asset-loader
 */

/** The plugin's entry id — mirrors the loader entry name (package name). */
const PLUGIN_ID = '@changfenhuang/dsh-genui'

/** Assets directory served by the node-half route. */
const ASSET_DIR = `/plugins/${PLUGIN_ID}/assets`
let embeddedAssetBase: string | undefined

/** Set once before rendering when the host bundles engines locally. */
export function setGenuiAssetBase(baseURL: string): void {
  embeddedAssetBase = new URL(baseURL, document.baseURI).href.replace(/\/?$/, '/')
}

/** Boot graph shape read from `window.__DSH_BOOT__` (subset, defensive). */
interface BootGraphLike {
  entries?: Array<{ id?: string; rev?: string }>
}

/** The global the asset bundles register their engines on. */
interface AssetGlobal {
  __GenuiAssets__?: Record<string, unknown>
}

/** Resolve an engine API registered by an inline standalone bundle. */
function preloadedAsset(name: string): unknown {
  const key = name.replace(/-(\w)/g, (_match, char: string) => char.toUpperCase())
  return (window as unknown as AssetGlobal).__GenuiAssets__?.[key]
}

/** Resolve an asset URL, appending the bundle rev for cache busting when the
 * boot graph exposes it. */
export function assetUrl(file: string): string {
  if (embeddedAssetBase !== undefined) return new URL(file, embeddedAssetBase).href
  const graph = (window as unknown as { __DSH_BOOT__?: BootGraphLike }).__DSH_BOOT__
  const rev = graph?.entries?.find(entry => entry.id === PLUGIN_ID)?.rev
  return `${ASSET_DIR}/${file}${rev === undefined ? '' : `?rev=${rev}`}`
}

const pending = new Map<string, Promise<Record<string, unknown>>>()

/**
 * Load one asset bundle and return the engines it registered. Memoized per
 * file: repeated requests (several mermaid nodes, re-renders) share one
 * script load; a failed load stays failed for the page (the component shows
 * its fallback).
 * @param name - 'mermaid', 'three', 'echarts-core', or 'echarts-full'.
 * @returns the registered engine surface.
 */
export function loadGenuiAsset<T>(name: 'mermaid' | 'three' | 'echarts-core' | 'echarts-full'): Promise<T> {
  const preloaded = preloadedAsset(name)
  if (preloaded !== undefined) return Promise.resolve(preloaded as T)
  const file = `${name}.js`
  const existing = pending.get(file)
  if (existing !== undefined) return existing as Promise<T>
  const task = new Promise<T>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = assetUrl(file)
    script.async = true
    script.onload = () => {
      const global = (window as unknown as AssetGlobal).__GenuiAssets__ ?? {}
      // Asset files are kebab-case; the keys they register are camelCase.
      const key = name.replace(/-(\w)/g, (_m, ch: string) => ch.toUpperCase())
      const api = global[key]
      if (api === undefined) {
        reject(new Error(`genui asset '${file}' loaded but registered no '${name}' engine`))
        return
      }
      resolve(api as T)
    }
    script.onerror = () => {
      reject(new Error(`genui asset '${file}' failed to load (host asset route missing?)`))
    }
    document.head.appendChild(script)
  })
  pending.set(file, task as unknown as Promise<Record<string, unknown>>)
  return task
}
