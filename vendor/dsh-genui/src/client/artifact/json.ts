import type { GenuiArtifactV1 } from './types.ts'

/** 以稳定缩进序列化 GenUI artifact。 */
export function serializeGenuiArtifact(artifact: GenuiArtifactV1): string {
  return JSON.stringify(artifact, null, 2)
}
