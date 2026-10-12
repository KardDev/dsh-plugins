/**
 * The `render_ui` tool: a model-facing channel that renders a GenUI spec as
 * an interactive card in the conversation TOOL ROW (route A of the design
 * doc). The ```dsh-ui fence channel renders inline in the reply; this tool
 * renders in the tool row and rides the harness's result `meta` projection:
 * `presentationMeta` stores the repaired spec, the browser toolview
 * (`src/client/toolview.tsx`) reads it from the result node and renders.
 *
 * Zero runtime harness imports, deliberately: an external plugin's node half
 * must not depend on the harness module graph at runtime (the profile
 * resolves only the plugin package itself). The definition is therefore a
 * plain `ToolDefinition` object — the exact shape `defineTool` returns — with
 * the arguments schema authored as JSON Schema (the harness validates args
 * and output with the same JSON Schema validator defineTool uses). Deep
 * validation, deterministic repair, and resource limits live in the shared
 * guard (`src/client/guard.ts`), which the schema deliberately stays loose
 * enough to reach.
 * @module @changfenhuang/dsh-genui/plugin/tool
 */

import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type { GenericCallView, GenericResultView, JsonSchemaNode, ToolDefinition } from '@deepseek-ai/dsh-tools'
import {
  isRenderableProcess, processGenuiSpec,
} from '../client/guard.ts'
import type { GenuiProcessResult } from '../client/guard.ts'
import { completeFenceJson } from '../shared/fence-repair.ts'
import { droppedNodeFailure } from './genui-diagnostic.ts'
import { collectInlineContentWarnings } from './inline-content-diagnostic.ts'
import type { GenuiSpec } from '../client/spec.ts'

/**
 * Arguments schema: an open `spec` slot. The schema must NOT reject anything
 * the guard could repair — the model's component trees are imperfect by
 * nature, and the guard heals them; argument validation would only strand
 * them. `additionalProperties: false` keeps the call shape honest.
 *
 * `spec` IS typed `object` on purpose: the guard can only repair plain
 * records (a serialized JSON string, array, or scalar root is unusable), so
 * argument validation rejecting non-objects loses nothing repairable — and
 * it stops the model from double-encoding the tree as a string (observed
 * twice in the wild), failing fast with a clear schema error instead.
 */
const RENDER_UI_PARAMETERS: Record<string, unknown> = {
  type: 'object',
  properties: {
    spec: {
      type: 'object',
      description: [
      'Render structured UI for the user (tool-row card). USE THIS whenever the answer contains ≥3 parallel points, a comparison, numbers/metrics, a step sequence, a flow, or a status/report — do NOT write those as markdown bullets or a markdown table.',
      'Same white-listed vocabulary as the ```dsh-ui fence (see the GenUI system-prompt section). Pick the fence when the UI belongs in the message body; pick this tool when the deliverable is a self-contained card.',
      'Deep-validated and repaired by the renderer. Pass the spec as a JSON OBJECT — never as a serialized JSON string (a string fails argument validation).',
    ].join(' '),
      // Structural hints for the tool-call bridge. A bare `object` here was
      // observed to make some bridge layers stringify the whole spec into an
      // OpenAI-style `{ arguments: "<JSON>" }` wrapper (and to corrupt long
      // specs mid-stream). Declaring the known top-level fields gives the
      // bridge a concrete shape to serialize directly, while the schema stays
      // deliberately open (unknown keys tolerated, `items` elements are free
      // objects) so the guard — not the schema — remains the repair authority.
      properties: {
        title: { type: 'string', description: 'Short title shown as the card banner.' },
        gap: { type: 'number', description: 'Vertical gap between root items in px.' },
        panel: { type: 'boolean', description: 'Panel-only: renders into the session panel dock instead of the message flow.' },
        items: {
          type: 'array',
          description: 'Root component list (white-listed vocabulary).',
          items: { type: 'object' },
        },
      },
    },
  },
  required: ['spec'],
  additionalProperties: false,
}

/** The tool's canonical value is a short model-facing summary string. */
const RENDER_UI_OUTPUT_SCHEMA: JsonSchemaNode = { type: 'string', description: 'One-line human-readable render summary for the model.' }

/**
 * Read the `spec` argument defensively (presenters run on replayed args).
 *
 * The harness tool-call bridge has been observed to deliver arguments in
 * shapes other than the authored `{ spec: <object> }`:
 * - `{ spec: "<JSON string>" }` — spec serialized to text;
 * - `{ arguments: "<JSON string>" }` / `{ arguments: <object> }` — a
 *   double-encoded wrapper from the SDK tool-call bridge (seen live in the
 *   web GUI: small specs arrived wrapped this way, large specs arrived with
 *   their JSON corrupted mid-stream);
 * - a bare JSON string (double-encoded root).
 * Each shape is unwrapped here so the guard can repair the actual tree.
 * Corrupted JSON cannot be recovered (bytes were lost in transit): it yields
 * `undefined` plus a diagnostic log line for the transport-layer bug.
 */
function specOf(args: unknown): unknown {
  if (typeof args === 'string') {
    return parseSpecJson(args, 'bare-string')
  }
  if (typeof args !== 'object' || args === null) return undefined
  const record = args as Record<string, unknown>
  if ('spec' in record) {
    const s = record.spec
    if (typeof s === 'string') return parseSpecJson(s, 'spec-string')
    return unwrapSpec(s, 'spec')
  }
  if ('arguments' in record) {
    const a = record.arguments
    if (typeof a === 'string') return parseSpecJson(a, 'arguments-string')
    if (typeof a === 'object' && a !== null) return unwrapSpec(a, 'arguments')
  }
  return undefined
}

/**
 * Peel nested `{ spec: ... }` wrapper layers. Observed bridge shapes nest the
 * authored `spec` object one or more levels deep (e.g. the serialized text
 * inside `{ arguments: "..." }` is itself `{ spec: { title, gap, items } }`),
 * so unwrapping stops only at a value that carries no `spec` key.
 */
function unwrapSpec(value: unknown, shape: string): unknown {
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    if ('spec' in record) {
      const s = record.spec
      if (typeof s === 'string') return parseSpecJson(s, `${shape}/spec-string`)
      return unwrapSpec(s, `${shape}/spec`)
    }
  }
  return value
}

/** Try to decode a serialized spec; log a diagnostic when it is broken. */
function parseSpecJson(raw: string, shape: string): unknown {
  try {
    return unwrapSpec(JSON.parse(raw), shape)
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error)
    const pos = /position (\d+)/.exec(detail)?.[1] ?? '?'
    console.error(`[genui-tool] spec wrapped as ${shape} but its JSON is broken (${raw.length} bytes, error at ${pos}); cannot recover — bytes lost in transit`)
    return undefined
  }
}

/** Process a raw tool value once for all render-time decisions. */
function processRenderableValue(value: unknown): GenuiProcessResult {
  return processGenuiSpec(value)
}

/** Wrap model-facing validation fields in the stable GenUI protocol envelope. */
function validationProtocol(lines: string[]): string {
  return ['[genui-validation]', ...lines, 'reply_language=conversation'].join('\n')
}

/** Render process diagnostics as stable model-facing warning fields. */
function formatProcessWarnings(processed: GenuiProcessResult): string[] {
  return processed.warnings.map(warning => {
    if (warning.kind === 'alias' && warning.canonical !== undefined) {
      const separator = warning.path.lastIndexOf('.')
      const canonicalPath = `${separator < 0 ? '' : warning.path.slice(0, separator + 1)}${warning.canonical}`
      return warning.message.includes('ignored')
        ? `warning=alias_ignored path=${warning.path} canonical=${canonicalPath}`
        : `warning=alias_normalized path=${warning.path} canonical=${canonicalPath}`
    }
    return `warning=process detail=${JSON.stringify(warning.message)}`
  })
}

/** 将行内字段的块级 Markdown 诊断写入稳定的验证协议。 */
function formatInlineContentWarnings(spec: GenuiSpec): string[] {
  return collectInlineContentWarnings(spec).map(warning =>
    `warning=block_markdown path=${warning.path} kind=${warning.kind} replacement=${warning.replacement}`)
}

/** Format chart-specific process errors while keeping other schema errors generic. */
function formatProcessFailure(processed: GenuiProcessResult): string | undefined {
  const chartErrors = processed.errors.filter(error => /(?:variant is unsupported|kind must be bars, line, or donut|requires data or series|(?:data|series) is required for|(?:\.data|\.series)(?:\[\d+\])?(?:\.(?:data|label|value|color))? must|series is only supported for bars)/.test(error))
  return chartErrors.length === 0 ? undefined : validationProtocol([
    'status=invalid',
    'error=invalid_chart_fields',
    ...chartErrors.map(error => `diagnostic=${JSON.stringify(error)}`),
    'next=fix_and_revalidate',
  ])
}

/** Tool-call title shared by the pending and completed presentations. */
function cardTitle(args: unknown): string | undefined {
  const processed = processRenderableValue(specOf(args))
  if (!isRenderableProcess(processed) || processed.spec === null) return undefined
  return `渲染 UI：${processed.spec.title ?? '未命名'}`
}

/**
 * Build the render_ui tool definition. Registered by the plugin node half;
 * `ctx.tools.register` consumes it exactly like a `defineTool` result.
 */
export function createRenderUiTool(): ToolDefinition {
  return {
    name: 'render_ui',
    description:
      'Render an interactive UI card in the conversation tool row by passing a GenUI spec (a white-listed component tree; the same vocabulary as the ```dsh-ui fence, see the system prompt). '
      + 'Use it when the user asks for a structured panel, dashboard, or form that belongs in the tool row rather than inline in the reply. '
      + 'The card is interactive client-side (tabs, buttons, inputs, switches); components carrying an "action" field send [genui-action] back to you when the user interacts, and you should re-render the updated UI.',
    parameters: RENDER_UI_PARAMETERS,
    output: {
      schema: RENDER_UI_OUTPUT_SCHEMA,
      render(_args: unknown, value: JsonValue): ContentBlock[] {
        return [{ type: 'text', text: String(value) }]
      },
      presentationMeta(args: unknown): JsonValue {
        // The browser toolview reads the repaired spec from result meta. The
        // spec is JSON-safe by construction (only string/number/boolean/array
        // fields after repair), so the widening cast is lossless.
        const processed = processRenderableValue(specOf(args))
        return (isRenderableProcess(processed) ? processed.spec : null) as unknown as JsonValue
      },
    },
    async execute(args: unknown): Promise<JsonValue> {
      const processed = processRenderableValue(specOf(args))
      if (processed.spec === null) {
        return ['[genui-render]', 'status=invalid', 'error=invalid_spec', 'required=items', 'next=fix_and_retry', 'reply_language=conversation'].join('\n')
      }
      if (!isRenderableProcess(processed)) {
        throw new Error('render_ui spec invalid: ' + processed.errors.join('; '))
      }
      const spec = processed.spec
      const warnings = formatProcessWarnings(processed)
      return [
        '[genui-render]',
        'status=rendered',
        ...(spec.title === undefined ? [] : [`title=${JSON.stringify(spec.title)}`]),
        `rendered=${processed.renderedCount}`,
        'action_feedback=[genui-action]',
        ...warnings,
        'reply_language=conversation',
      ].join('\n')
    },
    presentCall(args: unknown): GenericCallView | undefined {
      const title = cardTitle(args)
      return title === undefined ? undefined : { card: 'generic', title, kind: 'other' }
    },
    presentResult(args: unknown): GenericResultView | undefined {
      const title = cardTitle(args)
      return title === undefined ? undefined : { card: 'generic', title }
    },
  }
}

/**
 * The `validate_dsh_ui` tool: a model-facing pre-flight check for the
 * ```dsh-ui fence channel. The model calls it with the JSON text it is about
 * to put inside a fence; it reports whether the body parses as a valid GenUI
 * spec, and when it does not, WHERE it breaks and WHAT is likely wrong
 * (bracket counts, common typo classes) so the model can fix and re-validate
 * before emitting — turning "render a red banner after the fact" into
 * "verify before you send". Purely local: no LLM, no network, no DOM.
 */
const VALIDATE_DESCRIPTION =
  'Validate the JSON body of a ```dsh-ui fence BEFORE emitting it — use for non-trivial specs (≥3 nodes or containing a table); skip for trivial ones (≤2 nodes). '
  + 'Pass the exact JSON text you are about to put inside the fence as the "spec" argument (a string). '
  + 'Returns a [genui-validation] protocol block with status, diagnostics, next action, and reply_language=conversation. '
  + 'When invalid JSON is repairable, repaired_json contains the fixed body; emit it only with next=emit_repaired_fence. '
  + 'A warning=block_markdown requires the indicated replacement node and another validation call.'

const VALIDATE_PARAMETERS: Record<string, unknown> = {
  type: 'object',
  properties: {
    spec: {
      oneOf: [
        { type: 'string', description: 'The exact JSON text of the fence body.' },
        { type: 'object', description: 'The spec object (serialized before validation).' },
      ],
      description: 'The dsh-ui fence body to validate: pass the JSON as a string for an exact check, or as the spec object.',
    },
  },
  required: ['spec'],
  additionalProperties: false,
}

/** Read the fence-body text from the call args (string preferred, object serialized). */
function fenceTextOf(args: unknown): string | null {
  if (typeof args === 'string') return args
  if (typeof args !== 'object' || args === null) return null
  const record = args as Record<string, unknown>
  const s = 'spec' in record ? record.spec : 'arguments' in record ? record.arguments : undefined
  if (typeof s === 'string') return s
  if (typeof s === 'object' && s !== null) return JSON.stringify(s)
  return null
}

/** Count structural brackets outside string literals. */
function bracketCounts(raw: string): { '{': number; '}': number; '[': number; ']': number } {
  const counts = { '{': 0, '}': 0, '[': 0, ']': 0 }
  let inString = false
  let escaped = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!
    if (escaped) {
      escaped = false
      continue
    }
    if (inString) {
      if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') counts['{'] += 1
    else if (ch === '}') counts['}'] += 1
    else if (ch === '[') counts['['] += 1
    else if (ch === ']') counts[']'] += 1
  }
  return counts
}

/** Return stable structural count fields for an invalid JSON body. */
function bracketDiagnostic(raw: string): string[] {
  const c = bracketCounts(raw)
  const fields = [`braces_open=${c['{']}`, `braces_close=${c['}']}`, `brackets_open=${c['[']}`, `brackets_close=${c[']']}`]
  if (c['{'] !== c['}']) {
    const d = c['{'] - c['}']
    fields.push(`brace_delta=${d}`, `brace_action=${d > 0 ? `add:${d}` : `remove:${-d}`}`)
  }
  if (c['['] !== c[']']) {
    const d = c['['] - c[']']
    fields.push(`bracket_delta=${d}`, `bracket_action=${d > 0 ? `add:${d}` : `remove:${-d}`}`)
  }
  return fields
}

const COMMON_CAUSES = 'likely_causes=unbalanced_delimiters,unescaped_quote,trailing_comma,unterminated_string'

/** Build the validate_dsh_ui tool definition (registered alongside render_ui). */
export function createValidateDshUiTool(): ToolDefinition {
  return {
    name: 'validate_dsh_ui',
    description: VALIDATE_DESCRIPTION,
    parameters: VALIDATE_PARAMETERS,
    output: {
      schema: { type: 'string', description: 'Validation verdict for the model.' },
      render(_args: unknown, value: JsonValue): ContentBlock[] {
        return [{ type: 'text', text: String(value) }]
      },
    },
    async execute(args: unknown): Promise<JsonValue> {
      const raw = fenceTextOf(args)
      if (raw === null || raw.trim() === '') {
        return validationProtocol(['status=invalid', 'error=missing_spec', 'next=provide_spec'])
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch (error: unknown) {
        const detail = error instanceof Error ? error.message : String(error)
        // Pre-emission, both repair tiers are safe (no streaming half exists
        // in a validation call). When the repair succeeds, hand the model the
        // FIXED JSON instead of asking it to re-author the fix — re-writing
        // the whole fence by hand is where the next typo comes from.
        const repaired = completeFenceJson(raw)
        if (repaired !== null) {
          const repairedValue = JSON.parse(repaired.text) as unknown
          const processed = processRenderableValue(repairedValue)
          const chartFailure = formatProcessFailure(processed)
          if (chartFailure !== undefined) return chartFailure
          if (processed.spec !== null && processed.errors.length === 0) {
            const warnings = formatProcessWarnings(processed)
            const inlineWarnings = formatInlineContentWarnings(processed.spec)
            return `${validationProtocol([
              'status=invalid',
              'error=invalid_json',
              `detail=${JSON.stringify(detail)}`,
              ...bracketDiagnostic(raw),
              ...warnings,
              ...inlineWarnings,
              'repair=applied',
              `repair_count=${repaired.repairs}`,
              inlineWarnings.length === 0 ? 'next=emit_repaired_fence' : 'next=fix_and_revalidate',
            ])}\nrepaired_json:\n\`\`\`\n${repaired.text}\n\`\`\``
          }
        }
        return validationProtocol([
          'status=invalid',
          'error=invalid_json',
          `detail=${JSON.stringify(detail)}`,
          ...bracketDiagnostic(raw),
          'repair=failed',
          COMMON_CAUSES,
          'next=fix_and_revalidate',
        ])
      }
      const processed = processRenderableValue(parsed)
      const chartFailure = formatProcessFailure(processed)
      if (chartFailure !== undefined) return chartFailure
      if (processed.spec === null || processed.errors.length > 0) {
        const dropped = droppedNodeFailure(processed, parsed)
        return dropped === undefined
          ? validationProtocol([
            'status=invalid',
            'error=invalid_spec',
            ...(processed.errors.length === 0
              ? ['required=items', 'node_types=whitelist']
              : processed.errors.map(error => `diagnostic=${JSON.stringify(error)}`)),
            'next=fix_and_revalidate',
          ])
          : validationProtocol(['status=invalid', ...dropped, 'next=fix_and_revalidate'])
      }
      const warnings = formatProcessWarnings(processed)
      const inlineWarnings = formatInlineContentWarnings(processed.spec)
      return validationProtocol([
        'status=valid', `rendered=${processed.renderedCount}`, ...warnings, ...inlineWarnings,
        inlineWarnings.length === 0 ? 'next=emit_fence' : 'next=fix_and_revalidate',
      ])
    },
    presentCall(): GenericCallView | undefined {
      return { card: 'generic', title: '验证 dsh-ui 围栏', kind: 'other' }
    },
    presentResult(): GenericResultView | undefined {
      return { card: 'generic', title: '验证 dsh-ui 围栏' }
    },
  }
}
