'use client';

import { useEffect, useRef, useState } from 'react';
import type { Muscle, MuscleScore } from '@/lib/ranks';
import { BodyMap } from './BodyMap';

interface Props {
  scores: MuscleScore[];
  selected: Muscle | null;
  onSelect: (m: Muscle) => void;
}

const NEUTRAL = new Set(['body', 'bones', 'head']);

/**
 * Rotatable 3D muscle figure (Z-Anatomy, CC BY-SA 4.0). Drag to turn it, tap a
 * muscle to select it. Falls back to the flat figure if WebGL is unavailable.
 */
export function Body3D({ scores, selected, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ paint: (s: MuscleScore[], sel: Muscle | null) => void; turn: (deg: number) => void } | null>(null);
  const pick = useRef(onSelect);
  pick.current = onSelect;
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      try {
        const THREE = await import('three');
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js');
        const el = host.current;
        if (!el || disposed) return;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
        el.appendChild(renderer.domElement);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(24, 1, 0.01, 100);
        scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a84, 1.5));
        const key = new THREE.DirectionalLight(0xffffff, 2.6);
        key.position.set(2, 3, 4);
        camera.add(key);
        scene.add(camera);

        const draco = new DRACOLoader().setDecoderPath('/draco/').setDecoderConfig({ type: 'wasm' });
        const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync('/models/body.glb');
        draco.dispose();
        if (disposed) { renderer.dispose(); return; }

        const root = gltf.scene;
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        root.position.sub(center);
        const pivot = new THREE.Group();
        pivot.add(root);
        scene.add(pivot);
        const dist = (size.y / 2) / Math.tan((camera.fov * Math.PI) / 360) * 1.08;
        camera.position.set(0, 0, dist);

        const css = getComputedStyle(el);
        const muscleGrey = new THREE.Color(css.getPropertyValue('--bm-muscle').trim() || '#e9e9e6');
        const bodyGrey = new THREE.Color(css.getPropertyValue('--bm-body').trim() || '#bdbdba');
        const meshes = new Map<string, InstanceType<typeof THREE.Mesh>>();
        root.traverse((o) => {
          const m = o as InstanceType<typeof THREE.Mesh>;
          if (!m.isMesh) return;
          m.material = new THREE.MeshStandardMaterial({ color: NEUTRAL.has(m.name) ? bodyGrey : muscleGrey, roughness: 0.8, metalness: 0, flatShading: false });
          meshes.set(m.name, m);
        });

        let frame = 0;
        const render = () => { frame = 0; renderer.render(scene, camera); };
        const invalidate = () => { if (!frame) frame = requestAnimationFrame(render); };

        const paint = (list: MuscleScore[], sel: Muscle | null) => {
          const by = new Map(list.map((s) => [s.muscle, s]));
          meshes.forEach((m, name) => {
            if (NEUTRAL.has(name)) return;
            const mat = m.material as InstanceType<typeof THREE.MeshStandardMaterial>;
            const s = by.get(name as Muscle);
            mat.color.set(s ? s.rank.color : muscleGrey);
            mat.emissive.set(name === sel ? 0x333333 : 0x000000);
          });
          invalidate();
        };
        const turn = (deg: number) => { pivot.rotation.y = (deg * Math.PI) / 180; invalidate(); };

        const resize = () => {
          const w = el.clientWidth, h = el.clientHeight;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          invalidate();
        };
        const ro = new ResizeObserver(resize);
        ro.observe(el);
        resize();

        // Drag turns the figure around its vertical axis; a tap selects a muscle.
        const ray = new THREE.Raycaster();
        let down: { x: number; y: number; rot: number } | null = null;
        let moved = false;
        const cv = renderer.domElement;
        const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, rot: pivot.rotation.y }; moved = false; cv.setPointerCapture(e.pointerId); };
        const onMove = (e: PointerEvent) => {
          if (!down) return;
          const dx = e.clientX - down.x;
          if (Math.abs(dx) > 4) moved = true;
          pivot.rotation.y = down.rot + dx * 0.012;
          invalidate();
        };
        const onUp = (e: PointerEvent) => {
          if (down && !moved) {
            const r = cv.getBoundingClientRect();
            ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
            const hit = ray.intersectObjects([...meshes.values()], false)[0];
            if (hit && !NEUTRAL.has(hit.object.name)) pick.current(hit.object.name as Muscle);
          }
          down = null;
        };
        cv.addEventListener('pointerdown', onDown);
        cv.addEventListener('pointermove', onMove);
        cv.addEventListener('pointerup', onUp);
        cv.addEventListener('pointercancel', () => { down = null; });

        api.current = { paint, turn };
        setState('ready');
        cleanup = () => {
          ro.disconnect();
          cancelAnimationFrame(frame);
          meshes.forEach((m) => { m.geometry.dispose(); (m.material as InstanceType<typeof THREE.Material>).dispose(); });
          renderer.dispose();
          cv.remove();
        };
      } catch {
        if (!disposed) setState('failed');
      }
    })();
    return () => { disposed = true; api.current = null; cleanup(); };
  }, []);

  useEffect(() => { api.current?.paint(scores, selected); }, [scores, selected, state]);

  if (state === 'failed') return <BodyMap scores={scores} selected={selected} onSelect={onSelect} />;
  return (
    <div className="body3d">
      <div ref={host} className="body3d-view" aria-label="3D muscle figure. Drag to turn, tap a muscle." role="img" />
      {state === 'loading' && <p className="body3d-msg small muted">Loading 3D body…</p>}
      <div className="body3d-turns">
        <button type="button" className="chip" onClick={() => api.current?.turn(0)}>Front</button>
        <button type="button" className="chip" onClick={() => api.current?.turn(180)}>Back</button>
      </div>
      <p className="body3d-credit">3D model: Z-Anatomy, from BodyParts3D (DBCLS), CC BY-SA 4.0</p>
    </div>
  );
}
