const W = 480;
const H = 480;
const MIN_SIZE = 13;
const MAX_SIZE = 40;
const START_LIVES = 3;

const WIN_SIZE = 32;

/** 吃鱼成长到该体型即通关 */
export const BIG_FISH_GOAL = WIN_SIZE;
export const BIG_FISH_START = MIN_SIZE;

export interface BigFishCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onSize: (size: number) => void;
  onGameOver: (score: number) => void;
  onWin: (score: number) => void;
}

type State = 'idle' | 'playing' | 'over' | 'won';

interface FishEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
  wobble: number;
  hue: number;
}

interface Bubble {
  x: number;
  y: number;
  r: number;
  speed: number;
  drift: number;
  phase: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}

interface Popup {
  x: number;
  y: number;
  vy: number;
  life: number;
  max: number;
  text: string;
  color: string;
  size: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export class BigFishEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: BigFishCallbacks;
  private dpr: number;

  private player = {
    x: W / 2,
    y: H / 2,
    vx: 0,
    vy: 0,
    size: MIN_SIZE,
    facing: 1,
    invuln: 0,
  };

  private fish: FishEntity[] = [];
  private bubbles: Bubble[] = [];
  private particles: Particle[] = [];
  private popups: Popup[] = [];

  private state: State = 'idle';
  private paused = false;
  private score = 0;
  private lives = START_LIVES;
  private elapsed = 0;
  private spawnTimer = 0;
  private shake = 0;
  private flash = 0;

  private pointer = { x: W / 2, y: H / 2, active: false };
  private keys = new Set<string>();

  private raf = 0;
  private last = 0;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, callbacks: BigFishCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建 2D 画布');
    this.ctx = ctx;

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * this.dpr;
    canvas.height = H * this.dpr;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.bubbles = Array.from({ length: 22 }, () => ({
      x: rand(0, W),
      y: rand(0, H),
      r: rand(1.5, 5),
      speed: rand(16, 46),
      drift: rand(6, 18),
      phase: rand(0, Math.PI * 2),
    }));

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    this.raf = requestAnimationFrame(this.frame);
  }

  // ---------------- 对外 API ----------------

  start(): void {
    this.state = 'playing';
    this.paused = false;
    this.score = 0;
    this.lives = START_LIVES;
    this.elapsed = 0;
    this.spawnTimer = 0.5;
    this.shake = 0;
    this.flash = 0;
    this.particles = [];
    this.popups = [];
    this.fish = [];
    this.player = { x: W / 2, y: H / 2, vx: 0, vy: 0, size: MIN_SIZE, facing: 1, invuln: 0 };
    this.pointer = { x: W / 2, y: H / 2, active: false };

    for (let i = 0; i < 5; i += 1) {
      const fish = this.makeFish(rand(6, 10));
      fish.x = rand(50, W - 50);
      fish.y = rand(50, H - 50);
      fish.vx = rand(30, 60) * (Math.random() < 0.5 ? -1 : 1);
      this.fish.push(fish);
    }

    this.emitAll();
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.paused = true;
    this.pointer.active = false;
    this.keys.clear();
  }

  resume(): void {
    this.paused = false;
  }

  destroy(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  // ---------------- 输入 ----------------

  private onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    this.canvas.setPointerCapture(event.pointerId);
    const point = this.toLogical(event.clientX, event.clientY);
    this.pointer.x = point.x;
    this.pointer.y = point.y;
    this.pointer.active = true;
  };

  private onPointerMove = (event: PointerEvent) => {
    const point = this.toLogical(event.clientX, event.clientY);
    this.pointer.x = point.x;
    this.pointer.y = point.y;
    if (event.pointerType === 'mouse' || this.pointer.active) this.pointer.active = true;
  };

  private onPointerUp = () => {
    this.pointer.active = false;
  };

  private onPointerLeave = () => {
    this.pointer.active = false;
  };

  private onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'].includes(key)) {
      event.preventDefault();
    }
    this.keys.add(key);
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.key.toLowerCase());
  };

  private toLogical(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  }

  // ---------------- 主循环 ----------------

  private frame = (now: number) => {
    if (this.disposed) return;

    const dt = this.last === 0 ? 0.016 : Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.elapsed += dt;

    this.update(dt);
    this.draw();

    this.raf = requestAnimationFrame(this.frame);
  };

  private update(dt: number): void {
    if (this.paused) return;

    this.shake = Math.max(0, this.shake - 44 * dt);
    this.flash = Math.max(0, this.flash - 1.8 * dt);
    this.updateBubbles(dt);
    this.updateEffects(dt);

    if (this.state === 'playing') {
      this.updatePlayer(dt);
      this.updateFish(dt);
      this.updateSpawner(dt);
    }
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);

    let dx = 0;
    let dy = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) dx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) dx += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) dy -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) dy += 1;

    let desiredX = 0;
    let desiredY = 0;
    const maxSpeed = 250 + (p.size - MIN_SIZE) * 2;

    if (dx !== 0 || dy !== 0) {
      const length = Math.hypot(dx, dy);
      desiredX = (dx / length) * maxSpeed;
      desiredY = (dy / length) * maxSpeed;
    } else if (this.pointer.active) {
      const ax = this.pointer.x - p.x;
      const ay = this.pointer.y - p.y;
      const distance = Math.hypot(ax, ay);
      if (distance > 4) {
        const speed = Math.min(maxSpeed, distance * 7);
        desiredX = (ax / distance) * speed;
        desiredY = (ay / distance) * speed;
      }
    }

    const ease = Math.min(1, dt * 8);
    p.vx += (desiredX - p.vx) * ease;
    p.vy += (desiredY - p.vy) * ease;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    const padding = p.size * 0.75;
    p.x = clamp(p.x, padding, W - padding);
    p.y = clamp(p.y, padding, H - padding);

    if (Math.abs(p.vx) > 14) p.facing = p.vx > 0 ? 1 : -1;
  }

  private updateFish(dt: number): void {
    const p = this.player;

    for (let i = this.fish.length - 1; i >= 0; i -= 1) {
      const f = this.fish[i];
      f.phase += dt * 6;
      f.wobble += dt;
      f.x += f.vx * dt;
      f.y += (f.vy + Math.sin(f.wobble * 2.2 + f.phase) * 14) * dt;
      f.y = clamp(f.y, f.size * 0.8 + 6, H - f.size * 0.8 - 6);

      if (f.x < -f.size * 3 || f.x > W + f.size * 3) {
        this.fish.splice(i, 1);
        continue;
      }

      if (p.invuln > 0) continue;

      const distance = Math.hypot(f.x - p.x, f.y - p.y);
      const threshold = p.size * 0.82 + f.size * 0.5;
      if (distance > threshold) continue;

      const ratio = f.size / p.size;
      if (ratio <= 0.9) {
        this.fish.splice(i, 1);
        this.eatFish(f);
      } else if (ratio >= 1.06) {
        this.hitPlayer(f);
      }
    }
  }

  private eatFish(fish: FishEntity): void {
    const gained = Math.round(10 + fish.size * 6);
    this.score += gained;

    this.player.size = Math.min(MAX_SIZE, this.player.size + 0.55 + fish.size * 0.12);

    if (this.player.size >= WIN_SIZE && this.state === 'playing') {
      this.win();
      return;
    }

    this.burst(fish.x, fish.y, 10, ['#a7f3d0', '#fde68a', '#7dd3fc']);
    this.popups.push({
      x: fish.x,
      y: fish.y - fish.size * 0.6,
      vy: -36,
      life: 0.8,
      max: 0.8,
      text: `+${gained}`,
      color: '#a7f3d0',
      size: 13,
    });
    this.shake = Math.max(this.shake, 2.5);

    this.callbacks.onScore(this.score);
    this.callbacks.onSize(this.player.size);
  }

  private hitPlayer(fish: FishEntity): void {
    const p = this.player;
    this.lives -= 1;
    p.invuln = 1.8;
    p.size = Math.max(MIN_SIZE, p.size - 1.6);

    const angle = Math.atan2(p.y - fish.y, p.x - fish.x);
    p.vx += Math.cos(angle) * 240;
    p.vy += Math.sin(angle) * 240;

    this.shake = 14;
    this.flash = 0.42;
    this.burst(p.x, p.y, 16, ['#fecdd3', '#f43f5e', '#fda4af']);
    this.popups.push({
      x: p.x,
      y: p.y - p.size,
      vy: -30,
      life: 0.9,
      max: 0.9,
      text: '被咬了！',
      color: '#fda4af',
      size: 13,
    });

    this.callbacks.onLives(this.lives);
    this.callbacks.onSize(p.size);

    if (this.lives <= 0) {
      this.state = 'over';
      this.callbacks.onGameOver(this.score);
    }
  }

  private win(): void {
    const p = this.player;
    this.state = 'won';
    this.shake = 10;
    this.flash = 0.2;
    this.burst(p.x, p.y, 34, ['#a7f3d0', '#fde68a', '#7dd3fc', '#fef08a']);
    this.popups.push({
      x: p.x,
      y: p.y - p.size,
      vy: -24,
      life: 1.2,
      max: 1.2,
      text: '称霸海洋！',
      color: '#fef08a',
      size: 18,
    });

    this.callbacks.onScore(this.score);
    this.callbacks.onSize(this.player.size);
    this.callbacks.onWin(this.score);
  }

  private updateSpawner(dt: number): void {
    this.spawnTimer -= dt;
    const maxFish = 18 + Math.min(8, Math.floor(this.elapsed / 14));

    if (this.spawnTimer <= 0 && this.fish.length < maxFish) {
      this.fish.push(this.makeFish(this.rollSize()));
      this.spawnTimer = Math.max(0.3, 0.78 - this.elapsed * 0.008) * rand(0.75, 1.25);
    }
  }

  private rollSize(): number {
    const base = this.player.size;
    const roll = Math.random();

    let size: number;
    if (roll < 0.62) size = base * rand(0.28, 0.78);
    else if (roll < 0.86) size = base * rand(0.9, 1.05);
    else size = base * rand(1.14, 1.9);

    return clamp(size, 5, 66);
  }

  private makeFish(size: number): FishEntity {
    const fromLeft = Math.random() < 0.5;
    const speed = size > this.player.size ? rand(30, 58) : rand(55, 112);
    const margin = size * 2.5;

    return {
      x: fromLeft ? -margin : W + margin,
      y: rand(36, H - 36),
      vx: (fromLeft ? 1 : -1) * speed,
      vy: rand(-8, 8),
      size,
      phase: rand(0, Math.PI * 2),
      wobble: rand(0, Math.PI * 2),
      hue: Math.floor(rand(0, 4)),
    };
  }

  private updateBubbles(dt: number): void {
    for (const bubble of this.bubbles) {
      bubble.y -= bubble.speed * dt;
      bubble.phase += dt;
      if (bubble.y < -bubble.r * 2) {
        bubble.y = H + bubble.r * 2;
        bubble.x = rand(0, W);
      }
    }
  }

  private burst(x: number, y: number, count: number, colors: string[]): void {
    for (let i = 0; i < count; i += 1) {
      const angle = rand(0, Math.PI * 2);
      const power = rand(40, 190);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * power,
        vy: Math.sin(angle) * power,
        life: rand(0.3, 0.6),
        max: 0.6,
        size: rand(1.5, 3.4),
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  private updateEffects(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i];
      particle.life -= dt;
      if (particle.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 1 - 2.5 * dt;
      particle.vy = particle.vy * (1 - 2.5 * dt) - 30 * dt;
    }

    for (let i = this.popups.length - 1; i >= 0; i -= 1) {
      const popup = this.popups[i];
      popup.life -= dt;
      if (popup.life <= 0) {
        this.popups.splice(i, 1);
        continue;
      }
      popup.y += popup.vy * dt;
      popup.vy *= 1 - 2 * dt;
    }
  }

  private emitAll(): void {
    this.callbacks.onScore(this.score);
    this.callbacks.onLives(this.lives);
    this.callbacks.onSize(this.player.size);
  }

  // ---------------- 绘制 ----------------

  private draw(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);

    this.drawOcean();

    ctx.save();
    if (this.shake > 0.2) {
      ctx.translate(rand(-1, 1) * this.shake, rand(-1, 1) * this.shake);
    }

    for (const fish of this.fish) {
      this.drawFish(fish);
    }

    if (this.state !== 'over' || this.player.invuln > 0) {
      this.drawPlayer();
    }

    for (const bubble of this.bubbles) {
      ctx.strokeStyle = 'rgba(190,240,255,0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(bubble.x + Math.sin(bubble.phase) * bubble.drift, bubble.y, bubble.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const particle of this.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.max);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;

    for (const popup of this.popups) {
      ctx.globalAlpha = Math.max(0, popup.life / popup.max);
      ctx.fillStyle = popup.color;
      ctx.font = `800 ${popup.size}px "PingFang SC", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(popup.text, popup.x, popup.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';

    ctx.restore();

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,60,90,${this.flash * 0.55})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private drawOcean(): void {
    const ctx = this.ctx;
    const water = ctx.createLinearGradient(0, 0, 0, H);
    water.addColorStop(0, '#062a3d');
    water.addColorStop(0.45, '#041a2b');
    water.addColorStop(1, '#020a13');
    ctx.fillStyle = water;
    ctx.fillRect(0, 0, W, H);

    // 光柱
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i += 1) {
      const x = 60 + i * 110 + Math.sin(this.elapsed * 0.35 + i) * 22;
      const beam = ctx.createLinearGradient(x, 0, x + 40, H);
      beam.addColorStop(0, 'rgba(140,225,255,0.1)');
      beam.addColorStop(1, 'rgba(140,225,255,0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(x - 26, 0);
      ctx.lineTo(x + 26, 0);
      ctx.lineTo(x + 96, H);
      ctx.lineTo(x + 26, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 海底沙地
    const sand = ctx.createLinearGradient(0, H - 46, 0, H);
    sand.addColorStop(0, 'rgba(20,60,64,0)');
    sand.addColorStop(1, 'rgba(16,64,62,0.85)');
    ctx.fillStyle = sand;
    ctx.fillRect(0, H - 46, W, 46);

    // 海草
    ctx.strokeStyle = 'rgba(30,120,102,0.55)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i += 1) {
      const baseX = 26 + i * 72;
      const height = 46 + (i % 3) * 22;
      const sway = Math.sin(this.elapsed * 1.2 + i * 0.9) * 9;
      ctx.beginPath();
      ctx.moveTo(baseX, H - 6);
      ctx.quadraticCurveTo(baseX + sway, H - height * 0.55, baseX + sway * 1.6, H - height);
      ctx.stroke();
    }

    // 远处暗礁
    ctx.fillStyle = 'rgba(8,40,46,0.6)';
    ctx.beginPath();
    ctx.moveTo(0, H - 40);
    ctx.quadraticCurveTo(80, H - 78, 150, H - 46);
    ctx.quadraticCurveTo(230, H - 96, 320, H - 44);
    ctx.quadraticCurveTo(400, H - 80, W, H - 42);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
  }

  private fishColors(fish: FishEntity): { fill: string; glow: string; dangerous: boolean } {
    const ratio = fish.size / this.player.size;
    if (ratio > 1.05) {
      return {
        fill: fish.hue % 2 === 0 ? '#f43f5e' : '#a855f7',
        glow: 'rgba(244,63,94,0.55)',
        dangerous: true,
      };
    }
    if (ratio >= 0.9) {
      return { fill: '#64748b', glow: 'rgba(100,116,139,0.35)', dangerous: false };
    }
    const hues = [160, 45, 96, 196];
    const hue = hues[fish.hue % hues.length];
    return {
      fill: `hsl(${hue} 78% 58%)`,
      glow: `hsla(${hue} 85% 62% 0.45)`,
      dangerous: false,
    };
  }

  private drawFish(fish: FishEntity): void {
    const ctx = this.ctx;
    const { fill, glow, dangerous } = this.fishColors(fish);
    const facing = fish.vx >= 0 ? 1 : -1;

    ctx.save();
    ctx.translate(fish.x, fish.y);
    ctx.scale(facing, 1);
    ctx.shadowBlur = dangerous ? 16 : 10;
    ctx.shadowColor = glow;
    this.drawFishBody(fish.size, fill, fish.phase, false);
    ctx.restore();
  }

  private drawPlayer(): void {
    const ctx = this.ctx;
    const p = this.player;
    const blink = p.invuln > 0 && Math.floor(this.elapsed * 12) % 2 === 0;

    ctx.save();
    ctx.globalAlpha = blink ? 0.35 : 1;
    ctx.translate(p.x, p.y + Math.sin(this.elapsed * 3) * 1.4);
    ctx.scale(p.facing, 1);
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(62,224,161,0.8)';
    this.drawFishBody(p.size, '#3ee0a1', this.elapsed * 7, true);
    ctx.restore();
  }

  private drawFishBody(size: number, fill: string, phase: number, isPlayer: boolean): void {
    const ctx = this.ctx;
    const rx = size;
    const ry = size * 0.62;
    const wiggle = Math.sin(phase) * 0.45;

    // 尾巴
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(-rx * 0.72, 0);
    ctx.lineTo(-rx * 1.72, -ry * 0.95 + wiggle * ry * 0.7);
    ctx.lineTo(-rx * 1.34, 0);
    ctx.lineTo(-rx * 1.72, ry * 0.95 + wiggle * ry * 0.7);
    ctx.closePath();
    ctx.fill();

    // 背鳍
    ctx.beginPath();
    ctx.moveTo(-rx * 0.15, -ry * 0.82);
    ctx.quadraticCurveTo(rx * 0.1, -ry * 1.7, rx * 0.5, -ry * 0.86);
    ctx.closePath();
    ctx.fill();

    // 腹鳍
    ctx.beginPath();
    ctx.moveTo(-rx * 0.05, ry * 0.78);
    ctx.quadraticCurveTo(-rx * 0.2, ry * 1.5, rx * 0.36, ry * 0.82);
    ctx.closePath();
    ctx.fill();

    // 身体
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // 光泽
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.ellipse(-rx * 0.12, -ry * 0.34, rx * 0.62, ry * 0.28, -0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 胸鳍
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(rx * 0.32, ry * 0.42, rx * 0.26, ry * 0.16, 0.5, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    const eyeX = rx * 0.56;
    const eyeY = -ry * 0.22;
    const eyeR = Math.max(2, ry * 0.3);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b1220';
    ctx.beginPath();
    ctx.arc(eyeX + eyeR * 0.3, eyeY, eyeR * 0.52, 0, Math.PI * 2);
    ctx.fill();

    // 嘴
    ctx.strokeStyle = 'rgba(4,20,26,0.65)';
    ctx.lineWidth = Math.max(1, size * 0.07);
    ctx.beginPath();
    ctx.arc(rx * 0.88, ry * 0.16, ry * 0.2, -0.4, 0.9);
    ctx.stroke();

    if (isPlayer) {
      // 小高光标记，让玩家更容易找到自己
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(-rx * 0.5, -ry * 0.4, Math.max(1.2, size * 0.06), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
