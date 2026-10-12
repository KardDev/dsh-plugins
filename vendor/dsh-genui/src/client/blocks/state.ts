/**
 * Shared block-level state types: the block props contract and the answers
 * registry (grouped radios / checkboxes → submit aggregation). Lives OUTSIDE
 * GenuiBlock.tsx so the per-family block modules can import the types without
 * a cycle back into the block shell.
 * @module @changfenhuang/dsh-genui/client/blocks/state
 */
import type { GenuiSpec } from '../spec.ts'
import type { BlockInteractionState } from '../interaction-store.ts'
import type { SubmissionRegistry } from '../submission-registry.ts'

export interface GenuiBlockProps {
  /** Parsed spec to render. */
  spec: GenuiSpec
  /**
   * v2: optional action callback. Interactive components carrying an
   * `action` field fire it (button click, switch toggle, form submit);
   * absent = components are display-only (v1 behavior).
   */
  onAction?: ((action: string, payload: Record<string, unknown>) => void) | undefined
  /**
   * v2.7: durable-state key (session + slot + content fingerprint). When set,
   * interaction state (radio answers, checkbox groups, submit lock, field
   * values) persists to localStorage and restores on refresh / re-render of
   * the same content. Changing an existing key starts a fresh interaction
   * lifetime; a streaming instance adopts its first key without losing input.
   * GenuiBlock owns the matching React identity.
   */
  stateKey?: string | undefined
  /** Animate newly arriving items; settled message replays opt out. */
  animateEntrance?: boolean | undefined
  /** Native hosts own durable state instead of the browser store. Read once per stateKey. */
  initialState?: BlockInteractionState | undefined
  onStateChange?: ((state: BlockInteractionState) => void) | undefined
  /** Observe the current secret-free durable state without changing persistence ownership. */
  onStateSnapshot?: ((state: BlockInteractionState) => void) | undefined
}

/** Block-wide aggregation state. Grouped radios store one selected label in
 * `answers`; grouped checkboxes store a selected-label array in
 * `multiAnswers`. Keeping the registries separate preserves the existing
 * radio/local-grading string contract while allowing submit to expose one
 * unified `answers` payload (`string | string[]`). */
export interface AnswersState {
  answers: Record<string, string>
  /** Grouped checkbox selections. An empty array is meaningful: the user
   * explicitly cleared the group, so model-provided `checked` defaults must
   * not reappear after a durable restore. */
  multiAnswers: Record<string, string[]>
  /** Field values by id (input/textarea with an `id`), collected by submit. */
  fields: Record<string, string>
  /** Field ids whose value must never be persisted or collected (secrets). */
  secretFields: ReadonlySet<string>
  registry: SubmissionRegistry
  /** True after a local grading: questions are locked until 重新作答. */
  locked: boolean
  /** Bumped by every reset; radios use it as their remount key. */
  round: number
  setAnswer: (group: string, choice: string) => void
  setMultiAnswer: (group: string, choice: string, checked: boolean) => void
  setField: (id: string, value: string) => void
  registerSecretField: (id: string) => void
  clear: () => void
  setLocked: (locked: boolean) => void
}
