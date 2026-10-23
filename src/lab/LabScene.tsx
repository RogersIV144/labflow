import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Station } from './scene-data';
import { frameBounds } from './scene-camera';

export interface SceneHandle { focus: (station?: Station) => void; reset: () => void; view: (view: 'perspective'|'top') => void; }
import { material, type SceneProps as Props } from './scene-primitives';
import { buildWB } from './scene-wb';
import { buildOptics } from './scene-optics';
import type { HandsOnEvent } from './interaction-state';

export const LabScene = forwardRef<SceneHandle, Props>(function LabScene(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const current = useRef(props); current.current = props;
  const runtime = useRef<(SceneHandle & { invalidate: () => void; stepChanged: () => void }) | null>(null);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [hovered, setHovered] = useState('');
  useImperativeHandle(ref, () => ({ focus: station => runtime.current?.focus(station), reset: () => runtime.current?.reset(), view: view => runtime.current?.view(view) }), []);
  useEffect(() => { runtime.current?.stepChanged(); }, [props.stepId]);
  useEffect(() => { runtime.current?.invalidate(); setHovered(''); }, [props.action, props.running, props.exploded, props.exposure, props.alignment, props.station, props.isolated, props.handsOn]);

  useEffect(() => {
    const container = host.current!;
    let renderer: THREE.WebGLRenderer;
    setReady(false); setError(false);
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setError(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.environmentIntensity = .85;
    const camera = new THREE.PerspectiveCamera(37, 1, .1, 160);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = .12; controls.enablePan = false;
    controls.minDistance = 2.5; controls.maxDistance = 80;
    controls.minPolarAngle = .03; controls.maxPolarAngle = Math.PI * .48;
    const room = new RoomEnvironment(); const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(room, .05); scene.environment = environment.texture; room.dispose(); pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xe4edf5, 0x49515a, .8));
    const sun = new THREE.DirectionalLight(0xfff5e9, 2.5); sun.position.set(-3, 10, 8); sun.castShadow = true;
    const shadowSize = window.innerWidth > 760 ? 2048 : 1024;
    sun.shadow.mapSize.set(shadowSize, shadowSize); sun.shadow.camera.left = -10; sun.shadow.camera.right = 10; sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8; sun.shadow.normalBias = .018; sun.shadow.bias = -.00015; scene.add(sun);
    const fill = new THREE.DirectionalLight(0xc5e3f5, 1.5); fill.position.set(7, 5, -5); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xf0f6ff, .75); rim.position.set(-7, 4, -5); scene.add(rim);
    const model = props.caseId === 'jtc' ? buildOptics() : buildWB(); scene.add(model.root);
    const objectBounds = (object: THREE.Object3D) => {
      const local = object.userData.inspectionBounds;
      return local instanceof THREE.Box3 ? local.clone().applyMatrix4(object.matrixWorld) : new THREE.Box3().setFromObject(object);
    };
    const ring = new THREE.Mesh(new THREE.RingGeometry(.62, .635, 64), new THREE.MeshBasicMaterial({ color: 0x92d6ca, transparent: true, opacity: .6, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 1.108; scene.add(ring);
    const inspectionBase = new THREE.Mesh(new RoundedBoxGeometry(1, .09, 1, 2, .025), material(0x53656f, .25, .55));
    inspectionBase.receiveShadow = true; scene.add(inspectionBase);
    let view: 'perspective'|'top'|'focus'|'free' = 'perspective';
    let focusedStation = current.current.station;
    let targetCamera: THREE.Vector3 | null = null, targetLook: THREE.Vector3 | null = null;
    let frame = 0, disposed = false, lost = false, visible = true, previous = performance.now(), elapsed = 0, settleUntil = 0;
    let previousHandsOn: boolean | undefined;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const request = () => { if (!disposed && !lost && visible && !document.hidden && !frame) frame = requestAnimationFrame(animate); };
    const invalidate = () => { settleUntil = performance.now() + 1800; renderer.shadowMap.needsUpdate = true; request(); };
    const frameView = (immediate = false) => {
      if (view === 'free') return;
      controls.enableDamping = false; controls.update(); controls.enableDamping = true;
      model.root.updateMatrixWorld(true);
      const framingInstrument = view === 'focus' || view === 'top' && current.current.isolated;
      const object = framingInstrument ? model.stations[focusedStation] || model.root : model.root;
      const bounds = objectBounds(object);
      // Frame the working surface, not the large decorative floor below the bench.
      if (!framingInstrument) { bounds.min.y = .9; bounds.min.z = -2.8; bounds.max.z = 2.8; bounds.min.x = -6.7; bounds.max.x = 6.7; }
      // Instrument-provided bounds include open lids, drawers and exploded parts.
      const preferred = object.userData.viewDirection as [number, number, number] | undefined;
      const direction = view === 'top' ? new THREE.Vector3(.001, 1, .04) : view === 'focus' ? new THREE.Vector3(...(preferred || [2.8, 3.1, 5.8] as const)) : new THREE.Vector3(7, 7.8, 13);
      const fitted = frameBounds(bounds, camera.aspect, camera.fov, direction, framingInstrument ? 1.1 : 1.06);
      targetCamera = fitted.position; targetLook = fitted.target;
      if (immediate || reducedMotion.matches) { camera.position.copy(targetCamera); controls.target.copy(targetLook); targetCamera = null; targetLook = null; }
      invalidate();
    };
    const changeView = (next: 'perspective'|'top') => { view = next; current.current.onViewChange(next); frameView(); };
    runtime.current = {
      reset: () => changeView('perspective'), view: changeView,
      focus: station => { focusedStation = station || current.current.station; view = 'focus'; current.current.onViewChange(view); frameView(); },
      stepChanged: () => { focusedStation = current.current.station; if (view === 'focus') frameView(); invalidate(); },
      invalidate,
    };
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
    const hit = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      // Hidden animation props must not intercept clicks on visible instruments.
      for (const item of raycaster.intersectObject(model.root, true)) {
        let object: THREE.Object3D | null = item.object, stationId: Station | undefined, shown = true, pickThrough = false;
        let interaction: HandsOnEvent | undefined, control: 'offsetX' | 'offsetY' | 'focus' | undefined, label = '';
        while (object) {
          if (!object.visible) shown = false;
          if (object.userData.station) stationId = object.userData.station;
          if (object.userData.pickThrough) pickThrough = true;
          interaction ||= object.userData.interaction;
          control ||= object.userData.control;
          label ||= object.userData.interactionLabel || '';
          object = object.parent;
        }
        if (!shown || pickThrough) continue;
        return { station: stationId, interaction, control, label };
      }
      return undefined;
    };
    let down: { x: number; y: number; id: number } | undefined;
    let drag: { id: number; x: number; value: number; axis: 'offsetX' | 'offsetY' | 'focus' } | undefined;
    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || drag) return;
      down = { x: event.clientX, y: event.clientY, id: event.pointerId };
      const selected = current.current.handsOn ? hit(event) : undefined;
      if (selected?.control) {
        drag = { id: event.pointerId, x: event.clientX, value: current.current.handsOn!.optics[selected.control], axis: selected.control };
        controls.enabled = false; targetCamera = null; targetLook = null;
        renderer.domElement.setPointerCapture(event.pointerId);
        event.preventDefault(); event.stopImmediatePropagation();
      }
    };
    const pointerUp = (event: PointerEvent) => {
      if (drag?.id === event.pointerId) {
        drag = undefined; down = undefined; controls.enabled = true;
        if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
        event.preventDefault(); event.stopImmediatePropagation(); return;
      }
      if (down && event.pointerId === down.id && Math.hypot(event.clientX - down.x, event.clientY - down.y) < 5 && event.button === 0) {
        const selected = hit(event);
        if (current.current.handsOn && selected?.interaction) current.current.onInteract?.(selected.interaction);
        else if (selected?.station) current.current.onInspect(selected.station);
      }
      down = undefined;
    };
    const pointerCancel = () => {
      if (drag && renderer.domElement.hasPointerCapture(drag.id)) renderer.domElement.releasePointerCapture(drag.id);
      drag = undefined; down = undefined; controls.enabled = true; setHovered('');
    };
    const pointerMove = (event: PointerEvent) => {
      if (drag?.id === event.pointerId) {
        current.current.onInteract?.({ type: 'opt-adjust', axis: drag.axis, value: Math.round(Math.max(-40, Math.min(40, drag.value + (event.clientX - drag.x) / 3))) });
        event.preventDefault(); event.stopImmediatePropagation(); return;
      }
      if (!down) {
        const selected = hit(event), manual = current.current.handsOn;
        renderer.domElement.style.cursor = manual && selected?.control ? 'ew-resize' : selected?.station ? 'pointer' : 'grab';
        setHovered(manual && selected?.label ? `${selected.control ? '左右拖动 · ' : '点击 · '}${selected.label}` : '');
      }
    };
    const controlStart = () => { targetCamera = null; targetLook = null; };
    const controlChange = () => { request(); };
    const manualMove = (event: PointerEvent) => {
      if (!drag && down && Math.hypot(event.clientX - down.x, event.clientY - down.y) >= 5 && view !== 'free') { view = 'free'; current.current.onViewChange(view); }
    };
    const wheel = () => { view = 'free'; targetCamera = null; targetLook = null; current.current.onViewChange(view); };
    const contextLost = (event: Event) => { event.preventDefault(); lost = true; cancelAnimationFrame(frame); frame = 0; setError(true); };
    renderer.domElement.addEventListener('pointerdown', pointerDown, true);
    renderer.domElement.addEventListener('pointerup', pointerUp, true);
    renderer.domElement.addEventListener('pointercancel', pointerCancel);
    renderer.domElement.addEventListener('pointermove', pointerMove, true);
    renderer.domElement.addEventListener('pointerleave', pointerCancel);
    renderer.domElement.addEventListener('pointermove', manualMove);
    renderer.domElement.addEventListener('wheel', wheel, { passive: true });
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    controls.addEventListener('start', controlStart); controls.addEventListener('change', controlChange);
    const resize = () => {
      const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); frameView(true); invalidate();
    };
    const observer = new ResizeObserver(resize); observer.observe(container);
    const intersection = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) { previous = performance.now(); invalidate(); } else { cancelAnimationFrame(frame); frame = 0; }
    }); intersection.observe(container);
    const visibility = () => {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else { previous = performance.now(); invalidate(); }
    };
    document.addEventListener('visibilitychange', visibility);
    reducedMotion.addEventListener('change', invalidate);
    function animate(now: number) {
      frame = 0;
      if (disposed || lost || !visible || document.hidden) return;
      const elapsedFrame = Math.max((now - previous) / 1000, .001);
      const dt = Math.min(elapsedFrame, .1); previous = now;
      const moving = current.current.running && !reducedMotion.matches;
      if (moving) elapsed += dt;
      if (targetCamera && targetLook) {
        const blend = reducedMotion.matches ? 1 : 1 - Math.exp(-elapsedFrame * 7);
        camera.position.lerp(targetCamera, blend); controls.target.lerp(targetLook, blend);
        if (camera.position.distanceTo(targetCamera) < .005) { camera.position.copy(targetCamera); controls.target.copy(targetLook); targetCamera = null; targetLook = null; }
      }
      const damping = controls.update();
      const inspectionTarget = model.stations[focusedStation];
      for (const child of model.root.children) child.visible = !current.current.isolated || child === inspectionTarget;
      inspectionBase.visible = current.current.isolated && Boolean(inspectionTarget);
      if (inspectionBase.visible && inspectionTarget) {
        const bounds = objectBounds(inspectionTarget), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
        inspectionBase.position.set(center.x, 1.05, center.z); inspectionBase.scale.set(size.x + .65, 1, size.z + .55);
      }
      model.update({ ...current.current, running: moving }, elapsed, reducedMotion.matches ? 100 : Math.min(elapsedFrame, 1));
      if (previousHandsOn !== Boolean(current.current.handsOn)) {
        previousHandsOn = Boolean(current.current.handsOn);
        frameView(true);
      }
      const active = model.stations[current.current.isolated ? focusedStation : current.current.station];
      ring.visible = !current.current.isolated;
      if (active) { ring.position.x = active.position.x; ring.position.z = active.position.z; ring.scale.setScalar(current.current.station === 'imager' ? 1.65 : 1.3); }
      if (moving || now < settleUntil) renderer.shadowMap.needsUpdate = true;
      renderer.render(scene, camera);
      if (moving || targetCamera || damping || now < settleUntil) request();
    }
    resize(); setReady(true);
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect();
      document.removeEventListener('visibilitychange', visibility); reducedMotion.removeEventListener('change', invalidate);
      controls.removeEventListener('start', controlStart); controls.removeEventListener('change', controlChange); controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', pointerDown, true); renderer.domElement.removeEventListener('pointerup', pointerUp, true); renderer.domElement.removeEventListener('pointercancel', pointerCancel); renderer.domElement.removeEventListener('pointermove', pointerMove, true); renderer.domElement.removeEventListener('pointerleave', pointerCancel); renderer.domElement.removeEventListener('pointermove', manualMove); renderer.domElement.removeEventListener('wheel', wheel); renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
      scene.traverse(object => { if (object instanceof THREE.Mesh) {
        if (object instanceof THREE.InstancedMesh) object.dispose();
        geometries.add(object.geometry);
        for (const m of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(m);
          for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value);
        }
      } });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
      sun.shadow.dispose(); environment.dispose(); renderer.dispose(); container.replaceChildren(); runtime.current = null;
    };
  }, [props.caseId, attempt]);
  return <>{hovered && props.handsOn && <div className="scene-hotspot-hint">{hovered}</div>}<div ref={host} className="lab-webgl" role="img" aria-label={`${props.caseId === 'jtc' ? '光学' : '生物'}实验器材三维教学模型，可拖动旋转；也可用下方器材按钮和操作导览浏览。`}/>{error ? <div className="scene-fallback" role="status"><strong>三维场景暂不可用</strong><p>可继续使用操作导览。开启浏览器硬件加速后，可重新加载场景。</p><button onClick={() => setAttempt(value => value + 1)}>重新加载三维场景</button></div> : !ready && <div className="scene-fallback">正在布置实验台…</div>}</>;
});
