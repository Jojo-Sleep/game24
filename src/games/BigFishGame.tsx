import { useEffect, useRef, useState } from 'react';
import { GameFrame } from '../components/GameFrame';
import { cn } from '../lib/cn';
import { BigFishEngine } from '../lib/bigFish';

const BEST_KEY = 'game24-bigfish-best';

type Status = 'ready' | 'playing' | 'over';

function LifeIcon({ dim }: { dim: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={dim ? 'text-slate-700' : 'text-rose-300'}
    >
      <path d="M12 6c4.4 0 8 2.7 8 6s-3.6 6-8 6c-2.4 0-4.6-.9-6.1-2.3L3 18V6l2.9 2.3C7.4 6.9 9.6 6 12 6z" />
      <circle cx="15.6" cy="10.4" r="1.5" fill="#0b1220" />
    </svg>
  );
}

export function BigFishGame({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BigFishEngine | null>(null);
  const [status, setStatus] = useState<Status>('ready');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [size, setSize] = useState(13);
  const [best, setBest] = useState(() => {
    try {
      return Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch {
      return 0;
    }
  });
  const [newRecord, setNewRecord] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const engine = new BigFishEngine(canvas, {
      onScore: (value) => setScore(value),
      onLives: (value) => setLives(value),
      onSize: (value) => setSize(value),
      onGameOver: (value) => {
        setStatus('over');
        const previous = Number(localStorage.getItem(BEST_KEY)) || 0;
        if (value > previous) {
          try {
            localStorage.setItem(BEST_KEY, String(value));
          } catch {
            // 存储不可用时忽略
          }
          setBest(value);
          setNewRecord(true);
        } else {
          setNewRecord(false);
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
    setStatus('playing');
    setNewRecord(false);
  };

  return (
    <GameFrame
      title="大鱼吃小鱼"
      subtitle="吞噬成长 · 躲避大鱼"
      onExit={onExit}
      right={<span className="font-mono text-[11px] text-slate-500">BEST {best}</span>}
    >
      <div className="mx-auto w-full max-w-[520px]">
        <section
          className="relative mx-auto aspect-square w-full overflow-hidden rounded-[22px] border border-white/10 bg-[#02101c] shadow-[0_28px_80px_-40px_rgba(62,224,161,0.45)]"
          style={{ maxWidth: 'min(520px, calc(100dvh - 170px))' }}
        >
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" aria-label="大鱼吃小鱼游戏区域" />

          <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between">
            <div className="rounded-xl border border-white/15 bg-black/40 px-3 py-1.5 backdrop-blur">
              <p className="text-[9px] tracking-[0.22em] text-slate-400">SCORE</p>
              <p className="font-mono text-xl font-bold leading-none tabular-nums text-neon">{score}</p>
            </div>

            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-1 rounded-xl border border-white/15 bg-black/40 px-2.5 py-1.5 backdrop-blur">
                {[0, 1, 2].map((index) => (
                  <LifeIcon key={index} dim={index >= lives} />
                ))}
              </div>
              <div className="rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[10px] text-slate-300 backdrop-blur">
                体型 {Math.round(size)}
              </div>
            </div>
          </div>

          {status === 'ready' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#02101c]/65 px-6 text-center backdrop-blur-[2px]">
              <div>
                <p className="text-2xl font-extrabold text-white">大鱼吃小鱼</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  吃掉比你小的鱼，慢慢长成海里最大的那条
                </p>
              </div>
              <div className="space-y-1 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-[11px] leading-relaxed text-slate-300">
                <p>电脑：WASD / 方向键游动，也可以直接移动鼠标</p>
                <p>手机：在画面上拖动，鱼儿会朝手指游过去</p>
                <p>绿黄蓝小鱼可以吃，红紫大鱼会咬你，灰色体型相近吃不了</p>
              </div>
              <button
                type="button"
                onClick={start}
                className="h-11 select-none rounded-full bg-neon px-8 text-sm font-bold text-ink-950 shadow-[0_0_0_6px_rgba(62,224,161,0.15)] transition active:scale-95"
              >
                开始觅食
              </button>
              {best > 0 && <p className="text-[11px] text-slate-400">历史最高分 {best}</p>}
            </div>
          )}

          {status === 'over' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#02101c]/80 px-6 text-center backdrop-blur-sm">
              <p className="text-2xl font-extrabold text-rose-400">被吃掉了！</p>
              <div className="font-mono text-4xl font-bold tabular-nums text-white">{score}</div>
              {newRecord ? (
                <span className="rounded-full border border-amber-300/40 bg-amber-300/15 px-3 py-1 text-[11px] font-semibold text-amber-200">
                  新的最高分
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">最高分 {best}</span>
              )}
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
                  className={cn(
                    'h-10 rounded-full bg-neon px-6 text-xs font-bold text-ink-950 transition active:scale-95',
                  )}
                >
                  再吃一局
                </button>
              </div>
            </div>
          )}
        </section>

        <p className="pointer-hint mt-3 text-center text-[11px] text-slate-500">
          拖动或方向键控制游动 · 只吃比自己小的鱼 · 三条命耗尽结束
        </p>
      </div>
    </GameFrame>
  );
}
