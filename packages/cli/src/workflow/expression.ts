/**
 * A GitHub Actions expression evaluator with GitHub's typing rules: values are
 * null, booleans, numbers, strings, arrays and objects; `==` and `<` coerce
 * mismatched types to numbers; strings compare case-insensitively; `&&` and
 * `||` return one of their operands.
 *
 * https://docs.github.com/en/actions/reference/workflows-and-actions/expressions
 */

export type ExpressionValue =
  | null
  | boolean
  | number
  | string
  | ExpressionValue[]
  | { [key: string]: ExpressionValue };

export interface EvaluationScope {
  /** Context objects by name (`github`, `needs`, …). Unknown names evaluate to null. */
  contexts: Record<string, unknown>;
  /** Extra functions by lower-case name (status functions, hashFiles, …). */
  functions?: Record<string, (...args: ExpressionValue[]) => ExpressionValue>;
}

type Token =
  | { kind: "num"; value: number }
  | { kind: "str"; value: string }
  | { kind: "ident"; value: string }
  | { kind: "op"; value: string };

type Node =
  | { type: "literal"; value: ExpressionValue }
  | { type: "context"; name: string }
  | { type: "member"; object: Node; key: Node | "*" }
  | { type: "call"; name: string; args: Node[] }
  | { type: "not"; operand: Node }
  | { type: "binary"; op: string; left: Node; right: Node };

const OPERATORS = [
  "==",
  "!=",
  "<=",
  ">=",
  "&&",
  "||",
  "<",
  ">",
  "!",
  "(",
  ")",
  "[",
  "]",
  ",",
  ".",
  "*",
];

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === "'") {
      let value = "";
      i++;
      for (;;) {
        if (i >= expr.length) {
          throw new Error(`Unterminated string in expression: ${expr}`);
        }
        if (expr[i] === "'") {
          if (expr[i + 1] === "'") {
            value += "'";
            i += 2;
            continue;
          }
          i++;
          break;
        }
        value += expr[i++];
      }
      tokens.push({ kind: "str", value });
      continue;
    }
    // A leading `-` is part of a number literal (`-1`) unless it follows an
    // operand; expressions have no subtraction.
    const negative =
      c === "-" && !(tokens.length > 0 && isOperand(tokens[tokens.length - 1])) ? 1 : 0;
    const num = /^(0x[0-9a-fA-F]+|(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?)/.exec(expr.slice(i + negative));
    if (num && negative) {
      tokens.push({ kind: "num", value: -Number(num[0]) });
      i += num[0].length + 1;
      continue;
    }
    if (num && !(c === "." && tokens.length > 0 && isOperand(tokens[tokens.length - 1]))) {
      tokens.push({ kind: "num", value: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const ident = /^[A-Za-z_][\w-]*/.exec(expr.slice(i));
    if (ident) {
      tokens.push({ kind: "ident", value: ident[0] });
      i += ident[0].length;
      continue;
    }
    const op = OPERATORS.find((o) => expr.startsWith(o, i));
    if (!op) {
      throw new Error(`Unexpected character '${c}' in expression: ${expr}`);
    }
    tokens.push({ kind: "op", value: op });
    i += op.length;
  }
  return tokens;
}

function isOperand(t: Token): boolean {
  return (
    t.kind === "ident" ||
    t.kind === "num" ||
    t.kind === "str" ||
    (t.kind === "op" && (t.value === ")" || t.value === "]"))
  );
}

class Parser {
  private pos = 0;
  private readonly tokens: Token[];
  private readonly source: string;

  constructor(tokens: Token[], source: string) {
    this.tokens = tokens;
    this.source = source;
  }

  parse(): Node {
    const node = this.or();
    if (this.pos < this.tokens.length) {
      throw new Error(`Unexpected token in expression: ${this.source}`);
    }
    return node;
  }

  private peekOp(...ops: string[]): string | undefined {
    const t = this.tokens[this.pos];
    return t && t.kind === "op" && ops.includes(t.value) ? t.value : undefined;
  }

  private expectOp(op: string) {
    if (!this.peekOp(op)) {
      throw new Error(`Expected '${op}' in expression: ${this.source}`);
    }
    this.pos++;
  }

  private binary(next: () => Node, ops: string[]): Node {
    let left = next();
    for (let op = this.peekOp(...ops); op; op = this.peekOp(...ops)) {
      this.pos++;
      left = { type: "binary", op, left, right: next() };
    }
    return left;
  }

  private or = (): Node => this.binary(this.and, ["||"]);
  private and = (): Node => this.binary(this.equality, ["&&"]);
  private equality = (): Node => this.binary(this.comparison, ["==", "!="]);
  private comparison = (): Node => this.binary(this.unary, ["<", "<=", ">", ">="]);

  private unary = (): Node => {
    if (this.peekOp("!")) {
      this.pos++;
      return { type: "not", operand: this.unary() };
    }
    return this.postfix();
  };

  private postfix(): Node {
    let node = this.primary();
    for (;;) {
      if (this.peekOp(".")) {
        this.pos++;
        const t = this.tokens[this.pos++];
        if (t?.kind === "op" && t.value === "*") {
          node = { type: "member", object: node, key: "*" };
        } else if (t?.kind === "ident") {
          node = { type: "member", object: node, key: { type: "literal", value: t.value } };
        } else {
          throw new Error(`Expected a property name in expression: ${this.source}`);
        }
      } else if (this.peekOp("[")) {
        this.pos++;
        if (this.peekOp("*")) {
          this.pos++;
          this.expectOp("]");
          node = { type: "member", object: node, key: "*" };
        } else {
          const key = this.or();
          this.expectOp("]");
          node = { type: "member", object: node, key };
        }
      } else {
        return node;
      }
    }
  }

  private primary(): Node {
    const t = this.tokens[this.pos++];
    if (!t) {
      throw new Error(`Unexpected end of expression: ${this.source}`);
    }
    if (t.kind === "num" || t.kind === "str") {
      return { type: "literal", value: t.value };
    }
    if (t.kind === "op" && t.value === "(") {
      const inner = this.or();
      this.expectOp(")");
      return inner;
    }
    if (t.kind === "ident") {
      if (this.peekOp("(")) {
        this.pos++;
        const args: Node[] = [];
        if (!this.peekOp(")")) {
          args.push(this.or());
          while (this.peekOp(",")) {
            this.pos++;
            args.push(this.or());
          }
        }
        this.expectOp(")");
        return { type: "call", name: t.value.toLowerCase(), args };
      }
      if (t.value === "true" || t.value === "false") {
        return { type: "literal", value: t.value === "true" };
      }
      if (t.value === "null") {
        return { type: "literal", value: null };
      }
      if (t.value === "NaN" || t.value === "Infinity") {
        return { type: "literal", value: Number(t.value) };
      }
      return { type: "context", name: t.value };
    }
    throw new Error(`Unexpected '${t.value}' in expression: ${this.source}`);
  }
}

/** GitHub's truthiness: false, 0, -0, NaN, '' and null are falsy. */
export function isTruthy(v: ExpressionValue): boolean {
  if (v === null || v === false || v === "") {
    return false;
  }
  if (typeof v === "number") {
    return v !== 0 && !Number.isNaN(v);
  }
  return true;
}

function toNumber(v: ExpressionValue): number {
  if (v === null) {
    return 0;
  }
  if (typeof v === "boolean") {
    return v ? 1 : 0;
  }
  if (typeof v === "number") {
    return v;
  }
  if (typeof v === "string") {
    const s = v.trim();
    return s === "" ? 0 : Number(s);
  }
  return NaN;
}

/** How GitHub turns a value into a string (env values, format() arguments, …). */
export function toExpressionString(v: ExpressionValue): string {
  if (v === null) {
    return "";
  }
  if (typeof v === "boolean") {
    return v ? "true" : "false";
  }
  if (typeof v === "number") {
    return Object.is(v, -0) ? "0" : String(v);
  }
  if (typeof v === "string") {
    return v;
  }
  return Array.isArray(v) ? "Array" : "Object";
}

function looselyEqual(a: ExpressionValue, b: ExpressionValue): boolean {
  const ta = kindOf(a);
  const tb = kindOf(b);
  if (ta !== tb) {
    if (ta === "object" || tb === "object" || ta === "array" || tb === "array") {
      return false;
    }
    return toNumber(a) === toNumber(b);
  }
  if (ta === "string") {
    return (a as string).toUpperCase() === (b as string).toUpperCase();
  }
  return a === b;
}

function compare(a: ExpressionValue, b: ExpressionValue): number {
  if (typeof a === "string" && typeof b === "string") {
    const x = a.toUpperCase();
    const y = b.toUpperCase();
    return x < y ? -1 : x > y ? 1 : 0;
  }
  const x = toNumber(a);
  const y = toNumber(b);
  if (Number.isNaN(x) || Number.isNaN(y)) {
    return NaN;
  }
  return x < y ? -1 : x > y ? 1 : 0;
}

function kindOf(v: ExpressionValue): string {
  if (v === null) {
    return "null";
  }
  if (Array.isArray(v)) {
    return "array";
  }
  return typeof v;
}

/** Normalize a JS value from a context object into an expression value. */
function fromJs(v: unknown): ExpressionValue {
  if (v === undefined || v === null) {
    return null;
  }
  if (typeof v === "boolean" || typeof v === "number" || typeof v === "string") {
    return v;
  }
  if (Array.isArray(v)) {
    return v.map(fromJs);
  }
  if (typeof v === "object") {
    return Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, fromJs(x)]));
  }
  return String(v);
}

function lookup(obj: ExpressionValue, key: ExpressionValue): ExpressionValue {
  if (Array.isArray(obj)) {
    if (typeof key === "number" || (typeof key === "string" && key.trim() !== "")) {
      const i = Math.trunc(toNumber(key));
      return i >= 0 && i < obj.length ? obj[i] : null;
    }
    return null;
  }
  if (obj !== null && typeof obj === "object" && typeof key === "string") {
    // Property names are case-insensitive.
    const exact = obj[key];
    if (exact !== undefined) {
      return exact;
    }
    const found = Object.keys(obj).find((k) => k.toLowerCase() === key.toLowerCase());
    return found !== undefined ? obj[found] : null;
  }
  return null;
}

// A filter (`.*`) result: further property access maps over its items.
const FILTERED = Symbol("filtered");
type Filtered = ExpressionValue[] & { [FILTERED]?: true };

function markFiltered(items: ExpressionValue[]): Filtered {
  const out = items as Filtered;
  Object.defineProperty(out, FILTERED, { value: true });
  return out;
}

function formatString(template: string, args: ExpressionValue[]): string {
  let out = "";
  for (let i = 0; i < template.length; i++) {
    const c = template[i];
    if (c === "{" && template[i + 1] === "{") {
      out += "{";
      i++;
    } else if (c === "}" && template[i + 1] === "}") {
      out += "}";
      i++;
    } else if (c === "{") {
      const end = template.indexOf("}", i);
      const index = end > i ? Number(template.slice(i + 1, end)) : NaN;
      if (!Number.isInteger(index) || index < 0 || index >= args.length) {
        throw new Error(`Invalid format string: ${template}`);
      }
      out += toExpressionString(args[index]);
      i = end;
    } else {
      out += c;
    }
  }
  return out;
}

const BUILTINS: Record<string, (...args: ExpressionValue[]) => ExpressionValue> = {
  contains: (search, item) => {
    if (Array.isArray(search)) {
      return search.some((x) => looselyEqual(x, item));
    }
    return toExpressionString(search)
      .toUpperCase()
      .includes(toExpressionString(item).toUpperCase());
  },
  startswith: (s, v) =>
    toExpressionString(s).toUpperCase().startsWith(toExpressionString(v).toUpperCase()),
  endswith: (s, v) =>
    toExpressionString(s).toUpperCase().endsWith(toExpressionString(v).toUpperCase()),
  format: (template, ...args) => formatString(toExpressionString(template), args),
  join: (items, sep = ",") =>
    Array.isArray(items)
      ? items.map(toExpressionString).join(toExpressionString(sep))
      : toExpressionString(items),
  tojson: (v) => JSON.stringify(v, null, 2) ?? "null",
  fromjson: (v) => fromJs(JSON.parse(toExpressionString(v))),
};

function evaluateNode(node: Node, scope: EvaluationScope): ExpressionValue {
  switch (node.type) {
    case "literal":
      return node.value;
    case "context":
      return fromJs(
        scope.contexts[node.name] ??
          scope.contexts[
            Object.keys(scope.contexts).find((k) => k.toLowerCase() === node.name.toLowerCase()) ??
              ""
          ],
      );
    case "member": {
      const object = evaluateNode(node.object, scope);
      const filtered = Array.isArray(object) && (object as Filtered)[FILTERED];
      if (node.key === "*") {
        const items = Array.isArray(object)
          ? filtered
            ? object.flatMap((x) =>
                Array.isArray(x) ? x : x !== null && typeof x === "object" ? Object.values(x) : [],
              )
            : [...object]
          : object !== null && typeof object === "object"
            ? Object.values(object)
            : [];
        return markFiltered(items);
      }
      const key = evaluateNode(node.key, scope);
      if (filtered) {
        return markFiltered(
          (object as ExpressionValue[]).map((x) => lookup(x, key)).filter((x) => x !== null),
        );
      }
      return lookup(object, key);
    }
    case "call": {
      const fn = scope.functions?.[node.name] ?? BUILTINS[node.name];
      if (!fn) {
        throw new Error(`Unknown function '${node.name}'`);
      }
      return fn(...node.args.map((a) => evaluateNode(a, scope)));
    }
    case "not":
      return !isTruthy(evaluateNode(node.operand, scope));
    case "binary": {
      if (node.op === "&&") {
        const left = evaluateNode(node.left, scope);
        return isTruthy(left) ? evaluateNode(node.right, scope) : left;
      }
      if (node.op === "||") {
        const left = evaluateNode(node.left, scope);
        return isTruthy(left) ? left : evaluateNode(node.right, scope);
      }
      const left = evaluateNode(node.left, scope);
      const right = evaluateNode(node.right, scope);
      switch (node.op) {
        case "==":
          return looselyEqual(left, right);
        case "!=":
          return !looselyEqual(left, right);
        case "<":
          return compare(left, right) < 0;
        case "<=":
          return compare(left, right) <= 0;
        case ">":
          return compare(left, right) > 0;
        default:
          return compare(left, right) >= 0;
      }
    }
  }
}

/** Evaluate an expression (without the surrounding `${{ }}`). */
export function evaluateExpression(expr: string, scope: EvaluationScope): ExpressionValue {
  const node = new Parser(tokenize(expr), expr).parse();
  const value = evaluateNode(node, scope);
  return Array.isArray(value) ? [...value] : value;
}

/** Whether an expression calls a status function (success, failure, always, cancelled). */
export function callsStatusFunction(expr: string): boolean {
  try {
    const tokens = tokenize(expr);
    return tokens.some(
      (t, i) =>
        t.kind === "ident" &&
        ["success", "failure", "always", "cancelled"].includes(t.value.toLowerCase()) &&
        tokens[i + 1]?.kind === "op" &&
        tokens[i + 1].value === "(",
    );
  } catch {
    return false;
  }
}
