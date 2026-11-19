import { solve, type SolutionNode } from './solver';

export interface Puzzle {
  numbers: number[];
  solutionCount: number;
  solution: SolutionNode | null;
}

/**
 * 随机出题，并用求解器保证一定有解。
 * 优先挑解法数量在 1–12 之间的题目，避免“太容易”或“怎么算都不对”的体验。
 */
export function makePuzzle(): Puzzle {
  let fallback: Puzzle | null = null;

  for (let attempt = 0; attempt < 300; attempt += 1) {
    const numbers = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 10));
    const { count, solution } = solve(numbers);
    if (count === 0) continue;

    const puzzle: Puzzle = {
      numbers: [...numbers].sort((a, b) => b - a),
      solutionCount: count,
      solution,
    };

    if (!fallback) fallback = puzzle;
    if (count <= 12) return puzzle;
  }

  if (fallback) return fallback;

  const numbers = [3, 3, 8, 8];
  const { count, solution } = solve(numbers);
  return { numbers, solutionCount: count, solution };
}
