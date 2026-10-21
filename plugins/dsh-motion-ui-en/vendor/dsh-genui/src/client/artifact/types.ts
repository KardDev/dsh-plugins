import type { LocaleId } from '../i18n/runtime.ts'
import type { GenuiSpec } from '../spec.ts'
import type { BlockInteractionState } from '../interaction-store.ts'

export const GENUI_ARTIFACT_FORMAT = 'dsh-genui'
export const GENUI_ARTIFACT_VERSION = 1 as const

export type GenuiArtifactTheme = 'light' | 'dark'
export type GenuiStandaloneAsset = 'mermaid' | 'three' | 'echarts-core' | 'echarts-full'

export interface GenuiArtifactV1 {
  format: typeof GENUI_ARTIFACT_FORMAT
  version: typeof GENUI_ARTIFACT_VERSION
  spec: GenuiSpec
  state?: BlockInteractionState
  presentation: { locale: LocaleId; theme: GenuiArtifactTheme }
}

export interface GenuiPortabilityReport {
  requiredAssets: GenuiStandaloneAsset[]
  customTypes: string[]
  externalMedia: string[]
  hasModelActions: boolean
}

export type GenuiExportErrorCode =
  | 'unsupported-custom-component'
  | 'runtime-fetch-failed'
  | 'asset-fetch-failed'
  | 'artifact-invalid'
  | 'download-failed'

/** 导出流程遇到可供界面识别的错误时使用。 */
export class GenuiExportError extends Error {
  constructor(readonly code: GenuiExportErrorCode, message: string) {
    super(message)
    this.name = 'GenuiExportError'
  }
}

export interface CreateGenuiArtifactOptions {
  locale?: LocaleId
  theme?: GenuiArtifactTheme
}
