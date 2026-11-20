import { useEffect, useRef, useState } from 'react';
import { GameFrame } from '../components/GameFrame';
import { cn } from '../lib/cn';
import { EggyEngine } from '../lib/eggy';

interface EggyGameProps {
  onExit: () => void;
}

const BEST_KEY = 'eggy-best';

function formatTime(seconds: number): string {
  const total = Math.max(0, seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest.toFixed(2).padStart(5, '0')}`;
}

function Joystick({ onMove }: { onMove: (x: number, y: number) => void }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const active = useRef(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const update = (clientX: number, clientY: number) => {
    const rect = baseRef.current?.getBoundingClientRect();
    if (!rect) return;

    const max = rect.width / 2 - 20;
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy);

    if (length > max) {
      dx = (dx / length) * max;
      dy = (dy / length) * max;
    }

    setKnob({ x: dx, y: dy });
    onMove(dx / max, dy / max);
  };

  const end = () => {
    active.current = false;
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  };

  return (
    <div
      ref={baseRef}
      onPointerDown={(event) => {
        active.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        update(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (active.current) update(event.clientX, event.clientY);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      className="touch-controls absolute bottom-4 left-4 z-20 h-28 w-28 touch-none items-center justify-center rounded-full border border-white/25 bg-black/25 backdrop-blur-sm"
    >
      <div
        className="pointer-events-none h-12 w-12 rounded-full border border-white/40 bg-white/70 shadow-lg"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  );
}

export function EggyGame({ onExit }: EggyGameProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<EggyEngine | null>(null);
  const [status, setStatus] = useState<'ready' | 'playing' | 'won'>('ready');
  const [time, setTime] = useState(0);
  const [best, setBest] = useState(() => {
    try {
      return Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch {
      return 0;
    }
  });
  const [newRecord, setNewRecord] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!mountRef.current) return undefined;

    const engine = new EggyEngine(mountRef.current, {      onTime: (value) => setTime(value),
      onFinish: (value) => {
        setStatus('won');
        setTime(value);
        const previous = Number(localStorage.getItem(BEST_KEY)) || 0;
        if (previous === 0 || value < previous) {
          try {
            localStorage.setItem(BEST_KEY, String(value));
          } catch {
            // 忽略存储失败
          }
          setBest(value);
          setNewRecord(true);
        } else {
          setNewRecord(false);
        }
      },
      onRespawn: () => {
        setFlash('掉下去了！回到检查点');
        if (flashTimer.current) window.clearTimeout(flashTimer.current);
        flashTimer.current = window.setTimeout(() => setFlash(null), 1300);
      },
    });

    engineRef.current = engine;

    return () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const prevBody = document.body.style.overflow;
    const prevHtml = html.style.overflow;
    document.body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBody;
      html.style.overflow = prevHtml;
    };
  }, []);

  const start = () => {
    engineRef.current?.start();
    setNewRecord(false);
    setStatus('playing');
  };

  return (
    <GameFrame
      title="蛋仔闯关"
      subtitle="3D 障碍闯关"
      onExit={onExit}
      right={
        <button
          type="button"
          onClick={start}
          className="h-8 select-none rounded-full border border-neon/30 bg-neon/10 px-2.5 text-[11px] text-neon transition hover:bg-neon/20"
        >
          重开
        </button>
      }
    >
      <section
        className="relative touch-none overflow-hidden rounded-[22px] border border-white/10 bg-[#0a1524] shadow-[0_24px_70px_-40px_rgba(62,224,161,0.4)]"
        style={{ height: 'calc(100dvh - 130px)', minHeight: 220 }}
      >
        <div ref={mountRef} className="absolute inset-0" />

        <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between">
          <div className="rounded-full border border-white/15 bg-black/40 px-2.5 py-1 font-mono text-[11px] font-semibold text-white backdrop-blur">
            {formatTime(time)}
          </div>
          <div className="rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[10px] text-white/80 backdrop-blur">
            最佳 {best > 0 ? formatTime(best) : '--'}
          </div>
        </div>

        {flash && (
          <div className="pointer-events-none absolute left-1/2 top-16 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-rose-400/30 bg-rose-500/25 px-3 py-1 text-[11px] font-semibold text-rose-100 backdrop-blur">
            {flash}
          </div>
        )}

        {status === 'playing' && (
          <>
            <Joystick onMove={(x, y) => engineRef.current?.setTouchInput(x, y)} />
            <button
              type="button"
              onPointerDown={(event) => {
                event.preventDefault();
                engineRef.current?.jump();
              }}
              onPointerUp={() => engineRef.current?.releaseJump()}
              onPointerCancel={() => engineRef.current?.releaseJump()}
              className="touch-controls absolute bottom-6 right-5 z-20 h-20 w-20 touch-none select-none items-center justify-center rounded-full border border-amber-300/60 bg-amber-300/90 text-sm font-bold text-ink-950 shadow-[0_0_0_8px_rgba(245,185,66,0.15)] active:scale-95"
            >
              跳跃
            </button>
          </>
        )}

        {status === 'ready' && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-[#050b14]/55 px-6 text-center backdrop-blur-[2px]">
            <div>
              <p className="text-2xl font-extrabold text-white">蛋仔闯关</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                穿过浮空平台、躲开旋转锤和滚球，冲过终点旗
              </p>
            </div>
            <div className="space-y-1 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-[11px] leading-relaxed text-slate-300">
              <p>电脑：WASD / 方向键移动，空格跳跃</p>
              <p>手机：左侧摇杆移动，右侧按钮跳跃</p>
              <p>掉落会回到最近的检查点，计时不暂停</p>
            </div>
            <button
              type="button"
              onClick={start}
              className="h-11 select-none rounded-full bg-neon px-8 text-sm font-bold text-ink-950 shadow-[0_0_0_6px_rgba(62,224,161,0.15)] transition active:scale-95"
            >
              开始闯关
            </button>
            {best > 0 && <p className="text-[11px] text-slate-400">你的最佳成绩：{formatTime(best)}</p>}
          </div>
        )}

        {status === 'won' && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#050b14]/80 px-6 text-center backdrop-blur-sm">
            <p className="text-2xl font-extrabold text-neon">冲线成功！</p>
            <p className="font-mono text-sm text-white">{formatTime(time)}</p>
            {newRecord ? (
              <span className="rounded-full border border-amber-300/40 bg-amber-300/15 px-3 py-1 text-[11px] font-semibold text-amber-200">
                新的最佳成绩
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">最佳 {formatTime(best)}</span>
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
                再来一次
              </button>
            </div>
          </div>
        )}
      </section>
    </GameFrame>
  );
}
