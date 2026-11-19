import { add, div, frac, mul, sub, type Fraction } from './fraction';

export type Operator = '+' | '-' | '*' | '/';

export interface SolutionNode {
  value: Fraction;
  expr: string;
  key: string;
  op?: string;
  left?: SolutionNode;
  right?: SolutionNode;
  leaf?: boolean;
}

export interface SolveResult {
  count: number;
  solution: SolutionNode | null;
}

function combine(a: SolutionNode, b: SolutionNode, op: Operator): SolutionNode | null {
  let value: Fraction | null;
  if (op === '+') value = add(a.value, b.value);
  else if (op === '-') value = sub(a.value, b.value);
  else if (op === '*') value = mul(a.value, b.value);
  else value = div(a.value, b.value);

  if (!value) return null;

  const symbol = op === '*' ? '×' : op === '/' ? '÷' : op;
  const key =
    op === '+' || op === '*'
      ? `(${[a.key, b.key].sort().join(op)})`
      : `(${a.key}${op}${b.key})`;

  return {
    value,
    expr: `(${a.expr} ${symbol} ${b.expr})`,
    key,
    op: symbol,
    left: a,
    right: b,
  };
}

/**
 * 枚举四个数字两两合并的全部方式，找出所有不同的 24 解。
 * 用分数而非浮点数，避免 8 / (3 - 8 / 3) 这类恰好为 24 的算式被误判。
 */
export function solve(numbers: number[]): SolveResult {
  const found = new Map<string, SolutionNode>();

  function walk(items: SolutionNode[]): void {
    if (items.length === 1) {
      const only = items[0];
      if (only.value.n === 24 && only.value.d === 1 && !found.has(only.key)) {
        found.set(only.key, only);
      }
      return;
    }

    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const a = items[i];
        const b = items[j];
        const rest = items.filter((_, index) => index !== i && index !== j);
        const candidates = [
          combine(a, b, '+'),
          combine(a, b, '*'),
          combine(a, b, '-'),
          combine(b, a, '-'),
          combine(a, b, '/'),
          combine(b, a, '/'),
        ];

        for (const candidate of candidates) {
          if (candidate) walk([...rest, candidate]);
        }
      }
    }
  }

  walk(
    numbers.map((n) => ({
      value: frac(n)!,
      expr: String(n),
      key: String(n),
      leaf: true,
    })),
  );

  const all = [...found.values()];
  return { count: all.length, solution: all[0] ?? null };
}

/** 找到解法树里最深层的一步（两个原始数字之间的运算），用于提示 */
export function firstStep(node: SolutionNode | null): SolutionNode | null {
  if (!node?.left || !node.right) return null;
  if (node.left.leaf && node.right.leaf) return node;
  return firstStep(node.left) ?? firstStep(node.right);
}

/** 去掉最外层多余的括号 */
export function prettyExpr(expr: string): string {
  return expr.startsWith('(') && expr.endsWith(')') ? expr.slice(1, -1) : expr;
}
