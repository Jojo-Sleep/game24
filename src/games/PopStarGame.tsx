import { useCallback, useEffect, useRef, useState } from 'react';
import { GameFrame } from '../components/GameFrame';
import { cn } from '../lib/cn';

const ROWS = 10;
const COLS = 10;
const COLORS = ['#3ee0a1', '#80c1ff', '#f5b942', '#ff7ab8', '#b18cff'];
const BEST_KEY = 'game24-popstar-best';

interface Tile {
  id: number;
  color: number;
}

type Board = (Tile | null)[][];

let tileSeq = 1;

function neighborCells(r: number, c: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  if (r > 0) out.push([r - 1, c]);
  if (r < ROWS - 1) out.push([r + 1, c]);
  if (c > 0) out.push([r, c - 1]);
  if (c < COLS - 1) out.push([r, c + 1]);
  return out;
}

function findMove(board: Board): boolean {
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const tile = board[r][c];
      if (!tile) continue;
      for (const [nr, nc] of neighborCells(r, c)) {
        const other = board[nr][nc];
        if (other && other.color === tile.color) return true;
      }
    }
  }
  return false;
}

function randomBoard(): Board {
  for (;;) {
    const board: Board = [];
    for (let r = 0; r < ROWS; r += 1) {
      const row: (Tile | null)[] = [];
      for (let c = 0; c < COLS; c += 1) {
        row.push({ id: tileSeq++, color: Math.floor(Math.random() * COLORS.length) });
      }
      board.push(row);
    }
    if (findMove(board)) return board;
  }
}

function findGroup(board: Board, r: number, c: number): Array<[number, number]> {
  const start = board[r][c];
  if (!start) return [];

  const color = start.color;
  const seen = new Set<number>([r * COLS + c]);
  const queue: Array<[number, number]> = [[r, c]];
  const group: Array<[number, number]> = [];

  while (queue.length > 0) {
    const [cr, cc] = queue.pop()!;
    group.push([cr, cc]);

    for (const [nr, nc] of neighborCells(cr, cc)) {
      const key = nr * COLS + nc;
      if (seen.has(key)) continue;
      const tile = board[nr][nc];
      if (tile && tile.color === color) {
        seen.add(key);
        queue.push([nr, nc]);
      }
    }
  }

  return group;
}

function collapse(board: Board): Board {
  const next = board.map((row) => row.slice());

  for (let c = 0; c < COLS; c += 1) {
    const stack: Tile[] = [];
    for (let r = ROWS - 1; r >= 0; r -= 1) {
      const tile = next[r][c];
      if (tile) stack.push(tile);
    }
    for (let r = ROWS - 1; r >= 0; r -= 1) {
      next[r][c] = stack[ROWS - 1 - r] ?? null;
    }
  }

  return next;
}

export function PopStarGame({ onExit }: { onExit: () => void }) {
  const [board, setBoard] = useState<Board>(() => randomBoard());
  const [score, setScore] = useState(0);
  const [best, setBest] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch {
      return 0;
    }
  });
  const [clearing, setClearing] = useState<Set<number>>(() => new Set<number>());
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [gain, setGain] = useState<{ value: number; key: number } | null>(null);
  const [hint, setHint] = useState('');
  const timerRef = useRef<number | null>(null);

  const restart = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setBoard(randomBoard());
    setScore(0);
    setClearing(new Set<number>());
    setBusy(false);
    setOver(false);
    setGain(null);
    setHint('');
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const handlePick = (r: number, c: number) => {
    if (busy || over) return;

    const group = findGroup(board, r, c);
    if (group.length < 2) {
      setHint('至少要连两个同色星星');
      return;
    }

    const gained = group.length * group.length * 5;
    const ids = new Set<number>();
    for (const [rr, cc] of group) {
      const tile = board[rr][cc];
      if (tile) ids.add(tile.id);
    }

    setHint('');
    setBusy(true);
    setClearing(ids);

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const removed = board.map((row) => row.slice());
      for (const [rr, cc] of group) removed[rr][cc] = null;

      const next = collapse(removed);
      const nextScore = score + gained;

      setBoard(next);
      setScore(nextScore);
      setClearing(new Set<number>());
      setBusy(false);
      setGain({ value: gained, key: Date.now() });

      setBest((prev) => {
        if (nextScore <= prev) return prev;
        try {
          localStorage.setItem(BEST_KEY, String(nextScore));
        } catch {
          // 存储不可用时忽略
        }
        return nextScore;
      });

      if (!findMove(next)) setOver(true);
    }, 180);
  };

  return (
    <GameFrame
      title="消灭星星"
      subtitle="点击相连的同色星星"
      onExit={onExit}
      right={
        <button
          type="button"
          onClick={restart}
          className="select-none rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:border-neon/40 hover:text-neon"
        >
          重开
        </button>
      }
    >
      <section className="relative overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.035] p-3.5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:p-6">
        <div className="relative flex items-end justify-between">
          <div>
            <div className="text-[10px] tracking-[0.22em] text-slate-500">SCORE</div>
            <div className="font-mono text-3xl font-bold leading-tight tabular-nums text-neon">{score}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] tracking-[0.22em] text-slate-500">BEST</div>
            <div className="font-mono text-base font-semibold tabular-nums text-slate-300">{best}</div>
          </div>

          {gain && (
            <span
              key={gain.key}
              className="gain-pop pointer-events-none absolute left-0 top-9 font-mono text-sm font-semibold text-amber-300"
            >
              +{gain.value}
            </span>
          )}
        </div>

        <div className="relative mt-3">
          <div className="grid grid-cols-10 gap-1 rounded-[16px] border border-white/10 bg-black/30 p-1.5 sm:p-2">
            {board.map((row, r) =>
              row.map((tile, c) => (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onClick={() => handlePick(r, c)}
                  aria-label={tile ? `第 ${r + 1} 行第 ${c + 1} 列` : '空'}
                  className="star-btn relative aspect-square select-none rounded-[5px]"
                >
                  {tile && (
                    <span
                      className={cn('star', clearing.has(tile.id) && 'star-pop')}
                      style={{ color: COLORS[tile.color] }}
                    />
                  )}
                </button>
              )),
            )}
          </div>

          {over && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-[16px] bg-ink-950/85 px-6 text-center backdrop-blur-sm">
              <p className="text-xs text-slate-400">没有可消除的星星了</p>
              <p className="font-mono text-4xl font-bold tabular-nums text-neon">{score}</p>
              <p className="text-[11px] text-slate-500">最高分 {best}</p>
              <button
                type="button"
                onClick={restart}
                className="mt-2 select-none rounded-xl bg-neon px-6 py-2.5 text-sm font-semibold text-ink-950 shadow-[0_12px_36px_-12px_rgba(62,224,161,0.8)] transition hover:bg-[#54e9b0] active:scale-[0.98]"
              >
                再来一局
              </button>
            </div>
          )}
        </div>

        <p className="mt-2 min-h-[18px] text-center text-[11px] text-slate-500">
          {hint || '连得越多，得分越高（分数 = 星星数² × 5）'}
        </p>
      </section>
    </GameFrame>
  );
}

