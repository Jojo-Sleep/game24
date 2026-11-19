import { useCallback, useEffect, useRef, useState } from 'react';
import { GameFrame } from '../components/GameFrame';

const W = 360;
const H = 600;
const BEST_KEY = 'game24-thunder-best';

type Status = 'ready' | 'playing' | 'paused' | 'over';

interface Bullet {
  x: number;
  y: number;
  vy: number;
  r: number;
}

interface Enemy {
  x: number;
  y: number;
  vy: number;
  r: number;
  hp: number;
  maxHp: number;
  phase: number;
  fire: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  hue: number;
}

interface Star {
  x: number;
  y: number;
  z: number;
}

interface GameState {
  status: Status;
  time: number;
  score: number;
  lives: number;
  level: number;
  player: { x: number; y: number; r: number; inv: number };
  bullets: Bullet[];
  enemyBullets: Bullet[];
  enemies: Enemy[];
  particles: Particle[];
  stars: Star[];
  keys: Set<string>;
  pointer: { x: number; y: number; active: boolean };
  fireTimer: number;
  spawnTimer: number;
  shake: number;
  flash: number;
}

function makeStars(): Star[] {
  return Array.from({ length: 70 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    z: 0.3 + Math.random() * 0.9,
  }));
}

function makeState(): GameState {
  return {
    status: 'ready',
    time: 0,
    score: 0,
    lives: 3,
    level: 1,
    player: { x: W / 2, y: H - 72, r: 14, inv: 0 },
    bullets: [],
    enemyBullets: [],
    enemies: [],
    particles: [],
    stars: makeStars(),
    keys: new Set<string>(),
    pointer: { x: W / 2, y: H - 72, active: false },
    fireTimer: 0,
    spawnTimer: 0.7,
    shake: 0,
    flash: 0,
  };
}

function burst(s: GameState, x: number, y: number, count: number, speed: number) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const power = speed * (0.25 + Math.random() * 0.75);
    s.particles.push({
      x,
      y,
      vx: Math.cos(angle) * power,
      vy: Math.sin(angle) * power,
      life: 0.45 + Math.random() * 0.4,
      max: 0.85,
      size: 1.5 + Math.random() * 2.5,
      hue: 140 + Math.random() * 70,
    });
  }
}

function spawnEnemy(s: GameState) {
  const r = 12 + Math.random() * 7;
  const hp = s.level >= 4 && Math.random() < 0.3 ? 2 : 1;
  s.enemies.push({
    x: 30 + Math.random() * (W - 60),
    y: -r - 12,
    vy: 70 + s.level * 9 + Math.random() * 45,
    r,
    hp,
    maxHp: hp,
    phase: Math.random() * Math.PI * 2,
    fire: 1.2 + Math.random() * 1.8,
  });
}

function ShipIcon({ dim }: { dim: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" className={dim ? 'text-slate-600' : 'text-neon'}>
      <path d="M12 3 L19 20 L12 16.5 L5 20 Z" fill="currentColor" />
    </svg>
  );
}

const overlayButton =
  'mt-1 select-none rounded-xl bg-neon px-6 py-2.5 text-sm font-semibold text-ink-950 shadow-[0_12px_36px_-12px_rgba(62,224,161,0.8)] transition hover:bg-[#54e9b0] active:scale-[0.98]';

export function ThunderGame({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(makeState());
  const [status, setStatus] = useState<Status>('ready');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [best, setBest] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch {
      return 0;
    }
  });

  const start = useCallback(() => {
    const next = makeState();
    next.status = 'playing';
    stateRef.current = next;
    setStatus('playing');
    setScore(0);
    setLives(3);
  }, []);

  const togglePause = useCallback(() => {
    const s = stateRef.current;
    if (s.status === 'playing') {
      s.status = 'paused';
      setStatus('paused');
    } else if (s.status === 'paused') {
      s.status = 'playing';
      setStatus('playing');
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const damage = () => {
      const s = stateRef.current;
      if (s.player.inv > 0 || s.status !== 'playing') return;

      s.lives -= 1;
      s.player.inv = 1.4;
      s.shake = 14;
      s.flash = 0.3;
      burst(s, s.player.x, s.player.y, 26, 320);
      setLives(s.lives);

      if (s.lives <= 0) {
        s.status = 'over';
        setStatus('over');
        setBest((prev) => {
          const next = Math.max(prev, s.score);
          try {
            localStorage.setItem(BEST_KEY, String(next));
          } catch {
            // 存储不可用时忽略
          }
          return next;
        });
      }
    };

    const update = (s: GameState, dt: number) => {
      s.time += dt;

      const level = 1 + Math.floor(s.time / 18);
      if (level !== s.level) s.level = level;

      if (s.player.inv > 0) s.player.inv = Math.max(0, s.player.inv - dt);

      let dx = 0;
      let dy = 0;
      if (s.keys.has('ArrowLeft') || s.keys.has('a') || s.keys.has('A')) dx -= 1;
      if (s.keys.has('ArrowRight') || s.keys.has('d') || s.keys.has('D')) dx += 1;
      if (s.keys.has('ArrowUp') || s.keys.has('w') || s.keys.has('W')) dy -= 1;
      if (s.keys.has('ArrowDown') || s.keys.has('s') || s.keys.has('S')) dy += 1;

      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        s.player.x += (dx / len) * 300 * dt;
        s.player.y += (dy / len) * 300 * dt;
      }

      if (s.pointer.active) {
        const k = Math.min(1, dt * 16);
        s.player.x += (s.pointer.x - s.player.x) * k;
        s.player.y += (s.pointer.y - s.player.y) * k;
      }

      s.player.x = Math.max(20, Math.min(W - 20, s.player.x));
      s.player.y = Math.max(70, Math.min(H - 28, s.player.y));

      s.fireTimer -= dt;
      if (s.fireTimer <= 0) {
        s.fireTimer = Math.max(0.08, 0.17 - s.level * 0.006);
        s.bullets.push({ x: s.player.x, y: s.player.y - 18, vy: -640, r: 3 });
      }

      s.spawnTimer -= dt;
      if (s.spawnTimer <= 0) {
        s.spawnTimer = Math.max(0.36, 1 - s.level * 0.06) * (0.7 + Math.random() * 0.6);
        spawnEnemy(s);
      }

      for (const star of s.stars) {
        star.y += (26 + star.z * 150) * dt;
        if (star.y > H) {
          star.y = -4;
          star.x = Math.random() * W;
        }
      }

      for (let i = s.bullets.length - 1; i >= 0; i -= 1) {
        const bullet = s.bullets[i];
        bullet.y += bullet.vy * dt;
        if (bullet.y < -20) {
          s.bullets.splice(i, 1);
          continue;
        }

        for (let j = s.enemies.length - 1; j >= 0; j -= 1) {
          const enemy = s.enemies[j];
          if (Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < bullet.r + enemy.r) {
            s.bullets.splice(i, 1);
            enemy.hp -= 1;

            if (enemy.hp <= 0) {
              s.enemies.splice(j, 1);
              s.score += 30;
              setScore(s.score);
              burst(s, enemy.x, enemy.y, 14, 220);
              s.shake = Math.max(s.shake, 4);
            } else {
              burst(s, bullet.x, bullet.y, 4, 120);
            }
            break;
          }
        }
      }

      for (let j = s.enemies.length - 1; j >= 0; j -= 1) {
        const enemy = s.enemies[j];
        enemy.phase += dt;
        enemy.x += Math.sin(enemy.phase * 1.7) * 34 * dt;
        enemy.y += enemy.vy * dt;
        enemy.fire -= dt;

        if (enemy.fire <= 0 && enemy.y > 40 && enemy.y < H * 0.62) {
          enemy.fire = 1.9 + Math.random();
          s.enemyBullets.push({ x: enemy.x, y: enemy.y + enemy.r, vy: 220 + s.level * 10, r: 4 });
        }

        if (enemy.y > H + 40) {
          s.enemies.splice(j, 1);
          continue;
        }

        if (
          s.player.inv <= 0 &&
          Math.hypot(enemy.x - s.player.x, enemy.y - s.player.y) < enemy.r + s.player.r
        ) {
          s.enemies.splice(j, 1);
          damage();
        }
      }

      for (let i = s.enemyBullets.length - 1; i >= 0; i -= 1) {
        const bullet = s.enemyBullets[i];
        bullet.y += bullet.vy * dt;

        if (bullet.y > H + 20) {
          s.enemyBullets.splice(i, 1);
          continue;
        }

        if (
          s.player.inv <= 0 &&
          Math.hypot(bullet.x - s.player.x, bullet.y - s.player.y) < bullet.r + s.player.r
        ) {
          s.enemyBullets.splice(i, 1);
          damage();
        }
      }

      for (let i = s.particles.length - 1; i >= 0; i -= 1) {
        const particle = s.particles[i];
        particle.life -= dt;
        if (particle.life <= 0) {
          s.particles.splice(i, 1);
          continue;
        }
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= 1 - 1.6 * dt;
        particle.vy = particle.vy * (1 - 1.6 * dt) + 40 * dt;
      }

      if (s.shake > 0) s.shake = Math.max(0, s.shake - 42 * dt);
      if (s.flash > 0) s.flash = Math.max(0, s.flash - 1.3 * dt);
    };

    const draw = (s: GameState, now: number) => {
      ctx.clearRect(0, 0, W, H);

      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#060b11');
      bg.addColorStop(1, '#03060a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      for (const star of s.stars) {
        ctx.globalAlpha = 0.2 + star.z * 0.55;
        ctx.fillStyle = '#9fe8ff';
        ctx.fillRect(star.x, star.y, 1.4 * star.z, 3 * star.z);
      }
      ctx.globalAlpha = 1;

      ctx.save();
      if (s.shake > 0) {
        ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);
      }

      ctx.shadowBlur = 10;
      ctx.shadowColor = '#3ee0a1';
      ctx.fillStyle = '#b7ffe2';
      for (const bullet of s.bullets) {
        ctx.fillRect(bullet.x - 2, bullet.y - 10, 4, 14);
      }

      ctx.shadowColor = '#ff7a7a';
      ctx.fillStyle = '#ffb3b3';
      for (const bullet of s.enemyBullets) {
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 12;
      ctx.shadowColor = '#80c1ff';
      ctx.lineWidth = 2;
      for (const enemy of s.enemies) {
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.rotate(enemy.phase * 0.6);
        ctx.beginPath();
        for (let i = 0; i < 6; i += 1) {
          const angle = (Math.PI / 3) * i;
          const px = Math.cos(angle) * enemy.r;
          const py = Math.sin(angle) * enemy.r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = enemy.maxHp > 1 ? '#2a2438' : '#132b3d';
        ctx.fill();
        ctx.strokeStyle = enemy.maxHp > 1 ? '#c4a6ff' : '#80c1ff';
        ctx.stroke();
        ctx.restore();
      }
      ctx.shadowBlur = 0;

      const player = s.player;
      const blink = player.inv > 0 && Math.floor(now / 110) % 2 === 0;
      if (!blink) {
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.shadowBlur = 16;
        ctx.shadowColor = '#3ee0a1';
        ctx.fillStyle = '#eafff6';
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(14, 14);
        ctx.lineTo(0, 8);
        ctx.lineTo(-14, 14);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0a1a15';
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(5, 4);
        ctx.lineTo(-5, 4);
        ctx.closePath();
        ctx.fill();

        const flame = 9 + Math.sin(now / 60) * 4;
        ctx.fillStyle = 'rgba(62,224,161,0.6)';
        ctx.beginPath();
        ctx.moveTo(-5, 12);
        ctx.lineTo(0, 12 + flame);
        ctx.lineTo(5, 12);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      for (const particle of s.particles) {
        ctx.globalAlpha = Math.max(0, particle.life / particle.max);
        ctx.fillStyle = `hsl(${particle.hue} 90% 66%)`;
        ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
      }
      ctx.globalAlpha = 1;

      ctx.restore();

      if (s.flash > 0) {
        ctx.fillStyle = `rgba(255, 80, 90, ${s.flash})`;
        ctx.fillRect(0, 0, W, H);
      }
    };

    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const s = stateRef.current;
      if (s.status === 'playing') update(s, dt);
      draw(s, now);
      raf = window.requestAnimationFrame(frame);
    };
    raf = window.requestAnimationFrame(frame);

    const toLogical = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * W,
        y: ((clientY - rect.top) / rect.height) * H,
      };
    };

    const onPointerDown = (event: PointerEvent) => {
      const s = stateRef.current;
      if (s.status !== 'playing') return;
      canvas.setPointerCapture(event.pointerId);
      const pos = toLogical(event.clientX, event.clientY);
      s.pointer = { x: pos.x, y: pos.y, active: true };
    };

    const onPointerMove = (event: PointerEvent) => {
      const s = stateRef.current;
      if (!s.pointer.active || s.status !== 'playing') return;
      const pos = toLogical(event.clientX, event.clientY);
      s.pointer.x = pos.x;
      s.pointer.y = pos.y;
    };

    const onPointerUp = () => {
      stateRef.current.pointer.active = false;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const s = stateRef.current;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) {
        event.preventDefault();
      }
      s.keys.add(event.key);
      if (event.key === 'p' || event.key === 'P') togglePause();
      if (event.key === 'Enter' && (s.status === 'ready' || s.status === 'over')) start();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      stateRef.current.keys.delete(event.key);
    };

    const onVisibility = () => {
      if (document.hidden) {
        const s = stateRef.current;
        if (s.status === 'playing') {
          s.status = 'paused';
          setStatus('paused');
        }
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [start, togglePause]);

  return (
    <GameFrame
      title="雷霆战机"
      subtitle="拖动飞船 · 自动开火"
      onExit={onExit}
      right={
        status === 'playing' || status === 'paused' ? (
          <button
            type="button"
            onClick={togglePause}
            className="select-none rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:border-neon/40 hover:text-neon"
          >
            {status === 'paused' ? '继续' : '暂停'}
          </button>
        ) : (
          <span className="font-mono text-[11px] text-slate-500">BEST {best}</span>
        )
      }
    >
      <div
        className="relative mx-auto aspect-[3/5] w-full overflow-hidden rounded-[22px] border border-white/10 bg-black/60 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.95)]"
        style={{ maxWidth: 'min(400px, 42dvh)' }}
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none"
          aria-label="雷霆战机游戏区域"
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
          <div className="rounded-lg border border-white/10 bg-black/45 px-2 py-1 font-mono text-[11px] text-slate-300 backdrop-blur">
            SCORE <span className="font-semibold text-neon">{score}</span>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/45 px-2 py-1.5 backdrop-blur">
            {[0, 1, 2].map((index) => (
              <ShipIcon key={index} dim={index >= lives} />
            ))}
          </div>
        </div>

        {status !== 'playing' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-ink-950/80 px-6 text-center backdrop-blur-sm">
            {status === 'ready' && (
              <>
                <div className="text-lg font-semibold">雷霆战机</div>
                <p className="text-xs text-slate-400">拖动飞船移动，自动开火</p>
                <button type="button" onClick={start} className={overlayButton}>
                  开始游戏
                </button>
              </>
            )}

            {status === 'paused' && (
              <>
                <div className="text-lg font-semibold">已暂停</div>
                <p className="text-xs text-slate-400">按 P 或点按钮继续</p>
                <button type="button" onClick={togglePause} className={overlayButton}>
                  继续
                </button>
              </>
            )}

            {status === 'over' && (
              <>
                <div className="text-lg font-semibold">本局结束</div>
                <div className="font-mono text-4xl font-bold tabular-nums text-neon">{score}</div>
                <p className="text-[11px] text-slate-500">最高分 {best}</p>
                <button type="button" onClick={start} className={overlayButton}>
                  再来一局
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-center text-[11px] text-slate-500">拖动或方向键移动 · 自动射击 · P 暂停</p>
    </GameFrame>
  );
}
