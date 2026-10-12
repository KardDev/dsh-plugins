import { renderInline } from '../inline.ts'
import { useEffect, useState } from 'react'
import css from '../GenuiBlock.module.css'
import type { GenuiCheckbox } from '../spec.ts'
import type { AnswersState, GenuiBlockProps } from './state.ts'

/**
 * Checkbox with two backwards-compatible modes:
 *
 * - no `group`: legacy local toggle + optional per-click action;
 * - with `group`: local-only multi-select state collected by a sibling submit.
 *
 * A persisted group key wins over `checked`, including an explicit empty
 * array. This lets a user clear every default-checked option without those
 * defaults reappearing after refresh.
 */
export function CheckboxNode({ node, onAction, answers }: {
  node: GenuiCheckbox
  onAction?: GenuiBlockProps['onAction']
  answers?: AnswersState | undefined
}) {
  const group = node.group
  const grouped = group !== undefined
  const hasRecordedGroup = group !== undefined
    && Object.prototype.hasOwnProperty.call(answers?.multiAnswers ?? {}, group)
  const recorded = group === undefined ? undefined : answers?.multiAnswers[group]
  const groupChecked = hasRecordedGroup
    ? Array.isArray(recorded) && recorded.includes(node.label)
    : node.checked === true
  const [checked, setChecked] = useState(node.checked === true)

  useEffect(() => {
    if (group === undefined || node.checked !== true || hasRecordedGroup) return
    // Model-provided defaults are real initial selections, but never override
    // a restored user choice (including an explicitly empty group).
    answers?.setMultiAnswer(group, node.label, true)
    // answers is intentionally omitted: the callbacks are stable and a
    // registry update should not re-register the same default.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, node.checked, node.label, hasRecordedGroup])

  return (
    <label className={css.checkbox}>
      <input
        type="checkbox"
        checked={grouped ? groupChecked : checked}
        onChange={e => {
          const next = e.currentTarget.checked
          setChecked(next)
          if (grouped) {
            // Aggregation mode: update local multi-answer state only.
            answers?.setMultiAnswer(group, node.label, next)
          } else if (node.action !== undefined && onAction !== undefined) {
            onAction(node.action, { type: 'checkbox', checked: next })
          }
        }}
      />
      <span>{renderInline(node.label, false)}</span>
    </label>
  )
}
