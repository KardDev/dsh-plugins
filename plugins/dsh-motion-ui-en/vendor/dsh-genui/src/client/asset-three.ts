/**
 * three.js asset-bundle entry: registers the scene renderer on
 * `window.__GenuiAssets__.three`. Built as a standalone IIFE into
 * `lib/assets/three.js` and served by the plugin's node-half route; loaded on
 * demand by scene3d-lazy.
 * @module @changfenhuang/dsh-genui/client/asset-three
 */
import { mountScene } from './scene3d-core.ts'

const win = globalThis as unknown as { __GenuiAssets__?: Record<string, unknown> }
const assets = win.__GenuiAssets__ ?? (win.__GenuiAssets__ = {})
assets.three = { mountScene }
