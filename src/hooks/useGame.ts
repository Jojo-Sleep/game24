import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { evaluate, normalize, sameMultiset, tokenize, type Token } from '../lib/expression';
import { formatFraction, type Fraction } from '../lib/fraction';
import { makePuzzle } from '../lib/puzzle';
import { firstStep, prettyExpr, type SolutionNode } from '../lib/solver';

export type MessageKind = 'ok' | 'bad' | 'hint' | '';

export interface GameMessage {
  text: string;
  kind: MessageKind;
}

const STORAGE_KEY = 'game24-stats';
const NEXT_PUZZLE_DELAY = 1500;

function loadSolved(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { solved?: unknown };
    return typeof parsed.solved === 'number' ? parsed.solved : 0;
  } catch {
    return 0;
  }
}

function saveSolved(value: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ solved: value }));
  } catch {
    // 隐私模式或存储被禁用时忽略
  }
}

export function useGame() {
  const [puzzleId, setPuzzleId] = useState(0);
  const [numbers, setNumbers] = useState<number[]>([]);
  const [solution, setSolution] = useState<SolutionNode | null>(null);
  const [solutionCount, setSolutionCount] = useState(0);

  const [expression, setExpression] = useState('');
  const [message, setMessage] = useState<GameMessage>({ text: '', kind: '' });
  const [locked, setLocked] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [winning, setWinning] = useState(false);

  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const [solved, setSolved] = useState(loadSolved);
  const [streak, setStreak] = useState(0);

  const startedAtRef = useRef(0);
  const nextTimerRef = useRef<number | null>(null);

  const newPuzzle = useCallback(() => {
    if (nextTimerRef.current !== null) {
      window.clearTimeout(nextTimerRef.current);
      nextTimerRef.current = null;
    }

    const next = makePuzzle();
    setNumbers(next.numbers);
    setSolution(next.solution);
    setSolutionCount(next.solutionCount);
    setExpression('');
    setMessage({ text: '', kind: '' });
    setLocked(false);
    setHintUsed(false);
    setWinning(false);
    setElapsed(0);
    startedAtRef.current = Date.now();
    setRunning(true);
    setPuzzleId((id) => id + 1);
  }, []);

  useEffect(() => {
    newPuzzle();
  }, [newPuzzle]);

  useEffect(() => {
    if (!running) return undefined;
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(
    () => () => {
      if (nextTimerRef.current !== null) window.clearTimeout(nextTimerRef.current);
    },
    [],
  );

  const preview = useMemo<Fraction | null>(() => {
    const raw = expression.trim();
    if (!raw) return null;
    try {
      return evaluate(tokenize(normalize(raw)));
    } catch {
      return null;
    }
  }, [expression]);

  const usedNumbers = useMemo<Record<number, number>>(() => {
    const counts: Record<number, number> = {};
    try {
      for (const token of tokenize(normalize(expression))) {
        if (token.type === 'num') counts[token.value] = (counts[token.value] ?? 0) + 1;
      }
    } catch {
      // 输入过程中可能暂时不合法，忽略即可
    }
    return counts;
  }, [expression]);

  const submit = useCallback(() => {
    if (locked) return;

    const raw = expression.trim();
    if (!raw) {
      setMessage({ text: '先写一个表达式', kind: 'hint' });
      return;
    }

    let tokens: Token[];
    try {
      tokens = tokenize(normalize(raw));
    } catch (error) {
      setMessage({ text: (error as Error).message, kind: 'bad' });
      return;
    }

    const inputNumbers = tokens
      .filter((token) => token.type === 'num')
      .map((token) => (token as { value: number }).value);

    if (!sameMultiset(inputNumbers, numbers)) {
      setMessage({
        text: `要刚好用完 ${numbers.join('、')} 这四个数，每个一次`,
        kind: 'bad',
      });
      return;
    }

    let value: Fraction;
    try {
      value = evaluate(tokens);
    } catch (error) {
      setMessage({ text: (error as Error).message, kind: 'bad' });
      return;
    }

    if (value.n !== 24 || value.d !== 1) {
      setMessage({ text: `结果是 ${formatFraction(value)}，再想想`, kind: 'bad' });
      return;
    }

    const seconds = Math.floor((Date.now() - startedAtRef.current) / 1000);
    setRunning(false);
    setLocked(true);
    setWinning(true);
    setStreak((current) => current + 1);
    setSolved((current) => {
      const next = current + 1;
      saveSolved(next);
      return next;
    });

    const extra = solutionCount > 1 ? `，本题共 ${solutionCount} 种解法` : '';
    setMessage({
      text: `正确！用时 ${seconds} 秒${hintUsed ? '（用过提示）' : ''}${extra}`,
      kind: 'ok',
    });

    nextTimerRef.current = window.setTimeout(() => {
      nextTimerRef.current = null;
      newPuzzle();
    }, NEXT_PUZZLE_DELAY);
  }, [locked, expression, numbers, solutionCount, hintUsed, newPuzzle]);

  const showHint = useCallback(() => {
    if (locked) return;
    const step = firstStep(solution);
    if (!step?.left || !step.right) {
      setMessage({ text: '这题暂时没找到解法，换一题吧', kind: 'bad' });
      return;
    }
    setHintUsed(true);
    setMessage({
      text: `提示：先算 ${step.left.expr} ${step.op} ${step.right.expr} = ${formatFraction(step.value)}`,
      kind: 'hint',
    });
  }, [locked, solution]);

  const revealAnswer = useCallback(() => {
    if (locked) return;
    if (!solution) {
      setMessage({ text: '这题暂时没找到解法，换一题吧', kind: 'bad' });
      return;
    }
    setRunning(false);
    setLocked(true);
    setStreak(0);
    setMessage({
      text: `参考答案：${prettyExpr(solution.expr)} = 24，点「换一题」继续`,
      kind: 'hint',
    });
  }, [locked, solution]);

  return {
    puzzleId,
    numbers,
    expression,
    setExpression,
    preview,
    usedNumbers,
    message,
    locked,
    winning,
    elapsed,
    solved,
    streak,
    submit,
    showHint,
    revealAnswer,
    newPuzzle,
  };
}
