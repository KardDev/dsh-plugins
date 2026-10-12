/**
 * SafeMath: a restricted math expression evaluator for GenUI plot specs.
 *
 * The model supplies an expression string like "sin(x) * 2 + 1". It is parsed
 * and evaluated here WITHOUT eval / new Function: a hand-written recursive
 * descent parser over a white-listed function/constant vocabulary. Unknown
 * identifiers, object property access, and call syntax other than the
 * white-listed functions are parse errors, so an adversarial expression
 * cannot reach globals, prototypes, or side effects.
 *
 * Supported grammar:
 *   expr    := term (('+' | '-') term)*
 *   term    := unary (('*' | '/' | '%') unary)*
 *   unary   := ('-' | '+') unary | power
 *   power   := atom ('^' atom)?
 *   atom    := number | variable | constant | func '(' expr ')' | '(' expr ')'
 *   variable: 'x' (and any single-letter variable present in vars)
 *   constant: 'pi' | 'e' | 'tau'
 *   func    : sin cos tan asin acos atan sqrt cbrt exp log ln abs floor ceil round min max pow
 */

export interface SafeMathOptions {
  /** Variable values; only names present here may be referenced as variables. */
  vars?: Record<string, number>
}

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
  tau: Math.PI * 2,
}

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sqrt: Math.sqrt, cbrt: Math.cbrt,
  exp: Math.exp, log: Math.log10, ln: Math.log,
  abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round,
  min: Math.min, max: Math.max,
  pow: (a, b) => Math.pow(a, b),
}

class ParseError extends Error {
  constructor(message: string, readonly pos: number) {
    super(`SafeMath parse error at ${pos}: ${message}`)
  }
}

class SafeMathParser {
  private i = 0
  constructor(private readonly src: string, private readonly vars: Record<string, number>) {}

  parse(): (x: number) => number {
    const node = this.parseExpr()
    this.skipWs()
    if (this.i < this.src.length) throw new ParseError('unexpected trailing input', this.i)
    return this.evalNode(node)
  }

  private evalNode(node: number | ((x: number) => number)): (x: number) => number {
    if (typeof node === 'number') return () => node
    return node
  }

  private parseExpr(): number | ((x: number) => number) {
    let left = this.parseTerm()
    for (;;) {
      this.skipWs()
      const c = this.peek()
      if (c === '+' || c === '-') {
        this.i++
        const right = this.parseTerm()
        const op = c
        const prev = left
        left = op === '+'
          ? (x) => this.asNum(prev, x) + this.asNum(right, x)
          : (x) => this.asNum(prev, x) - this.asNum(right, x)
      } else return left
    }
  }

  private parseTerm(): number | ((x: number) => number) {
    let left = this.parseUnary()
    for (;;) {
      this.skipWs()
      const c = this.peek()
      if (c === '*' || c === '/' || c === '%') {
        this.i++
        const right = this.parseUnary()
        const op = c
        const prev = left
        left = op === '*'
          ? (x) => this.asNum(prev, x) * this.asNum(right, x)
          : op === '/'
            ? (x) => this.asNum(prev, x) / this.asNum(right, x)
            : (x) => this.asNum(prev, x) % this.asNum(right, x)
      } else return left
    }
  }

  private parseUnary(): number | ((x: number) => number) {
    this.skipWs()
    const c = this.char()
    if (c === '-' || c === '+') {
      this.i++
      const operand = this.parseUnary()
      return c === '-' ? (x) => -this.asNum(operand, x) : (x) => this.asNum(operand, x)
    }
    return this.parsePower()
  }

  private parsePower(): number | ((x: number) => number) {
    const base = this.parseAtom()
    this.skipWs()
    if (this.peek() === '^') {
      this.i++
      const exp = this.parsePower()
      const prev = base
      return (x) => Math.pow(this.asNum(prev, x), this.asNum(exp, x))
    }
    return base
  }

  private parseAtom(): number | ((x: number) => number) {
    this.skipWs()
    const c = this.char()
    if (c === '(') {
      this.i++
      const inner = this.parseExpr()
      this.skipWs()
      if (this.peek() !== ')') throw new ParseError('expected )', this.i)
      this.i++
      return inner
    }
    if (c >= '0' && c <= '9' || c === '.') return this.parseNumber()
    if (this.isIdentStart(c)) return this.parseIdent()
    throw new ParseError(`unexpected character '${c}'`, this.i)
  }

  private parseNumber(): number {
    const start = this.i
    let sawDigit = false

    while (this.i < this.src.length && /[0-9]/.test(this.src[this.i]!)) {
      sawDigit = true
      this.i++
    }

    if (this.peek() === '.') {
      this.i++
      while (this.i < this.src.length && /[0-9]/.test(this.src[this.i]!)) {
        sawDigit = true
        this.i++
      }
    }

    if (!sawDigit) {
      throw new ParseError(`invalid number '${this.src.slice(start, this.i)}'`, start)
    }

    if (this.peek() === 'e' || this.peek() === 'E') {
      this.i++
      if (this.peek() === '+' || this.peek() === '-') this.i++
      const exponentStart = this.i
      while (this.i < this.src.length && /[0-9]/.test(this.src[this.i]!)) this.i++
      if (this.i === exponentStart) {
        throw new ParseError(`invalid number '${this.src.slice(start, this.i)}'`, start)
      }
    }

    const text = this.src.slice(start, this.i)
    const value = Number(text)
    if (Number.isNaN(value)) throw new ParseError(`invalid number '${text}'`, start)
    return value
  }

  private parseIdent(): number | ((x: number) => number) {
    const start = this.i
    while (this.i < this.src.length && this.isIdentChar(this.src[this.i]!)) this.i++
    const name = this.src.slice(start, this.i)
    this.skipWs()
    if (this.peek() === '(') {
      // Function call.
      const fn = FUNCTIONS[name]
      if (fn === undefined) throw new ParseError(`unknown function '${name}'`, start)
      this.i++
      const args: Array<number | ((x: number) => number)> = []
      this.skipWs()
      if (this.peek() === ')') {
        this.i++
      } else {
        for (;;) {
          args.push(this.parseExpr())
          this.skipWs()
          const sep = this.peek()
          if (sep === ',') { this.i++; continue }
          if (sep === ')') { this.i++; break }
          throw new ParseError('expected , or ) in call', this.i)
        }
      }
      return (x) => fn(...args.map(a => this.asNum(a, x)))
    }
    // Own-property checks only: `in` would match inherited members like
    // `constructor`/`toString` on the vars object.
    if (Object.hasOwn(CONSTANTS, name)) return CONSTANTS[name]!
    if (name === 'x') {
      // The sampling variable resolves against the evaluation argument.
      return (value: number) => value
    }
    if (Object.hasOwn(this.vars, name)) {
      // A declared parameter (a/b/c…) resolves against its captured value,
      // which the caller changes by recompiling with new vars.
      const captured = this.vars[name]!
      return () => captured
    }
    // Implicit parameters: an undeclared single-lowercase-letter identifier
    // (a/b/k/m/n…) is a parameter that defaults to 1, so a model expression
    // like "a*sin(b*x)" without a params declaration still renders instead
    // of failing as "unknown identifier". This is safe: only [a-z] matches,
    // so injection names (constructor, window, process…) still parse-error.
    if (/^[a-z]$/.test(name)) return () => 1
    throw new ParseError(`unknown identifier '${name}'`, start)
  }

  private asNum(node: number | ((x: number) => number), x: number): number {
    return typeof node === 'number' ? node : node(x)
  }

  private skipWs(): void {
    while (this.i < this.src.length && /\s/.test(this.src[this.i]!)) this.i++
  }

  private peek(): string | undefined {
    return this.src[this.i]
  }

  private char(): string {
    const c = this.peek()
    if (c === undefined) throw new ParseError('unexpected end of input', this.i)
    return c
  }

  private isIdentStart(c: string | undefined): boolean {
    return c !== undefined && /[a-zA-Z_]/.test(c)
  }

  private isIdentChar(c: string): boolean {
    return /[a-zA-Z0-9_]/.test(c)
  }
}

/**
 * Compile an expression into an evaluable function.
 * @param expr - the math expression. `x` is the sampling variable; any other
 *   name in `vars` is a parameter whose captured value the evaluator returns
 *   (recompile with new vars to change a parameter — expressions are short).
 * @param options - parameter values; `x` is reserved and ignored here.
 * @returns evaluator, or null when the expression is invalid.
 */
export function compileMathExpr(expr: string, options: SafeMathOptions = {}): ((x: number) => number) | null {
  try {
    // `x` is the sampling variable and must never be shadowed by a param.
    const vars: Record<string, number> = { ...options.vars }
    delete vars.x
    return new SafeMathParser(expr, vars).parse()
  } catch {
    return null
  }
}

/**
 * Sample an expression over a range.
 * @param expr - math expression in x, with optional parameters.
 * @param xMin - inclusive start.
 * @param xMax - inclusive end.
 * @param samples - number of samples (>= 2).
 * @param params - parameter values (e.g. { a: 2, b: 3 }); recompile per change.
 * @returns [x, y] pairs; non-finite samples are dropped.
 */
export function sampleExpr(
  expr: string,
  xMin: number,
  xMax: number,
  samples = 200,
  params: Record<string, number> = {},
): Array<[number, number]> {
  const fn = compileMathExpr(expr, { vars: params })
  if (fn === null) return []
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMax <= xMin || samples < 2) return []
  const points: Array<[number, number]> = []
  const step = (xMax - xMin) / (samples - 1)
  for (let i = 0; i < samples; i++) {
    const x = xMin + step * i
    const y = fn(x)
    if (Number.isFinite(y)) points.push([x, y])
  }
  return points
}
