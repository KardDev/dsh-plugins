/// <reference path="../css-modules.d.ts" />
/** Public bundler entry for hosts that embed GenUI without the DSH plugin runtime. */
export { GenuiBlock } from './GenuiBlock.tsx'
export { GenuiActionContext } from './action-context.ts'
export { ErrorBoundary } from './ErrorBoundary.tsx'
export { isRenderableProcess, processGenuiSpec } from './guard.ts'
export { setGenuiAssetBase } from './asset-loader.ts'
export type { GenuiSpec } from './spec.ts'
export type { BlockInteractionState } from './interaction-store.ts'
export {
  analyzeGenuiPortability,
  buildStandaloneHtml,
  createGenuiArtifact,
  downloadGenuiArtifactHtml,
  downloadGenuiArtifactJson,
  parseGenuiArtifact,
  serializeGenuiArtifact,
} from './artifact/index.ts'
export type { GenuiArtifactV1, GenuiPortabilityReport } from './artifact/index.ts'
