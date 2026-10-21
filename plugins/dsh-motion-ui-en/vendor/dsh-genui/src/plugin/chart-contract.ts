import { validateGenuiChartSemantics } from '../client/guard.ts'

/**
 * Validate chart nodes using the guard's shared native renderability contract.
 * The plugin-facing API remains stable while the guard remains the single
 * owner of chart field and renderer-semantic rules.
 *
 * @param value - Raw GenUI spec or bare chart node.
 * @returns Chart errors in deterministic tree order.
 */
export function validateRenderableChartSemantics(value: unknown): string[] {
  return validateGenuiChartSemantics(value)
}
