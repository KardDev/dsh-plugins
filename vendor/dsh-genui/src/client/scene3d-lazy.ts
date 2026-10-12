/**
 * Runtime loader for the three.js scene renderer. The heavy three bundle
 * ships as a separate asset (`lib/assets/three.js`, served by the plugin's
 * own HTTP route) and is fetched ONLY when a spec contains a `scene3d` node.
 * On a host that does not serve the asset the load rejects and the
 * Scene3DNode shows its error hint.
 * @module @changfenhuang/dsh-genui/client/scene3d-lazy
 */
import { loadGenuiAsset } from './asset-loader.ts'
import type { GenuiScene3D } from './spec.ts'

/** The engine surface registered by the three asset bundle. */
interface ThreeAssetApi {
  mountScene: (container: HTMLElement, scene: GenuiScene3D) => Promise<() => void>
}

/**
 * Mount a GenUI 3D scene into `container` (engine loaded on demand).
 * @param container - the DOM node to host the WebGL canvas.
 * @param scene - the declarative scene spec.
 * @returns a disposer that removes the renderer and its context.
 */
export async function mountScene(container: HTMLElement, scene: GenuiScene3D): Promise<() => void> {
  const api = await loadGenuiAsset<ThreeAssetApi>('three')
  return api.mountScene(container, scene)
}
