import { useEffect, useRef, useState } from 'react';
import { GameFrame } from '../components/GameFrame';
import { cn } from '../lib/cn';
import { RaceEngine, type RaceHudState } from '../lib/race';

const BEST_KEY = 'game24-racing-best';

type Status = 'ready' | 'playing' | 'over';

export function RacingGame({ onExit }: { onExit: () => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<RaceEngine | null>(null);
  const [status, setStatus] = useState<Status>('ready');
  const [hud, setHud] = useState<RaceHudState>({ speed: 0, distance: 0, energy: 100, boosting: false });
  const [result, setResult] = useState(0);
  const [best, setBest] = useState(() => {
    try {
      return Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch {
      return 0;
    }
  });
  const [newRecord, setNewRecord] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const engine = new RaceEngine(mount, {
      onHud: (state) => setHud(state),
      onCrash: (distance) => {
        setResult(distance);
        setStatus('over');
        const previous = Number(localStorage.getItem(BEST_KEY)) || 0;
        if (distance > previous) {
          try {
            localStorage.setItem(BEST_KEY, String(distance));
          } catch {
            // 存储不可用时忽略
          }
          setBest(distance);
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
    setNewRecord(false);
    setStatus('playing');
  };

  return (
    <GameFrame
      title="极速赛车"
      subtitle="无尽公路竞速"
      onExit={onExit}
      right={<span className="font-mono text-[11px] text-slate-500">BEST {best}m</span>}
    >
      <section
        className="relative touch-none overflow-hidden rounded-[22px] border border-white/10 bg-[#070b12] shadow-[0_24px_70px_-40px_rgba(62,224,161,0.4)]"
        style={{ height: 'calc(100dvh - 130px)', minHeight: 220 }}
      >
        <div ref={mountRef} className="absolute inset-0" />

        <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between">
          <div className="rounded-xl border border-white/15 bg-black/45 px-3 py-1.5 backdrop-blur">
            <p className="font-mono text-2xl font-bold leading-none tabular-nums text-white">{hud.speed}</p>
            <p className="mt-1 text-[9px] tracking-[0.22em] text-slate-400">KM/H</p>
          </div>
          <div className="rounded-xl border border-white/15 bg-black/45 px-3 py-1.5 text-right backdrop-blur">
            <p className="font-mono text-lg font-semibold leading-none tabular-nums text-neon">
              {hud.distance}
            </p>
            <p className="mt-1 text-[9px] tracking-[0.22em] text-slate-400">METERS</p>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex flex-col items-center gap-1.5 sm:bottom-4">
          <div className="w-40 rounded-full border border-white/15 bg-black/50 p-1 backdrop-blur">
            <div
              className={cn(
                'h-1.5 rounded-full transition-[width] duration-100',
                hud.boosting ? 'bg-gradient-to-r from-amber-300 to-rose-400' : 'bg-gradient-to-r from-sky-400 to-neon',
              )}
              style={{ width: `${Math.max(0, Math.min(100, hud.energy))}%` }}
            />
          </div>
          <span
            className={cn(
              'text-[9px] font-semibold tracking-[0.24em]',
              hud.boosting ? 'text-amber-300' : 'text-slate-500',
            )}
          >
            {hud.boosting ? 'BOOST' : 'NITRO'}
          </span>
        </div>

        {status === 'playing' && (
          <div className="touch-controls absolute inset-x-4 bottom-4 z-20 items-end justify-between">
            <div className="flex gap-3">
              <button
                type="button"
                aria-label="向左转向"
                onPointerDown={(event) => {
                  event.preventDefault();
                  engineRef.current?.setSteer(-1);
                }}
                onPointerUp={() => engineRef.current?.setSteer(0)}
                onPointerCancel={() => engineRef.current?.setSteer(0)}
                onPointerLeave={() => engineRef.current?.setSteer(0)}
                className="flex h-16 w-16 touch-none select-none items-center justify-center rounded-full border border-white/20 bg-black/45 text-xl text-slate-100 backdrop-blur active:bg-white/15"
              >
                ←
              </button>
              <button
                type="button"
                aria-label="向右转向"
                onPointerDown={(event) => {
                  event.preventDefault();
                  engineRef.current?.setSteer(1);
                }}
                onPointerUp={() => engineRef.current?.setSteer(0)}
                onPointerCancel={() => engineRef.current?.setSteer(0)}
                onPointerLeave={() => engineRef.current?.setSteer(0)}
                className="flex h-16 w-16 touch-none select-none items-center justify-center rounded-full border border-white/20 bg-black/45 text-xl text-slate-100 backdrop-blur active:bg-white/15"
              >
                →
              </button>
            </div>

            <button
              type="button"
              aria-label="氮气加速"
              onPointerDown={(event) => {
                event.preventDefault();
                engineRef.current?.setNitro(true);
              }}
              onPointerUp={() => engineRef.current?.setNitro(false)}
              onPointerCancel={() => engineRef.current?.setNitro(false)}
              onPointerLeave={() => engineRef.current?.setNitro(false)}
              className="flex h-20 w-20 touch-none select-none items-center justify-center rounded-full border border-amber-300/60 bg-amber-300/90 text-xs font-bold text-ink-950 shadow-[0_0_0_8px_rgba(245,185,66,0.15)] active:scale-95"
            >
              氮气
            </button>
          </div>
        )}

        {status === 'ready' && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-[#050b14]/60 px-6 text-center backdrop-blur-[2px]">
            <div>
              <p className="text-2xl font-extrabold text-white">极速赛车</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                自动加速，在三条车流中穿行，氮气冲得更远
              </p>
            </div>
            <div className="space-y-1 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-[11px] leading-relaxed text-slate-300">
              <p>电脑：A / D 或 ← / → 转向，空格氮气</p>
              <p>手机：左下按钮转向，右侧按钮喷氮气</p>
              <p>撞上任何车辆即结束，里程自动计入最佳</p>
            </div>
            <button
              type="button"
              onClick={start}
              className="h-11 select-none rounded-full bg-neon px-8 text-sm font-bold text-ink-950 shadow-[0_0_0_6px_rgba(62,224,161,0.15)] transition active:scale-95"
            >
              开始竞速
            </button>
            {best > 0 && <p className="text-[11px] text-slate-400">最佳里程 {best} m</p>}
          </div>
        )}

        {status === 'over' && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#050b14]/80 px-6 text-center backdrop-blur-sm">
            <p className="text-2xl font-extrabold text-rose-400">撞车了！</p>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-4xl font-bold tabular-nums text-white">{result}</span>
              <span className="text-xs text-slate-400">米</span>
            </div>
            {newRecord ? (
              <span className="rounded-full border border-amber-300/40 bg-amber-300/15 px-3 py-1 text-[11px] font-semibold text-amber-200">
                新的最佳里程
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">最佳 {best} m</span>
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
                className="h-10 rounded-full bg-neon px-6 text-xs font-bold text-ink-950 transition active:scale-95"
              >
                再跑一次
              </button>
            </div>
          </div>
        )}
      </section>
    </GameFrame>
  );
}
