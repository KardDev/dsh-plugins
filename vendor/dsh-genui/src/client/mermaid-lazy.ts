/**
 * Runtime loader for the mermaid engine. The heavy mermaid bundle ships as a
 * separate asset (`lib/assets/mermaid.js`, served by the plugin's own HTTP
 * route) and is fetched ONLY when a spec contains a `mermaid` node — the
 * main client bundle stays small and most conversations never download
 * mermaid at all. On a host that does not serve the asset (older harness) the
 * load rejects and the MermaidNode shows its plain-source fallback.
 *
 * The pure source utilities stay statically exported from mermaid-safe so
 * tests (and any consumer) can use them without the engine.
 * @module @changfenhuang/dsh-genui/client/mermaid-lazy
 */
import { loadGenuiAsset } from './asset-loader.ts'
export { assertSafeSvg, ensureFlowchartKind, repairMermaidSource } from './mermaid-safe.ts'

/** The engine surface registered by the mermaid asset bundle. */
interface MermaidAssetApi {
  renderMermaid: (code: string) => Promise<string>
}

/**
 * Render mermaid source to an SVG string (engine loaded on demand).
 * @param code - the mermaid diagram source.
 * @returns the rendered SVG markup (verified free of script/event handlers).
 * @throws when the asset cannot load, the kind is not whitelisted, rendering
 *   fails, or the output fails the sanitization check.
 */
export async function renderMermaid(code: string): Promise<string> {
  const api = await loadGenuiAsset<MermaidAssetApi>('mermaid')
  return api.renderMermaid(code)
}
