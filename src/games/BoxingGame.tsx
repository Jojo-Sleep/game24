import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { GameFrame } from '../components/GameFrame';
import { cn } from '../lib/cn';
import { BoxingEngine, type BoxingResult } from '../lib/boxing';

const WINS_KEY = 'game24-boxing-wins';

type Status = 'ready' | 'playing' | 'over';

export function BoxingGame({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BoxingEngine | null>(null);
  const [status, setStatus] = useState<Status>('ready');
  const [result, setResult] = useState<BoxingResult | null>(null);
  const [wins, setWins] = useState(() => {
    try {
      return Number(localStorage.getItem(WINS_KEY)) || 0;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const engine = new BoxingEngine(canvas, {
      onMatchEnd: (value) => {
        setResult(value);
        setStatus('over');
        if (value === 'win') {
          const previous = Number(localStorage.getItem(WINS_KEY)) || 0;
          try {
            localStorage.setItem(WINS_KEY, String(previous + 1));
          } catch {
            // 存储不可用时忽略
          }
          setWins(previous + 1);
        }
      },
    });

    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const start = () => {
    engineRef.current?.start();
    setResult(null);
    setStatus('playing');
  };

  const hold = (action: () => void) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    action();
  };

  return (
    <GameFrame
      title="拳王"
      subtitle="三回合擂台赛"
      onExit={onExit}
      right={<span className="font-mono text-[11px] text-slate-500">胜场 {wins}</span>}
    >
      <div className="mx-auto w-full max-w-[560px]">
        <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-black shadow-[0_30px_80px_-42px_rgba(251,113,133,0.45)]">
          <canvas ref={canvasRef} className="block w-full touch-none" aria-label="拳王擂台" />

          {status !== 'playing' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-ink-950/80 px-5 text-center backdrop-blur-sm">
              {status === 'ready' && (
                <>
                  <p className="text-xl font-extrabold">拳王</p>
                  <p className="text-xs text-slate-400">先赢两回合者获胜 · 每回合 40 秒</p>
                  <div className="space-y-1 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-[11px] leading-relaxed text-slate-300">
                    <p>电脑：A / D 移动，J 或空格出拳，K 格挡</p>
                    <p>手机：用下方按钮移动、格挡与出拳</p>
                    <p>格挡可大幅减伤，但挡住时无法出拳</p>
                  </div>
                  <button
                    type="button"
                    onClick={start}
                    className="mt-1 h-10 select-none rounded-full bg-neon px-7 text-sm font-bold text-ink-950 shadow-[0_0_0_6px_rgba(62,224,161,0.15)] transition active:scale-95"
                  >
                    开始比赛
                  </button>
                </>
              )}

              {status === 'over' && (
                <>
                  <p
                    className={cn(
                      'text-2xl font-extrabold',
                      result === 'win' ? 'text-neon' : 'text-rose-400',
                    )}
                  >
                    {result === 'win' ? '胜利！' : '落败'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {result === 'win' ? '你击败了对手，拿下这场对决' : '对手更强一些，再练一轮吧'}
                  </p>
                  <p className="font-mono text-[11px] text-slate-500">累计胜场 {wins}</p>
                  <div className="mt-1 flex gap-2">
                    <button
                      type="button"
                      onClick={onExit}
                      className="h-10 rounded-full border border-white/15 bg-white/[0.06] px-5 text-xs text-slate-200 transition hover:border-white/30"
                    >
                      返回大厅
                    </button>
                    <button
                      type="button"
                      onClick={start}
                      className="h-10 rounded-full bg-neon px-6 text-xs font-bold text-ink-950 transition active:scale-95"
                    >
                      再战一场
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="touch-controls mt-3 items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="向左移动"
              onPointerDown={hold(() => engineRef.current?.setDirection(-1))}
              onPointerUp={hold(() => engineRef.current?.setDirection(0))}
              onPointerCancel={hold(() => engineRef.current?.setDirection(0))}
              onPointerLeave={hold(() => engineRef.current?.setDirection(0))}
              className="flex h-14 w-14 touch-none select-none items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-lg text-slate-200 active:bg-white/15"
            >
              ←
            </button>
            <button
              type="button"
              aria-label="向右移动"
              onPointerDown={hold(() => engineRef.current?.setDirection(1))}
              onPointerUp={hold(() => engineRef.current?.setDirection(0))}
              onPointerCancel={hold(() => engineRef.current?.setDirection(0))}
              onPointerLeave={hold(() => engineRef.current?.setDirection(0))}
              className="flex h-14 w-14 touch-none select-none items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-lg text-slate-200 active:bg-white/15"
            >
              →
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onPointerDown={hold(() => engineRef.current?.setBlock(true))}
              onPointerUp={hold(() => engineRef.current?.setBlock(false))}
              onPointerCancel={hold(() => engineRef.current?.setBlock(false))}
              onPointerLeave={hold(() => engineRef.current?.setBlock(false))}
              className="flex h-14 w-16 touch-none select-none items-center justify-center rounded-full border border-sky-300/40 bg-sky-400/10 text-xs font-semibold text-sky-200 active:bg-sky-400/25"
            >
              格挡
            </button>
            <button
              type="button"
              onPointerDown={hold(() => engineRef.current?.punch())}
              className="flex h-14 w-16 touch-none select-none items-center justify-center rounded-full border border-amber-300/50 bg-amber-300/90 text-xs font-bold text-ink-950 active:scale-95"
            >
              出拳
            </button>
          </div>
        </div>

        <p className="pointer-hint mt-3 text-center text-[11px] text-slate-500">
          电脑：A / D 移动 · J 或空格出拳 · K 格挡 · 先赢两回合获胜
        </p>
      </div>
    </GameFrame>
  );
}

