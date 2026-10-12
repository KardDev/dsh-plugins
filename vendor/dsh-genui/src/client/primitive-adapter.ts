import * as primitives from '@deepseek-ai/dsh-client-ui-primitives'

export { CodeBlock, DiffBlock, JsonTree, writeClipboard } from '@deepseek-ai/dsh-client-ui-primitives'
export type { DiffBlockLabels, JsonTreeLabels } from '@deepseek-ai/dsh-client-ui-primitives'

type HostGenuiExtensions = {
  getGenuiComponent?: (type: string) => unknown
  GenuiActionContext?: typeof primitives extends { GenuiActionContext: infer T } ? T : unknown
}

const hostExtensions = primitives as unknown as HostGenuiExtensions
export const getGenuiComponent = hostExtensions.getGenuiComponent
export const GenuiActionContext = hostExtensions.GenuiActionContext
