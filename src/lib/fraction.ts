export interface Fraction {
  n: number;
  d: number;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const rest = a % b;
    a = b;
    b = rest;
  }
  return a || 1;
}

/** 约分并统一符号；分母为 0 时返回 null */
export function frac(n: number, d = 1): Fraction | null {
  if (d === 0) return null;
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

export function add(a: Fraction, b: Fraction): Fraction {
  return { ...frac(a.n * b.d + b.n * a.d, a.d * b.d)! };
}

export function sub(a: Fraction, b: Fraction): Fraction {
  return { ...frac(a.n * b.d - b.n * a.d, a.d * b.d)! };
}

export function mul(a: Fraction, b: Fraction): Fraction {
  return { ...frac(a.n * b.n, a.d * b.d)! };
}

export function div(a: Fraction, b: Fraction): Fraction | null {
  if (b.n === 0) return null;
  return frac(a.n * b.d, a.d * b.n);
}

export function formatFraction(value: Fraction): string {
  return value.d === 1 ? String(value.n) : `${value.n}/${value.d}`;
}
