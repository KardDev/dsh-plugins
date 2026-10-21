import { fromMarkdown } from 'mdast-util-from-markdown'
import type { AssistantBlock, ChatNode, ChatSnapshot } from '@deepseek-ai/dsh-client-ui-chat/client'

export interface SourceFence {
  lang: string | null
  value: string
  openingLineComplete: boolean
}

interface MarkdownNode {
  type: string
  lang?: string | null
  value?: string
  children?: MarkdownNode[]
  position?: { start: { offset?: number } }
}

/**
 * 按 Markdown 文档顺序读取所有代码围栏。
 *
 * @param markdown - assistant text block 中的 Markdown 内容
 * @returns Markdown AST 中的代码围栏
 */
export function sourceFencesOf(markdown: string): SourceFence[] {
  const fences: SourceFence[] = []
  const visit = (node: MarkdownNode): void => {
    if (node.type === 'code') {
      const openingOffset = node.position?.start.offset
      const openingLineEnd = openingOffset === undefined ? -1 : markdown.indexOf('\n', openingOffset)
      fences.push({
        lang: node.lang ?? null,
        value: node.value as string,
        openingLineComplete: openingLineEnd >= 0,
      })
    }
    for (const child of node.children ?? []) visit(child)
  }
  visit(fromMarkdown(markdown) as unknown as MarkdownNode)
  return fences
}

/**
 * 只从 assistant 的 text blocks 中读取代码围栏。
 *
 * @param blocks - ChatSnapshot 提供的 assistant 内容块
 * @returns 按内容块顺序排列的代码围栏
 */
export function sourceFencesOfAssistant(blocks: readonly AssistantBlock[]): SourceFence[] {
  const fences: SourceFence[] = []
  for (const block of blocks) {
    if (block.kind === 'text') fences.push(...sourceFencesOf(block.text))
  }
  return fences
}

/**
 * 根据 assistant node key 和围栏序号读取公开 ChatSnapshot 中的 language。
 *
 * @param chat - 当前会话的 ChatSnapshot
 * @param nodeKey - DOM assistant row 对应的 Chat node key
 * @param index - assistant row 内从零开始的宿主代码块序号
 * @returns 原始 language；null 表示围栏没有 language，undefined 表示 source 不可用
 */
export function sourceLanguageAt(chat: ChatSnapshot | undefined, nodeKey: string, index: number): string | null | undefined {
  const node = chat?.nodes.get(nodeKey)
  if (node?.kind !== 'assistant-step') return undefined
  const assistantNode = node as ChatNode<'assistant-step'>
  const fence = sourceFencesOfAssistant(assistantNode.data.blocks)[index]
  return fence?.lang
}
