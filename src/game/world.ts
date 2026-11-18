import { assetUrl } from '../hosting';
import * as T from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Config, Settings } from '../data';
export function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = T.MathUtils.clamp,
  lerp = T.MathUtils.lerp;
function hash(x: number, z: number) {
  const v = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return v - Math.floor(v);
}
function noise(x: number, z: number) {
  const a = Math.floor(x),
    b = Math.floor(z);
  let u = x - a,
    v = z - b;
  u = u * u * (3 - 2 * u);
  v = v * v * (3 - 2 * v);
  return lerp(lerp(hash(a, b), hash(a + 1, b), u), lerp(hash(a, b + 1), hash(a + 1, b + 1), u), v);
}
export const waterAt = (x: number, z: number, id: string) =>
  id === 'coast'
    ? x > 230 + Math.sin(z * 0.002) * 90
    : id === 'metro' && Math.abs(x + 380 - Math.sin(z * 0.0019) * 32) < 74;
export const heightAt = (x: number, z: number, id: string, seed = 1) => {
  const n = noise(x * 0.0012 + (seed % 73), z * 0.0014),
    n2 = noise(x * 0.004, z * 0.004),
    n3 = noise(x * 0.013, z * 0.011);
  const edge = clamp((Math.max(Math.abs(x) * 1.22, Math.abs(z) * 0.69) - 950) / 860, 0, 1);
  if (id === 'metro' && Math.abs(x + 380 - Math.sin(z * 0.0019) * 32) < 90)
    return -Math.min(20, (90 - Math.abs(x + 380 - Math.sin(z * 0.0019) * 32)) * 0.45);
  if (id === 'coast' && x > 210 + Math.sin(z * 0.002) * 90)
    return -Math.min(36, (x - 210 - Math.sin(z * 0.002) * 90) * 0.13);
  if (id === 'alpine') {
    const ridge = clamp((Math.abs(x + Math.sin(z * 0.0014) * 140) - 280) / 1030, 0, 1);
    return ridge * ridge * (180 + 820 * n + 180 * n2 + 48 * n3) + edge * 100 * n;
  }
  if (id === 'desert')
    return edge * (55 + Math.floor(n * 9) * 22 + 95 * n2) + Math.max(0, Math.hypot(x, z) - 1000) * 0.007;
  return edge * (45 + 340 * n + 100 * n2 + 22 * n3);
};
export type Section = {
  id: number;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  level: number;
  column: string;
  kind: string;
  integrity: number;
  collider: RAPIER.Collider | null;
  batch: T.InstancedMesh;
  index: number;
  brokenAt: number;
  matrix: T.Matrix4;
};
export type WorldData = {
  ground: RAPIER.RigidBody;
  sections: Section[];
  byCollider: Map<number, Section>;
  columns: Map<string, Section[]>;
  materials: Record<string, T.Material | T.Material[]>;
  clouds: T.Group;
  sun: T.DirectionalLight;
  water: T.Mesh | null;
  gates: T.Mesh[];
  sky: T.Mesh;
  setSection: (s: Section, visible: boolean) => void;
};
const sharedBox = new T.BoxGeometry(1, 1, 1);
export function facade(kind: string) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  const rng = random(kind.charCodeAt(0) * 125);
  const dark = kind === 'future',
    hang = kind === 'hangar',
    house = kind === 'home';
  g.fillStyle = dark ? '#354756' : house ? '#c4bda7' : hang ? '#b0b5ad' : '#aeb9bd';
  g.fillRect(0, 0, 256, 128);
  const rows = hang ? 1 : 3,
    cols = house ? 4 : hang ? 9 : 8;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const x = 4 + i * (250 / cols),
        y = hang ? 22 : 7 + j * 38;
      g.fillStyle = dark
        ? rng() > 0.52
          ? '#8ddcde'
          : '#213c53'
        : house
          ? '#526c72'
          : rng() > 0.5
            ? '#72919b'
            : '#627c88';
      g.fillRect(x, y, 250 / cols - (house ? 9 : 4), hang ? 28 : house ? 22 : 25);
      g.fillStyle = dark ? '#c6e0c3' : '#a1b6b8';
      g.fillRect(x, y, 250 / cols - (house ? 9 : 4), 3);
      if (!hang) {
        g.fillStyle = '#bac2bf';
        g.fillRect(x + 12, y, 1, 25);
      }
    }
  if (hang) {
    for (let i = 0; i < 256; i += 6) {
      g.fillStyle = '#929993';
      g.fillRect(i, 66, 1, 55);
    }
  }
  g.fillStyle = dark ? '#779b9e' : '#ddd9cd';
  g.fillRect(0, 0, 256, 4);
  g.fillStyle = dark ? '#162b3a' : '#919b9b';
  g.fillRect(0, 122, 256, 6);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
export async function buildWorld(
  scene: T.Scene,
  world: RAPIER.World,
  c: Config,
  quality: Settings['quality'],
): Promise<WorldData> {
  const rng = random(c.seed),
    terrainRng = random(c.seed ^ 0x3f59),
    dark = c.time === 'Twilight' || c.map === 'future',
    gold = c.time === 'Golden hour',
    storm = c.weather === 'storm',
    h = (x: number, z: number) => heightAt(x, z, c.map, c.seed),
    low = quality === 'Low';
  const horizon = dark ? 0xc7a49b : storm ? 0xa7b7ba : gold ? 0xf0d5bc : 0xdbe6df,
    skyTop = dark ? 0x293758 : storm ? 0x617584 : gold ? 0x859fb6 : 0x4688b8;
  scene.background = new T.Color(horizon);
  scene.fog = new T.FogExp2(horizon, storm ? 0.00052 : dark ? 0.0003 : 0.000165);
  const sky = new T.Mesh(
    new T.SphereGeometry(8500, 32, 16),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new T.Color(skyTop) },
        bottomColor: { value: new T.Color(horizon) },
        sunDir: { value: new T.Vector3(-0.7, gold ? 0.24 : 0.64, -0.45).normalize() },
      },
      vertexShader:
        'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        'varying vec3 vDir;uniform vec3 topColor;uniform vec3 bottomColor;uniform vec3 sunDir;void main(){vec3 d=normalize(vDir);float hh=pow(max(0.,d.y),.43);float s=max(0.,dot(d,sunDir));vec3 col=mix(bottomColor,topColor,hh);col+=vec3(1.,.71,.42)*pow(s,90.)*.55+vec3(1.,.88,.62)*smoothstep(.9995,.99983,s)*1.7;gl_FragColor=vec4(col,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
    }),
  );
  scene.add(sky);
  scene.add(
    new T.HemisphereLight(dark ? 0xb0c9e4 : 0xdce8f1, dark ? 0x49515d : 0x9c9e82, dark ? 1.45 : 1.53),
  );
  const sun = new T.DirectionalLight(gold ? 0xffcf9d : dark ? 0xf2c2a8 : 0xffe9c7, storm ? 1.05 : 2.17);
  sun.position.set(-400, 650, -270);
  sun.castShadow = !low;
  sun.shadow.mapSize.setScalar(quality === 'Ultra' ? 2048 : 1024);
  Object.assign(sun.shadow.camera, {
    left: -115,
    right: 115,
    top: 115,
    bottom: -115,
    near: 0.5,
    far: 1500,
  });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.13;
  scene.add(sun, sun.target);
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const terrain = new T.PlaneGeometry(9000, 9000, low ? 100 : 160, low ? 100 : 160);
  terrain.rotateX(-Math.PI / 2);
  const pos = terrain.attributes.position,
    colors: number[] = [];
  const col = new T.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      z = pos.getZ(i),
      y = h(x, z);
    pos.setY(i, y);
    let color =
      c.map === 'desert'
        ? y > 120
          ? '#a57555'
          : '#c1a273'
        : c.map === 'future'
          ? '#697d74'
          : c.map === 'alpine'
            ? y > 560
              ? '#e3e6e2'
              : y > 370
                ? '#909b95'
                : y > 175
                  ? '#5a725c'
                  : '#70865b'
            : '#849767';
    if (c.map === 'coast' && x > 145 + Math.sin(z * 0.002) * 90) color = '#d9c6a0';
    col.set(color);
    col.multiplyScalar(0.87 + 0.2 * noise(x * 0.017, z * 0.016) + 0.08 * terrainRng());
    colors.push(col.r, col.g, col.b);
  }
  terrain.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  terrain.computeVertexNormals();
  const terrainDetail = new T.TextureLoader().load(
    assetUrl(`textures/${c.map === 'desert' ? 'sand' : 'grass'}.webp`),
  );
  terrainDetail.colorSpace = T.SRGBColorSpace;
  terrainDetail.wrapS = terrainDetail.wrapT = T.RepeatWrapping;
  terrainDetail.repeat.set(260, 260);
  terrainDetail.anisotropy = 4;
  const land = new T.Mesh(
    terrain,
    new T.MeshStandardMaterial({
      map: terrainDetail,
      vertexColors: true,
      roughness: 0.98,
      flatShading: true,
    }),
  );
  land.receiveShadow = true;
  scene.add(land);
  world.createCollider(
    RAPIER.ColliderDesc.trimesh(
      new Float32Array(pos.array),
      new Uint32Array(terrain.index!.array),
    ).setFriction(0.78),
    ground,
  );
  world.createCollider(RAPIER.ColliderDesc.cuboid(4750, 1, 4750).setTranslation(0, -40, 0), ground);
  const batches = new Map<string, { color: number; boxes: { p: number[]; s: number[]; r: number }[] }>();
  function box(x: number, y: number, z: number, w: number, hh: number, d: number, color: number, r = 0) {
    const k = 'b' + color;
    if (!batches.has(k)) batches.set(k, { color, boxes: [] });
    batches.get(k)!.boxes.push({ p: [x, y, z], s: [w, hh, d], r });
  }
  const road = dark ? 0x39464b : 0x505a58,
    paint = 0xe5e3ce;
  // Runways, chevrons, threshold stripes, taxiways, service aprons and lights.
  box(0, 0.065, 0, 54, 0.13, 1760, road);
  box(87, 0.041, 0, 19, 0.08, 1710, 0x6c736c);
  for (let z = -820; z < 840; z += 45) {
    box(0, 0.165, z, 1.3, 0.02, 23, paint);
    for (const x of [-26.3, 26.3]) box(x, 0.19, z, 0.45, 0.35, 0.65, 0xffe1a3);
  }
  for (let i = 0; i < 95; i++) {
    const z = (rng() > 0.5 ? 1 : -1) * (490 + rng() * 260);
    box(
      (rng() - 0.5) * 13,
      0.153,
      z,
      0.15 + rng() * 0.35,
      0.006,
      5 + rng() * 24,
      0x4a514c,
      rng() * 0.025,
    );
  }
  for (const z of [-790, 780])
    for (let x = -20; x <= 20; x += 5.6) box(x, 0.17, z, 2.7, 0.02, 25, paint);
  for (const z of [-660, -220, 260, 630]) {
    box(62, 0.095, z, 125, 0.1, 20, 0x767b70);
    box(88, 0.16, z, 1, 0.02, 31, 0xeac068);
  }
  for (const x of [-24.5, 24.5]) box(x, 0.146, 0, 0.65, 0.018, 1715, paint);
  // Runway designation painted into the surface, not a floating UI label.
  const numberCanvas = document.createElement('canvas');
  numberCanvas.width = 256;
  numberCanvas.height = 256;
  const ng = numberCanvas.getContext('2d')!;
  ng.fillStyle = '#e4e3cf';
  ng.font = 'bold 154px monospace';
  ng.textAlign = 'center';
  ng.fillText('36', 128, 178);
  const numberTex = new T.CanvasTexture(numberCanvas);
  numberTex.colorSpace = T.SRGBColorSpace;
  const marking = new T.Mesh(
    new T.PlaneGeometry(28, 39),
    new T.MeshBasicMaterial({ map: numberTex, transparent: true, depthWrite: false }),
  );
  marking.rotation.x = -Math.PI / 2;
  marking.position.set(0, 0.2, 721);
  scene.add(marking);
  type Spec = {
    x: number;
    y: number;
    z: number;
    w: number;
    h: number;
    d: number;
    level: number;
    column: string;
    kind: string;
  };
  const specs: Spec[] = [];
  function building(
    x: number,
    z: number,
    w: number,
    d: number,
    floors: number,
    fh: number,
    kind: string,
    cols = 2,
  ) {
    const id = specs.length;
    const base = h(x, z);
    for (let k = 0; k < cols; k++) {
      const sx = x - w * 0.5 + ((k + 0.5) * w) / cols,
        column = id + '-' + k;
      for (let j = 0; j < floors; j++)
        specs.push({
          x: sx,
          y: base + (j + 0.5) * fh,
          z,
          w: w / cols,
          h: fh,
          d,
          level: j,
          column,
          kind,
        });
      if (kind === 'home' && floors < 4) {
        specs.push({
          x: sx,
          y: base + floors * fh + 1.55,
          z,
          w: w / cols + 0.65,
          h: 3.1,
          d: d + 1.1,
          level: floors,
          column,
          kind: 'roof',
        });
      } else if (kind === 'glass' || kind === 'future') {
        specs.push({
          x: sx,
          y: base + floors * fh + 1.1,
          z,
          w: (w / cols) * 0.51,
          h: 2.2,
          d: d * 0.62,
          level: floors,
          column,
          kind: 'metal',
        });
      }
    }
  }
  let water: T.Mesh | null = null;
  if (c.map === 'metro' || c.map === 'future') {
    const future = c.map === 'future';
    for (let gx = -4; gx <= 4; gx++)
      for (let gz = -5; gz <= 5; gz++) {
        const x = gx * 98 + 210,
          z = gz * 101 - 170;
        if (Math.abs(x) < 103 || rng() > 0.87) continue;
        const w = 29 + rng() * 27,
          d = 26 + rng() * 24;
        const floors = 2 + Math.floor(rng() * (future ? 9 : 7));
        building(x, z, w, d, floors, 6 + rng() * 8, future ? 'future' : rng() > 0.25 ? 'glass' : 'home');
      }
    for (let x = -5; x <= 5; x++) box(x * 98 + 161, 0.07, -170, 14, 0.12, 1200, road);
    for (let z = -6; z <= 6; z++) box(215, 0.08, z * 101 - 219, 980, 0.12, 14, road);
    if (future) {
      for (let z = -3; z < 4; z++) {
        const zz = z * 101 - 217;
        for (let a = 0; a < 3; a++) {
          const col = 'walk-' + z + '-' + a,
            x = 168 + a * 36;
          for (let j = 0; j < 3; j++)
            specs.push({
              x,
              y: 3.2 + 6.4 * j,
              z: zz,
              w: 3.3,
              h: 6.4,
              d: 4.1,
              level: j,
              column: col,
              kind: 'metal',
            });
          specs.push({ x, y: 20, z: zz, w: 36, h: 1.65, d: 7, level: 3, column: col, kind: 'future' });
        }
      }
    } else {
      // The river and bridges are fictional game geometry. Each bridge bay is an independent support column.
      const riverGeom = new T.PlaneGeometry(162, 9000, 1, 96);
      riverGeom.rotateX(-Math.PI / 2);
      const rp = riverGeom.attributes.position;
      for (let i = 0; i < rp.count; i++)
        rp.setX(i, rp.getX(i) - 380 + Math.sin(rp.getZ(i) * 0.0019) * 32);
      water = new T.Mesh(
        riverGeom,
        new T.MeshStandardMaterial({ color: 0x5a8e93, roughness: 0.29, metalness: 0.35 }),
      );
      water.position.y = -1.8;
      scene.add(water);
      for (const zz of [-550, 90, 650])
        for (let a = 0; a < 7; a++) {
          const x = -380 + Math.sin(zz * 0.0019) * 32 + (a - 3) * 28,
            col = 'bridge-' + zz + '-' + a;
          specs.push({ x, y: -7.5, z: zz, w: 6, h: 25, d: 10, level: 0, column: col, kind: 'metal' });
          specs.push({ x, y: 5.8, z: zz, w: 28, h: 1.7, d: 16, level: 1, column: col, kind: 'bridge' });
        }
      for (let i = 0; i < 21; i++)
        building(
          -530 - rng() * 300,
          -760 + rng() * 1500,
          14 + rng() * 13,
          15 + rng() * 14,
          2,
          4,
          'home',
          1,
        );
    }
  } else if (c.map === 'airport') {
    box(157, 0.022, -40, 150, 0.06, 1030, 0x9b9f94);
    building(174, -130, 55, 135, 3, 5.2, 'glass', 3);
    building(163, 15, 42, 108, 2, 5.1, 'glass', 3);
    for (let j = 0; j < 5; j++) {
      building(232, 350 - j * 170, 60, 68, 2, 6.2, 'hangar');
      building(-146, 250 - j * 172, 42, 53, 2, 5.8, 'hangar');
    }
    building(146, 157, 11, 11, 6, 5, 'home', 1);
    specs.push({
      x: 146,
      y: 32.6,
      z: 157,
      w: 19,
      h: 5.2,
      d: 19,
      level: 6,
      column: specs[specs.length - 1].column,
      kind: 'glass',
    });
    for (let i = 0; i < 26; i++) {
      const x = -340 - rng() * 340,
        z = -780 + rng() * 1480;
      building(x, z, 12 + rng() * 7, 11 + rng() * 6, 1 + Math.floor(rng() * 2), 3.8, 'home', 1);
    }
    for (let j = 0; j < 4; j++) building(119, -191 + j * 33, 40, 7, 1, 4.1, 'glass', 2);
  } else if (c.map === 'desert') {
    for (let i = 0; i < 22; i++) {
      const x = (i % 2 ? 1 : -1) * (108 + rng() * 280),
        z = -550 + rng() * 1100;
      building(x, z, 25 + rng() * 49, 30 + rng() * 45, 1 + Math.floor(rng() * 2), 7.2, 'hangar');
    }
    box(204, 0.06, 0, 10, 0.1, 1480, road);
  } else {
    for (let i = 0; i < 34; i++) {
      const x = -125 - rng() * 390,
        z = -720 + rng() * 1250;
      building(x, z, 10 + rng() * 11, 12 + rng() * 11, 1 + Math.floor(rng() * 2), 4.1, 'home', 1);
    }
    box(-183, 0.06, 0, 9, 0.1, 1500, road);
    building(115, -335, 32, 48, 2, 5.5, 'hangar');
  }
  if (c.map === 'coast') {
    water = new T.Mesh(
      new T.PlaneGeometry(5400, 9000),
      new T.MeshStandardMaterial({
        color: 0x5f9fa6,
        metalness: 0.32,
        roughness: 0.3,
        transparent: true,
        opacity: 0.91,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(2810, -1.8, 0);
    scene.add(water);
    for (let i = 0; i < 220; i++) {
      const x = 340 + rng() * 1800,
        z = -2600 + rng() * 5200;
      box(x, -1.72, z, 4 + rng() * 42, 0.025, 0.45 + rng() * 1.5, 0x9ac6c4);
    }
  }
  // Small parcels of tinted terrain keep the valley floor legible from altitude.
  for (let i = 0; i < 150; i++) {
    const x = (rng() - 0.5) * 2300,
      z = (rng() - 0.5) * 2300;
    if (Math.abs(x) < 300 || h(x, z) > 1 || (c.map === 'coast' && x > 190)) continue;
    box(
      x,
      0.015,
      z,
      30 + rng() * 100,
      0.012,
      45 + rng() * 120,
      c.map === 'desert' ? 0xbba078 : [0x7b9065, 0x899767, 0x8d9c72, 0x859668][i % 4],
      rng() * 0.04,
    );
  }
  const matKeys = ['glass', 'hangar', 'home', 'future', 'roof', 'metal', 'bridge'];
  const materials: WorldData['materials'] = {};
  const roof = new T.MeshStandardMaterial({ color: dark ? 0x5e6a73 : 0xa9ada9, roughness: 0.9 });
  for (const k of matKeys) {
    const side = new T.MeshStandardMaterial({
      map: facade(k),
      roughness: k === 'glass' ? 0.48 : 0.77,
      metalness: k === 'future' ? 0.28 : 0.08,
      emissive: k === 'future' ? 0x375260 : 0x000000,
      emissiveIntensity: 0.32,
    });
    materials[k] = [side, side, roof, roof, side, side];
  }
  materials.bridge = new T.MeshStandardMaterial({ color: 0x626c6d, roughness: 0.86 });
  materials.roof = new T.MeshStandardMaterial({
    color: c.map === 'alpine' ? 0x746459 : 0x916d55,
    roughness: 0.94,
  });
  materials.metal = new T.MeshStandardMaterial({ color: 0x788382, roughness: 0.72, metalness: 0.22 });
  const roofGeom = new T.BufferGeometry();
  roofGeom.setAttribute(
    'position',
    new T.Float32BufferAttribute(
      [-0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0, 0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0, 0.5, 0.5],
      3,
    ),
  );
  roofGeom.setIndex([2, 1, 0, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3]);
  roofGeom.computeVertexNormals();
  materials.concrete = new T.MeshStandardMaterial({ color: 0xa6aaa1, roughness: 0.96 });
  materials.glasschip = new T.MeshStandardMaterial({ color: 0x83b4c4, metalness: 0.5, roughness: 0.22 });
  const sections: Section[] = [],
    byCollider = new Map<number, Section>(),
    columns = new Map<string, Section[]>();
  const tmp = new T.Object3D();
  for (const k of matKeys) {
    const ss = specs.filter((s) => s.kind === k);
    if (!ss.length) continue;
    const batch = new T.InstancedMesh(k === 'roof' ? roofGeom : sharedBox, materials[k], ss.length);
    batch.castShadow = true;
    batch.receiveShadow = true;
    batch.instanceMatrix.setUsage(T.DynamicDrawUsage);
    scene.add(batch);
    ss.forEach((s, i) => {
      tmp.position.set(s.x, s.y, s.z);
      tmp.scale.set(s.w - 0.05, s.h - 0.04, s.d);
      tmp.updateMatrix();
      batch.setMatrixAt(i, tmp.matrix);
      batch.setColorAt(i, new T.Color().setScalar(0.88 + rng() * 0.15));
      const collider = world.createCollider(
        RAPIER.ColliderDesc.cuboid(s.w / 2, s.h / 2, s.d / 2)
          .setTranslation(s.x, s.y, s.z)
          .setFriction(0.72)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
        ground,
      );
      const sec: Section = {
        ...s,
        integrity: 1,
        id: sections.length,
        collider,
        index: i,
        batch,
        brokenAt: Infinity,
        matrix: tmp.matrix.clone(),
      };
      sections.push(sec);
      byCollider.set(collider.handle, sec);
      if (!columns.has(s.column)) columns.set(s.column, []);
      columns.get(s.column)!.push(sec);
    });
    batch.computeBoundingSphere();
  }
  const pavement = new T.TextureLoader().load(assetUrl('textures/tarmac.webp'));
  pavement.colorSpace = T.SRGBColorSpace;
  pavement.wrapS = pavement.wrapT = T.RepeatWrapping;
  pavement.anisotropy = 4;
  for (const [, b] of batches) {
    const mat = new T.MeshStandardMaterial({ color: b.color, roughness: 0.92 });
    if (b.color === road || b.color === 0x9b9f94) {
      mat.map = pavement;
      mat.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace(
          '#include <uv_vertex>',
          '#include <uv_vertex>\n vMapUv = (instanceMatrix * vec4(position, 1.0)).xz * 0.09;',
        );
      };
    }
    const mesh = new T.InstancedMesh(sharedBox, mat, b.boxes.length);
    b.boxes.forEach((i, n) => {
      tmp.position.fromArray(i.p);
      tmp.scale.fromArray(i.s);
      tmp.rotation.set(0, i.r, 0);
      tmp.updateMatrix();
      mesh.setMatrixAt(n, tmp.matrix);
    });
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  // One instanced draw per PBR prop primitive, regardless of the number of trees or carts.
  const props = (await new GLTFLoader().loadAsync(assetUrl('models/world-props.glb'))).scene;
  const propPlaces: Record<string, T.Matrix4[]> = {};
  function place(kind: string, x: number, z: number, scale = 1, y = 0, rot = 0) {
    tmp.position.set(x, h(x, z) + y, z);
    tmp.rotation.set(0, rot, 0);
    tmp.scale.setScalar(scale);
    tmp.updateMatrix();
    (propPlaces[kind] ||= []).push(tmp.matrix.clone());
  }
  for (let i = 0; i < (low ? 420 : 1050); i++) {
    const x = (rng() - 0.5) * 3200,
      z = (rng() - 0.5) * 3900;
    if (
      waterAt(x, z, c.map) ||
      Math.abs(x) < 290 ||
      c.map === 'desert' ||
      (c.map === 'coast' && x > 140) ||
      h(x, z) > 500
    )
      continue;
    place('pine', x, z, 0.65 + rng() * 1.1, 0, rng() * 6);
  }
  if (c.map !== 'desert') {
    for (let cluster = 0; cluster < (low ? 27 : 62); cluster++) {
      const cx = (rng() > 0.5 ? 1 : -1) * (330 + rng() * 1400),
        cz = (rng() - 0.5) * 3500;
      for (let j = 0; j < 36; j++) {
        const x = cx + (rng() - 0.5) * 125,
          z = cz + (rng() - 0.5) * 165;
        if (waterAt(x, z, c.map) || h(x, z) > 480 || (c.map === 'coast' && x > 135)) continue;
        place('pine', x, z, 0.88 + rng() * 1.38, 0, rng() * 6);
      }
    }
  }
  for (let i = 0; i < 28; i++) {
    const x = 102 + rng() * 27,
      z = rng() * 1100 - 570;
    place(i % 3 ? 'cargo_crate' : 'service_cart', x, z, 1, 1, rng() * 1.7);
  }
  for (let i = 0; i < 16; i++) place('barricade', 91 + (i % 4) * 7, i * 43 - 370, 1, 0.1);
  for (let i = 0; i < 9; i++) place('bench', 127, -126 + i * 11, 1, 0.2);
  for (const [key, poses] of Object.entries(propPlaces)) {
    const obj = props.getObjectByName(key);
    if (!obj) continue;
    obj.updateMatrixWorld(true);
    const bbox = new T.Box3().setFromObject(obj);
    const offset = new T.Vector3();
    bbox.getCenter(offset);
    offset.y = bbox.min.y;
    obj.traverse((ch) => {
      if (!(ch instanceof T.Mesh)) return;
      const instance = new T.InstancedMesh(ch.geometry, ch.material, poses.length);
      const local = new T.Matrix4()
        .makeTranslation(-offset.x, -offset.y, -offset.z)
        .multiply(ch.matrixWorld);
      poses.forEach((m, i) => instance.setMatrixAt(i, m.clone().multiply(local)));
      instance.castShadow = !low;
      instance.receiveShadow = true;
      scene.add(instance);
    });
  }
  const clouds = new T.Group();
  const cloudTexture = new T.TextureLoader().load(assetUrl('textures/cumulus.webp'));
  cloudTexture.colorSpace = T.SRGBColorSpace;
  const cloudMat = new T.SpriteMaterial({
    map: cloudTexture,
    color: dark ? 0xcfb9bf : storm ? 0x82909a : 0xffffff,
    transparent: true,
    opacity: storm ? 0.85 : 0.91,
    depthWrite: false,
    fog: true,
  });
  for (let i = 0; i < (storm ? 140 : 75); i++) {
    const cl = new T.Sprite(cloudMat);
    cl.position.set((rng() - 0.5) * 8100, 500 + rng() * 850, (rng() - 0.5) * 8100);
    cl.scale.set(250 + rng() * 720, 95 + rng() * 190, 1);
    clouds.add(cl);
  }
  scene.add(clouds);
  const gates: T.Mesh[] = [];
  if (c.mode === 'Checkpoint challenge') {
    for (let i = 0; i < 9; i++) {
      const mesh = new T.Mesh(
        new T.TorusGeometry(32, 1.8, 6, 48),
        new T.MeshStandardMaterial({ color: 0xff7432, emissive: 0xc85a21, emissiveIntensity: 0.5 }),
      );
      mesh.position.set(Math.sin(i * 0.81) * 125, c.altitude + Math.sin(i * 0.7) * 28, 140 - i * 215);
      scene.add(mesh);
      gates.push(mesh);
    }
  }
  const invisible = new T.Matrix4().makeScale(0, 0, 0);
  return {
    ground,
    sections,
    byCollider,
    columns,
    materials,
    clouds,
    sun,
    water,
    gates,
    sky,
    setSection(s, visible) {
      s.batch.setMatrixAt(s.index, visible ? s.matrix : invisible);
      s.batch.instanceMatrix.needsUpdate = true;
    },
  };
}
