import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Station } from './scene-data';

export interface SceneProps {
  caseId: string; stepId: string; station: Station; action: number; total: number;
  isolated: boolean; running: boolean; exploded: boolean; exposure: number; alignment: number; onInspect: (station: Station) => void; onViewChange: (view: 'perspective'|'top'|'focus'|'free') => void;
}
export type Model = {
  root: THREE.Group;
  stations: Partial<Record<Station, THREE.Group>>;
  update: (props: SceneProps, time: number, dt: number) => void;
};
export const palette = { shell: 0xd8dddf, white: 0xeeeFEB, teal: 0x347b7d, dark: 0x263036, metal: 0xb8c2c9, blue: 0x84c4d6, amber: 0xd4a859 };
export const material = (color: number, metalness = .05, roughness = .34) => new THREE.MeshStandardMaterial({ color, metalness, roughness });

export function box(parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, color: number, radius = .035) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, Math.min(w, h, d) / 3)), material(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
export function cylinder(parent: THREE.Object3D, r: number, h: number, x: number, y: number, z: number, color: number, bottom = r) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, bottom, h, 32), material(color, color === palette.metal ? .8 : .08, color === palette.metal ? .27 : .36));
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
export function station(root: THREE.Group, id: Station, x: number, z: number) {
  const group = new THREE.Group(); group.position.set(x, 1.1, z); group.userData.station = id; root.add(group); return group;
}
export function label(parent: THREE.Object3D, text: string, x: number, y: number, z: number, width = 1.3, color = '#d9e8db', background = '#284b49') {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = background; ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = color; ctx.font = '500 35px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 50, 486);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 96 / 512), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false }));
  mesh.position.set(x, y, z); parent.add(mesh); return mesh;
}
export function tube(parent: THREE.Object3D, x: number, y: number, z: number, cap: number) {
  const group = new THREE.Group(); group.position.set(x, y, z); parent.add(group);
  const glass = cylinder(group, .085, .30, 0, .27, 0, 0xe5f2f5, .078);
  const cone = cylinder(group, .078, .14, 0, .05, 0, 0xe5f2f5, .012);
  for (const shell of [glass, cone]) { const m = shell.material as THREE.MeshStandardMaterial; m.transparent = true; m.opacity = .28; m.roughness = .12; m.depthWrite = false; shell.castShadow = false; }
  const liquid = cylinder(group, .059, .17, 0, .13, 0, 0x6ea8aa, .025);
  cylinder(group, .091, .025, 0, .415, 0, 0xdbe5e6);
  const capGroup = new THREE.Group(); capGroup.position.set(0, .425, -.095); group.add(capGroup);
  cylinder(capGroup, .1, .045, 0, .025, .095, cap);
  box(group, .03, .04, .06, 0, .43, -.105, cap, .008);
  box(capGroup, .075, .013, .013, 0, .038, .199, cap, .003);
  for (const height of [.19, .25, .31]) box(group, .035, .005, .007, .027, height, .078, 0x8a969d, .001);
  return { group, liquid, cap: capGroup };
}
export function bottle(parent: THREE.Object3D, x: number, z: number, color: number, text: string) {
  cylinder(parent, .22, .51, x, .28, z, 0xe0e7e3);
  cylinder(parent, .12, .13, x, .60, z, 0xe0e7e3, .22);
  cylinder(parent, .12, .06, x, .69, z, 0xe0e7e3);
  cylinder(parent, .143, .13, x, .77, z, color);
  const ribGeo = new THREE.BoxGeometry(.012, .1, .014), ribMat = material(color);
  const ribs = new THREE.InstancedMesh(ribGeo, ribMat, 24), matrix = new THREE.Matrix4();
  for (let i = 0; i < 24; i++) { const angle = i / 24 * Math.PI * 2; matrix.makeRotationY(-angle); matrix.setPosition(x + Math.sin(angle) * .141, .77, z + Math.cos(angle) * .141); ribs.setMatrixAt(i, matrix); } parent.add(ribs);
  label(parent, text, x, .36, z + .223, .39, '#26333a', '#f5f3e9');
  label(parent, 'REAGENT / LOT', x, .25, z + .224, .32, '#596873', '#f5f3e9');
}
export function cable(parent: THREE.Object3D, points: number[][], color: number, radius = .018) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p as [number, number, number])));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 36, radius, 8, false), material(color)); parent.add(mesh); return mesh;
}
export function signalTexture(kind: 'input'|'spectrum'|'correlation'|'blot'|'empty', exposure = 40) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 180;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = kind === 'blot' ? '#d9dfe0' : '#0b1822'; ctx.fillRect(0, 0, 256, 180);
  if (kind === 'input') {
    ctx.strokeStyle = '#cee7bf'; ctx.lineWidth = 11;
    [63, 164].forEach(x => { ctx.beginPath(); ctx.moveTo(x, 48); ctx.lineTo(x, 125); ctx.lineTo(x + 29, 125); ctx.stroke(); });
  } else if (kind === 'spectrum') {
    for (let i = 0; i < 256; i += 4) {
      ctx.fillStyle = `rgba(190,218,151,${Math.exp(-(((i - 128) / 65) ** 2)) * .95})`;
      ctx.fillRect(i, 20, 2, 140);
    }
  } else if (kind === 'correlation') {
    [53, 128, 203].forEach((x, i) => { const gradient = ctx.createRadialGradient(x, 90, 0, x, 90, i === 1 ? 22 : 14); gradient.addColorStop(0, '#f3f6c3'); gradient.addColorStop(.25, '#c4d991'); gradient.addColorStop(1, 'rgba(178,213,145,0)'); ctx.fillStyle = gradient; ctx.fillRect(x - 24, 60, 48, 60); });
  } else if (kind === 'empty') {
    ctx.strokeStyle = '#486359'; ctx.lineWidth = 1; ctx.strokeRect(16, 16, 224, 148);
    ctx.fillStyle = '#b4c8b7'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('AWAITING CAPTURE', 128, 94);
  } else {
    const background = ctx.createLinearGradient(0, 20, 256, 180); background.addColorStop(0, '#cbd2d5'); background.addColorStop(.5, '#e0e5e4'); background.addColorStop(1, '#c4ced0'); ctx.fillStyle = background; ctx.fillRect(0, 24, 256, 156);
    let noise = 1147;
    for (let i = 0; i < 1400; i++) { noise = (noise * 1664525 + 1013904223) >>> 0; ctx.fillStyle = `rgba(35,44,51,${(noise % 5) / 100})`; ctx.fillRect(noise % 256, 24 + ((noise >>> 8) % 156), 1, 1); }
    ctx.fillStyle = '#48565f'; ctx.font = '11px sans-serif'; ['M','C1','C2','T1','T2'].forEach((s, i) => ctx.fillText(s, 18 + i * 48, 16));
    for (let i = 0; i < 5; i++) {
      const ys = i === 0 ? [35, 55, 80, 105, 130, 155] : [65, 135];
      ys.forEach((y, j) => {
        const alpha = Math.min(1, exposure / 70 * (j ? .7 : .35 + i * .16));
        const x = 12 + i * 48, height = exposure > 75 ? 9 : 4;
        ctx.fillStyle = `rgba(27,31,39,${alpha})`; ctx.shadowColor = `rgba(27,31,39,${alpha * .6})`; ctx.shadowBlur = exposure > 75 ? 5 : 2;
        ctx.beginPath(); ctx.moveTo(x, y + 1); ctx.bezierCurveTo(x + 8, y - 1, x + 19, y + 1, x + 25, y); ctx.lineTo(x + 25, y + height); ctx.bezierCurveTo(x + 15, y + height + 2, x + 8, y + height - 1, x, y + height + 1); ctx.closePath(); ctx.fill();
      });
    }
    ctx.shadowBlur = 0;
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
export function screen(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, kind: 'input'|'spectrum'|'correlation'|'blot'|'empty') {
  box(parent, w + .16, h + .16, .12, x, y, z - .04, palette.dark);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signalTexture(kind) }));
  mesh.position.set(x, y, z + .025); parent.add(mesh); return mesh;
}
export function bench(root: THREE.Group, optical: boolean) {
  const frame = new THREE.Group(); root.add(frame);
  box(frame, 13.4, .27, 5.6, 0, .94, 0, optical ? 0x313b42 : 0xbec7ca, .055);
  const surface = box(frame, 13.3, .05, 5.5, 0, 1.075, 0, optical ? 0x9ba3a9 : 0x69757a, .012);
  const surfaceMat = surface.material as THREE.MeshStandardMaterial;
  surfaceMat.metalness = optical ? .72 : .08; surfaceMat.roughness = optical ? .38 : .52;
  // A fine, deterministic surface grain gives metal and epoxy distinct finishes.
  const grain = document.createElement('canvas'); grain.width = grain.height = 256;
  const ctx = grain.getContext('2d')!; const pixels = ctx.createImageData(256, 256); let seed = 9271;
  for (let i = 0; i < pixels.data.length; i += 4) { seed = (seed * 1664525 + 1013904223) >>> 0; const v = 205 + (seed % 36); pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = v; pixels.data[i + 3] = 255; }
  ctx.putImageData(pixels, 0, 0);
  const grainMap = new THREE.CanvasTexture(grain); grainMap.wrapS = grainMap.wrapT = THREE.RepeatWrapping; grainMap.repeat.set(12, 5); surfaceMat.roughnessMap = grainMap;
  for (const x of [-5.6, 5.6]) for (const z of [-2, 2]) {
    box(frame, optical ? .38 : .14, 1.15, optical ? .38 : .14, x, .24, z, 0x46525a);
    cylinder(frame, optical ? .29 : .14, .12, x, -.37, z, 0x22282e);
  }
  box(frame, 11.4, .12, .12, 0, -.08, -2, 0x68747c);
  box(frame, 15.3, .12, 7.5, 0, -.5, -.15, 0x354149, .12);
  if (optical) {
    const count = 47 * 19;
    const holes = new THREE.InstancedMesh(new THREE.CircleGeometry(.023, 12), material(0x252c31, .15, .7), count);
    const bevels = new THREE.InstancedMesh(new THREE.RingGeometry(.023, .034, 12), material(0xb7c0c7, .85, .25), count);
    const m = new THREE.Matrix4(); let n = 0;
    for (let x = 0; x < 47; x++) for (let z = 0; z < 19; z++) { m.makeRotationX(-Math.PI / 2); m.setPosition(-6.44 + x * .28, 1.102, -2.52 + z * .28); holes.setMatrixAt(n, m); bevels.setMatrixAt(n++, m); }
    frame.add(holes, bevels);
    for (const z of [-2.79, 2.79]) box(frame, 13.1, .035, .015, 0, .96, z, 0x909ca4, .004);
    label(frame, 'OPTICAL BREADBOARD', -4.7, .94, 2.806, 1.85, '#becbd2', '#313b42');
  } else {
    box(frame, 9.5, .085, .8, -.9, 2.75, -2.35, 0xc3cacc);
    for (const x of [-4.5, 2.6]) { box(frame, .075, 1.64, .075, x, 1.94, -2.57, palette.metal); box(frame, .07, .065, .65, x, 2.69, -2.3, palette.metal); }
    const shelf = new THREE.Group(); shelf.position.set(-3.5, 2.795, -2.3); frame.add(shelf);
    [0, .65, 1.3].forEach((x, i) => bottle(shelf, x, 0, [palette.teal, palette.amber, palette.dark][i], ['BUFFER','WASH','REAGENT'][i]));
    box(frame, 1.35, .44, .64, 1.7, 3.015, -2.3, 0xe6e4db);
    label(frame, 'LABFLOW / MOLECULAR', 1.7, 3.02, -1.972, 1.15, '#506468', '#e6e4db');
    box(frame, 2.0, .92, 2.5, -4.2, .28, .3, 0xc6cccd, .045);
    for (const y of [-.04, .27, .58]) { box(frame, 1.9, .27, .035, -4.2, y, 1.575, 0xe1e4e2, .015); box(frame, .6, .035, .06, -4.2, y + .04, 1.61, palette.metal, .01); }
    label(frame, 'WET LAB / WORK SURFACE', -4.7, .94, 2.806, 1.9, '#e1e7e9', '#546167');
  }
}
