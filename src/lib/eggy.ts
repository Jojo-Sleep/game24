import * as THREE from 'three';

export interface EggyCallbacks {
  onTime: (seconds: number) => void;
  onFinish: (seconds: number) => void;
  onRespawn: () => void;
}

interface PlatformDef {
  x: number;
  z: number;
  top: number;
  w: number;
  d: number;
  h?: number;
  color: number;
  checkpoint?: boolean;
  move?: { axis: 'x' | 'y' | 'z'; range: number; speed: number; phase: number };
}

interface PlatformRuntime {
  mesh: THREE.Group;
  base: THREE.Vector3;
  current: THREE.Vector3;
  prev: THREE.Vector3;
  size: THREE.Vector3;
  move?: PlatformDef['move'];
  checkpoint: boolean;
}

interface HammerRuntime {
  group: THREE.Group;
  pivot: THREE.Vector3;
  radius: number;
  speed: number;
  phase: number;
}

interface BallRuntime {
  mesh: THREE.Mesh;
  base: THREE.Vector3;
  axis: 'x' | 'z';
  range: number;
  speed: number;
  phase: number;
  radius: number;
}

const START_TOP = 0;
const FINISH_Z = -200.5;

const PLATFORM_DEFS: PlatformDef[] = [
  { x: 0, z: 0, top: START_TOP, w: 10, d: 10, color: 0x8fe3c7, checkpoint: true },
  { x: 0, z: -9, top: 0, w: 4, d: 4, color: 0xffd6a5 },
  { x: 0, z: -15, top: 0.2, w: 3.5, d: 3.5, color: 0xffc3d9, move: { axis: 'x', range: 2.2, speed: 1.1, phase: 0 } },
  { x: 0, z: -21, top: 0, w: 4, d: 4, color: 0xc7c2ff },
  { x: 0, z: -29, top: 0.4, w: 6, d: 10, color: 0x9ed8ff },
  { x: 0, z: -38.5, top: 1.2, w: 4.5, d: 4.5, color: 0xffe08a },
  { x: 0, z: -46.5, top: 1.2, w: 8, d: 8, color: 0x8fe3c7, checkpoint: true },
  { x: 0, z: -58, top: 1.2, w: 10, d: 16, color: 0xffc3d9 },
  { x: 0, z: -68, top: 1, w: 3, d: 3, color: 0xc7c2ff, move: { axis: 'x', range: 4.5, speed: 0.9, phase: 1.2 } },
  { x: 0, z: -76, top: 0.8, w: 7, d: 7, color: 0x8fe3c7, checkpoint: true },
  { x: 0, z: -86, top: 0.8, w: 5, d: 12, color: 0xffd6a5 },
  { x: -2.5, z: -94.5, top: 0.6, w: 3, d: 3, color: 0x9ed8ff },
  { x: 2.2, z: -99, top: 0.9, w: 3, d: 3, color: 0xffc3d9 },
  { x: 0, z: -103.5, top: 0.6, w: 3, d: 3, color: 0xc7c2ff },
  { x: 0, z: -111, top: 1, w: 8, d: 8, color: 0x8fe3c7, checkpoint: true },
  // 第三段：窄桥、踩点跳跃、纵向移动平台与机关桥
  { x: 0, z: -119, top: 0.8, w: 2, d: 8, color: 0xffd6a5 },
  { x: -2.4, z: -125.5, top: 1.1, w: 2.6, d: 2.6, color: 0x9ed8ff },
  { x: 2.4, z: -130.5, top: 0.9, w: 2.6, d: 2.6, color: 0xffc3d9, checkpoint: true },
  { x: 0, z: -137, top: 0.7, w: 3.4, d: 3.4, color: 0xffe08a, move: { axis: 'z', range: 2.2, speed: 0.85, phase: 0 } },
  { x: 0, z: -145, top: 0.9, w: 2, d: 9, color: 0xc7c2ff },
  { x: 0, z: -154, top: 1.2, w: 10, d: 10, color: 0x8fe3c7, checkpoint: true },
  // 第四段：升降台、锤球窄桥、对角跳台与终点前的连续机关
  { x: 0, z: -161.5, top: 0.8, w: 3.4, d: 3.4, color: 0x9ed8ff, move: { axis: 'y', range: 1.5, speed: 1.1, phase: 0 } },
  { x: 0, z: -168.5, top: 1.4, w: 1.8, d: 7, color: 0xffd6a5 },
  { x: -2.1, z: -176.5, top: 1.1, w: 2.4, d: 2.4, color: 0xffc3d9 },
  { x: 2.1, z: -181.5, top: 1.2, w: 3, d: 3, color: 0x8fe3c7, checkpoint: true },
  { x: 0, z: -189, top: 1.2, w: 1.9, d: 8, color: 0xc7c2ff },
  { x: 0, z: -198.5, top: 1.2, w: 9, d: 9, color: 0xffe08a },
];

export class EggyEngine {
  private container: HTMLElement;
  private callbacks: EggyCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private sun: THREE.DirectionalLight;

  private player: THREE.Group;
  private playerVisual!: THREE.Group;
  private upper!: THREE.Group;
  private feet: THREE.Mesh[] = [];
  private eggBody: THREE.Mesh;
  private walkPhase = 0;
  private walkBlend = 0;

  private platforms: PlatformRuntime[] = [];
  private hammers: HammerRuntime[] = [];
  private balls: BallRuntime[] = [];
  private clouds: THREE.Group[] = [];

  private velocity = new THREE.Vector3();
  private prevPosition = new THREE.Vector3();
  private touch = new THREE.Vector2();
  private keys = new Set<string>();
  private support: PlatformRuntime | null = null;
  private grounded = false;
  private hitCooldown = 0;
  private squash = 0;
  private coyote = 0;
  private jumpBuffer = 0;
  private jumpHeld = false;

  private spawn = new THREE.Vector3(0, 0.66, 0);
  private running = false;
  private finished = false;
  private elapsed = 0;
  private motionTime = 0;
  private clockTime = 0;
  private timeAccum = 0;

  private raf = 0;
  private resizeObserver: ResizeObserver;
  private readonly halfHeight = 0.66;

  constructor(container: HTMLElement, callbacks: EggyCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth || 360, container.clientHeight || 520, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9ad7ff);
    this.scene.fog = new THREE.Fog(0x9ad7ff, 45, 165);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
    this.camera.position.set(0, 6, 10);

    this.sun = new THREE.DirectionalLight(0xffffff, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -24;
    this.sun.shadow.camera.right = 24;
    this.sun.shadow.camera.top = 24;
    this.sun.shadow.camera.bottom = -24;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 80;
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.scene.add(new THREE.HemisphereLight(0xdff4ff, 0x5d8fbe, 1.35));
    const fill = new THREE.DirectionalLight(0xfff1d6, 0.5);
    fill.position.set(-12, 10, -8);
    this.scene.add(fill);

    this.buildSky();
    this.buildScenery();
    this.buildCourse();
    this.buildFinishArch();

    const { group, body } = this.createPlayer();
    this.player = group;
    this.eggBody = body;
    this.scene.add(group);

    this.spawn.set(0, START_TOP + this.halfHeight, 0);
    this.player.position.copy(this.spawn);
    this.prevPosition.copy(this.player.position);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(container);
    this.onResize();

    this.updatePlatforms(true);
    this.updateCamera(1);
    this.animate();
  }

  // ---------------- 对外 API ----------------

  start(): void {
    this.resetMotion();
    this.running = true;
    this.finished = false;
    this.elapsed = 0;
    this.timeAccum = 0;
    this.callbacks.onTime(0);
  }

  jump(): void {
    if (!this.running) return;
    // 跳跃缓冲：落地前一瞬间按下也能起跳
    this.jumpBuffer = 0.14;
    this.jumpHeld = true;
  }

  releaseJump(): void {
    this.jumpHeld = false;
    // 提前松手则跳得更矮，方便精细落点
    if (this.velocity.y > 4) this.velocity.y *= 0.55;
  }

  setTouchInput(x: number, y: number): void {
    const length = Math.hypot(x, y);
    if (length < 0.12) {
      this.touch.set(0, 0);
      return;
    }
    const scale = Math.min(1, (length - 0.12) / 0.88) / length;
    this.touch.set(x * scale, y * scale);
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.resizeObserver.disconnect();

    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });

    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  // ---------------- 初始化 ----------------

  private onResize = (): void => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
    if (event.code === 'Space' && !this.keys.has('Space')) this.jump();
    this.keys.add(event.code);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    if (event.code === 'Space') this.releaseJump();
    this.keys.delete(event.code);
  };

  private buildSky(): void {
    const geometry = new THREE.SphereGeometry(280, 32, 16);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x4aa9ff) },
        bottomColor: { value: new THREE.Color(0xe2f6ff) },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vWorldPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y * 0.5 + 0.5;
          gl_FragColor = vec4(mix(bottomColor, topColor, smoothstep(0.05, 0.75, h)), 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.scene.add(new THREE.Mesh(geometry, material));
  }

  private buildScenery(): void {
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 700),
      new THREE.MeshStandardMaterial({ color: 0x69bde8, roughness: 0.35, metalness: 0.15 }),
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -24;
    this.scene.add(ocean);

    const cloudMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92 });
    for (let i = 0; i < 16; i += 1) {
      const cloud = new THREE.Group();
      const blobs = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < blobs; j += 1) {
        const blob = new THREE.Mesh(new THREE.SphereGeometry(1.3 + Math.random() * 1.5, 14, 10), cloudMaterial);
        blob.position.set((j - blobs / 2) * 1.5, Math.random() * 0.7, Math.random() * 0.9);
        blob.scale.y = 0.55;
        cloud.add(blob);
      }
      cloud.position.set(-50 + Math.random() * 100, 3 + Math.random() * 16, -4 - Math.random() * 215);
      this.clouds.push(cloud);
      this.scene.add(cloud);
    }

    const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x9c86c9, roughness: 0.9 });
    const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x8fe3a8, roughness: 0.8 });
    for (let i = 0; i < 12; i += 1) {
      const side = i % 2 === 0 ? 1 : -1;
      const x = side * (20 + Math.random() * 26);
      const z = -6 - Math.random() * 215;
      const y = -5 - Math.random() * 6;
      const radius = 3 + Math.random() * 2.5;

      const rock = new THREE.Mesh(new THREE.ConeGeometry(radius, 6 + Math.random() * 3, 7), rockMaterial);
      rock.position.set(x, y - 3.4, z);
      rock.rotation.y = Math.random() * Math.PI;
      this.scene.add(rock);

      const grass = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.94, 1.2, 9), grassMaterial);
      grass.position.set(x, y, z);
      this.scene.add(grass);
    }
  }

  private buildCourse(): void {
    for (const def of PLATFORM_DEFS) this.addPlatform(def);

    this.addHammer(0, 0.4, -29, 3.4, 1.5, 0);
    this.addHammer(0, 0.8, -82, 2.6, 1.7, 0.6);
    this.addHammer(0, 0.8, -86, 1.8, 1.9, 0.5);
    this.addHammer(0, 0.8, -90, 2.6, -1.9, 2.1);
    this.addHammer(0, 0.9, -145, 2, 1.4, 1.1);

    this.addBall(0, 2.15, -52, 'x', 3.9, 1.0, 0, 0.95);
    this.addBall(0, 2.15, -58, 'x', 3.9, 1.3, 1.8, 0.95);
    this.addBall(0, 2.15, -64, 'x', 3.9, 1.6, 0.9, 0.95);
    this.addBall(0, 1.85, -119, 'x', 1.7, 1.5, 0, 0.72);

    this.addHammer(0, 1.4, -168.5, 1.6, 1.5, 0.2);
    this.addBall(0, 2.45, -170.8, 'x', 1.15, 1.6, 0.4, 0.62);
    this.addBall(0, 2.25, -187.3, 'x', 1.2, 1.35, 0, 0.62);
    this.addHammer(0, 1.2, -190.5, 1.7, 1.7, 0.6);
  }

  private addPlatform(def: PlatformDef): void {
    const height = def.h ?? 1;
    const group = new THREE.Group();

    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(def.w, height, def.d),
      new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.7, metalness: 0.05 }),
    );
    slab.castShadow = true;
    slab.receiveShadow = true;
    group.add(slab);

    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(def.w * 0.93, 0.07, def.d * 0.93),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, roughness: 0.5 }),
    );
    rim.position.y = height / 2 + 0.02;
    group.add(rim);

    const center = new THREE.Vector3(def.x, def.top - height / 2, def.z);
    group.position.copy(center);
    this.scene.add(group);

    this.platforms.push({
      mesh: group,
      base: center.clone(),
      current: center.clone(),
      prev: center.clone(),
      size: new THREE.Vector3(def.w, height, def.d),
      move: def.move,
      checkpoint: Boolean(def.checkpoint),
    });

    if (def.checkpoint) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.15, 0.09, 12, 32),
        new THREE.MeshStandardMaterial({
          color: 0xfff3b0,
          emissive: 0xffd166,
          emissiveIntensity: 0.7,
          roughness: 0.35,
        }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(def.x, def.top + 0.08, def.z);
      this.scene.add(ring);
    }
  }

  private addHammer(x: number, top: number, z: number, radius: number, speed: number, phase: number): void {
    const group = new THREE.Group();
    const poleHeight = 1.05;
    group.position.set(x, top + poleHeight, z);

    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x6b7f9e, roughness: 0.6, metalness: 0.25 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, poleHeight, 12), poleMaterial);
    pole.position.y = -poleHeight / 2;
    pole.castShadow = true;
    group.add(pole);

    const armMaterial = new THREE.MeshStandardMaterial({ color: 0xff9f7a, roughness: 0.55 });
    const arm = new THREE.Mesh(new THREE.BoxGeometry(radius * 2, 0.2, 0.2), armMaterial);
    arm.castShadow = true;
    group.add(arm);

    const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xff5d8f, roughness: 0.4, metalness: 0.15 });
    for (const sign of [1, -1]) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 14), ballMaterial);
      ball.position.x = radius * sign;
      ball.castShadow = true;
      group.add(ball);
    }

    this.scene.add(group);
    this.hammers.push({ group, pivot: group.position.clone(), radius, speed, phase });
  }

  private addBall(
    x: number,
    y: number,
    z: number,
    axis: 'x' | 'z',
    range: number,
    speed: number,
    phase: number,
    radius: number,
  ): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 20, 16),
      new THREE.MeshStandardMaterial({ color: 0xffb03a, roughness: 0.35, metalness: 0.2 }),
    );
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.balls.push({ mesh, base: new THREE.Vector3(x, y, z), axis, range, speed, phase, radius });
  }

  private buildFinishArch(): void {
    const top = 1.2;
    const material = new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.45, metalness: 0.2 });

    for (const x of [-3.4, 3.4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4.2, 12), material);
      post.position.set(x, top + 2.1, FINISH_Z);
      post.castShadow = true;
      this.scene.add(post);
    }

    const bar = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.42, 0.42), material);
    bar.position.set(0, top + 4.2, FINISH_Z);
    bar.castShadow = true;
    this.scene.add(bar);

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#102038';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffe08a';
      ctx.font = 'bold 76px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('FINISH', canvas.width / 2, canvas.height / 2 + 4);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 1.15),
      new THREE.MeshBasicMaterial({ map: texture }),
    );
    banner.position.set(0, top + 3.35, FINISH_Z + 0.05);
    this.scene.add(banner);
  }

  private createPlayer(): { group: THREE.Group; body: THREE.Mesh } {
    const group = new THREE.Group();
    const visual = new THREE.Group();
    const upper = new THREE.Group();
    visual.add(upper);
    group.add(visual);

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 32, 24),
      new THREE.MeshStandardMaterial({ color: 0xfff4e6, roughness: 0.45 }),
    );
    body.scale.set(1, 1.2, 1);
    body.castShadow = true;
    upper.add(body);

    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1b2430, roughness: 0.3 });

    for (const x of [-0.17, 0.17]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), white);
      eye.position.set(x, 0.18, 0.46);
      upper.add(eye);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), dark);
      pupil.position.set(x, 0.18, 0.55);
      upper.add(pupil);
    }

    const blush = new THREE.MeshStandardMaterial({ color: 0xff9fbd, roughness: 1 });
    for (const x of [-0.33, 0.33]) {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), blush);
      cheek.scale.set(1.4, 0.8, 0.4);
      cheek.position.set(x, 0, 0.41);
      upper.add(cheek);
    }

    const footMaterial = new THREE.MeshStandardMaterial({ color: 0xffb703, roughness: 0.65 });
    this.feet = [];
    for (const x of [-0.2, 0.2]) {
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), footMaterial);
      foot.scale.set(1, 0.7, 1.35);
      foot.position.set(x, -0.62, 0.06);
      foot.castShadow = true;
      visual.add(foot);
      this.feet.push(foot);
    }

    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 0.55, 16),
      new THREE.MeshStandardMaterial({ color: 0xff8fab, roughness: 0.5 }),
    );
    hat.position.set(0, 0.83, 0);
    hat.rotation.z = 0.12;
    hat.castShadow = true;
    upper.add(hat);

    const pom = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xffe08a, roughness: 0.5 }),
    );
    pom.position.set(0.06, 1.11, 0);
    upper.add(pom);

    this.playerVisual = visual;
    this.upper = upper;

    return { group, body };
  }

  // ---------------- 主循环 ----------------

  private animate = (): void => {
    this.raf = requestAnimationFrame(this.animate);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.clockTime += dt;

    for (const cloud of this.clouds) {
      cloud.position.x += dt * 0.4;
      if (cloud.position.x > 55) cloud.position.x = -55;
    }

    if (this.running) {
      this.motionTime += dt;
      this.elapsed += dt;
      this.updatePlatforms(false);
      this.carryWithPlatform();
      this.updatePhysics(dt);
      this.updateHazards();
      this.checkProgress();

      this.timeAccum += dt;
      if (this.timeAccum >= 0.1) {
        this.timeAccum = 0;
        this.callbacks.onTime(this.elapsed);
      }
    }

    this.updatePlayerVisual(dt);
    this.updateCamera(dt);
    this.updateSun();
    this.renderer.render(this.scene, this.camera);
  };

  private updatePlatforms(reset: boolean): void {
    for (const platform of this.platforms) {
      platform.prev.copy(platform.current);

      if (reset || !platform.move) {
        platform.current.copy(platform.base);
      } else {
        const offset = Math.sin(this.motionTime * platform.move.speed + platform.move.phase) * platform.move.range;
        platform.current.copy(platform.base);
        if (platform.move.axis === 'x') platform.current.x += offset;
        else if (platform.move.axis === 'y') platform.current.y += offset;
        else platform.current.z += offset;
      }

      platform.mesh.position.copy(platform.current);
    }

    if (reset) {
      for (const hammer of this.hammers) {
        const angle = hammer.phase;
        hammer.group.rotation.y = angle;
      }
      this.updateHazards(true);
    }
  }

  private carryWithPlatform(): void {
    if (!this.support) return;
    this.player.position.x += this.support.current.x - this.support.prev.x;
    this.player.position.z += this.support.current.z - this.support.prev.z;
  }

  private updatePhysics(dt: number): void {
    this.prevPosition.copy(this.player.position);
    const position = this.player.position;

    if (this.support) {
      const top = this.support.current.y + this.support.size.y / 2;
      if (this.onPlatform(this.support)) {
        position.y = top + this.halfHeight;
        this.velocity.y = 0;
        this.grounded = true;
      } else {
        this.support = null;
        this.grounded = false;
      }
    } else {
      this.grounded = false;
    }

    // 土狼时间 + 跳跃缓冲，让起跳更跟手
    if (this.grounded) this.coyote = 0.1;
    else this.coyote = Math.max(0, this.coyote - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    if (this.jumpBuffer > 0 && (this.grounded || this.coyote > 0)) {
      this.velocity.y = 9.2;
      this.grounded = false;
      this.support = null;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.squash = Math.max(this.squash, 0.9);
    }

    const input = this.readInput();
    const moving = input.lengthSq() > 0.001;
    const targetX = input.x * 7.4;
    const targetZ = input.y * 7.4;
    const accel = this.grounded ? (moving ? 18 : 26) : 11;
    this.velocity.x += (targetX - this.velocity.x) * Math.min(1, accel * dt);
    this.velocity.z += (targetZ - this.velocity.z) * Math.min(1, accel * dt);

    if (!this.grounded) {
      // 按住跳得更高，轻点跳得更矮
      const gravity = this.velocity.y > 0 && this.jumpHeld ? 21 : 30;
      this.velocity.y -= gravity * dt;
      this.velocity.y = Math.max(this.velocity.y, -34);
    }

    position.x += this.velocity.x * dt;
    position.y += this.velocity.y * dt;
    position.z += this.velocity.z * dt;

    if (!this.grounded && this.velocity.y <= 0) {
      const bottom = position.y - this.halfHeight;
      const prevBottom = this.prevPosition.y - this.halfHeight;

      let landed: PlatformRuntime | null = null;
      let landedTop = Number.NEGATIVE_INFINITY;

      for (const platform of this.platforms) {
        const top = platform.current.y + platform.size.y / 2;
        if (Math.abs(position.x - platform.current.x) > platform.size.x / 2 + 0.26) continue;
        if (Math.abs(position.z - platform.current.z) > platform.size.z / 2 + 0.26) continue;
        if (prevBottom >= top - 0.08 && bottom <= top + 0.08 && top > landedTop) {
          landed = platform;
          landedTop = top;
        }
      }

      if (landed) {
        position.y = landedTop + this.halfHeight;
        this.velocity.y = 0;
        this.grounded = true;
        this.support = landed;
        this.squash = Math.max(this.squash, 0.8);

        if (landed.checkpoint) {
          this.spawn.set(landed.current.x, landedTop + this.halfHeight, landed.current.z);
        }
      }
    }

    if (this.hitCooldown > 0) this.hitCooldown = Math.max(0, this.hitCooldown - dt);

    if (position.y < -9) this.respawn();
  }

  private readInput(): THREE.Vector2 {
    let x = this.touch.x;
    let y = this.touch.y;

    if (x === 0 && y === 0) {
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    }

    const vector = new THREE.Vector2(x, y);
    if (vector.lengthSq() > 1) vector.normalize();
    return vector;
  }

  private onPlatform(platform: PlatformRuntime): boolean {
    const position = this.player.position;
    return (
      Math.abs(position.x - platform.current.x) <= platform.size.x / 2 + 0.22 &&
      Math.abs(position.z - platform.current.z) <= platform.size.z / 2 + 0.22
    );
  }

  private updateHazards(initial = false): void {
    if (initial) {
      for (const hammer of this.hammers) hammer.group.rotation.y = hammer.phase;
      for (const ball of this.balls) {
        const offset = Math.sin(ball.phase) * ball.range;
        ball.mesh.position.copy(ball.base);
        if (ball.axis === 'x') ball.mesh.position.x += offset;
        else ball.mesh.position.z += offset;
      }
      return;
    }

    for (const hammer of this.hammers) {
      const angle = this.motionTime * hammer.speed + hammer.phase;
      hammer.group.rotation.y = angle;

      for (const sign of [1, -1]) {
        const hitPoint = new THREE.Vector3(
          hammer.pivot.x + Math.cos(angle) * hammer.radius * sign,
          hammer.pivot.y,
          hammer.pivot.z + Math.sin(angle) * hammer.radius * sign,
        );
        this.tryHit(hitPoint, 0.55);
      }
    }

    for (const ball of this.balls) {
      const offset = Math.sin(this.motionTime * ball.speed + ball.phase) * ball.range;
      ball.mesh.position.copy(ball.base);
      if (ball.axis === 'x') {
        ball.mesh.position.x += offset;
        ball.mesh.rotation.z -= offset * 0.1;
      } else {
        ball.mesh.position.z += offset;
        ball.mesh.rotation.x += offset * 0.1;
      }
      this.tryHit(ball.mesh.position, ball.radius);
    }
  }

  private tryHit(center: THREE.Vector3, radius: number): void {
    if (this.hitCooldown > 0) return;

    const position = this.player.position;
    const dx = position.x - center.x;
    const dz = position.z - center.z;
    const dy = position.y - 0.15 - center.y;
    const distance = Math.hypot(dx, dz, dy);
    if (distance > radius + 0.55) return;

    const horizontal = new THREE.Vector3(dx, 0, dz);
    if (horizontal.lengthSq() < 0.001) horizontal.set(0, 0, 1);
    horizontal.normalize();

    this.velocity.set(horizontal.x * 12, 7.5, horizontal.z * 12);
    this.grounded = false;
    this.support = null;
    this.hitCooldown = 0.7;
    this.squash = 1;
  }

  private checkProgress(): void {
    if (this.finished) return;

    if (this.player.position.z <= FINISH_Z) {
      this.finished = true;
      this.running = false;
      this.callbacks.onTime(this.elapsed);
      this.callbacks.onFinish(this.elapsed);
    }
  }

  private respawn(): void {
    this.player.position.copy(this.spawn);
    this.prevPosition.copy(this.spawn);
    this.velocity.set(0, 0, 0);
    this.support = null;
    this.grounded = false;
    this.hitCooldown = 0.8;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.jumpHeld = false;
    // 直接对准出生点视角，避免镜头从坠落处慢慢飞回来
    this.camera.position.set(this.spawn.x, this.spawn.y + 5.2, this.spawn.z + 9.6);
    this.callbacks.onRespawn();
  }

  private updatePlayerVisual(dt: number): void {
    const speed = Math.hypot(this.velocity.x, this.velocity.z);

    if (speed > 0.4) {
      const targetYaw = Math.atan2(this.velocity.x, this.velocity.z);
      let diff = targetYaw - this.player.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.player.rotation.y += diff * Math.min(1, 12 * dt);
    }

    // 着地移动时进入走路状态：双脚交替迈步、上身起伏与轻微摇摆
    const stride = this.grounded ? Math.min(1, speed / 5.5) : 0;
    this.walkBlend += (stride - this.walkBlend) * Math.min(1, 12 * dt);

    if (this.walkBlend > 0.02) {
      this.walkPhase += dt * (7 + speed * 1.15);
    }

    const step = Math.sin(this.walkPhase);
    const blend = this.walkBlend;

    this.feet.forEach((foot, index) => {
      const swing = index === 0 ? step : -step;
      const lift = Math.max(0, swing);
      foot.position.set(
        index === 0 ? -0.2 : 0.2,
        -0.62 + lift * 0.16 * blend,
        0.06 + swing * 0.2 * blend,
      );
      foot.rotation.x = swing * 0.35 * blend;
    });

    // 上身跟着步伐起伏，整个身体轻微摇摆并向前倾
    this.upper.position.y = Math.abs(step) * 0.055 * blend;
    this.playerVisual.rotation.x = THREE.MathUtils.lerp(
      this.playerVisual.rotation.x,
      -0.09 * blend,
      Math.min(1, 8 * dt),
    );
    this.playerVisual.rotation.z = THREE.MathUtils.lerp(
      this.playerVisual.rotation.z,
      -step * 0.06 * blend - this.velocity.x * 0.015,
      Math.min(1, 10 * dt),
    );

    this.squash = Math.max(0, this.squash - dt * 4);
    const bob = this.grounded ? Math.sin(this.motionTime * 11) * 0.035 * Math.min(1, speed / 5) : 0;
    this.eggBody.scale.set(1 + this.squash * 0.12, 1.2 + bob - this.squash * 0.1, 1 + this.squash * 0.12);
  }

  private updateCamera(dt: number): void {
    const position = this.player.position;
    // 轻微跟随速度方向做前瞻，转身和加速时画面更顺
    const desired = new THREE.Vector3(
      position.x + this.velocity.x * 0.16,
      position.y + 5.2,
      position.z + 9.6 + this.velocity.z * 0.08,
    );
    const factor = Math.min(1, 7 * dt);
    this.camera.position.lerp(desired, factor);
    this.camera.lookAt(
      position.x + this.velocity.x * 0.12,
      position.y + 1,
      position.z - 3.6 + this.velocity.z * 0.12,
    );
  }

  private updateSun(): void {
    const position = this.player.position;
    this.sun.position.set(position.x + 12, position.y + 22, position.z + 10);
    this.sun.target.position.set(position.x, 0, position.z);
    this.sun.target.updateMatrixWorld();
  }

  private resetMotion(): void {
    this.motionTime = 0;
    this.updatePlatforms(true);
    this.spawn.set(0, START_TOP + this.halfHeight, 0);
    this.player.position.copy(this.spawn);
    this.prevPosition.copy(this.spawn);
    this.player.rotation.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.support = null;
    this.grounded = false;
    this.hitCooldown = 0;
    this.squash = 0;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.jumpHeld = false;
    this.walkPhase = 0;
    this.walkBlend = 0;
    this.playerVisual.rotation.set(0, 0, 0);
    this.upper.position.y = 0;
    this.feet.forEach((foot, index) => {
      foot.position.set(index === 0 ? -0.2 : 0.2, -0.62, 0.06);
      foot.rotation.x = 0;
    });
    this.eggBody.scale.set(1, 1.2, 1);
    this.camera.position.set(0, START_TOP + 5.86, 9.6);
  }
}
