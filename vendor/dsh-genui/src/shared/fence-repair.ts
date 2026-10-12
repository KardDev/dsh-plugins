/**
 * Shared fence-body JSON repair — pure string functions, no DOM, no I/O.
 * Used by BOTH the client fence renderer (tier-1/tier-2 auto-repair before
 * rendering) and the node-side validate_dsh_ui tool (which returns the
 * repaired JSON to the model instead of making it re-author the fix).
 *
 * Two tiers, deliberately gated differently by the callers:
 * - Tier-1 (`repairFenceJson`): heals the most common model JSON typos that
 *   do NOT change the body's structure — unescaped half-width quotes inside
 *   string values and trailing commas. Safe at any time (streaming included),
 *   adopted only when the WHOLE body parses afterwards.
 * - Tier-2 (`completeFenceJson`): heals structural incompleteness — missing
 *   closing quotes/brackets — by appending the missing terminators, and
 *   skips mismatched closers (a `]` mistyped as `}`, duplicated terminators).
 *   SETTLED MESSAGES ONLY: a streaming half must never be adopted as a
 *   finished prefix.
 * @module @changfenhuang/dsh-genui/shared/fence-repair
 */

/** A fence body counts as complete when it parses as a whole JSON value. */
export function isCompleteJson(raw: string): boolean {
  try {
    JSON.parse(raw)
    return true
  } catch {
    return false
  }
}

/** Short human-readable reason for a body that fails whole-JSON parsing, or
 * null when it parses. Positions come from the host's JSON.parse error. */
export function describeJsonFailure(raw: string): string | null {
  try {
    JSON.parse(raw)
    return null
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const pos = msg.match(/position (\d+)/i)
    const where = pos !== null ? `（字符 ${pos[1]} 附近）` : ''
    return `${where}${msg.slice(0, 140)}`
  }
}

/**
 * Tier-1 repair — SAFE AT ANY TIME (streaming included): heals the most
 * common model JSON typos that do NOT change the body's structure, and only
 * when the whole body parses afterwards (so a still-growing streaming half
 * can never be adopted):
 *
 * 1. Unescaped half-width `"` inside a string value — Chinese text quoted
 *    with ASCII quotes (e.g. `对"别名路径"判定失败`), which makes JSON.parse
 *    fail near that quote with "Expected ',' or ']'...".
 * 2. Trailing commas before `}` / `]` or at end of input.
 *
 * A shared grammar-aware scan distinguishes object keys from values and
 * checks the continuation after a potential string terminator. Ambiguous
 * value quotes use bounded backtracking; trailing commas are dropped only
 * outside strings.
 *
 * Returns `{ text, repairs }` on success, or null when nothing needed fixing
 * or the body still does not parse (callers fall through to tier-2 / banner).
 */
export function repairFenceJson(raw: string): { text: string; repairs: number } | null {
  try {
    JSON.parse(raw)
    return null
  } catch {
    // fall through to the repair scan
  }
  return scanFenceJson(raw, false)
}

/** A fixed search budget prevents quote ambiguity from becoming exponential. */
const MAX_QUOTE_ATTEMPTS = 32
const MAX_QUOTE_LOOKAHEAD = 4096

type JsonScope = {
  closer: '}' | ']'
  expecting: 'key' | 'colon' | 'value' | 'comma'
}
type RepairScan = {
  text: string
  repairs: number
  rootEnd: number
  rawRootEnd: number
  choices: number[]
  unfinishedString: boolean
  invalidValue: boolean
}

function isJsonSpace(ch: string | undefined): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r'
}

/**
 * Quote closure is contextual: only keys may be followed by `:`, and a comma
 * must introduce the next member of the enclosing object/array. Walk closing
 * delimiters too, so a bracket in a quoted code example cannot end a value
 * when prose immediately follows it inside the enclosing JSON structure.
 * Lookahead has a fixed bound; inconclusive long continuations keep the
 * terminator interpretation and leave the final JSON.parse as the arbiter.
 */
function quoteCanClose(raw: string, index: number, key: boolean, scopes: JsonScope[], complete: boolean): boolean {
  const limit = Math.min(raw.length, index + MAX_QUOTE_LOOKAHEAD)
  let cursor = index + 1
  const skipSpace = (): void => { while (cursor < limit && isJsonSpace(raw[cursor])) cursor++ }
  skipSpace()
  if (cursor >= limit) return true
  if (key) return raw[cursor] === ':'
  let scopeIndex = scopes.length - 1
  if (raw[cursor] === ':') return false
  while (raw[cursor] === '}' || raw[cursor] === ']') {
    const scope = scopes[scopeIndex]
    if (scope === undefined) return false
    if (raw[cursor] === scope.closer) scopeIndex--
    else if (!complete) return false
    cursor++
    skipSpace()
    if (cursor >= limit) return true
    // Tier-2 can retain a complete root prefix followed by junk. It tries
    // whole-body quote alternatives before actually adopting that prefix.
    if (scopeIndex < 0) return complete
  }
  if (raw[cursor] !== ',') return false
  const scope = scopes[scopeIndex]
  if (scope === undefined) return false
  cursor++
  skipSpace()
  if (cursor >= limit) return true
  if (raw[cursor] === scope.closer) return true // a removable trailing comma
  if (scope.closer === ']') return /["[{tfn\-0-9]/.test(raw[cursor]!)
  if (raw[cursor] !== '"') return false
  // An object comma must be followed by a quoted key and its colon. Escapes
  // in that key are skipped without changing them.
  cursor++
  while (cursor < limit) {
    if (raw[cursor] === '\\') { cursor += 2; continue }
    if (raw[cursor] === '"') {
      cursor++
      skipSpace()
      return cursor >= limit || raw[cursor] === ':'
    }
    if (raw[cursor]!.charCodeAt(0) < 0x20) return false
    cursor++
  }
  return true
}

/** Both tiers share the same string-aware scan and quote decisions. */
function scanFenceCandidate(raw: string, complete: boolean, contentQuotes: ReadonlySet<number>): RepairScan {
  let out = ''
  const scopes: JsonScope[] = []
  let inString = false
  let key = false
  let interiorQuote = false
  let escaped = false
  let repairs = 0
  let rootEnd = 0
  let rawRootEnd = 0
  let invalidValue = false
  const choices: number[] = []
  const finishValue = (): void => {
    const scope = scopes[scopes.length - 1]
    if (scope !== undefined) scope.expecting = 'comma'
  }
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!
    if (escaped) {
      if (inString && ch === '"') interiorQuote = true
      out += ch
      escaped = false
      continue
    }
    if (inString) {
      if (ch === '\\') { out += ch; escaped = true; continue }
      if (ch !== '"') { out += ch; continue }
      let next = i + 1
      while (next < raw.length && isJsonSpace(raw[next])) next++
      // Without any interior quote, a delimiter-looking quote is a normal
      // terminator even if its sibling is malformed. Do not absorb a broken
      // bare value merely to make structural completion succeed.
      const ordinaryEnd = !key && ((!interiorQuote && ',}]:'.includes(raw[next] ?? '\0'))
        || (scopes[scopes.length - 1]?.closer === ']' && raw[next] === ','))
      if (!contentQuotes.has(i) && (ordinaryEnd || quoteCanClose(raw, i, key, scopes, complete))) {
        inString = false
        out += ch
        const scope = scopes[scopes.length - 1]
        if (key) {
          if (scope !== undefined) scope.expecting = 'colon'
        } else {
          finishValue()
          // Only value terminators create alternatives. Retaining at most
          // 32 recent decisions bounds the pending search and its memory.
          if (scope !== undefined && interiorQuote) {
            if (choices.length === MAX_QUOTE_ATTEMPTS) choices.shift()
            choices.push(i)
          }
        }
      } else {
        out += '\\"'
        interiorQuote = true
        repairs++
      }
      continue
    }
    if (ch === '"') {
      key = scopes[scopes.length - 1]?.expecting === 'key'
      interiorQuote = false
      inString = true
      out += ch
      continue
    }
    if (ch === '{' || ch === '[') {
      finishValue()
      scopes.push({ closer: ch === '{' ? '}' : ']', expecting: ch === '{' ? 'key' : 'value' })
      out += ch
      continue
    }
    if (ch === '}' || ch === ']') {
      if (scopes[scopes.length - 1]?.closer === ch) {
        scopes.pop()
        out += ch
        if (scopes.length === 0 && rootEnd === 0) {
          rootEnd = out.length
          rawRootEnd = i + 1
        }
      } else if (complete) repairs++
      else out += ch
      continue
    }
    if (ch === ',') {
      let j = i + 1
      while (j < raw.length && isJsonSpace(raw[j])) j++
      if (j === raw.length || raw[j] === '}' || raw[j] === ']') {
        repairs++
        continue
      }
      const scope = scopes[scopes.length - 1]
      if (scope !== undefined) scope.expecting = scope.closer === '}' ? 'key' : 'value'
    } else if (ch === ':') {
      const scope = scopes[scopes.length - 1]
      if (scope !== undefined) scope.expecting = 'value'
    } else if (!isJsonSpace(ch) && scopes[scopes.length - 1]?.expecting === 'value') {
      // Invalid bare values are not quote ambiguity: do not turn an earlier
      // finished string into a container for `broken` / `undefined` tokens.
      let j = i + 1
      while (j < raw.length && !isJsonSpace(raw[j]) && !'{}[],:"'.includes(raw[j]!)) j++
      const token = raw.slice(i, j)
      if (!/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)$/.test(token)) invalidValue = true
      finishValue()
      out += token
      i = j - 1
      continue
    }
    out += ch
  }
  const unfinishedString = inString
  if (complete) {
    if (inString) { out += '"'; repairs++ }
    while (scopes.length > 0) { out += scopes.pop()!.closer; repairs++ }
  }
  return { text: out, repairs, rootEnd, rawRootEnd, choices, unfinishedString, invalidValue }
}

/** Find an authoritative, already-valid object/array prefix without repair. */
function originalJsonPrefix(raw: string): string | null {
  const scopes: string[] = []
  let inString = false
  let escaped = false
  let started = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!
    if (escaped) { escaped = false; continue }
    if (inString) {
      if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (!started) {
      if (isJsonSpace(ch)) continue
      if (ch !== '{' && ch !== '[') return null
      started = true
    }
    if (ch === '"') { inString = true; continue }
    if (ch === '{' || ch === '[') scopes.push(ch === '{' ? '}' : ']')
    else if (ch === '}' || ch === ']') {
      if (scopes.pop() !== ch) return null
      if (scopes.length === 0) {
        const text = raw.slice(0, i + 1).trimEnd()
        try { JSON.parse(text); return text } catch { return null }
      }
    }
  }
  return null
}

/**
 * Prefer real terminators; if the resulting whole body fails, try interpreting
 * a bounded number of ambiguous value quotes as content. Each attempt is an
 * iterative scan, not a recursive parser; no engine-specific error offset is
 * needed. Fixed attempts/lookahead give O(n) time and O(n) working storage.
 */
function scanFenceJson(raw: string, complete: boolean): { text: string; repairs: number } | null {
  // A genuine original root is authoritative. Never reinterpret its closing
  // quote to absorb a second object or prose, even during speculative repair.
  const original = originalJsonPrefix(raw)
  if (original !== null) return complete ? { text: original, repairs: 1 } : null
  const pending: number[][] = [[]]
  let prefix: { text: string; repairs: number; rawEnd: number } | null = null
  for (let attempt = 0; attempt < MAX_QUOTE_ATTEMPTS && pending.length > 0; attempt++) {
    const forced = pending.pop()!
    const scanned = scanFenceCandidate(raw, complete, new Set(forced))
    // A speculative branch must find a real closing quote. Appending one to
    // that branch could swallow malformed sibling fields into invented text.
    if (scanned.repairs > 0 && !(forced.length > 0 && scanned.unfinishedString)) {
      try {
        JSON.parse(scanned.text)
        return { text: scanned.text, repairs: scanned.repairs }
      } catch { /* try a different bounded quote interpretation */ }
    }
    // Validate possible prefixes now, but do not adopt one until all whole-
    // body alternatives have failed. Prefer the one that retains the most
    // source text, rather than an earlier quote mistaken for a root end.
    if (complete && scanned.rootEnd > 0 && (prefix === null || scanned.rawRootEnd > prefix.rawEnd)) {
      const text = scanned.text.slice(0, scanned.rootEnd).trimEnd()
      try {
        JSON.parse(text)
        prefix = { text, repairs: scanned.repairs + 1, rawEnd: scanned.rawRootEnd }
      } catch { /* a balanced but invalid prefix cannot be adopted */ }
    }
    if (scanned.invalidValue) continue
    const last = forced[forced.length - 1] ?? -1
    for (const quote of scanned.choices) {
      if (quote > last) pending.push([...forced, quote])
    }
    // Newer decisions are tried first. Discard older pending branches when
    // the fixed budget is full instead of accumulating an exponential tree.
    if (pending.length > MAX_QUOTE_ATTEMPTS) pending.splice(0, pending.length - MAX_QUOTE_ATTEMPTS)
  }
  // Balanced-prefix adoption remains strictly tier-2 / settled-only, and only
  // after whole-body repair attempts have failed.
  if (prefix !== null) return { text: prefix.text, repairs: prefix.repairs }
  return null
}

/**
 * 取**第一个平衡根值**的文本（丢弃其后的杂字符）；没有平衡根时返回 null。
 *
 * 与 {@link completeFenceJson} 里的前缀回退同源，但**只做裁剪、不做结构补全**：
 * 内容识别用它来容忍「合法 JSON + 尾部泄漏文本」（真实样本：模型把自己的工具调用
 * 模板泄漏在 JSON 之后，且围栏没闭合）。根值正好结束在末尾时返回 null —— 那种情况
 * `JSON.parse` 本来就会成功。
 *
 * @param text - 候选正文。
 * @returns 平衡根前缀；无可裁剪内容时 null。
 */
export function trimToBalancedRoot(text: string): string | null {
  const stack: Array<'}' | ']'> = []
  let inString = false
  let escaped = false
  let started = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
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
      started = true
      continue
    }
    if (ch === '{') {
      stack.push('}')
      started = true
      continue
    }
    if (ch === '[') {
      stack.push(']')
      started = true
      continue
    }
    if (ch === '}' || ch === ']') {
      // 不匹配的闭括号 ⇒ 这份正文结构上已经坏了，不做"裁剪"式的猜测。
      if (stack[stack.length - 1] !== ch) return null
      stack.pop()
      if (stack.length === 0 && started) {
        if (i + 1 >= text.length) return null
        return text.slice(0, i + 1).trim()
      }
    }
  }
  return null
}

/**
 * Rewrite the "Tetris table" shape into legal JSON: the model closed the
 * `columns` array after the header cells and then wrote the row matrix as a
 * SIBLING array element —
 *
 *     "columns":["a","b"],["rows":[["1","2"],["3","4"]]]
 *
 * The element after `columns` is a `rows` field wearing the wrong hat, so
 * restore the key (`"rows":[…]`) and drop the closer the mis-nesting left
 * over (the final bracket-depth rescan removes every unmatched closer). Safe
 * by construction: only applied to a body that does not parse, and the caller
 * adopts the result only when the WHOLE body then parses.
 *
 * @param raw - the raw fence body.
 * @returns the rewritten body plus the edit count, or null when the shape is
 *   not present (or the columns array never closes).
 */
function rewriteTetrisTableColumns(raw: string): { text: string; repairs: number } | null {
  if (!/"columns"\s*:\s*\[/.test(raw)) return null
  let text = ''
  let rest = raw
  let edits = 0
  while (true) {
    const match = /"columns"\s*:\s*\[/.exec(rest)
    if (match === null) { text += rest; break }
    const start = match.index + match[0]!.length
    // Walk to the matching `]` of this columns array, string-aware.
    let depth = 1
    let inString = false
    let escaped = false
    let end = -1
    for (let i = start; i < rest.length; i++) {
      const ch = rest[i]!
      if (escaped) { escaped = false; continue }
      if (inString) {
        if (ch === '\\') escaped = true
        else if (ch === '"') inString = false
        continue
      }
      if (ch === '"') { inString = true; continue }
      if (ch === '[') depth++
      else if (ch === ']') { depth--; if (depth === 0) { end = i; break } }
    }
    if (end < 0) return null
    const after = rest.slice(end + 1)
    // Two Tetris spellings, both meaning "the rows matrix is a sibling array
    // of `columns`": with the key already inside the array (`[ "rows": […]`)
    // or as a bare matrix (`[ […], […] ]`).
    const keyed = /^\s*,\s*\[\s*"rows"\s*:\s*\[/.exec(after)
    if (keyed !== null) {
      const through = end + 1 + keyed[0]!.length
      text += `${rest.slice(0, end + 1)},"rows":[`
      rest = rest.slice(through)
      edits += 1
      continue
    }
    const nextArray = /^\s*,\s*\[/.exec(after)
    if (nextArray === null) {
      text += rest.slice(0, end + 1)
      rest = after
      continue
    }
    const throughBracket = end + 1 + nextArray[0]!.length
    text += rest.slice(0, throughBracket).replace(/,\s*\[$/, ', "rows": [')
    rest = rest.slice(throughBracket)
    edits += 1
  }
  if (edits === 0) return null
  // Drop the closers the mis-nesting left without a partner.
  const stack: string[] = []
  let out = ''
  let inString = false
  let escaped = false
  for (const ch of text) {
    if (escaped) { out += ch; escaped = false; continue }
    if (inString) {
      out += ch
      if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') { inString = true; out += ch; continue }
    if (ch === '{' || ch === '[') { stack.push(ch); out += ch; continue }
    if (ch === '}' || ch === ']') {
      const open = stack[stack.length - 1]
      if ((ch === '}' && open === '{') || (ch === ']' && open === '[')) {
        stack.pop()
        out += ch
      } else edits += 1                   // stray closer → drop it
      continue
    }
    out += ch
  }
  return { text: out, repairs: edits }
}

/**
 * Tier-2 repair — SETTLED MESSAGES ONLY (never while streaming): heals
 * structural incompleteness — missing closing quotes/brackets — by appending
 * the missing terminators, and heals stray closers — a `]` mistyped as `}` or
 * a duplicated terminator — by skipping closers that do not match the open
 * stack (they cannot be legal JSON). Callers gate it on settled messages (the
 * client uses the host-provided fence source; the validate tool is by
 * definition pre-emission), so a streaming half can never flash premature UI.
 *
 * One shared scan implementation folds the tier-1 fixes (quote escaping +
 * trailing-comma drops) into structural completion, so bodies with BOTH defects
 * (a trailing comma AND a missing closer) heal in one shot — the old
 * two-phase chain lost tier-1's partial work when its whole-body parse
 * failed, and re-scanning the raw text could not compose the repairs.
 * Adopted only when the completed body parses as whole JSON.
 */
export function completeFenceJson(raw: string): { text: string; repairs: number } | null {
  try {
    JSON.parse(raw)
    return null
  } catch {
    // fall through to the unified repair scan
  }
  // Shape defect first: the "Tetris table" nesting cannot be healed by the
  // closer-appending scan below (its brackets are balanced — just nested
  // wrongly), so rewrite the shape, then let the scan run on the result.
  const tetris = rewriteTetrisTableColumns(raw)
  if (tetris !== null) {
    try {
      JSON.parse(tetris.text)
      return tetris
    } catch {
      // Tetris 形状修复可能暴露需要 tier-2 继续处理的结构问题。
    }
    const scanned = completeFenceJson(tetris.text)
    if (scanned === null) return null
    return { text: scanned.text, repairs: scanned.repairs + tetris.repairs }
  }
  return scanFenceJson(raw, true)
}
