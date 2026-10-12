/**
 * GenuiBlock: renders a declarative GenUI spec (from a ```dsh-ui fence in an
 * assistant reply) as real interactive components inline in the conversation.
 * The component tree is white-listed and mapped to DOM directly — no raw HTML.
 * The block shell holds the shared interaction state (answers registry,
 * durable localStorage persistence, action debounce); the per-family
 * components live in src/client/blocks/*.
 */
import { renderInline } from './inline.ts'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGenuiAction } from './action-context.ts'
import css from './GenuiBlock.module.css'
import { loadBlockState, saveBlockState } from './interaction-store.ts'
import { recordFence, recordInteraction } from './achievement-store.ts'
import { renderNode } from './blocks/render-node.tsx'
import type { AnswersState, GenuiBlockProps } from './blocks/state.ts'
import type { GenuiSpec } from './spec.ts'
import { compileSubmissionRegistry } from './submission-registry.ts'

export const GENUI_ACTION_DEBOUNCE_MS = 300

/**
 * Wrap the harness action callback. DISCRETE gestures (button, checkbox,
 * radio, switch, select, input, textarea, submit, quiz — every payload type
 * but `slider`) deliver immediately: each is one user intent, and SKILL.md
 * promises per-interaction `action` behavior, so collapsing them would
 * silently drop interactions from the model's view. Only the CONTINUOUS
 * gesture (slider drag) goes through the trailing debounce, keyed by action
 * name + payload `id`, so one control's drag still collapses to its last
 * value while distinct sliders sharing an action name never displace each
 * other. Absent provider = v1 behavior (components are display-only,
 * callback stays undefined). Pending timers are cleared on unmount so a
 * drag that never fired does not leak into the next mount. Timers live in
 * one stable map and read the latest handler through a ref, so provider
 * updates cannot leave stale callbacks behind.
 */
function useDebouncedAction(onAction: GenuiBlockProps['onAction'] | undefined): GenuiBlockProps['onAction'] {
  const pending = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const actionRef = useRef(onAction)
  actionRef.current = onAction

  useEffect(() => {
    return () => {
      for (const timer of pending.current.values()) clearTimeout(timer)
      pending.current.clear()
    }
  }, [])

  const debounced = useCallback((action: string, payload: Record<string, unknown>): void => {
    if (payload.type !== 'slider') {
      actionRef.current?.(action, payload)
      return
    }
    const key = `${action}\u0000${typeof payload.id === 'string' ? payload.id : ''}`
    const existing = pending.current.get(key)
    if (existing !== undefined) clearTimeout(existing)
    pending.current.set(key, setTimeout(() => {
      pending.current.delete(key)
      actionRef.current?.(action, payload)
    }, GENUI_ACTION_DEBOUNCE_MS))
  }, [])

  return onAction === undefined ? undefined : debounced
}

/**
 * Structural spec equality for the memo comparator: the fence path re-parses
 * the body on every streaming chunk and produces a FRESH object even when the
 * repaired content is unchanged (a chunk that closed no new component). The
 * default shallow memo would then re-render the whole tree per chunk — up to
 * ~200 full-tree renders for a max-size fence. Stringify equality makes the
 * memo skip renders whose content did not actually change; the cost is one
 * JSON.stringify per chunk (≤200 nodes, negligible next to a React tree
 * reconciliation). `stateKey` already embeds the content fingerprint, so when
 * both keys are equal and non-undefined the specs necessarily stringify
 * equal — the stringify branch matters for the streaming path (stateKey
 * undefined).
 */
function specEquivalent(a: GenuiSpec, b: GenuiSpec): boolean {
  if (a === b) return true
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Stateful implementation. Streaming state adopts its first durable key
 * when the reply settles; switching an existing durable key starts fresh. */
function GenuiBlockInstance({ spec, stateKey, animateEntrance = true, initialState, onStateChange, onStateSnapshot }: GenuiBlockProps) {
  const gap = spec.gap ?? 16
  const onAction = useDebouncedAction(useGenuiAction())
  const stateChangeRef = useRef(onStateChange)
  stateChangeRef.current = onStateChange
  const savesExternally = onStateChange !== undefined
  // Grouped radios and grouped checkboxes record their local selections here;
  // `submit` either grades radio-only papers locally or aggregates all form
  // state into one action. Block-local state survives streaming/panel
  // re-renders, and with a stateKey it also survives refresh/reopen.
  const [persisted] = useState(() => initialState ?? (onStateChange !== undefined || stateKey === undefined ? null : loadBlockState(stateKey)))
  const [answers, setAnswers] = useState<Record<string, string>>(persisted?.answers ?? {})
  const [multiAnswers, setMultiAnswers] = useState<Record<string, string[]>>(persisted?.multiAnswers ?? {})
  const [fields, setFields] = useState<Record<string, string>>(persisted?.fields ?? {})
  const submissionRegistry = useMemo(() => compileSubmissionRegistry(spec), [spec])
  const [locked, setLocked] = useState(persisted?.locked === true)
  const [round, setRound] = useState(0)
  // Secret (password) field ids: their values never persist and never join
  // submit collection — the input itself stays masked and its own action
  // still delivers the value on explicit user submit.
  const [secretFields, setSecretFields] = useState<ReadonlySet<string>>(new Set())
  const setAnswer = useCallback((group: string, choice: string) => {
    setAnswers(prev => (prev[group] === choice ? prev : { ...prev, [group]: choice }))
  }, [])
  const setMultiAnswer = useCallback((group: string, choice: string, checked: boolean) => {
    setMultiAnswers(prev => {
      const current = prev[group] ?? []
      const next = checked
        ? current.includes(choice) ? current : [...current, choice]
        : current.filter(item => item !== choice)
      const hadGroup = Object.prototype.hasOwnProperty.call(prev, group)
      if (hadGroup && next.length === current.length && next.every((item, index) => item === current[index])) {
        return prev
      }
      // Keep an explicit empty array: it distinguishes "user cleared this
      // group" from "group never had local state", so checked defaults do not
      // reappear after a refresh.
      return { ...prev, [group]: next }
    })
  }, [])
  const setField = useCallback((id: string, value: string) => {
    // Field state presence means "the user has touched this field" — a blank
    // value is stored as '' instead of deleting the entry, so a user who
    // CLEARS a model-provided default does not get the default back on the
    // next mount. Blank values are still excluded from submit collection by
    // SubmitNode's filledFields filter (and from persistence for secrets), so
    // this does not change what the model receives.
    setFields(prev => (prev[id] === value ? prev : { ...prev, [id]: value }))
  }, [])
  const registerSecretField = useCallback((id: string) => {
    setSecretFields(prev => (prev.has(id) ? prev : new Set(prev).add(id)))
  }, [])
  const clear = useCallback(() => {
    setAnswers({})
    setMultiAnswers({})
    setLocked(false)
    setRound(r => r + 1) // radios remount (key carries the round) with clean selections
  }, [])
  const answersState = useMemo<AnswersState>(
    () => ({
      answers, multiAnswers, fields, secretFields, registry: submissionRegistry, locked, round,
      setAnswer, setMultiAnswer, setField, registerSecretField, clear, setLocked,
    }),
    [answers, multiAnswers, fields, secretFields, submissionRegistry, locked, round, setAnswer, setMultiAnswer, setField, registerSecretField, clear],
  )
  const durableState = useMemo(() => {
    const safeFields = Object.fromEntries(Object.entries(fields).filter(([id]) => !secretFields.has(id)))
    return {
      answers,
      ...(Object.keys(multiAnswers).length > 0 ? { multiAnswers } : {}),
      locked,
      ...(Object.keys(safeFields).length > 0 ? { fields: safeFields } : {}),
    }
  }, [answers, multiAnswers, locked, fields, secretFields])
  useEffect(() => {
    onStateSnapshot?.(durableState)
  }, [durableState, onStateSnapshot])
  // Achievement telemetry: every emitted action counts as one interaction
  // (the debounced emit fires once per real user action).
  const trackedAction = useMemo(() => {
    if (onAction === undefined) return undefined
    return (action: string, payload: Record<string, unknown>): void => {
      recordInteraction()
      onAction(action, payload)
    }
  }, [onAction])
  // Durable save (debounced 300ms — typing in a field fires per keystroke).
  // Secret field values are stripped before writing: passwords never persist.
  useEffect(() => {
    if (savesExternally) {
      stateChangeRef.current?.(durableState)
      return
    }
    if (stateKey === undefined) return
    const timer = setTimeout(() => saveBlockState(stateKey, durableState), 300)
    return () => clearTimeout(timer)
  }, [stateKey, durableState, savesExternally])
  // Achievement telemetry (0.9.5): the store dedupes by spec fingerprint, so
  // streaming re-renders and replays count once per distinct content.
  useEffect(() => {
    recordFence(spec)
  }, [spec])
  return (
    <div className={css.block} data-genui>
      {spec.title !== undefined && <div className={css.banner}>{renderInline(spec.title)}</div>}
      <div className={css.col} style={{ gap: `${gap}px` }}>
        {spec.items.map((c, i) => (
          // Staggered reveal: each root item fades/slides in after its
          // predecessors, so the block assembles piece by piece instead of
          // popping in as one slab. Delay capped so long specs still settle
          // quickly; prefers-reduced-motion disables it (see CSS).
          <div
            key={i}
            className={css.reveal}
            style={{
              animationDelay: `${Math.min(i * 90, 720)}ms`,
              ...(!animateEntrance || persisted !== null ? { animation: 'none' } : {}),
            }}
            onAnimationEnd={event => {
              // Reattaching this DOM node must not replay its completed entrance.
              if (event.target === event.currentTarget) event.currentTarget.style.animation = 'none'
            }}
          >
            {renderNode(c, i, trackedAction, 0, answersState)}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Render a GenUI spec as an inline block. `stateKey` is also the durable
 * component identity. A streaming instance adopts its first durable key so
 * inputs and pending actions survive settling. Leaving an existing durable
 * key remounts, keeping different blocks' interaction state isolated.
 */
export const GenuiBlock = memo(function GenuiBlock(props: GenuiBlockProps) {
  const [identity, setIdentity] = useState({ stateKey: props.stateKey, generation: 0 })
  if (identity.stateKey !== props.stateKey) {
    setIdentity({
      stateKey: props.stateKey,
      generation: identity.generation + (identity.stateKey === undefined ? 0 : 1),
    })
  }
  return <GenuiBlockInstance key={identity.generation} {...props} />
}, (prev, next) => prev.stateKey === next.stateKey
  && prev.animateEntrance === next.animateEntrance && prev.onStateChange === next.onStateChange
  && prev.onStateSnapshot === next.onStateSnapshot
  && specEquivalent(prev.spec, next.spec))
