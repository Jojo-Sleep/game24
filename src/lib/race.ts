import * as THREE from 'three';

const LANE_X = [-3.4, 0, 3.4];
const ROAD_LENGTH = 280;
const MAX_SPEED = 45;
const NITRO_SPEED = 72;
const STEER_SPEED = 8.2;
const MAX_OFFSET = 4.3;

export interface RaceHudState {
  speed: number;
  distance: number;
  energy: number;
  boosting: boolean;
}

export interface RaceCallbacks {
  onHud: (state: RaceHudState) => void;
  onCrash: (distance: number) => void;
}

type Phase = 'idle' | 'running' | 'crashed';

interface TrafficCar {
  group: THREE.Group;
  speed: number;
  lane: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export class RaceEngine {
  private container: HTMLElement;
  private callbacks: RaceCallbacks;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private roadTexture: THREE.CanvasTexture;

  private playerCar: THREE.Group;
  private flames: THREE.Mesh[] = [];
  private posts: THREE.Group[] = [];
  private traffic: TrafficCar[] = [];

  private phase: Phase = 'idle';
  private speed = 0;
  private distance = 0;
  private energy = 100;
  private boosting = false;
  private playerX = 0;
  private steer = 0;
  private touchSteer = 0;
  private nitroHeld = false;
  private keys = new Set<string>();
  private elapsed = 0;
  private crashTimer = 0;
  private hudTimer = 0;

  private raf = 0;
  private last = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement, callbacks: RaceCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth || 360, container.clientHeight || 480, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070b12);
    this.scene.fog = new THREE.Fog(0x070b12, 42, 205);

    this.camera = new THREE.PerspectiveCamera(64, 1, 0.1, 400);
    this.camera.position.set(0, 3.3, 7.8);
    this.camera.lookAt(0, 1, -10);

    this.scene.add(new THREE.HemisphereLight(0xa8c8f0, 0x0a0f16, 1.15));
    const moon = new THREE.DirectionalLight(0xfff1d6, 1.7);
    moon.position.set(9, 20, 7);
    this.scene.add(moon);
    const rim = new THREE.DirectionalLight(0x6be8ff, 0.7);
    rim.position.set(-12, 8, -16);
    this.scene.add(rim);

    this.buildStars();
    this.roadTexture = this.buildRoad();
    this.buildPosts();
    this.buildTraffic();

    this.playerCar = this.buildCar(0x3ee0a1, true);
    this.scene.add(this.playerCar);

    const headlight = new THREE.PointLight(0xfff0c8, 9, 28, 2);
    headlight.position.set(0, 1.3, -3.6);
    this.playerCar.add(headlight);

    this.resetRun();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(container);
    this.onResize();

    this.raf = requestAnimationFrame(this.frame);
  }

  // ---------------- 对外 API ----------------

  start(): void {
    this.resetRun();
    this.phase = 'running';
    this.last = 0;
    this.emitHud(true);
  }

  setSteer(dir: number): void {
    this.touchSteer = clamp(Math.round(dir), -1, 1);
  }

  setNitro(value: boolean): void {
    this.nitroHeld = value;
  }

  destroy(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);

    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
        object.geometry.dispose();
        const material = object.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material.dispose();
      }
    });
    this.roadTexture.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  // ---------------- 输入 ----------------

  private onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'a', 'd', ' '].includes(key)) event.preventDefault();
    this.keys.add(key);
    if (key === ' ') this.nitroHeld = true;
    this.updateKeyboardSteer();
  };

  private onKeyUp = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    this.keys.delete(key);
    if (key === ' ') this.nitroHeld = false;
    this.updateKeyboardSteer();
  };

  private onBlur = () => {
    this.keys.clear();
    this.nitroHeld = false;
    this.touchSteer = 0;
    this.steer = 0;
  };

  private updateKeyboardSteer(): void {
    const left = this.keys.has('arrowleft') || this.keys.has('a');
    const right = this.keys.has('arrowright') || this.keys.has('d');
    this.steer = (right ? 1 : 0) - (left ? 1 : 0);
  }

  // ---------------- 场景搭建 ----------------

  private buildStars(): void {
    const count = 420;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = rand(-230, 230);
      positions[i * 3 + 1] = rand(16, 95);
      positions[i * 3 + 2] = rand(-280, -20);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0x9fb9d6,
      size: 0.85,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.85,
    });
    this.scene.add(new THREE.Points(geometry, material));
  }

  private buildRoad(): THREE.CanvasTexture {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(360, 520),
      new THREE.MeshStandardMaterial({ color: 0x060b11, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.06, -150);
    this.scene.add(ground);

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#111820';
      ctx.fillRect(0, 0, 128, 256);
      for (let i = 0; i < 200; i += 1) {
        ctx.fillStyle = `rgba(255,255,255,${rand(0.015, 0.045)})`;
        ctx.fillRect(rand(0, 128), rand(0, 256), 1.6, 1.6);
      }
      ctx.fillStyle = 'rgba(226,240,255,0.5)';
      ctx.fillRect(40, 10, 5, 92);
      ctx.fillRect(83, 138, 5, 92);
      ctx.fillStyle = 'rgba(62,224,161,0.8)';
      ctx.fillRect(3, 0, 3, 256);
      ctx.fillRect(122, 0, 3, 256);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 26);
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(11, ROAD_LENGTH),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.92, metalness: 0.04 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -110);
    this.scene.add(road);

    const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x1a2330, roughness: 0.8 });
    const shoulderGeo = new THREE.BoxGeometry(0.5, 0.12, ROAD_LENGTH);
    for (const x of [-6.1, 6.1]) {
      const strip = new THREE.Mesh(shoulderGeo, shoulderMat);
      strip.position.set(x, 0.02, -110);
      this.scene.add(strip);
    }

    return texture;
  }

  private buildPosts(): void {
    const postMat = new THREE.MeshStandardMaterial({ color: 0x243040, roughness: 0.7 });
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xbdf6e6,
      emissive: 0x3ee0a1,
      emissiveIntensity: 2.4,
    });
    const poleGeo = new THREE.BoxGeometry(0.22, 1.1, 0.22);
    const lampGeo = new THREE.BoxGeometry(0.34, 0.2, 0.34);

    for (const x of [-6.6, 6.6]) {
      for (let z = 20; z > -260; z -= 11) {
        const group = new THREE.Group();
        const post = new THREE.Mesh(poleGeo, postMat);
        post.position.y = 0.55;
        group.add(post);
        const lamp = new THREE.Mesh(lampGeo, lampMat);
        lamp.position.y = 1.16;
        group.add(lamp);
        group.position.set(x, 0, z);
        this.scene.add(group);
        this.posts.push(group);
      }
    }

    const tallPoleGeo = new THREE.CylinderGeometry(0.11, 0.16, 6.4, 8);
    const tallLampGeo = new THREE.SphereGeometry(0.26, 10, 8);
    const tallLampMat = new THREE.MeshStandardMaterial({
      color: 0xfff3cf,
      emissive: 0xffcf7a,
      emissiveIntensity: 2.6,
    });

    for (const x of [-8.6, 8.6]) {
      for (let z = 8; z > -260; z -= 44) {
        const group = new THREE.Group();
        const pole = new THREE.Mesh(tallPoleGeo, postMat);
        pole.position.y = 3.2;
        group.add(pole);
        const head = new THREE.Mesh(tallLampGeo, tallLampMat);
        head.position.y = 6.45;
        group.add(head);
        group.position.set(x, 0, z);
        this.scene.add(group);
        this.posts.push(group);
      }
    }
  }

  private buildTraffic(): void {
    const colors = [0xfb7185, 0xf59e0b, 0x60a5fa, 0xc084fc, 0xe2e8f0];
    for (let i = 0; i < 7; i += 1) {
      const group = this.buildCar(colors[i % colors.length], false);
      this.scene.add(group);
      this.traffic.push({ group, speed: 16, lane: 0 });
    }
  }

  private buildCar(color: number, isPlayer: boolean): THREE.Group {
    const group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.5, 4.1),
      new THREE.MeshStandardMaterial({
        color,
        metalness: 0.55,
        roughness: 0.32,
        emissive: isPlayer ? 0x0b3b2c : 0x000000,
        emissiveIntensity: isPlayer ? 0.7 : 0,
      }),
    );
    body.position.y = 0.6;
    group.add(body);

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 0.46, 1.9),
      new THREE.MeshStandardMaterial({ color: 0x0a1522, metalness: 0.85, roughness: 0.15 }),
    );
    cabin.position.set(0, 1.02, 0.18);
    group.add(cabin);

    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0b0f15, roughness: 0.9 });
    for (const [wx, wz] of [
      [-0.98, -1.3],
      [0.98, -1.3],
      [-0.98, 1.35],
      [0.98, 1.35],
    ]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.36, wz);
      group.add(wheel);
    }

    const headMat = new THREE.MeshStandardMaterial({
      color: 0xfff6d8,
      emissive: 0xfff0b8,
      emissiveIntensity: 2.2,
    });
    for (const hx of [-0.6, 0.6]) {
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), headMat);
      light.position.set(hx, 0.66, -2.06);
      group.add(light);
    }

    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xff5566,
      emissive: 0xff2d3d,
      emissiveIntensity: 1.9,
    });
    for (const hx of [-0.6, 0.6]) {
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.08), tailMat);
      light.position.set(hx, 0.66, 2.06);
      group.add(light);
    }

    if (isPlayer) {
      const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb066, transparent: true, opacity: 0.9 });
      for (const fx of [-0.58, 0.58]) {
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.17, 1.1, 8), flameMat);
        flame.rotation.x = Math.PI / 2;
        flame.position.set(fx, 0.58, 2.7);
        group.add(flame);
        this.flames.push(flame);
      }

      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.06, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x0e2a23, metalness: 0.6, roughness: 0.4 }),
      );
      wing.position.set(0, 1.06, 1.95);
      group.add(wing);
    }

    return group;
  }

  private resetRun(): void {
    this.phase = 'idle';
    this.speed = 0;
    this.distance = 0;
    this.energy = 100;
    this.boosting = false;
    this.nitroHeld = false;
    this.playerX = 0;
    this.steer = 0;
    this.touchSteer = 0;
    this.crashTimer = 0;
    this.hudTimer = 0;

    this.playerCar.position.set(0, 0, 0);
    this.playerCar.rotation.set(0, 0, 0);

    this.camera.position.set(0, 3.3, 7.8);
    this.camera.fov = 64;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(0, 1, -10);

    const lanes = [0, 2, 1, 0, 2, 1, 0];
    this.traffic.forEach((car, index) => {
      const lane = lanes[index % lanes.length];
      car.lane = lane;
      car.speed = rand(15, 28);
      car.group.position.set(LANE_X[lane], 0, -48 - index * 38 - rand(0, 14));
      car.group.rotation.set(0, 0, 0);
    });

    for (const flame of this.flames) {
      flame.visible = false;
      flame.scale.setScalar(0.6);
    }
  }

  // ---------------- 更新 ----------------

  private update(dt: number): void {
    if (this.phase === 'running') {
      this.updateRunning(dt);
    } else if (this.phase === 'crashed') {
      this.crashTimer += dt;
      const shake = Math.max(0, 0.26 - this.crashTimer) * 0.7;
      this.camera.position.x += rand(-shake, shake);
      this.camera.position.y += rand(-shake, shake);
    }
  }

  private updateRunning(dt: number): void {
    const boosting = this.nitroHeld && this.energy > 0;
    this.boosting = boosting;

    if (boosting) this.energy = Math.max(0, this.energy - 32 * dt);
    else this.energy = Math.min(100, this.energy + 8 * dt);

    const target = boosting ? NITRO_SPEED : MAX_SPEED;
    const accel = boosting ? 26 : 10;
    this.speed += clamp(target - this.speed, -accel * 2 * dt, accel * dt);
    this.distance += this.speed * dt;

    const steer = this.touchSteer !== 0 ? this.touchSteer : this.steer;
    this.playerX = clamp(this.playerX + steer * STEER_SPEED * dt, -MAX_OFFSET, MAX_OFFSET);
    this.playerCar.position.x += (this.playerX - this.playerCar.position.x) * Math.min(1, dt * 12);
    this.playerCar.rotation.y += (-steer * 0.06 - this.playerCar.rotation.y) * Math.min(1, dt * 8);
    this.playerCar.rotation.z += (-steer * 0.07 - this.playerCar.rotation.z) * Math.min(1, dt * 8);

    const flameScale = boosting ? rand(1.8, 2.4) : 0.55 + Math.sin(this.elapsed * 22) * 0.08;
    for (const flame of this.flames) {
      flame.visible = this.speed > 2;
      flame.scale.setScalar(flameScale);
    }

    this.roadTexture.offset.y += (this.speed * dt) / (ROAD_LENGTH / 26);

    for (const post of this.posts) {
      post.position.z += this.speed * dt;
      if (post.position.z > 24) post.position.z -= ROAD_LENGTH;
    }

    const carX = this.playerCar.position.x;
    for (const car of this.traffic) {
      car.group.position.z += (this.speed - car.speed) * dt;

      if (car.group.position.z > 14) {
        car.lane = Math.floor(Math.random() * 3);
        car.speed = rand(15, 28);
        car.group.position.set(LANE_X[car.lane], 0, -ROAD_LENGTH + rand(-20, 15));
      }

      if (
        Math.abs(car.group.position.z) < 3.8 &&
        Math.abs(car.group.position.x - carX) < 2
      ) {
        this.crash();
        break;
      }
    }

    const targetFov = 64 + (this.speed / NITRO_SPEED) * 14;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 3);
    this.camera.updateProjectionMatrix();

    const shake = boosting ? 0.035 : 0;
    this.camera.position.x += (this.playerX * 0.45 + rand(-shake, shake) - this.camera.position.x) * Math.min(1, dt * 5);
    this.camera.position.y = 3.25 + (boosting ? Math.sin(this.elapsed * 38) * 0.02 : 0);
    this.camera.lookAt(this.playerX * 0.55, 1, -10);

    this.hudTimer += dt;
    if (this.hudTimer >= 0.1) {
      this.hudTimer = 0;
      this.emitHud(false);
    }
  }

  private crash(): void {
    if (this.phase !== 'running') return;
    this.phase = 'crashed';
    this.crashTimer = 0;
    this.boosting = false;
    this.nitroHeld = false;
    this.callbacks.onCrash(Math.floor(this.distance));
    this.emitHud(true);
  }

  private emitHud(force: boolean): void {
    if (!force && this.phase !== 'running') return;
    this.callbacks.onHud({
      speed: Math.round(this.speed * 6.2),
      distance: Math.floor(this.distance),
      energy: Math.round(this.energy),
      boosting: this.boosting,
    });
  }

  private onResize(): void {
    const width = this.container.clientWidth || 360;
    const height = this.container.clientHeight || 480;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private frame = (now: number) => {
    if (this.disposed) return;

    const dt = this.last === 0 ? 0.016 : Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.elapsed += dt;

    this.update(dt);
    this.renderer.render(this.scene, this.camera);

    this.raf = requestAnimationFrame(this.frame);
  };
}
