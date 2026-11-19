const W = 480;
const H = 300;
const GROUND = 272;
const MIN_X = 52;
const MAX_X = 428;
const MAX_HP = 100;
const ROUND_TIME = 40;
const ROUND_INTRO = 1.5;
const ROUND_END = 2.2;

export type BoxingResult = 'win' | 'lose';

export interface BoxingCallbacks {
  onMatchEnd: (result: BoxingResult) => void;
}

type Phase = 'idle' | 'intro' | 'fight' | 'roundEnd' | 'matchEnd';
type Side = 'player' | 'ai';

interface Fighter {
  x: number;
  hp: number;
  facing: 1 | -1;
  punch: number;
  hitApplied: boolean;
  cooldown: number;
  stun: number;
  flash: number;
  block: boolean;
  blockFlash: number;
  ko: number;
  walk: number;
  move: number;
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

interface CrowdDot {
  x: number;
  y: number;
  r: number;
  phase: number;
  color: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function makeFighter(x: number, facing: 1 | -1): Fighter {
  return {
    x,
    hp: MAX_HP,
    facing,
    punch: 0,
    hitApplied: true,
    cooldown: 0,
    stun: 0,
    flash: 0,
    block: false,
    blockFlash: 0,
    ko: 0,
    walk: 0,
    move: 0,
  };
}

export class BoxingEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: BoxingCallbacks;
  private dpr: number;

  private player: Fighter = makeFighter(180, 1);
  private ai: Fighter = makeFighter(300, -1);

  private phase: Phase = 'idle';
  private phaseTimer = 0;
  private round = 1;
  private playerWins = 0;
  private aiWins = 0;
  private roundTime = ROUND_TIME;
  private roundWinner: Side = 'player';
  private roundReason: 'ko' | 'time' = 'time';
  private fightBanner = 0;

  private shake = 0;
  private flash = 0;
  private time = 0;
  private particles: Particle[] = [];
  private popups: Popup[] = [];
  private crowd: CrowdDot[] = [];

  private input = { left: false, right: false, block: false };
  private touchDir = 0;
  private touchBlock = false;

  private aiThink = 0;
  private aiIntent = 0;
  private aiBlockTimer = 0;

  private raf = 0;
  private last = 0;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, callbacks: BoxingCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建 2D 画布');
    this.ctx = ctx;

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * this.dpr;
    canvas.height = H * this.dpr;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const colors = ['#334155', '#3f4a5c', '#4b5563', '#2d3a4b'];
    this.crowd = Array.from({ length: 110 }, () => ({
      x: rand(6, W - 6),
      y: rand(64, 122),
      r: rand(2.4, 5),
      phase: rand(0, Math.PI * 2),
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);

    this.raf = requestAnimationFrame(this.frame);
  }

  // ---------------- 对外 API ----------------

  start(): void {
    this.playerWins = 0;
    this.aiWins = 0;
    this.round = 1;
    this.particles = [];
    this.popups = [];
    this.startRound();
  }

  punch(): void {
    const p = this.player;
    if (this.phase !== 'fight' || p.cooldown > 0 || p.stun > 0 || this.playerBlocking()) return;
    p.punch = 0.26;
    p.hitApplied = false;
    p.cooldown = 0.42;
  }

  setDirection(dir: number): void {
    this.touchDir = clamp(Math.round(dir), -1, 1);
  }

  setBlock(value: boolean): void {
    this.touchBlock = value;
  }

  destroy(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.width = 1;
    this.canvas.height = 1;
  }

  // ---------------- 输入 ----------------

  private onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'a', 'd', 'j', 'k', ' '].includes(key)) event.preventDefault();

    if (key === 'a' || key === 'arrowleft') this.input.left = true;
    if (key === 'd' || key === 'arrowright') this.input.right = true;
    if (key === 'k' || key === 'shift') this.input.block = true;
    if ((key === 'j' || key === ' ') && !event.repeat) this.punch();
  };

  private onKeyUp = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (key === 'a' || key === 'arrowleft') this.input.left = false;
    if (key === 'd' || key === 'arrowright') this.input.right = false;
    if (key === 'k' || key === 'shift') this.input.block = false;
  };

  private onBlur = () => {
    this.input.left = false;
    this.input.right = false;
    this.input.block = false;
    this.touchDir = 0;
    this.touchBlock = false;
  };

  private playerBlocking(): boolean {
    return (this.input.block || this.touchBlock) && this.phase === 'fight' && this.player.punch <= 0;
  }

  // ---------------- 回合流程 ----------------

  private startRound(): void {
    this.player = makeFighter(180, 1);
    this.ai = makeFighter(300, -1);
    this.roundTime = ROUND_TIME;
    this.phase = 'intro';
    this.phaseTimer = ROUND_INTRO;
    this.fightBanner = 0;
    this.aiThink = 0;
    this.aiIntent = 0;
    this.aiBlockTimer = 0;
    this.particles = [];
    this.popups = [];
    this.shake = 0;
  }

  private finishRound(winner: Side, reason: 'ko' | 'time'): void {
    if (this.phase !== 'fight') return;

    this.phase = 'roundEnd';
    this.phaseTimer = ROUND_END;
    this.roundWinner = winner;
    this.roundReason = reason;
    this.fightBanner = 0;

    if (winner === 'player') this.playerWins += 1;
    else this.aiWins += 1;

    this.player.punch = 0;
    this.ai.punch = 0;
    this.player.block = false;
    this.ai.block = false;

    if (reason === 'ko') {
      const loser = winner === 'player' ? this.ai : this.player;
      this.spawnSparks(loser.x, GROUND - 68, 24, '#ffffff');
      this.shake = 10;
    }
  }

  // ---------------- 主循环 ----------------

  private frame = (now: number) => {
    if (this.disposed) return;

    const dt = this.last === 0 ? 0.016 : Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.time += dt;

    this.update(dt);
    this.draw(now);

    this.raf = requestAnimationFrame(this.frame);
  };

  private update(dt: number): void {
    this.shake = Math.max(0, this.shake - 42 * dt);
    this.flash = Math.max(0, this.flash - 1.8 * dt);
    this.updateEffects(dt);

    switch (this.phase) {
      case 'intro': {
        this.phaseTimer -= dt;
        this.player.block = this.playerBlocking();
        if (this.phaseTimer <= 0) {
          this.phase = 'fight';
          this.fightBanner = 0.65;
          this.player.cooldown = 0.2;
          this.ai.cooldown = 0.45;
        }
        break;
      }
      case 'fight': {
        this.roundTime -= dt;
        if (this.roundTime <= 0) {
          this.roundTime = 0;
          this.finishRound(this.player.hp >= this.ai.hp ? 'player' : 'ai', 'time');
          break;
        }

        this.fightBanner = Math.max(0, this.fightBanner - dt);
        this.updatePlayer(dt);
        this.updateAI(dt);
        this.updatePunch(this.player, dt, true);
        this.updatePunch(this.ai, dt, false);
        break;
      }
      case 'roundEnd': {
        this.phaseTimer -= dt;

        if (this.roundReason === 'ko') {
          const loser = this.roundWinner === 'player' ? this.ai : this.player;
          loser.ko = Math.min(1, loser.ko + dt * 2.6);
        }

        if (this.phaseTimer <= 0) {
          if (this.playerWins >= 2 || this.aiWins >= 2) {
            this.phase = 'matchEnd';
            this.callbacks.onMatchEnd(this.playerWins >= 2 ? 'win' : 'lose');
          } else {
            this.round += 1;
            this.startRound();
          }
        }
        break;
      }
      default:
        break;
    }
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    let dir = (this.input.left ? -1 : 0) + (this.input.right ? 1 : 0);
    if (dir === 0) dir = this.touchDir;

    p.block = this.playerBlocking();
    if (p.stun > 0) {
      dir = 0;
      p.block = false;
    }

    const speed = p.block ? 52 : 122;
    p.x = clamp(p.x + dir * speed * dt, MIN_X, MAX_X);
    p.move = dir;
    p.walk += Math.abs(dir) * dt * 11;

    this.separate();
    p.facing = p.x < this.ai.x ? 1 : -1;
    this.ai.facing = this.ai.x < p.x ? 1 : -1;
  }

  private updateAI(dt: number): void {
    const a = this.ai;
    const p = this.player;

    a.cooldown = Math.max(0, a.cooldown - dt);
    if (a.stun > 0) {
      a.block = false;
      a.move = 0;
      return;
    }

    this.aiThink -= dt;
    const distance = Math.abs(a.x - p.x);

    if (this.aiThink <= 0) {
      this.aiThink = 0.16 + Math.random() * 0.2;

      if (p.punch > 0.08 && distance < 92 && Math.random() < 0.3 + this.round * 0.08) {
        this.aiBlockTimer = 0.36;
        this.aiIntent = 0;
      } else {
        if (distance > 68) {
          this.aiIntent = 1;
        } else if (Math.random() < 0.18 + this.round * 0.05) {
          this.aiIntent = -1;
        } else {
          this.aiIntent = 0;
        }

        if (
          distance < 80 &&
          a.cooldown <= 0 &&
          this.aiBlockTimer <= 0 &&
          Math.random() < 0.5 + this.round * 0.09
        ) {
          this.aiPunch();
        }
      }
    }

    if (this.aiBlockTimer > 0) this.aiBlockTimer -= dt;
    a.block = this.aiBlockTimer > 0;

    if (!a.block) {
      const speed = 62 + this.round * 10;
      a.x = clamp(a.x + this.aiIntent * speed * dt, MIN_X, MAX_X);
      a.move = this.aiIntent;
      a.walk += Math.abs(this.aiIntent) * dt * 11;
    } else {
      a.move = 0;
    }

    this.separate();
    p.facing = p.x < a.x ? 1 : -1;
    a.facing = a.x < p.x ? 1 : -1;
  }

  private aiPunch(): void {
    const a = this.ai;
    if (this.phase !== 'fight' || a.cooldown > 0 || a.stun > 0) return;
    a.punch = 0.26;
    a.hitApplied = false;
    a.cooldown = Math.max(0.45, 0.95 - this.round * 0.07);
  }

  private updatePunch(f: Fighter, dt: number, isPlayer: boolean): void {
    f.cooldown = Math.max(0, f.cooldown - dt);
    f.stun = Math.max(0, f.stun - dt);
    f.flash = Math.max(0, f.flash - dt);
    f.blockFlash = Math.max(0, f.blockFlash - dt);

    if (f.punch > 0) {
      f.punch = Math.max(0, f.punch - dt);
      if (!f.hitApplied && f.punch <= 0.12) {
        f.hitApplied = true;
        this.resolveHit(isPlayer);
      }
    }
  }

  private separate(): void {
    const gap = this.ai.x - this.player.x;
    const minGap = 46;
    if (Math.abs(gap) >= minGap) return;

    const push = (minGap - Math.abs(gap)) / 2;
    const sign = gap >= 0 ? 1 : -1;
    this.player.x = clamp(this.player.x - sign * push, MIN_X, MAX_X);
    this.ai.x = clamp(this.ai.x + sign * push, MIN_X, MAX_X);
  }

  private resolveHit(attackerIsPlayer: boolean): void {
    if (this.phase !== 'fight') return;

    const atk = attackerIsPlayer ? this.player : this.ai;
    const def = attackerIsPlayer ? this.ai : this.player;
    if (def.hp <= 0) return;
    if (Math.abs(atk.x - def.x) > 84) return;

    const blocked = def.block && def.stun <= 0;
    const base = attackerIsPlayer ? rand(8, 12) : rand(6, 9.5) + (this.round - 1) * 0.8;
    const damage = blocked ? Math.max(1, base * 0.18) : base;

    def.hp = Math.max(0, def.hp - damage);
    def.flash = 0.22;

    const hx = (atk.x + def.x) / 2 + atk.facing * 8;
    const hy = GROUND - 66 + rand(-8, 10);

    if (blocked) {
      def.blockFlash = 0.25;
      this.shake = Math.max(this.shake, 2.5);
      this.spawnSparks(hx, hy, 6, '#9ad7ff');
      this.popups.push({
        x: hx,
        y: hy - 14,
        vy: -22,
        life: 0.7,
        max: 0.7,
        text: 'BLOCK',
        color: '#9ad7ff',
        size: 11,
      });
    } else {
      def.stun = 0.3;
      def.punch = 0;
      def.x = clamp(def.x + atk.facing * 11, MIN_X, MAX_X);
      this.shake = Math.max(this.shake, 7);
      this.spawnSparks(hx, hy, 16, attackerIsPlayer ? '#ffd166' : '#ff8a8a');
      this.popups.push({
        x: hx,
        y: hy - 12,
        vy: -34,
        life: 0.75,
        max: 0.75,
        text: String(Math.round(damage)),
        color: attackerIsPlayer ? '#ffe3a3' : '#ffb3bd',
        size: 15,
      });

      if (def.hp <= 0) {
        this.finishRound(attackerIsPlayer ? 'player' : 'ai', 'ko');
      }
    }

    this.flash = Math.max(this.flash, blocked ? 0.04 : 0.09);
  }

  private spawnSparks(x: number, y: number, count: number, color: string): void {
    for (let i = 0; i < count; i += 1) {
      const angle = rand(0, Math.PI * 2);
      const power = rand(40, 260);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * power,
        vy: Math.sin(angle) * power - 30,
        life: rand(0.25, 0.55),
        max: 0.55,
        size: rand(1.4, 3.2),
        color,
      });
    }
  }

  private updateEffects(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 3 * dt;
      p.vy = p.vy * (1 - 3 * dt) + 420 * dt;
    }

    for (let i = this.popups.length - 1; i >= 0; i -= 1) {
      const p = this.popups[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.popups.splice(i, 1);
        continue;
      }
      p.y += p.vy * dt;
      p.vy *= 1 - 1.6 * dt;
    }
  }

  // ---------------- 绘制 ----------------

  private draw(now: number): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);
    this.drawBackdrop();
    this.drawCrowd();
    this.drawRing(now);
    this.drawHud();

    ctx.save();
    if (this.shake > 0.2) {
      ctx.translate(rand(-1, 1) * this.shake, rand(-1, 1) * this.shake * 0.6);
    }

    this.drawShadow(this.player);
    this.drawShadow(this.ai);
    this.drawFighter(this.player, '#3ee0a1', '#0f9f72', '#edc09a', '#2b2119');
    this.drawFighter(this.ai, '#fb7185', '#b81f45', '#d9a273', '#221a15');

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

    this.drawBanner();

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private drawBackdrop(): void {
    const ctx = this.ctx;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#05090f');
    bg.addColorStop(0.68, '#091018');
    bg.addColorStop(1, '#03060a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const light = ctx.createRadialGradient(W / 2, 8, 10, W / 2, 40, 260);
    light.addColorStop(0, 'rgba(62,224,161,0.18)');
    light.addColorStop(0.55, 'rgba(62,224,161,0.05)');
    light.addColorStop(1, 'rgba(62,224,161,0)');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, W, 220);

    const warm = ctx.createRadialGradient(70, 10, 4, 70, 30, 150);
    warm.addColorStop(0, 'rgba(255,196,120,0.14)');
    warm.addColorStop(1, 'rgba(255,196,120,0)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, W, 180);

    const cold = ctx.createRadialGradient(W - 70, 10, 4, W - 70, 30, 150);
    cold.addColorStop(0, 'rgba(128,193,255,0.14)');
    cold.addColorStop(1, 'rgba(128,193,255,0)');
    ctx.fillStyle = cold;
    ctx.fillRect(0, 0, W, 180);
  }

  private drawCrowd(): void {
    const ctx = this.ctx;
    for (const dot of this.crowd) {
      const twinkle = 0.55 + Math.sin(this.time * 1.7 + dot.phase) * 0.25;
      ctx.globalAlpha = 0.45 * twinkle;
      ctx.fillStyle = dot.color;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const haze = ctx.createLinearGradient(0, 118, 0, 138);
    haze.addColorStop(0, 'rgba(6,10,16,0)');
    haze.addColorStop(1, 'rgba(6,10,16,0.9)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 118, W, 20);
  }

  private drawRing(now: number): void {
    const ctx = this.ctx;

    // 擂台地板
    ctx.beginPath();
    ctx.moveTo(36, 226);
    ctx.lineTo(W - 36, 226);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    const mat = ctx.createLinearGradient(0, 226, 0, H);
    mat.addColorStop(0, '#152330');
    mat.addColorStop(1, '#0a121a');
    ctx.fillStyle = mat;
    ctx.fill();

    ctx.strokeStyle = 'rgba(62,224,161,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(36, 226);
    ctx.lineTo(W - 36, 226);
    ctx.stroke();

    // 中心标志
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = '#3ee0a1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(W / 2, 276, 74, 20, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#3ee0a1';
    ctx.font = '700 11px "PingFang SC", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ARCADE BOXING', W / 2, 280);
    ctx.restore();
    ctx.textAlign = 'left';

    // 围绳
    const ropeY = [152, 174, 196];
    ropeY.forEach((y, index) => {
      ctx.strokeStyle = ['rgba(255,255,255,0.32)', 'rgba(62,224,161,0.32)', 'rgba(251,113,133,0.3)'][index];
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(22, y);
      ctx.quadraticCurveTo(W / 2, y + 3, W - 22, y);
      ctx.stroke();
    });

    // 角柱
    for (const x of [18, W - 26]) {
      ctx.fillStyle = '#1b2733';
      roundedRect(ctx, x, 136, 8, 96, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      roundedRect(ctx, x + 2, 138, 2, 92, 1);
      ctx.fill();
    }

    // 聚光锥
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const beam = ctx.createLinearGradient(W / 2, 0, W / 2, 236);
    beam.addColorStop(0, 'rgba(180,255,230,0.13)');
    beam.addColorStop(1, 'rgba(180,255,230,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 26, 0);
    ctx.lineTo(W / 2 + 26, 0);
    ctx.lineTo(W / 2 + 132, 236);
    ctx.lineTo(W / 2 - 132, 236);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 回合灯
    const glow = 0.55 + Math.sin(now / 420) * 0.2;
    ctx.fillStyle = `rgba(255,214,120,${glow})`;
    for (let i = 0; i < 7; i += 1) {
      ctx.beginPath();
      ctx.arc(W / 2 - 66 + i * 22, 132, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 擂台裙边
    const skirt = ctx.createLinearGradient(0, 250, 0, H);
    skirt.addColorStop(0, 'rgba(6,10,16,0)');
    skirt.addColorStop(1, 'rgba(2,4,7,0.85)');
    ctx.fillStyle = skirt;
    ctx.fillRect(0, 250, W, H - 250);
  }

  private drawShadow(f: Fighter): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(f.x, GROUND + 2, 23, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawFighter(f: Fighter, glove: string, trunks: string, skin: string, hair: string): void {
    const ctx = this.ctx;
    const bob = Math.sin(this.time * 3.4 + (f === this.player ? 0 : 1.9)) * 1.8;
    const swing = Math.sin(f.walk) * 3;

    ctx.save();
    ctx.translate(f.x, GROUND + bob);
    if (f.ko > 0) ctx.rotate(-f.facing * f.ko * Math.PI * 0.48);
    ctx.scale(f.facing, 1);

    // 后腿
    ctx.strokeStyle = skin;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-4, -34);
    ctx.lineTo(-12 + swing, -5);
    ctx.stroke();
    ctx.fillStyle = '#0b1220';
    roundedRect(ctx, -19 + swing, -9, 15, 9, 3);
    ctx.fill();

    // 前腿
    ctx.strokeStyle = skin;
    ctx.beginPath();
    ctx.moveTo(4, -34);
    ctx.lineTo(12 - swing, -5);
    ctx.stroke();
    ctx.fillStyle = '#0b1220';
    roundedRect(ctx, 4 - swing, -9, 15, 9, 3);
    ctx.fill();

    // 短裤
    ctx.save();
    ctx.shadowBlur = 14;
    ctx.shadowColor = trunks;
    ctx.fillStyle = trunks;
    roundedRect(ctx, -13, -48, 26, 19, 7);
    ctx.fill();
    ctx.restore();

    // 躯干
    ctx.fillStyle = skin;
    roundedRect(ctx, -12, -72, 24, 30, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-2, -64);
    ctx.quadraticCurveTo(4, -58, 8, -62);
    ctx.stroke();

    const ext = f.punch > 0 ? Math.sin((1 - f.punch / 0.26) * Math.PI) : 0;
    const blocking = f.block && ext < 0.2;

    // 后手
    ctx.strokeStyle = skin;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-4, -68);
    ctx.lineTo(-13, -57);
    ctx.lineTo(-14, -48);
    ctx.stroke();
    ctx.fillStyle = glove;
    ctx.beginPath();
    ctx.arc(-14, -45, 7, 0, Math.PI * 2);
    ctx.fill();

    // 前手
    if (blocking) {
      ctx.strokeStyle = skin;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(2, -68);
      ctx.lineTo(13, -64);
      ctx.lineTo(12, -74);
      ctx.stroke();
      ctx.fillStyle = glove;
      ctx.beginPath();
      ctx.arc(13, -76, 7.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const handX = 9 + ext * 34;
      const handY = -57 - ext * 9;
      ctx.strokeStyle = skin;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(3, -68);
      ctx.lineTo(4 + ext * 20, -61);
      ctx.lineTo(handX, handY);
      ctx.stroke();
      ctx.save();
      ctx.shadowBlur = 12 + ext * 12;
      ctx.shadowColor = glove;
      ctx.fillStyle = glove;
      ctx.beginPath();
      ctx.arc(handX, handY, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 头
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(2, -82, 10.5, 0, Math.PI * 2);
    ctx.fill();

    // 头发 / 头带
    ctx.strokeStyle = hair;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(2, -83, 10.2, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();

    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(-7.6, -81, 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#11161e';
    ctx.beginPath();
    ctx.arc(8.2, -83, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 格挡护罩
    if (blocking) {
      ctx.strokeStyle = 'rgba(154,215,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(9, -72, 19, -Math.PI * 0.42, Math.PI * 0.42);
      ctx.stroke();
    }

    // 受击闪白
    if (f.flash > 0) {
      ctx.globalAlpha = Math.min(0.6, f.flash * 2.4);
      ctx.fillStyle = '#ffffff';
      roundedRect(ctx, -15, -95, 31, 62, 13);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  private drawHud(): void {
    const ctx = this.ctx;

    const barGrad = ctx.createLinearGradient(0, 0, 0, 62);
    barGrad.addColorStop(0, 'rgba(4,8,14,0.92)');
    barGrad.addColorStop(1, 'rgba(4,8,14,0)');
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 0, W, 62);

    this.drawBar(18, 15, 188, this.player.hp / MAX_HP, false);
    this.drawBar(W - 18 - 188, 15, 188, this.ai.hp / MAX_HP, true);

    ctx.font = '700 10px "PingFang SC", system-ui, sans-serif';
    ctx.fillStyle = '#3ee0a1';
    ctx.fillText('你', 18, 44);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fb7185';
    ctx.fillText('电脑', W - 18, 44);
    ctx.textAlign = 'left';

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundedRect(ctx, W / 2 - 30, 9, 60, 26, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    roundedRect(ctx, W / 2 - 30, 9, 60, 26, 9);
    ctx.stroke();

    ctx.fillStyle = this.roundTime <= 10 ? '#fb7185' : '#f1f5f9';
    ctx.font = '700 20px ui-monospace, "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.ceil(this.roundTime)).padStart(2, '0'), W / 2, 29);
    ctx.textAlign = 'left';

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '600 9px "PingFang SC", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`第 ${this.round} 回合`, W / 2, 50);

    ctx.fillStyle = '#3ee0a1';
    for (let i = 0; i < this.playerWins; i += 1) {
      ctx.beginPath();
      ctx.arc(W / 2 - 52 + i * 9, 16, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fb7185';
    for (let i = 0; i < this.aiWins; i += 1) {
      ctx.beginPath();
      ctx.arc(W / 2 + 45 - i * 9, 16, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.textAlign = 'left';
  }

  private drawBar(x: number, y: number, w: number, ratio: number, reverse: boolean): void {
    const ctx = this.ctx;
    const width = w * clamp(ratio, 0, 1);

    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    roundedRect(ctx, x, y, w, 11, 5.5);
    ctx.fill();

    if (width > 1.5) {
      const grad = ctx.createLinearGradient(x, y, x + w, y);
      if (reverse) {
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(1, '#fb7185');
      } else {
        grad.addColorStop(0, '#3ee0a1');
        grad.addColorStop(1, '#ffffff');
      }
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = reverse ? '#fb7185' : '#3ee0a1';
      ctx.fillStyle = grad;
      if (reverse) roundedRect(ctx, x + w - width, y, width, 11, Math.min(5.5, width / 2));
      else roundedRect(ctx, x, y, width, 11, Math.min(5.5, width / 2));
      ctx.fill();
      ctx.restore();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    roundedRect(ctx, x, y, w, 11, 5.5);
    ctx.stroke();
  }

  private drawBanner(): void {
    let main = '';
    let sub = '';
    let color = '#ffffff';

    if (this.phase === 'intro') {
      main = `ROUND ${this.round}`;
      sub = '准备';
    } else if (this.phase === 'fight' && this.fightBanner > 0) {
      main = 'FIGHT!';
      color = '#3ee0a1';
    } else if (this.phase === 'roundEnd') {
      main = this.roundReason === 'ko' ? 'K.O.' : 'TIME UP';
      sub = this.roundWinner === 'player' ? '你拿下这一回合' : '对手拿下这一回合';
      color = this.roundWinner === 'player' ? '#3ee0a1' : '#fb7185';
    }

    if (!main) return;

    const ctx = this.ctx;
    const alpha = Math.min(1, this.phase === 'roundEnd' ? this.phaseTimer / 0.4 : 1);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';

    const plateWidth = Math.max(150, main.length * 20 + 48);
    ctx.fillStyle = 'rgba(4,8,14,0.62)';
    roundedRect(ctx, W / 2 - plateWidth / 2, 96, plateWidth, sub ? 62 : 46, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    roundedRect(ctx, W / 2 - plateWidth / 2, 96, plateWidth, sub ? 62 : 46, 14);
    ctx.stroke();

    ctx.shadowBlur = 18;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.font = '800 30px "PingFang SC", system-ui, sans-serif';
    ctx.fillText(main, W / 2, 134);

    if (sub) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '600 11px "PingFang SC", system-ui, sans-serif';
      ctx.fillText(sub, W / 2, 152);
    }

    ctx.restore();
    ctx.textAlign = 'left';
  }
}

export const BOXING_SIZE = { width: W, height: H };
