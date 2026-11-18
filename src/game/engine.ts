import { assetUrl } from '../hosting';
import * as T from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { aircraftBy, weatherBy, uniqueId, type Config, type Settings, type Plane } from '../data';
import { buildWorld, heightAt, waterAt, random, type WorldData, type Section } from './world';
import { FlightAudio } from './audio';
import { cockpitInstruments } from './instruments';
import { pack, type Frame, type Recording, type DebrisSpec } from './recording';
const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const Q = () => new T.Quaternion();
const clamp = T.MathUtils.clamp,
  rad = T.MathUtils.radToDeg;
let ready: Promise<void> | undefined;
const initRapier = () => (ready ??= RAPIER.init());
export const cameras = ['Chase', 'Cockpit', 'Orbit', 'Ground', 'Free', 'Cabin'] as const;
export const faults = [
  'Engine malfunction',
  'Crosswind burst',
  'Hydraulic fault',
  'Electrical fault',
  'Navigation fault',
  'Structural fatigue',
  'Release cabin door',
  'Structure stress test',
  'District stress test',
  'Restore systems',
] as const;
export type Telemetry = {
  t: number;
  speed: number;
  alt: number;
  heading: number;
  bank: number;
  pitch: number;
  hp: number;
  throttle: number;
  camera: string;
  gear: boolean;
  paused: boolean;
  rate: number;
  status: string;
  debris: number;
  sections: number;
  bodies: number;
  fps: number;
  gate: number;
  electrical: boolean;
  navFault: boolean;
  replay: boolean;
  start: number;
  end: number;
  playing: boolean;
  pos: [number, number, number];
};
export const emptyTelemetry: Telemetry = {
  t: 0,
  speed: 0,
  alt: 0,
  heading: 0,
  bank: 0,
  pitch: 0,
  hp: 100,
  throttle: 72,
  camera: 'Chase',
  gear: false,
  paused: false,
  rate: 1,
  status: 'Initializing',
  debris: 0,
  sections: 0,
  bodies: 0,
  fps: 0,
  gate: 0,
  electrical: false,
  navFault: false,
  replay: false,
  start: 0,
  end: 0,
  playing: false,
  pos: [0, 0, 0],
};
type Debris = {
  id: number;
  obj: T.Object3D;
  body?: RAPIER.RigidBody;
  collider?: number;
  spec: DebrisSpec;
  vel: T.Vector3;
  spin: T.Vector3;
  rest: boolean;
  half: number;
};
type Particle = { age: number; life: number; vel: T.Vector3; size: number };
export class FlightEngine {
  c: Config;
  s: Settings;
  plane: Plane;
  canvas: HTMLCanvasElement;
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(56, 1, 0.12, 15000);
  world!: RAPIER.World;
  env!: WorldData;
  events!: RAPIER.EventQueue;
  body!: RAPIER.RigidBody;
  model!: T.Group;
  farModel?: T.Group;
  instruments?: ReturnType<typeof cockpitInstruments>;
  released = false;
  inWater = false;
  audio?: FlightAudio;
  onHUD: (v: Telemetry) => void;
  notice: (s: string) => void;
  rng: () => number;
  keys = new Set<string>();
  partColliders = new Map<string, RAPIER.Collider>();
  colliderParts = new Map<number, string>();
  lost = new Set<string>();
  partHits = new Map<string, number>();
  broken = new Set<number>();
  pending: Section[] = [];
  districtQueue: { section: Section; at: number }[] = [];
  debris: Debris[] = [];
  specs: DebrisSpec[] = [];
  debrisByCollider = new Map<number, Debris>();
  nextId = 1;
  frames: Frame[] = [];
  record?: Recording;
  replayTime = 0;
  playing = true;
  t = 0;
  throttle = 0.72;
  gear = false;
  hp = 100;
  paused = false;
  rate = 1;
  camIndex = 0;
  cameraPrimed = false;
  destroyed = false;
  raf = 0;
  acc = 0;
  last = 0;
  fps = 60;
  hudAt = 0;
  lastSample = -1;
  lastImpact = -1;
  lastDistance = 0;
  speed = 0;
  enginePower = 1;
  hydraulic = 1;
  electrical = false;
  navFault = false;
  gust = 0;
  nextFault = 22;
  gate = 0;
  grounded = false;
  challengeDone = false;
  orbitX = 0.6;
  orbitY = 0.28;
  orbitDist = 1;
  dragging = false;
  prevPointer = [0, 0];
  freeYaw = 0;
  freePitch = -0.1;
  resizeObs?: ResizeObserver;
  cleanups: (() => void)[] = [];
  maxBodies = 80;
  pixelRatio = 1;
  adaptAt = 0;
  particles: T.Points;
  particleData: Particle[] = [];
  particlePtr = 0;
  particlePos: Float32Array;
  particleColor: Float32Array;
  particleSize: Float32Array;
  count = 320;
  initialRadius = 0;
  constructor(
    canvas: HTMLCanvasElement,
    c: Config,
    s: Settings,
    onHUD: (v: Telemetry) => void,
    notice: (s: string) => void,
    rec?: Recording,
  ) {
    this.canvas = canvas;
    this.c = { ...c };
    this.s = { ...s };
    this.plane = aircraftBy(c.aircraft);
    this.rng = random(c.seed + 9821);
    this.onHUD = onHUD;
    this.notice = notice;
    this.record = rec;
    this.maxBodies = { Low: 24, Medium: 48, High: 80, Ultra: 120 }[s.quality];
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: s.quality !== 'Low',
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.shadowMap.enabled = s.quality !== 'Low';
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.pixelRatio = Math.min(
      devicePixelRatio,
      { Low: 0.85, Medium: 1.15, High: 1.55, Ultra: 2 }[s.quality],
    );
    this.renderer.setPixelRatio(this.pixelRatio);
    this.count = s.quality === 'Low' ? 140 : s.quality === 'Ultra' ? 600 : 320;
    this.particlePos = new Float32Array(this.count * 3).fill(-9999);
    this.particleColor = new Float32Array(this.count * 3);
    this.particleSize = new Float32Array(this.count);
    const geom = new T.BufferGeometry();
    geom.setAttribute(
      'position',
      new T.BufferAttribute(this.particlePos, 3).setUsage(T.DynamicDrawUsage),
    );
    geom.setAttribute('color', new T.BufferAttribute(this.particleColor, 3));
    geom.setAttribute('size', new T.BufferAttribute(this.particleSize, 1));
    this.particles = new T.Points(
      geom,
      new T.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        vertexColors: true,
        vertexShader:
          'attribute float size; varying vec3 col;void main(){col=color;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(size*550./max(1.,-mv.z),1.,75.);}',
        fragmentShader:
          'varying vec3 col;void main(){float a=1.-smoothstep(.09,.5,distance(gl_PointCoord,vec2(.5)));if(a<.012)discard;gl_FragColor=vec4(col,a*.46);\n#include <colorspace_fragment>\n}',
      }),
    );
    this.particles.frustumCulled = false;
    this.scene.add(this.particles);
  }
  async init() {
    await initRapier();
    if (this.destroyed) return;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;
    this.events = new RAPIER.EventQueue(true);
    this.world.numSolverIterations = this.s.quality === 'Low' ? 3 : 5;
    const [env, gltf, distant] = await Promise.all([
      buildWorld(this.scene, this.world, this.c, this.s.quality),
      new GLTFLoader().loadAsync(assetUrl(`models/${this.plane.id}.glb`)),
      new GLTFLoader().loadAsync(assetUrl(`models/${this.plane.id}-lod1.glb`)),
    ]);
    this.farModel = distant.scene;
    this.farModel.visible = false;
    this.scene.add(this.farModel);
    this.env = env;
    this.model = gltf.scene;
    this.model.name = 'Aircraft';
    this.model.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.scene.add(this.model);
    this.instruments = cockpitInstruments(this.model, this.plane);
    if (this.destroyed) {
      this.release();
      return;
    }
    const p = this.plane,
      alt = clamp(+this.c.altitude || 120, 12, 800),
      pos = V(this.c.mode === 'City destruction lab' ? 175 : 0, alt, 540);
    this.body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(pos.x, pos.y, pos.z)
        .setLinvel(0, 0, -p.cruise)
        .setAngularDamping(0.65)
        .setLinearDamping(0.003)
        .setCcdEnabled(true)
        .setCanSleep(false),
    );
    const add = (name: string, xyz: number[], half: number[], weight: number) => {
      const cd = RAPIER.ColliderDesc.cuboid(half[0], half[1], half[2])
        .setTranslation(xyz[0], xyz[1], xyz[2])
        .setMass(p.mass * weight)
        .setFriction(name === 'gear' ? 0.46 : 0.64)
        .setRestitution(0.08)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
      const col = this.world.createCollider(cd, this.body);
      this.partColliders.set(name, col);
      this.colliderParts.set(col.handle, name);
    };
    add('body_mid', [0, 0, 0], [p.radius, p.radius, p.length * 0.165], 0.28);
    add(
      'body_front',
      [0, 0, -p.length * 0.314],
      [p.radius * 0.81, p.radius * 0.83, p.length * 0.15],
      0.2,
    );
    add('body_aft', [0, 0.1, p.length * 0.318], [p.radius * 0.7, p.radius * 0.7, p.length * 0.15], 0.15);
    for (const side of [-1, 1]) {
      const s = side < 0 ? 'l' : 'r';
      add(
        'wing_' + s,
        [side * p.span * 0.268, -p.radius * 0.15, p.length * 0.057],
        [p.span * 0.224, p.radius * 0.15, p.length * 0.089],
        0.09,
      );
      const e = this.model.getObjectByName('engine_' + s)!;
      add(
        'engine_' + s,
        e.position.toArray(),
        [p.radius * 0.58, p.radius * 0.57, p.radius * 1.1],
        0.057,
      );
    }
    add(
      'tail',
      [0, p.radius * 1.88, p.length * 0.407],
      [p.radius * 0.16, p.radius * 1.49, p.length * 0.087],
      0.044,
    );
    add(
      'gear',
      [0, -p.radius * 1.54, -p.length * 0.04],
      [p.radius * 1.01, p.radius * 0.3, p.length * 0.22],
      0.012,
    );
    this.partColliders.get('gear')!.setEnabled(false);
    this.model.getObjectByName('gear')!.visible = false;
    this.model.position.copy(pos);
    this.speed = p.cruise;
    this.nextFault = 15 + this.rng() * 20;
    this.audio = new FlightAudio(this.s.sound, this.s.volume);
    this.resize();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(this.canvas.parentElement!);
    this.bind();
    if (this.record) {
      this.frames = this.record.frames;
      this.replayTime = this.frames[0]?.t || 0;
      this.record.breaks.forEach(([id, at]) => {
        if (this.env.sections[id]) this.env.sections[id].brokenAt = at;
      });
      this.record.parts.forEach((spec) => this.createReplayPiece(spec));
      this.applyReplay();
      this.camIndex = 2;
    } else this.sample();
    this.updateCamera(1);
    this.publish();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }
  resize() {
    const w = this.canvas.parentElement?.clientWidth || innerWidth,
      h = this.canvas.parentElement?.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }
  bind() {
    const listen = (
      el: EventTarget,
      name: string,
      fn: EventListener,
      options?: AddEventListenerOptions,
    ) => {
      el.addEventListener(name, fn, options);
      this.cleanups.push(() => el.removeEventListener(name, fn, options));
    };
    listen(window, 'keydown', ((e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input,select,textarea') || e.metaKey || e.altKey) return;
      const code = e.code;
      if (
        [
          'Space',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'ControlLeft',
          'ControlRight',
          'Tab',
        ].includes(code) &&
        code !== 'Tab'
      )
        e.preventDefault();
      this.keys.add(code);
      if (e.repeat) return;
      if (code === 'KeyC') this.setCamera((this.camIndex + 1) % cameras.length);
      if (code === 'KeyP' || code === 'Escape') this.togglePause();
      if (code === 'KeyT') this.setRate(this.rate === 1 ? 0.25 : 1);
      if (code === 'KeyG') this.toggleGear();
      if (code === 'KeyF' && !this.record) this.trigger(faults[Math.floor(this.rng() * 6)]);
    }) as EventListener);
    listen(window, 'keyup', ((e: KeyboardEvent) => {
      this.keys.delete(e.code);
    }) as EventListener);
    listen(window, 'blur', () => this.keys.clear());
    listen(document, 'visibilitychange', () => {
      this.keys.clear();
      if (document.hidden && !this.record) {
        this.paused = true;
        this.acc = 0;
        this.publish();
      }
    });
    listen(this.canvas, 'pointerdown', ((e: PointerEvent) => {
      this.dragging = true;
      this.prevPointer = [e.clientX, e.clientY];
      this.canvas.setPointerCapture(e.pointerId);
      if (this.camIndex === 0) this.setCamera(2);
    }) as EventListener);
    listen(this.canvas, 'pointerup', () => (this.dragging = false));
    listen(this.canvas, 'pointercancel', () => (this.dragging = false));
    listen(this.canvas, 'pointermove', ((e: PointerEvent) => {
      if (!this.dragging) return;
      const dx = (e.clientX - this.prevPointer[0]) * 0.006,
        dy = (e.clientY - this.prevPointer[1]) * 0.006;
      this.orbitX -= dx;
      this.orbitY = clamp(this.orbitY + dy, -0.15, 1.42);
      this.freeYaw -= dx;
      this.freePitch = clamp(this.freePitch - dy, -1.42, 1.42);
      this.prevPointer = [e.clientX, e.clientY];
    }) as EventListener);
    listen(
      this.canvas,
      'wheel',
      ((e: WheelEvent) => {
        e.preventDefault();
        this.orbitDist = clamp(this.orbitDist + e.deltaY * 0.001, 0.5, 3.5);
      }) as EventListener,
      { passive: false },
    );
  }
  togglePause() {
    if (this.record) {
      if (!this.playing && this.replayTime >= this.frames.at(-1)!.t - 0.025) this.seek(this.frames[0].t);
      this.playing = !this.playing;
    } else this.paused = !this.paused;
    this.acc = 0;
    this.keys.clear();
    this.publish();
  }
  setRate(r: number) {
    this.rate = clamp(r, 0.1, 2);
    this.publish();
  }
  setCamera(i: number) {
    this.camIndex = (i + cameras.length) % cameras.length;
    this.cameraPrimed = false;
    if (this.camIndex === 4) {
      const eu = new T.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
      this.freeYaw = eu.y;
      this.freePitch = eu.x;
    }
    this.publish();
  }
  toggleGear() {
    if (this.record || this.lost.has('gear')) return;
    this.gear = !this.gear;
    this.partColliders.get('gear')?.setEnabled(this.gear);
    this.model.getObjectByName('gear')!.visible = this.gear;
    this.notice(this.gear ? 'Landing gear extended' : 'Landing gear retracted');
    this.publish();
  }
  loop = (now: number) => {
    if (this.destroyed) return;
    const elapsed = Math.max(0, (now - this.last) / 1000);
    this.last = now;
    const dt = Math.min(0.1, elapsed);
    this.fps = T.MathUtils.lerp(this.fps, 1 / Math.max(0.001, elapsed), 0.035);
    if (this.record) {
      if (this.playing) {
        this.replayTime += dt * this.rate;
        const end = this.frames.at(-1)!.t;
        if (this.replayTime >= end) {
          this.replayTime = end;
          this.playing = false;
        }
      }
      this.applyReplay();
    } else if (!this.paused) {
      this.acc += dt * this.rate;
      let n = 0;
      while (this.acc >= 1 / 60 && n++ < 10) {
        this.step();
        this.acc -= 1 / 60;
      }
    }
    this.updateCamera(dt);
    if (this.env.water) this.env.water.position.y = -1.8 + Math.sin(this.t * 0.62) * 0.13;
    this.env.clouds.position.x = (this.t * weatherBy(this.c.weather).wind * 0.12) % 850;
    this.env.sky.position.copy(this.camera.position);
    this.env.sun.position.copy(this.model.position).add(V(-340, 520, -280));
    this.env.sun.target.position.copy(this.model.position);
    const dist = this.model.position.distanceTo(this.camera.position);
    if (this.farModel) {
      const far = dist > Math.max(220, this.plane.length * 8) && this.hp > 99.9 && !this.lost.size;
      this.farModel.visible = far;
      this.model.visible = !far;
      if (far) {
        this.farModel.position.copy(this.model.position);
        this.farModel.quaternion.copy(this.model.quaternion);
      }
    }
    const delta = this.model.position.clone().sub(this.camera.position).normalize();
    const pan = delta.dot(V(1, 0, 0).applyQuaternion(this.camera.quaternion));
    this.audio?.update(
      this.throttle * this.enginePower,
      this.speed,
      dist,
      pan,
      !this.paused && (!this.record || this.playing),
    );
    if (now - this.adaptAt > 5500 && now > 8000) {
      this.adaptAt = now;
      if (this.s.adaptive && this.fps < 30 && this.pixelRatio > 0.6) {
        this.pixelRatio = Math.max(0.58, this.pixelRatio - 0.12);
        this.renderer.setPixelRatio(this.pixelRatio);
      }
    }
    this.renderer.render(this.scene, this.camera);
    if (now - this.hudAt > 110) {
      this.hudAt = now;
      this.publish();
    }
    this.raf = requestAnimationFrame(this.loop);
  };
  step() {
    if (this.destroyed || !this.body || this.record) return;
    const dt = 1 / 60;
    this.t += dt;
    const body = this.body,
      p = this.plane;
    const rot = Q().copy(body.rotation() as T.Quaternion),
      pos = V().copy(body.translation()),
      vel = V().copy(body.linvel()),
      forward = V(0, 0, -1).applyQuaternion(rot),
      up = V(0, 1, 0).applyQuaternion(rot),
      right = V(1, 0, 0).applyQuaternion(rot);
    this.speed = vel.length();
    const clearance = pos.y - heightAt(pos.x, pos.z, this.c.map, this.c.seed);
    this.grounded = clearance < p.radius * (this.gear ? 2.15 : 1.22) && Math.abs(vel.y) < 3.5;
    const down = (...codes: string[]) => this.camIndex !== 4 && codes.some((k) => this.keys.has(k));
    const roll = +down('KeyA', 'ArrowLeft') - +down('KeyD', 'ArrowRight'),
      pitch = +down('KeyS', 'ArrowDown') - +down('KeyW', 'ArrowUp'),
      yaw = +down('KeyQ') - +down('KeyE');
    if (down('ShiftLeft', 'ShiftRight', 'Equal')) this.throttle = clamp(this.throttle + dt * 0.26, 0, 1);
    if (down('ControlLeft', 'ControlRight', 'Minus'))
      this.throttle = clamp(this.throttle - dt * 0.26, 0, 1);
    const brake = down('Space');
    const wind = weatherBy(this.c.weather).wind;
    const turb = (this.c.turbulence / 100) * (this.c.weather === 'storm' ? 3.4 : 1);
    this.gust *= 0.9975;
    const air = vel
      .clone()
      .sub(
        V(
          wind * 0.29 + Math.sin(this.t * 0.6 + pos.z * 0.001) * wind * 0.19 + this.gust,
          Math.sin(this.t * 1.14) * turb * 3.3,
          Math.cos(this.t * 0.35) * wind * 0.1,
        ),
      );
    const fs = Math.max(0, air.dot(forward)),
      ar = clamp(fs / p.cruise, 0, 1.8);
    const wing = 1 - (this.lost.has('wing_l') ? 0.46 : 0) - (this.lost.has('wing_r') ? 0.46 : 0);
    const aoa = clamp(-air.dot(up) / Math.max(12, fs), -0.4, 0.4);
    const lift = 9.81 * clamp(ar * ar * (1 + 1.4 * aoa), 0, 2.75) * wing;
    let power =
      this.enginePower * (this.lost.has('engine_l') ? 0.46 : 1) * (this.lost.has('engine_r') ? 0.46 : 1);
    if (this.hp < 8) power = 0;
    const accel = forward
      .clone()
      .multiplyScalar(8.1 * this.throttle * power)
      .addScaledVector(up, lift)
      .addScaledVector(
        air,
        -air.length() * (0.00115 * (70 / p.cruise) ** 2) * (brake ? 2.9 : this.gear ? 1.26 : 1),
      )
      .addScaledVector(right, -air.dot(right) * 0.84)
      .addScaledVector(up, -air.dot(up) * 0.72);
    const wet = waterAt(pos.x, pos.z, this.c.map) && pos.y < -1.8 + p.radius;
    if (wet) {
      const depth = clamp(-1.8 + p.radius - pos.y, 0, 6);
      accel.y += clamp(depth * 10, 0, 27);
      accel.addScaledVector(vel, -clamp(depth * 0.65, 0.1, 2.4));
      if (!this.inWater && -vel.y > 6) {
        this.damage('body_front', Math.abs(vel.y) * 3.4);
        this.emit(pos, 30, 'glass');
        this.audio?.effect('hit', 0.75);
        this.notice('Water contact · airframe stress detected');
      }
    }
    this.inWater = wet;
    if (this.grounded && brake) accel.addScaledVector(vel, -0.75);
    body.resetForces(true);
    body.addForce(accel.multiplyScalar(body.mass()), true);
    const assist = this.c.physics === 'Arcade' ? 1 : 0.32,
      control =
        p.agility *
        this.hydraulic *
        this.s.sensitivity *
        clamp(ar, 0.1, 1.17) *
        (this.hp < 10 ? 0.08 : 1);
    let asym = (this.lost.has('wing_l') ? 1 : 0) - (this.lost.has('wing_r') ? 1 : 0);
    const target = V(
      pitch * 0.64 * control - forward.y * 0.59 * assist + (ar < 0.55 && !this.grounded ? -0.16 : 0),
      yaw * 0.43 * control + right.y * 0.22 + Math.sin(this.t * 0.7) * turb * 0.019,
      roll * 1.16 * control -
        right.y * (roll ? 0 : 0.92) * assist +
        asym * 0.72 +
        Math.sin(this.t * 1.47 + pos.z * 0.001) * turb * 0.047,
    );
    if (this.grounded) target.multiplyScalar(0.35);
    target.applyQuaternion(rot);
    const av = V().copy(body.angvel());
    av.lerp(target, 1 - Math.exp(-dt * (this.grounded ? 2 : 2.7) * p.agility));
    body.setAngvel(av, true);
    const beforeV = vel.clone();
    this.world.step(this.events);
    const collisions: [number, number][] = [];
    this.events.drainCollisionEvents((a, b, start) => {
      if (start) collisions.push([a, b]);
    });
    this.model.position.copy(body.translation());
    this.model.quaternion.copy(body.rotation() as T.Quaternion);
    this.model.updateMatrixWorld(true);
    for (const [a, b] of collisions) {
      const ap = this.colliderParts.get(a) || this.colliderParts.get(b);
      const sec = this.env.byCollider.get(a) || this.env.byCollider.get(b);
      const frag = this.debrisByCollider.get(a) || this.debrisByCollider.get(b);
      if (ap && sec && !this.broken.has(sec.id) && this.speed > 8) {
        const resistance =
          (
            { future: 31, glass: 22, home: 14, hangar: 25, roof: 9, metal: 18, bridge: 28 } as Record<
              string,
              number
            >
          )[sec.kind] || 20;
        sec.integrity -= (this.speed / resistance) ** 2 * clamp(p.mass / 28000, 0.45, 2);
        if (sec.integrity <= 0) this.breakSection(sec, beforeV.clone().multiplyScalar(0.27));
        else {
          sec.batch.setColorAt(sec.index, new T.Color().setScalar(0.42 + sec.integrity * 0.41));
          if (sec.batch.instanceColor) sec.batch.instanceColor.needsUpdate = true;
        }
        const energyDamage = clamp(
          115 * (this.speed / p.cruise) ** 2 * clamp(0.7 + (0.3 * p.mass) / 28000, 0.72, 1.65),
          9,
          138,
        );
        this.damage(ap, energyDamage);
        this.audio?.effect('hit', 0.8);
      } else if (ap && !frag && !sec && this.t - this.lastImpact > 0.17) {
        const severity =
          Math.max(0, -beforeV.y) * (this.gear && ap === 'gear' ? 0.62 : 1) +
          (ap.startsWith('wing') ? this.speed * 0.24 : 0);
        if (severity > 5.8) {
          this.damage(ap, severity * 2.1);
          this.emit(this.model.position, 14, 'dust');
          this.lastImpact = this.t;
          this.audio?.effect('hit', severity * 0.025);
          if (severity > 15) {
            this.damage('gear', 85);
            this.damage(beforeV.x > 0 ? 'wing_r' : 'wing_l', severity * 2.7);
          }
        }
      }
      if (
        frag &&
        sec &&
        !this.broken.has(sec.id) &&
        frag.body &&
        V().copy(frag.body.linvel()).length() > 17 &&
        frag.spec.scale[0] * frag.spec.scale[1] * frag.spec.scale[2] > 10
      )
        this.breakSection(sec, V().copy(frag.body.linvel()).multiplyScalar(0.23));
    }
    if (this.districtQueue.length && this.t >= this.districtQueue[0].at) {
      const item = this.districtQueue.shift()!;
      this.breakSection(item.section, V((this.rng() - 0.5) * 3, 0.6, -1));
    }
    // Unsupported modules drop over successive fixed steps, never all in one render frame.
    for (let i = 0; i < 2 && this.pending.length; i++) {
      const sec = this.pending.shift()!;
      if (!this.broken.has(sec.id))
        this.breakSection(sec, V((this.rng() - 0.5) * 2, -0.3, (this.rng() - 0.5) * 2));
    }
    this.updateDebris(dt);
    this.updateParticles(dt);
    if (this.enginePower < 0.8 && Math.floor(this.t * 10) !== Math.floor((this.t - dt) * 10)) {
      const e = this.model.getObjectByName('engine_l');
      if (e) this.emit(e.getWorldPosition(V()), 2, 'smoke');
    }
    const ani = (name: string, axis: 'x' | 'y' | 'z', v: number) => {
      const o = this.model.getObjectByName(name);
      if (o) o.rotation[axis] = v;
    };
    ani('aileron_l', 'x', roll * 0.32);
    ani('aileron_r', 'x', -roll * 0.32);
    ani('elevator', 'x', -pitch * 0.21);
    ani('rudder', 'y', yaw * 0.28);
    ani('prop_l', 'z', this.t * 27);
    ani('prop_r', 'z', this.t * 27);
    if (this.c.mode === 'Random disaster' && this.t > this.nextFault) {
      this.trigger(faults[Math.floor(this.rng() * 6)]);
      this.nextFault = this.t + 18 + this.rng() * 32;
    }
    if (this.c.mode === 'Aircraft damage lab' && this.t > 6 && this.nextFault !== Infinity) {
      this.trigger('Engine malfunction');
      this.nextFault = Infinity;
    }
    if (this.c.mode === 'City destruction lab' && this.t > 4 && this.nextFault !== Infinity) {
      this.trigger('Structure stress test');
      this.nextFault = Infinity;
    }
    const gate = this.env.gates[this.gate];
    if (gate && gate.position.distanceTo(this.model.position) < 37) {
      gate.visible = false;
      this.gate++;
      this.notice(
        this.gate === this.env.gates.length
          ? 'Circuit complete — all nine gates cleared.'
          : `Checkpoint ${this.gate} / ${this.env.gates.length} cleared`,
      );
      this.audio?.effect('alert');
    }
    if (Math.abs(pos.x) > 4150 || Math.abs(pos.z) > 4150 || pos.y < -48 || pos.y > 2600) {
      body.setTranslation({ x: 0, y: Math.max(120, this.c.altitude), z: 570 }, true);
      body.setLinvel({ x: 0, y: 0, z: -p.cruise }, true);
      body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      this.cameraPrimed = false;
      this.notice('Sector boundary · returned to the flight corridor');
    }
    if (this.t - this.lastSample >= 0.125) this.sample();
  }
  damage(name: string, amount: number) {
    if (this.lost.has(name)) return;
    amount /= this.plane.strength;
    const next = (this.partHits.get(name) || 0) + amount;
    this.partHits.set(name, next);
    this.hp = clamp(this.hp - amount * 0.2, 0, 100);
    const o = this.model.getObjectByName(name);
    if (o && !name.startsWith('body')) {
      o.scale.y = clamp(1 - next * 0.0016, 0.76, 1);
      o.rotation.z += 0.015 * (this.rng() - 0.5);
    }
    if (next > (name === 'body_mid' ? 220 : name.startsWith('body') ? 72 : 40)) {
      if (name === 'body_mid') {
        this.detach('doors');
        this.detach('interior');
      } else this.detach(name);
      if (name.startsWith('body')) {
        this.detach('cabin_windows');
        this.detach(name === 'body_front' ? 'windshield' : 'tail');
        this.detach(name === 'body_front' ? 'cockpit' : 'elevator');
        if (name === 'body_aft') this.detach('rudder');
      }
      if (name.startsWith('wing')) {
        this.detach('aileron_' + name.slice(-1));
        this.detach('engine_' + name.slice(-1));
      }
    }
    this.emit(this.model.position, 12, 'spark');
  }
  detach(name: string) {
    if (this.lost.has(name) || name === 'body_mid') return;
    const o = this.model.getObjectByName(name);
    if (!o) return;
    this.lost.add(name);
    o.visible = false;
    const pc = this.partColliders.get(name);
    if (pc) {
      this.colliderParts.delete(pc.handle);
      this.world.removeCollider(pc, true);
      this.partColliders.delete(name);
    }
    const clone = o.clone(true);
    clone.visible = true;
    clone.position.set(0, 0, 0);
    clone.quaternion.identity();
    const size = new T.Box3().setFromObject(clone).getSize(V());
    size.max(V(0.18, 0.18, 0.18));
    const origin = o.getWorldPosition(V()),
      q = o.getWorldQuaternion(Q());
    const spec: DebrisSpec = {
      id: this.nextId++,
      kind: 'part',
      name,
      scale: size.toArray(),
      born: this.t,
    };
    this.spawnPiece(
      clone,
      spec,
      origin,
      q,
      V()
        .copy(this.body.linvel())
        .multiplyScalar(0.88)
        .add(V((this.rng() - 0.5) * 4, 1 + this.rng() * 1.8, (this.rng() - 0.5) * 4)),
      this.plane.mass * 0.027,
    );
    this.hp = clamp(this.hp - 2.4, 0, 100);
    this.notice('Component separated · ' + name.replaceAll('_', ' '));
  }
  breakSection(s: Section, impulse: T.Vector3) {
    if (this.broken.has(s.id)) return;
    this.broken.add(s.id);
    s.brokenAt = this.t;
    this.env.setSection(s, false);
    if (s.collider) {
      this.env.byCollider.delete(s.collider.handle);
      this.world.removeCollider(s.collider, true);
      s.collider = null;
    }
    // A floor slab and two exterior wall panels retain independent mass and angular velocity.
    const pieces: [number[], number[], string][] = [
      [[s.w * 0.95, Math.max(0.55, s.h * 0.15), s.d * 0.96], [0, -s.h * 0.4, 0], 'concrete'],
      [[s.w * 0.96, s.h * 0.84, Math.max(0.7, s.d * 0.08)], [0, 0, s.d * 0.43], s.kind],
      [[Math.max(0.7, s.w * 0.1), s.h * 0.84, s.d * 0.9], [s.w * 0.43, 0, 0], s.kind],
    ];
    for (const [size, off, mat] of pieces) {
      const sc = size as [number, number, number];
      const mesh = new T.Mesh(new T.BoxGeometry(1, 1, 1), this.env.materials[mat]);
      mesh.scale.fromArray(sc);
      const origin = V(s.x + off[0], s.y + off[1], s.z + off[2]);
      const spec: DebrisSpec = { id: this.nextId++, kind: 'block', name: mat, scale: sc, born: this.t };
      this.spawnPiece(
        mesh,
        spec,
        origin,
        Q(),
        impulse.clone().add(V((this.rng() - 0.5) * 4, this.rng() * 2, (this.rng() - 0.5) * 4)),
        size[0] * size[1] * size[2] * 70,
      );
    }
    this.emit(V(s.x, s.y, s.z), 20, 'dust');
    this.emit(V(s.x, s.y + 1, s.z), 8, 'glass');
    const direction = V(s.x, s.y, s.z).sub(this.camera.position);
    const distance = direction.length(),
      pan = direction.normalize().dot(V(1, 0, 0).applyQuaternion(this.camera.quaternion));
    this.audio?.effect('debris', 0.32, pan, distance);
    for (const upper of this.env.columns.get(s.column) || [])
      if (upper.level > s.level && !this.broken.has(upper.id) && !this.pending.includes(upper))
        this.pending.push(upper);
  }
  spawnPiece(
    obj: T.Object3D,
    spec: DebrisSpec,
    origin: T.Vector3,
    q: T.Quaternion,
    vel: T.Vector3,
    mass: number,
  ) {
    obj.position.copy(origin);
    obj.quaternion.copy(q);
    obj.traverse((ch) => {
      if (ch instanceof T.Mesh) {
        ch.castShadow = true;
        ch.receiveShadow = true;
      }
    });
    this.scene.add(obj);
    this.specs.push(spec);
    const spin = V(this.rng() - 0.5, this.rng() - 0.5, this.rng() - 0.5).multiplyScalar(2.7);
    const pair = this.debris.filter((d) => d.body);
    if (pair.length >= this.maxBodies) {
      const best = pair.sort(
        (a, b) =>
          Number(b.body!.isSleeping()) - Number(a.body!.isSleeping()) ||
          b.obj.position.distanceToSquared(this.model.position) -
            a.obj.position.distanceToSquared(this.model.position),
      )[0];
      this.demote(best);
    }
    const d: Debris = {
      id: spec.id,
      obj,
      spec,
      vel: vel.clone(),
      spin,
      rest: false,
      half: spec.scale[1] / 2,
    };
    if (origin.distanceTo(this.model.position) < 640) {
      const r = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(origin.x, origin.y, origin.z)
          .setRotation(q)
          .setLinvel(vel.x, vel.y, vel.z)
          .setAngvel(spin)
          .setAngularDamping(0.44)
          .setLinearDamping(0.055)
          .setCanSleep(true)
          .setCcdEnabled(true),
      );
      const col = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(
          Math.max(0.09, spec.scale[0] / 2),
          Math.max(0.09, spec.scale[1] / 2),
          Math.max(0.09, spec.scale[2] / 2),
        )
          .setMass(Math.max(0.5, mass))
          .setFriction(0.82)
          .setRestitution(0.13)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
        r,
      );
      d.body = r;
      d.collider = col.handle;
      this.debrisByCollider.set(col.handle, d);
    }
    this.debris.push(d);
    if (this.debris.length > 320) {
      const index = this.debris.findIndex((x) => x.spec.kind === 'block' && !x.body && x.rest);
      const old = this.debris.splice(index < 0 ? 0 : index, 1)[0];
      this.demote(old);
      this.scene.remove(old.obj);
      if (old.spec.kind === 'block') (old.obj as T.Mesh).geometry.dispose();
    }
  }
  demote(d: Debris) {
    if (!d.body) return;
    d.vel.copy(d.body.linvel());
    d.spin.copy(d.body.angvel());
    d.rest = d.body.isSleeping();
    if (d.collider !== undefined) this.debrisByCollider.delete(d.collider);
    this.world.removeRigidBody(d.body);
    d.body = undefined;
  }
  updateDebris(dt: number) {
    for (const d of this.debris) {
      if (d.body) {
        d.obj.position.copy(d.body.translation());
        d.obj.quaternion.copy(d.body.rotation() as T.Quaternion);
        if (d.obj.position.distanceToSquared(this.model.position) > 760 ** 2) this.demote(d);
      } else if (!d.rest) {
        d.vel.y -= 9.81 * dt;
        d.obj.position.addScaledVector(d.vel, dt);
        d.obj.rotation.x += d.spin.x * dt;
        d.obj.rotation.z += d.spin.z * dt;
        const y =
          heightAt(d.obj.position.x, d.obj.position.z, this.c.map, this.c.seed) + Math.min(d.half, 3);
        if (d.obj.position.y < y) {
          d.obj.position.y = y;
          d.vel.y = Math.abs(d.vel.y) * 0.14;
          d.vel.multiplyScalar(0.84);
          d.spin.multiplyScalar(0.76);
          d.rest = d.vel.length() < 0.45;
        }
      }
    }
  }
  emit(pos: T.Vector3, n: number, type: 'dust' | 'spark' | 'smoke' | 'glass') {
    for (let i = 0; i < n; i++) {
      const idx = this.particlePtr++ % this.count;
      const dust = type === 'dust' || type === 'smoke';
      this.particleData[idx] = {
        age: 0,
        life: dust ? 1.6 + this.rng() * 2.3 : 0.45 + this.rng() * 0.85,
        vel: V(
          (this.rng() - 0.5) * (dust ? 8 : 17),
          this.rng() * (dust ? 5 : 10),
          (this.rng() - 0.5) * (dust ? 8 : 17),
        ),
        size: dust ? 2 + this.rng() * 5 : 0.16 + this.rng() * 0.4,
      };
      this.particlePos.set(
        [pos.x + (this.rng() - 0.5) * 2, pos.y + this.rng() * 2, pos.z + (this.rng() - 0.5) * 2],
        idx * 3,
      );
      const color = new T.Color(
        type === 'spark'
          ? 0xffb55f
          : type === 'glass'
            ? 0xbde3e4
            : type === 'smoke'
              ? 0x454d4e
              : 0xb5a795,
      );
      this.particleColor.set([color.r, color.g, color.b], idx * 3);
    }
    this.particles.geometry.attributes.color.needsUpdate = true;
  }
  updateParticles(dt: number) {
    for (let i = 0; i < this.particleData.length; i++) {
      const d = this.particleData[i];
      if (!d || d.age > d.life) continue;
      d.age += dt;
      const k = i * 3;
      if (d.age > d.life) {
        this.particlePos[k + 1] = -9999;
        continue;
      }
      this.particlePos[k] += d.vel.x * dt;
      this.particlePos[k + 1] += d.vel.y * dt;
      this.particlePos[k + 2] += d.vel.z * dt;
      if (d.size < 1) d.vel.y -= 9.2 * dt;
      this.particleSize[i] = d.size * (1 - (d.age / d.life) * 0.75);
    }
    this.particles.geometry.attributes.position.needsUpdate = true;
    this.particles.geometry.attributes.size.needsUpdate = true;
  }
  trigger(event: string) {
    if (this.record || this.destroyed) return;
    switch (event) {
      case 'Engine malfunction':
        this.enginePower = 0.36;
        break;
      case 'Crosswind burst':
        this.gust = (this.rng() > 0.5 ? 1 : -1) * 34;
        this.body.applyImpulse(V(this.gust * this.body.mass() * 0.19, 0, 0), true);
        break;
      case 'Hydraulic fault':
        this.hydraulic = 0.31;
        break;
      case 'Electrical fault':
        this.electrical = true;
        break;
      case 'Navigation fault':
        this.navFault = true;
        break;
      case 'Structural fatigue':
        this.damage(this.rng() > 0.5 ? 'wing_l' : 'wing_r', 82);
        break;
      case 'Release cabin door':
        this.detach('doors');
        break;
      case 'District stress test': {
        const p = this.model.position;
        const bases = this.env.sections
          .filter((s) => s.level === 0 && !this.broken.has(s.id))
          .sort((a, b) => (a.x - p.x) ** 2 + (a.z - p.z) ** 2 - (b.x - p.x) ** 2 - (b.z - p.z) ** 2)
          .slice(0, 16);
        this.districtQueue = bases.map((section, i) => ({ section, at: this.t + 0.22 * i }));
        if (bases.length) {
          const center = bases
            .reduce((v, s) => v.add(V(s.x, 0, s.z)), V())
            .multiplyScalar(1 / bases.length);
          this.camIndex = 4;
          this.camera.position.copy(center).add(V(170, 108, 185));
          this.camera.lookAt(center.clone().add(V(0, 17, 0)));
          const angle = new T.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
          this.freePitch = angle.x;
          this.freeYaw = angle.y;
        }
        break;
      }
      case 'Structure stress test': {
        const p = this.model.position;
        const sec = this.env.sections
          .filter((s) => s.level === 0 && !this.broken.has(s.id))
          .sort((a, b) => (a.x - p.x) ** 2 + (a.z - p.z) ** 2 - (b.x - p.x) ** 2 - (b.z - p.z) ** 2)[0];
        if (sec) {
          this.breakSection(sec, V(2 + this.rng() * 2, 0.8, -1));
          this.focusStructure(sec);
        } else this.notice('No intact test structures remain');
        break;
      }
      case 'Restore systems':
        this.enginePower = 1;
        this.hydraulic = 1;
        this.electrical = false;
        this.navFault = false;
        this.gust = 0;
        break;
      default:
        return;
    }
    this.audio?.effect('alert');
    this.notice(
      event === 'Restore systems'
        ? 'Systems restored · separated components require a restart'
        : event + ' activated',
    );
    this.publish();
  }
  focusStructure(s: Section) {
    this.camIndex = 4;
    this.camera.position.set(s.x + s.w * 1.7 + 19, s.y + s.h * 1.8 + 13, s.z + s.d * 1.35 + 24);
    this.camera.lookAt(s.x, s.y + s.h, s.z);
    const eu = new T.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.freePitch = eu.x;
    this.freeYaw = eu.y;
  }
  updateCamera(dt: number) {
    if (!this.model) return;
    const interior = this.camIndex === 1 || this.camIndex === 5;
    const missing = (name: string) =>
      this.lost.has(name) ||
      !!this.record?.parts.some((d) => d.kind === 'part' && d.name === name && d.born <= this.t);
    const glass = this.model.getObjectByName('windshield');
    if (glass) glass.visible = !interior && !missing('windshield');
    if (this.instruments) {
      this.instruments.group.visible = interior && !missing('cockpit');
      if (interior) {
        const front = V(0, 0, -1).applyQuaternion(this.model.quaternion),
          right = V(1, 0, 0).applyQuaternion(this.model.quaternion),
          pos = this.model.position;
        this.instruments.update(
          this.t,
          this.speed,
          Math.max(0, pos.y - heightAt(pos.x, pos.z, this.c.map, this.c.seed)),
          Math.asin(clamp(right.y, -1, 1)),
          Math.asin(clamp(front.y, -1, 1)),
          (rad(Math.atan2(front.x, -front.z)) + 360) % 360,
          this.electrical,
          [
            missing('engine_l') ? 0 : this.throttle * this.enginePower,
            missing('engine_r') ? 0 : this.throttle * this.enginePower,
            this.hydraulic,
          ],
        );
      }
    }
    const p = this.model.position,
      q = this.model.quaternion,
      sz = this.plane.length;
    const look = p.clone(),
      target = V();
    let smooth = 1 - Math.exp(-dt * 5.8);
    if (!this.cameraPrimed) smooth = 1;
    let rollUp = V(0, 1, 0);
    if (this.camIndex === 0) {
      const back = V(0, 0, 1).applyQuaternion(q);
      back.y = clamp(back.y, -0.16, 0.35);
      back.normalize();
      target.copy(p).addScaledVector(back, sz * 1.56 * this.orbitDist);
      target.y += sz * 0.44 * this.orbitDist;
      look.addScaledVector(back, -sz * 0.53);
      look.y += sz * 0.025;
    } else if (this.camIndex === 1 || this.camIndex === 5) {
      const cabin = this.camIndex === 5;
      target
        .set(
          cabin ? -0.52 * this.plane.radius : 0,
          cabin ? 0.18 * this.plane.radius : 0.28 * this.plane.radius,
          sz * (cabin ? 0.1 : -0.36),
        )
        .applyQuaternion(q)
        .add(p);
      this.camera.position.copy(target);
      this.camera.quaternion.copy(q);
      this.camera.rotateX(cabin ? -0.02 : -0.032);
      this.cameraPrimed = true;
      return;
    } else if (this.camIndex === 2) {
      const d = sz * 1.8 * this.orbitDist;
      target
        .copy(p)
        .add(
          V(
            Math.sin(this.orbitX) * Math.cos(this.orbitY) * d,
            Math.sin(this.orbitY) * d,
            Math.cos(this.orbitX) * Math.cos(this.orbitY) * d,
          ),
        );
    } else if (this.camIndex === 3) {
      target.set(Math.round(p.x / 300) * 300 + 110, 0, Math.round(p.z / 400) * 400 - 110);
      target.y = heightAt(target.x, target.z, this.c.map, this.c.seed) + 8;
    } else {
      this.camera.quaternion.setFromEuler(new T.Euler(this.freePitch, this.freeYaw, 0, 'YXZ'));
      const speed = dt * (this.keys.has('ShiftLeft') ? 160 : 53);
      const f = V(0, 0, -1).applyQuaternion(this.camera.quaternion),
        r = V(1, 0, 0).applyQuaternion(this.camera.quaternion);
      this.camera.position
        .addScaledVector(f, (+this.keys.has('KeyW') - +this.keys.has('KeyS')) * speed)
        .addScaledVector(r, (+this.keys.has('KeyD') - +this.keys.has('KeyA')) * speed);
      this.camera.position.y += (+this.keys.has('KeyE') - +this.keys.has('KeyQ')) * speed;
      return;
    }
    target.y = Math.max(target.y, heightAt(target.x, target.z, this.c.map, this.c.seed) + 1.3);
    this.camera.position.lerp(target, smooth);
    this.camera.up.copy(rollUp);
    this.camera.lookAt(look);
    this.cameraPrimed = true;
  }
  sample() {
    this.lastSample = this.t;
    this.frames.push({
      t: Math.round(this.t * 1000) / 1000,
      p: pack(this.model.position, this.model.quaternion),
      v: Math.round(this.speed * 10) / 10,
      hp: Math.round(this.hp),
      gear: this.gear,
      throttle: Math.round(this.throttle * 100),
      gate: this.gate,
      d: this.debris.map((v) => [v.id, ...pack(v.obj.position, v.obj.quaternion)]),
    });
    while (this.frames.length > 720 || this.frames[0].t < this.t - 90) this.frames.shift();
  }
  recording(name: string, owner: string): Recording {
    if (!this.record) this.sample();
    const ids = new Set(this.frames.flatMap((f) => f.d.map((d) => d[0])));
    return {
      version: 1,
      id: uniqueId(),
      name,
      created: new Date().toISOString(),
      config: { ...this.c },
      duration: this.t,
      frames: this.frames.map((f) => ({ ...f })),
      parts: this.specs.filter((s) => ids.has(s.id) || s.kind === 'part'),
      breaks: this.env.sections
        .filter((s) => Number.isFinite(s.brokenAt))
        .map((s) => [s.id, s.brokenAt]),
      owner,
    };
  }
  createReplayPiece(spec: DebrisSpec) {
    let obj: T.Object3D;
    if (spec.kind === 'part') {
      obj = this.model.getObjectByName(spec.name)?.clone(true) || new T.Group();
    } else {
      obj = new T.Mesh(
        new T.BoxGeometry(1, 1, 1),
        this.env.materials[spec.name] || this.env.materials.concrete,
      );
      obj.scale.fromArray(spec.scale);
    }
    obj.visible = false;
    this.scene.add(obj);
    this.debris.push({ id: spec.id, obj, spec, rest: true, vel: V(), spin: V(), half: 0 });
  }
  seek(t: number) {
    if (!this.record) return;
    this.replayTime = clamp(t, this.frames[0].t, this.frames.at(-1)!.t);
    this.applyReplay();
    this.publish();
  }
  applyReplay() {
    if (!this.frames.length) return;
    let hi = 0,
      lo = this.frames.length - 1;
    while (hi < lo) {
      const m = Math.floor((hi + lo) / 2);
      if (this.frames[m].t < this.replayTime) hi = m + 1;
      else lo = m;
    }
    const b = this.frames[hi],
      a = this.frames[Math.max(0, hi - 1)],
      f = clamp((this.replayTime - a.t) / Math.max(0.001, b.t - a.t), 0, 1);
    const pose = (obj: T.Object3D, aa: readonly number[], bb: readonly number[], o = 0) => {
      obj.position.set(
        (aa[o] + (bb[o] - aa[o]) * f) / 100,
        (aa[o + 1] + (bb[o + 1] - aa[o + 1]) * f) / 100,
        (aa[o + 2] + (bb[o + 2] - aa[o + 2]) * f) / 100,
      );
      obj.quaternion
        .set(aa[o + 3] / 1e4, aa[o + 4] / 1e4, aa[o + 5] / 1e4, aa[o + 6] / 1e4)
        .normalize()
        .slerp(
          Q()
            .set(bb[o + 3] / 1e4, bb[o + 4] / 1e4, bb[o + 5] / 1e4, bb[o + 6] / 1e4)
            .normalize(),
          f,
        );
    };
    pose(this.model, a.p, b.p);
    this.t = this.replayTime;
    this.speed = T.MathUtils.lerp(a.v, b.v, f);
    this.hp = a.hp;
    this.gear = a.gear;
    this.throttle = a.throttle / 100;
    this.gate = a.gate;
    this.model.getObjectByName('gear')!.visible = this.gear;
    this.env.gates.forEach((g, i) => (g.visible = i >= this.gate));
    for (const s of this.env.sections) {
      if (s.brokenAt < Infinity) {
        const broken = this.replayTime >= s.brokenAt;
        this.env.setSection(s, !broken);
        if (broken) this.broken.add(s.id);
        else this.broken.delete(s.id);
      }
    }
    const am = new Map(a.d.map((d) => [d[0], d])),
      bm = new Map(b.d.map((d) => [d[0], d]));
    for (const d of this.debris) {
      const ad = am.get(d.id),
        bd = bm.get(d.id);
      d.obj.visible = !!ad && this.t >= d.spec.born;
      if (ad) pose(d.obj, ad, bd || ad, 1);
      if (d.spec.kind === 'part') {
        const src = this.model.getObjectByName(d.spec.name);
        if (src) src.visible = this.t < d.spec.born && (d.spec.name !== 'gear' || this.gear);
      }
    }
  }
  publish() {
    if (!this.model) return;
    const f = V(0, 0, -1).applyQuaternion(this.model.quaternion),
      r = V(1, 0, 0).applyQuaternion(this.model.quaternion),
      p = this.model.position;
    this.onHUD({
      t: this.t,
      speed: this.speed,
      alt: Math.max(0, p.y - heightAt(p.x, p.z, this.c.map, this.c.seed)),
      heading: (rad(Math.atan2(f.x, -f.z)) + 360) % 360,
      bank: rad(Math.asin(clamp(r.y, -1, 1))),
      pitch: rad(Math.asin(clamp(f.y, -1, 1))),
      hp: this.hp,
      throttle: Math.round(this.throttle * 100),
      camera: cameras[this.camIndex],
      gear: this.gear,
      paused: this.paused,
      rate: this.rate,
      status: this.record
        ? 'Replay'
        : this.inWater
          ? 'On water'
          : this.hp < 30
            ? 'Critical damage'
            : this.hp < 88
              ? 'Airframe damaged'
              : this.enginePower < 1
                ? 'Engine fault'
                : this.grounded
                  ? 'On ground'
                  : this.c.mode === 'Checkpoint challenge' && this.gate >= 9
                    ? 'Circuit complete'
                    : 'In flight',
      debris: this.debris.filter((d) => d.obj.visible).length,
      sections: this.broken.size,
      bodies: this.debris.filter((d) => d.body).length,
      fps: Math.round(this.fps),
      gate: this.gate,
      electrical: this.electrical,
      navFault: this.navFault,
      replay: !!this.record,
      start: this.frames[0]?.t || 0,
      end: this.frames.at(-1)?.t || 0,
      playing: this.playing,
      pos: p.toArray(),
    });
  }
  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObs?.disconnect();
    this.cleanups.forEach((f) => f());
    this.audio?.dispose();
    this.keys.clear();
    if (this.env || !this.world) this.release();
  }
  release() {
    if (this.released) return;
    this.released = true;
    const mats = new Set<T.Material>(),
      geoms = new Set<T.BufferGeometry>(),
      textures = new Set<T.Texture>();
    this.scene.traverse((o) => {
      const m = o as T.Mesh;
      if (m.geometry) geoms.add(m.geometry);
      if (m.material) {
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mats.add(mat);
      }
    });
    mats.forEach((m) => {
      Object.values(m).forEach((v) => {
        if (v instanceof T.Texture) textures.add(v);
      });
      m.dispose();
    });
    textures.forEach((t) => t.dispose());
    geoms.forEach((g) => g.dispose());
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.world?.free();
    this.events?.free();
  }
}
