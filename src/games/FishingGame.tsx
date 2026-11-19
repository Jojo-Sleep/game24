import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameFrame } from '../components/GameFrame';
import { cn } from '../lib/cn';

const BEST_KEY = 'game24-fishing-best';
const BITE_WINDOW = 950;

type Phase = 'ready' | 'waiting' | 'bite' | 'reel' | 'caught' | 'missed';

interface Fish {
  name: string;
  value: number;
  color: string;
  rarity: string;
  weight: number;
}

const FISH: Fish[] = [
  { name: '小丑鱼', value: 10, color: '#f5b942', rarity: '普通', weight: 32 },
  { name: '鲈鱼', value: 16, color: '#80c1ff', rarity: '普通', weight: 26 },
  { name: '河豚', value: 30, color: '#3ee0a1', rarity: '稀有', weight: 18 },
  { name: '灯笼鱼', value: 45, color: '#b18cff', rarity: '珍贵', weight: 12 },
  { name: '黄金鱼', value: 100, color: '#ffd166', rarity: '传说', weight: 5 },
];

function pickFish(): Fish {
  const total = FISH.reduce((sum, fish) => sum + fish.weight, 0);
  let roll = Math.random() * total;
  for (const fish of FISH) {
    roll -= fish.weight;
    if (roll <= 0) return fish;
  }
  return FISH[0];
}

function FishIcon({ color, size = 44 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M13 24 L3 15 L3 33 Z" fill={color} opacity="0.85" />
      <ellipse cx="27" cy="24" rx="14" ry="10" fill={color} />
      <path d="M22 14 L26 8 L30 14 Z" fill={color} opacity="0.85" />
      <circle cx="34" cy="21" r="2" fill="#05121b" />
      <circle cx="34.8" cy="20.2" r="0.7" fill="#ffffff" opacity="0.85" />
    </svg>
  );
}

function Meter({ label, value, barClass }: { label: string; value: number; barClass: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-[10px] text-slate-400">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn('h-full rounded-full transition-[width] duration-100', barClass)}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function FishingGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [hook, setHook] = useState<Fish | null>(null);
  const [caught, setCaught] = useState<Fish | null>(null);
  const [message, setMessage] = useState('');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [progress, setProgress] = useState(0);
  const [tension, setTension] = useState(0);
  const [best, setBest] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch {
      return 0;
    }
  });

  const timers = useRef<{ wait?: number; bite?: number; reset?: number }>({});
  const holding = useRef(false);
  const hookRef = useRef<Fish | null>(null);
  const scoreRef = useRef(0);
  const bestRef = useRef(best);
  const streakRef = useRef(0);

  const bubbles = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        id: index,
        left: 6 + Math.random() * 88,
        size: 3 + Math.random() * 5,
        duration: 6 + Math.random() * 6,
        delay: Math.random() * 6,
      })),
    [],
  );

  const scheduleReset = useCallback(() => {
    if (timers.current.reset) window.clearTimeout(timers.current.reset);
    timers.current.reset = window.setTimeout(() => {
      setPhase('ready');
      setHook(null);
      hookRef.current = null;
      setCaught(null);
      setMessage('');
      setProgress(0);
      setTension(0);
    }, 1300);
  }, []);

  const cast = useCallback(() => {
    if (phase !== 'ready') return;

    const fish = pickFish();
    hookRef.current = fish;
    setHook(fish);
    setPhase('waiting');
    setMessage('');
    setProgress(0);
    setTension(0);

    timers.current.wait = window.setTimeout(() => {
      setPhase('bite');
      timers.current.bite = window.setTimeout(() => {
        setPhase('missed');
        setMessage('鱼饵被吃掉了');
        streakRef.current = 0;
        setStreak(0);
        scheduleReset();
      }, BITE_WINDOW);
    }, 900 + Math.random() * 1900);
  }, [phase, scheduleReset]);

  const press = () => {
    if (phase === 'ready') {
      cast();
      return;
    }
    if (phase === 'bite') {
      if (timers.current.bite) {
        window.clearTimeout(timers.current.bite);
        timers.current.bite = undefined;
      }
      holding.current = true;
      setPhase('reel');
      return;
    }
    if (phase === 'reel') holding.current = true;
  };

  const release = () => {
    holding.current = false;
  };

  const pressRef = useRef(press);
  pressRef.current = press;

  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      event.preventDefault();
      if (!event.repeat) pressRef.current();
    };
    const onUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') holding.current = false;
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  useEffect(
    () => () => {
      if (timers.current.wait) window.clearTimeout(timers.current.wait);
      if (timers.current.bite) window.clearTimeout(timers.current.bite);
      if (timers.current.reset) window.clearTimeout(timers.current.reset);
    },
    [],
  );

  useEffect(() => {
    if (phase !== 'reel') return undefined;

    let reelProgress = 0;
    let reelTension = 0;

    const id = window.setInterval(() => {
      if (holding.current) {
        reelProgress += 2.5;
        reelTension += 3.1;
      } else {
        reelProgress = Math.max(0, reelProgress - 0.6);
        reelTension = Math.max(0, reelTension - 3.4);
      }
      reelProgress = Math.min(100, reelProgress);
      reelTension = Math.min(100, reelTension);
      setProgress(reelProgress);
      setTension(reelTension);

      if (reelTension >= 100) {
        window.clearInterval(id);
        holding.current = false;
        streakRef.current = 0;
        setStreak(0);
        setPhase('missed');
        setMessage('线绷断了，鱼跑了');
        scheduleReset();
        return;
      }

      if (reelProgress >= 100) {
        window.clearInterval(id);
        holding.current = false;
        const fish = hookRef.current;
        setPhase('caught');
        setCaught(fish);

        if (fish) {
          const next = scoreRef.current + fish.value;
          scoreRef.current = next;
          setScore(next);
          streakRef.current += 1;
          setStreak(streakRef.current);

          if (next > bestRef.current) {
            bestRef.current = next;
            setBest(next);
            try {
              localStorage.setItem(BEST_KEY, String(next));
            } catch {
              // 存储不可用时忽略
            }
          }
        }

        scheduleReset();
      }
    }, 50);

    return () => window.clearInterval(id);
  }, [phase, scheduleReset]);

  const resetGame = useCallback(() => {
    if (timers.current.wait) window.clearTimeout(timers.current.wait);
    if (timers.current.bite) window.clearTimeout(timers.current.bite);
    if (timers.current.reset) window.clearTimeout(timers.current.reset);
    timers.current = {};
    holding.current = false;
    hookRef.current = null;
    scoreRef.current = 0;
    streakRef.current = 0;
    setScore(0);
    setStreak(0);
    setPhase('ready');
    setHook(null);
    setCaught(null);
    setMessage('');
    setProgress(0);
    setTension(0);
  }, []);

  const lineHeight =
    phase === 'ready'
      ? 0
      : phase === 'caught'
        ? 16
        : phase === 'reel'
          ? Math.max(12, 46 - progress * 0.35)
          : phase === 'bite'
            ? 49
            : 46;

  const actionLabel =
    phase === 'ready'
      ? '抛竿'
      : phase === 'waiting'
        ? '等鱼上钩…'
        : phase === 'bite'
          ? '收竿！'
          : phase === 'reel'
            ? '按住收线'
            : phase === 'caught'
              ? '收竿成功'
              : '鱼跑了';

  const actionClass =
    phase === 'bite'
      ? 'animate-pulse bg-amber-300 text-ink-950 shadow-[0_12px_36px_-12px_rgba(245,185,66,0.9)]'
      : phase === 'reel' || phase === 'ready'
        ? 'bg-neon text-ink-950 shadow-[0_12px_36px_-12px_rgba(62,224,161,0.8)]'
        : 'border border-white/10 bg-white/[0.04] text-slate-500';

  return (
    <GameFrame
      title="钓鱼"
      subtitle="抛竿、等咬钩、按住收线"
      onExit={onExit}
      right={
        <button
          type="button"
          onClick={resetGame}
          className="select-none rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:border-neon/40 hover:text-neon"
        >
          重开
        </button>
      }
    >
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] tracking-[0.2em] text-slate-500">SCORE</span>
          <span className="font-mono text-xl font-bold tabular-nums text-neon">{score}</span>
        </div>
        <div className="flex items-center gap-2.5 text-[11px] text-slate-500">
          <span>连击 ×{streak}</span>
          <span>最高 {best}</span>
        </div>
      </div>

      <div className="mx-auto mt-3 w-full" style={{ maxWidth: 'min(420px, 52dvh)' }}>
        <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] border border-white/10 bg-[#05131d]">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0e4159] via-[#072534] to-[#03101a]" />
          <div className="water-rays absolute inset-0" />
          <div className="absolute inset-x-0 top-0 h-px bg-white/25" />

          {bubbles.map((bubble) => (
            <span
              key={bubble.id}
              className="bubble"
              style={{
                left: `${bubble.left}%`,
                width: bubble.size,
                height: bubble.size,
                animationDuration: `${bubble.duration}s`,
                animationDelay: `${bubble.delay}s`,
              }}
            />
          ))}

          <div className="swim-right absolute left-0 top-[24%] opacity-20">
            <FishIcon color="#7fd6ff" size={38} />
          </div>
          <div className="swim-left absolute left-0 top-[60%] opacity-20">
            <FishIcon color="#8ef0c6" size={30} />
          </div>

          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#0b1a22] to-transparent" />

          <div
            className="absolute left-1/2 top-0 w-px -translate-x-1/2 bg-gradient-to-b from-white/50 to-white/10 transition-[height] duration-500"
            style={{ height: `${lineHeight}%` }}
          >
            <span className={cn('bobber', phase === 'bite' && 'bobber-bite')} />
          </div>

          {hook && phase !== 'ready' && (
            <div
              className={cn(
                'absolute left-[60%] z-[6]',
                phase === 'waiting' && 'fish-approach',
                phase === 'reel' && 'fish-struggle',
              )}
              style={{ top: `calc(${lineHeight}% + 8px)` }}
            >
              <FishIcon color={hook.color} size={44} />
            </div>
          )}

          {phase === 'waiting' && (
            <div className="absolute left-1/2 top-3 -translate-x-1/2 text-[11px] text-cyan-100/70">
              等鱼上钩…
            </div>
          )}

          {phase === 'bite' && (
            <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 animate-bounce rounded-full bg-amber-300/15 px-3 py-1 text-xs font-semibold text-amber-300">
              咬钩了！
            </div>
          )}

          {phase === 'reel' && (
            <div className="absolute inset-x-4 bottom-4 space-y-1.5">
              <Meter label="收线" value={progress} barClass="bg-neon" />
              <Meter
                label="张力"
                value={tension}
                barClass={tension > 74 ? 'bg-rose-400' : 'bg-amber-300'}
              />
            </div>
          )}

          {phase === 'ready' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
              <span className="text-sm text-slate-200/80">水面很平静</span>
              <span className="text-[11px] text-slate-400/70">抛竿后等鱼咬钩</span>
            </div>
          )}

          {phase === 'caught' && caught && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 bg-ink-950/70 backdrop-blur-sm">
              <div className="caught-pop">
                <FishIcon color={caught.color} size={68} />
              </div>
              <div className="mt-1 text-base font-semibold">{caught.name}</div>
              <div className="text-[11px] text-slate-400">{caught.rarity}</div>
              <div className="font-mono text-2xl font-bold text-neon">+{caught.value}</div>
            </div>
          )}

          {phase === 'missed' && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink-950/60 backdrop-blur-sm">
              <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-sm text-rose-300">
                {message}
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={phase === 'waiting' || phase === 'caught' || phase === 'missed'}
          onPointerDown={(event) => {
            event.preventDefault();
            press();
          }}
          onPointerUp={release}
          onPointerLeave={release}
          onPointerCancel={release}
          className={cn(
            'mt-3 h-12 w-full touch-none select-none rounded-xl text-sm font-semibold transition active:scale-[0.99] disabled:cursor-default',
            actionClass,
          )}
        >
          {actionLabel}
        </button>

        <p className="mt-2 text-center text-[11px] text-slate-500">空格键也可以操作</p>
      </div>
    </GameFrame>
  );
}
