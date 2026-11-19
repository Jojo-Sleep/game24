import { add, div, frac, mul, sub, type Fraction } from './fraction';

export type OperatorSymbol = '+' | '-' | '*' | '/' | '(' | ')';

export type Token = { type: 'num'; value: number } | { type: OperatorSymbol };

/** 把界面上输入的 × ÷ −（包括全角括号）统一成代码里的符号 */
export function normalize(input: string): string {
  return input
    .replace(/[×✕]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/\s+/g, '');
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    const ch = source[i];

    if (ch >= '0' && ch <= '9') {
      let j = i;
      while (j < source.length && source[j] >= '0' && source[j] <= '9') j += 1;
      tokens.push({ type: 'num', value: Number(source.slice(i, j)) });
      i = j;
      continue;
    }

    if ('+-*/()'.includes(ch)) {
      tokens.push({ type: ch as OperatorSymbol });
      i += 1;
      continue;
    }

    throw new Error(`不认识的符号「${ch}」`);
  }

  return tokens;
}

/** 递归下降解析，返回精确的分数结果 */
export function evaluate(tokens: Token[]): Fraction {
  let index = 0;

  function peek(): Token | undefined {
    return tokens[index];
  }

  function parseExpr(): Fraction {
    let value = parseTerm();
    for (;;) {
      const token = peek();
      if (!token || (token.type !== '+' && token.type !== '-')) break;
      const op = token.type;
      index += 1;
      const right = parseTerm();
      value = op === '+' ? add(value, right) : sub(value, right);
    }
    return value;
  }

  function parseTerm(): Fraction {
    let value = parseFactor();
    for (;;) {
      const token = peek();
      if (!token || (token.type !== '*' && token.type !== '/')) break;
      const op = token.type;
      index += 1;
      const right = parseFactor();
      if (op === '*') {
        value = mul(value, right);
      } else {
        const quotient = div(value, right);
        if (!quotient) throw new Error('除数不能为 0');
        value = quotient;
      }
    }
    return value;
  }

  function parseFactor(): Fraction {
    const token = tokens[index];
    if (!token) throw new Error('表达式不完整');

    if (token.type === 'num') {
      index += 1;
      return frac(token.value)!;
    }

    if (token.type === '(') {
      index += 1;
      const value = parseExpr();
      if (tokens[index]?.type !== ')') throw new Error('括号没有配对');
      index += 1;
      return value;
    }

    throw new Error('运算符位置不对');
  }

  const result = parseExpr();
  if (index < tokens.length) throw new Error('表达式有多余内容');
  return result;
}

export function sameMultiset(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort((x, y) => x - y);
  const right = [...b].sort((x, y) => x - y);
  return left.every((value, i) => value === right[i]);
}
