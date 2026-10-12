import type { GenuiArtifactV1 } from '../artifact/types.ts'

declare global {
  interface Window {
    __GenuiStandalone__?: {
      mount(root: HTMLElement, artifact: GenuiArtifactV1): () => void
    }
  }
}

export {}
