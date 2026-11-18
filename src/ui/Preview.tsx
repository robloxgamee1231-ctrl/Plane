import { assetUrl } from '../hosting';
import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Rotate3D, LoaderCircle } from 'lucide-react';
import type { Plane } from '../data';
// One WebGL context per open hangar. Render on demand rather than redrawing an idle model.
export default function Preview({ plane }: { plane: Plane }) {
  const host = useRef<HTMLDivElement>(null),
    change = useRef<((p: Plane) => void) | null>(null),
    first = useRef(plane);
  const [error, setError] = useState(false),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const h = host.current!;
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    } catch {
      setError(true);
      setLoading(false);
      return;
    }
    let stopped = false,
      raf = 0,
      request = 0,
      model: T.Group | undefined,
      p = first.current,
      spin = -0.78,
      tilt = 0.38,
      drag = false,
      px = 0,
      py = 0;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.3));
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.setClearColor(0xe2e5e1);
    h.appendChild(renderer.domElement);
    const scene = new T.Scene(),
      camera = new T.PerspectiveCamera(34, 1, 0.1, 1000);
    scene.add(new T.HemisphereLight(0xf1f6ff, 0x979f8e, 1.65));
    const sun = new T.DirectionalLight(0xffe3c1, 2.2);
    sun.position.set(-30, 50, -35);
    scene.add(sun);
    const fill = new T.DirectionalLight(0xc8e0f8, 0.85);
    fill.position.set(10, 15, 35);
    scene.add(fill);
    const grid = new T.GridHelper(180, 40, 0xbfc8be, 0xd1d9d1);
    scene.add(grid);
    const loader = new GLTFLoader();
    const draw = () => {
      if (stopped) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (stopped) return;
        const d = p.length * (camera.aspect > 2 ? 1.32 : 1.7);
        camera.position.set(
          Math.sin(spin) * Math.cos(tilt) * d,
          Math.sin(tilt) * d,
          -Math.cos(spin) * Math.cos(tilt) * d,
        );
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
      });
    };
    const dispose = (obj: T.Object3D) =>
      obj.traverse((o) => {
        if (o instanceof T.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
    let currentId = '';
    change.current = (next: Plane) => {
      if (currentId === next.id) return;
      currentId = next.id;
      const id = ++request;
      setLoading(true);
      setError(false);
      loader.load(
        assetUrl(`models/${next.id}.glb`),
        (g) => {
          if (stopped || id !== request) {
            dispose(g.scene);
            return;
          }
          if (model) {
            scene.remove(model);
            dispose(model);
          }
          model = g.scene;
          p = next;
          grid.position.y = -p.radius * 2;
          const gear = model.getObjectByName('gear');
          if (gear) gear.visible = false;
          scene.add(model);
          draw();
          setLoading(false);
        },
        undefined,
        () => {
          if (!stopped) {
            setError(true);
            setLoading(false);
          }
        },
      );
    };
    const down = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      drag = true;
      h.setPointerCapture(e.pointerId);
    };
    const up = () => (drag = false);
    const move = (e: PointerEvent) => {
      if (drag) {
        spin -= (e.clientX - px) * 0.009;
        tilt = T.MathUtils.clamp(tilt + (e.clientY - py) * 0.006, 0.04, 1.4);
        px = e.clientX;
        py = e.clientY;
        draw();
      }
    };
    h.addEventListener('pointerdown', down);
    h.addEventListener('pointerup', up);
    h.addEventListener('pointermove', move);
    const resize = () => {
      renderer.setSize(h.clientWidth, h.clientHeight);
      camera.aspect = h.clientWidth / Math.max(1, h.clientHeight);
      camera.updateProjectionMatrix();
      draw();
    };
    const obs = new ResizeObserver(resize);
    obs.observe(h);
    resize();
    change.current(first.current);
    return () => {
      stopped = true;
      change.current = null;
      cancelAnimationFrame(raf);
      obs.disconnect();
      h.removeEventListener('pointerdown', down);
      h.removeEventListener('pointerup', up);
      h.removeEventListener('pointermove', move);
      dispose(scene);
      grid.geometry.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);
  useEffect(() => change.current?.(plane), [plane]);
  return (
    <div ref={host} className="model-preview" aria-label={'Interactive 3D preview of ' + plane.name}>
      {error ? (
        <img src={assetUrl(`art/fleet/${plane.id}.jpg`)} alt={plane.name} />
      ) : (
        <span>
          {loading ? <LoaderCircle size={12} className="spin" /> : <Rotate3D size={13} />}{' '}
          {loading ? 'LOADING AIRFRAME' : 'DRAG TO ORBIT'}
        </span>
      )}
    </div>
  );
}
