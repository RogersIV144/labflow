import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Station } from './scene-data';

export interface SceneHandle { focus: () => void; reset: () => void; view: (view: 'perspective'|'top') => void; }
interface Props {
  caseId: string; stepId: string; station: Station; action: number; total: number;
  paused: boolean; exploded: boolean; exposure: number; alignment: number; onInspect: (station: Station) => void;
}
type Model = {
  root: THREE.Group;
  stations: Partial<Record<Station, THREE.Group>>;
  update: (props: Props, time: number, dt: number) => void;
};
const palette = { shell: 0xe5e9e2, white: 0xf4f3e9, teal: 0x377e78, dark: 0x253c3d, metal: 0xadb9b4, blue: 0x76c5d0, amber: 0xd4a859 };
const material = (color: number, metalness = .05, roughness = .4) => new THREE.MeshStandardMaterial({ color, metalness, roughness });

function box(parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, color: number, radius = .035) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, Math.min(w, h, d) / 3)), material(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function cylinder(parent: THREE.Object3D, r: number, h: number, x: number, y: number, z: number, color: number, bottom = r) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, bottom, h, 40), material(color, .25, .28));
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function station(root: THREE.Group, id: Station, x: number, z: number) {
  const group = new THREE.Group(); group.position.set(x, 1.1, z); group.userData.station = id; root.add(group); return group;
}
function label(parent: THREE.Object3D, text: string, x: number, y: number, z: number, width = 1.3, color = '#d9e8db', background = '#284b49') {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = background; ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = color; ctx.font = '500 35px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 50);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 96 / 512), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
  mesh.position.set(x, y, z); parent.add(mesh); return mesh;
}
function tube(parent: THREE.Object3D, x: number, y: number, z: number, cap: number) {
  const group = new THREE.Group(); group.position.set(x, y, z); parent.add(group);
  const glass = cylinder(group, .085, .38, 0, .23, 0, 0xc3d7d1, .045);
  (glass.material as THREE.MeshStandardMaterial).transparent = true; (glass.material as THREE.MeshStandardMaterial).opacity = .5;
  const liquid = cylinder(group, .059, .17, 0, .13, 0, 0x6ea8aa, .025);
  cylinder(group, .1, .055, 0, .44, 0, cap); return { group, liquid };
}
function bottle(parent: THREE.Object3D, x: number, z: number, color: number, text: string) {
  cylinder(parent, .22, .65, x, .35, z, 0xd1ded5); cylinder(parent, .13, .14, x, .74, z, color);
  label(parent, text, x, .37, z + .222, .38, '#294b46', '#edece1');
}
function cable(parent: THREE.Object3D, points: number[][], color: number, radius = .018) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p as [number, number, number])));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 36, radius, 8, false), material(color)); parent.add(mesh); return mesh;
}
function signalTexture(kind: 'input'|'spectrum'|'correlation'|'blot', exposure = 40) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 180;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = kind === 'blot' ? '#c6d0c4' : '#0b2025'; ctx.fillRect(0, 0, 256, 180);
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
  } else {
    ctx.fillStyle = '#4a6158'; ctx.font = '12px sans-serif'; ['M','C1','C2','T1','T2'].forEach((s, i) => ctx.fillText(s, 18 + i * 48, 18));
    for (let i = 0; i < 5; i++) {
      const ys = i === 0 ? [35, 55, 80, 105, 130, 155] : [65, 135];
      ys.forEach((y, j) => { ctx.fillStyle = `rgba(25,40,43,${Math.min(1, exposure / 70 * (j ? .7 : .35 + i * .16))})`; ctx.fillRect(12 + i * 48, y, 25, exposure > 75 ? 10 : 5); });
    }
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
function screen(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, kind: 'input'|'spectrum'|'correlation'|'blot') {
  box(parent, w + .16, h + .16, .12, x, y, z - .04, palette.dark);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signalTexture(kind) }));
  mesh.position.set(x, y, z + .025); parent.add(mesh); return mesh;
}
function bench(root: THREE.Group, optical: boolean) {
  box(root, 13.4, .22, 5.6, 0, .96, 0, optical ? 0x566563 : 0xb8c5bc, .07);
  box(root, 13.15, .12, 5.4, 0, 1.08, 0, optical ? 0x86938c : 0xe0e5d8, .035);
  for (const x of [-5.6, 5.6]) for (const z of [-2, 2]) {
    box(root, .18, 1.15, .18, x, .31, z, 0x566e66);
    box(root, .32, .12, .32, x, -.29, z, 0x273e39);
  }
  box(root, 11.4, .12, .12, 0, .05, -2, 0x506a62);
  box(root, 15.3, .18, 8, 0, -.48, -.2, 0x45645c, .12);
  // Sparse rails and surface fittings belong to the laboratory apparatus.
  if (optical) {
    const geo = new THREE.CylinderGeometry(.018, .018, .008, 6); const mat = material(0x334c49);
    const holes = new THREE.InstancedMesh(geo, mat, 18 * 7); let n = 0; const m = new THREE.Matrix4();
    for (let x = 0; x < 18; x++) for (let z = 0; z < 7; z++) { m.makeTranslation(-6 + x * .7, 1.145, -2.15 + z * .7); holes.setMatrixAt(n++, m); } root.add(holes);
  } else {
    box(root, 9.5, .11, .9, -.9, 2.75, -2.3, palette.white);
    for (const x of [-4.5, 2.6]) box(root, .08, .6, .08, x, 2.42, -2.5, palette.metal);
    const shelf = new THREE.Group(); shelf.position.set(-3.5, 2.81, -2.3); root.add(shelf);
    [0, .65, 1.3].forEach((x, i) => bottle(shelf, x, 0, [palette.teal, palette.amber, palette.dark][i], ['BUFFER','WASH','REAGENT'][i]));
    box(root, 1.5, .6, .65, 2.2, 3.1, -2.3, 0xc9d3c6); label(root, 'LABFLOW', 2.2, 3.1, -1.97, 1.1);
  }
}

function buildWB(): Model {
  const root = new THREE.Group(); bench(root, false);
  const stations: Model['stations'] = {};
  const reagents = stations.reagents = station(root, 'reagents', -4.9, -1.4);
  bottle(reagents, -.35, .15, palette.teal, 'BUFFER'); bottle(reagents, .3, -.2, palette.amber, 'REAGENT');
  label(reagents, '01 / PREPARE', 0, .06, .65, 1.25);

  const sample = stations.sample = station(root, 'sample', -4.2, 1.1);
  box(sample, 1.65, .16, .95, 0, .1, 0, palette.teal);
  const tubes: ReturnType<typeof tube>[] = [];
  for (let x = 0; x < 5; x++) for (let z = 0; z < 2; z++) tubes.push(tube(sample, -.55 + x * .28, .16, -.22 + z * .4, x % 2 ? palette.amber : palette.teal));
  const pipette = new THREE.Group(); pipette.position.set(.6, 1.25, 0); pipette.rotation.z = -.3; sample.add(pipette);
  cylinder(pipette, .075, .65, 0, .18, 0, palette.white); cylinder(pipette, .09, .1, 0, .55, 0, palette.teal);
  cylinder(pipette, .025, .5, 0, -.36, 0, 0xbdd9d1, .006); box(pipette, .07, .11, .04, 0, .18, .07, palette.dark);
  label(sample, '02 / SAMPLE', 0, .03, .65, 1.3);
  const plate = new THREE.Group(); plate.position.set(1.1, .02, .12); sample.add(plate);
  box(plate, .65, .1, .85, 0, .08, 0, palette.white);
  const wells: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) wells.push(cylinder(plate, .055, .025, -.18 + j * .18, .15, -.28 + i * .18, 0x9cacc5));

  const centrifuge = stations.centrifuge = station(root, 'centrifuge', -2.1, -.6);
  box(centrifuge, 1.7, .85, 1.5, 0, .45, 0, palette.white, .15);
  cylinder(centrifuge, .65, .05, 0, .9, -.08, palette.dark);
  const rotor = new THREE.Group(); rotor.position.set(0, .95, -.08); centrifuge.add(rotor);
  cylinder(rotor, .5, .1, 0, 0, 0, palette.metal);
  for (let i = 0; i < 8; i++) { const angle = i * Math.PI / 4; const t = tube(rotor, Math.cos(angle) * .35, -.03, Math.sin(angle) * .35, i % 2 ? palette.amber : palette.teal); t.group.scale.setScalar(.6); }
  const lid = new THREE.Group(); lid.position.set(0, .93, -.65); centrifuge.add(lid);
  box(lid, 1.65, .1, 1.45, 0, 0, .62, 0xd6e0d6, .12); lid.rotation.x = -1.13;
  const separated = new THREE.Group(); separated.position.set(1.05,.15,.72); centrifuge.add(separated); const separatedTube=tube(separated,0,0,0,palette.teal); separatedTube.group.scale.setScalar(2.2); const pellet=cylinder(separated,.08,.065,0,.105,0,palette.amber,.015); label(separated,'SUPERNATANT',.65,.6,.08,1.1); label(separated,'PELLET',.55,.11,.08,.8);
  label(centrifuge, 'CENTRIFUGE', 0, .37, .765, 1.05); box(centrifuge, .58, .2, .03, .38, .64, .76, palette.dark);

  const gel = stations.gel = station(root, 'gel', -.05, 1);
  box(gel, 1.48, .18, 1.2, 0, .11, 0, palette.teal);
  const tank = box(gel, 1.35, 1.25, .85, 0, .78, 0, 0x8eb7bd); const tankMat = tank.material as THREE.MeshStandardMaterial; tankMat.transparent = true; tankMat.opacity = .25; tankMat.depthWrite = false;
  box(gel, 1.35, .09, .95, 0, 1.43, 0, palette.teal);
  const gelSheet = box(gel, 1.05, .94, .09, 0, .85, .25, 0xb6d5cb); (gelSheet.material as THREE.MeshStandardMaterial).transparent = true; (gelSheet.material as THREE.MeshStandardMaterial).opacity = .7;
  const bands: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    box(gel, .12, .09, .02, -.4 + i * .2, 1.31, .32, palette.dark);
    for (let j = 0; j < 3; j++) bands.push(box(gel, .11, .025, .025, -.4 + i * .2, 1.18 - j * .14, .32, [0x326591, 0x718fa5, 0x6d748f][j], .005));
  }
  label(gel, '03 / SEPARATE', 0, .1, .66, 1.35);
  const power = new THREE.Group(); power.position.set(.2, 0, -1.35); gel.add(power);
  box(power, 1.25, .45, .75, 0, .24, 0, palette.white); label(power, 'POWER', -.13, .25, .39, .65);
  cylinder(power, .06, .06, .4, .25, .42, 0xb55447).rotation.x = Math.PI / 2;
  cable(gel, [[.5, 1.45, -.2], [.8, 1.8, -.9], [.7, .6, -1.35], [.6, .24, -.9]], 0xbc5e50);
  cable(gel, [[-.5, 1.45, -.2], [-.8, 1.65, -.8], [-.3, .5, -1.3]], 0x263d3d);

  const transfer = stations.transfer = station(root, 'transfer', 2.15, -.65);
  box(transfer, 1.85, .14, 1.6, 0, .08, 0, 0x739087);
  const stack: THREE.Mesh[] = [];
  const stackColors = [0x344c4d, 0xc5cbbb, 0xe6dfc6, 0xa4c6ce, 0xeeeade, 0xe6dfc6, 0xc5cbbb, 0xbb6657];
  stackColors.forEach((color, i) => stack.push(box(transfer, 1.22, .055, 1.05, 0, .23 + i * .06, 0, color, .012)));
  const transferred = new THREE.Group(); transfer.add(transferred); for(let i=0;i<5;i++){const band=box(transferred,.12,.012,.04,-.4+i*.2,.5,.1+(i%2)*.16,0x4d7793,.004);}
  const proteinParticles=new THREE.Group();transfer.add(proteinParticles); for(let i=0;i<12;i++){const dot=new THREE.Mesh(new THREE.SphereGeometry(.025,8,8),new THREE.MeshBasicMaterial({color:0x416c8a}));dot.position.set(-.45+(i%6)*.18,.46,-.25+Math.floor(i/6)*.5);proteinParticles.add(dot);}
  label(transfer, '04 / TRANSFER', 0, .06, .94, 1.5);
  const stackLabels = stackColors.map((_, i) => label(transfer, ['− CATHODE','PAD','PAPER','GEL','MEMBRANE','PAPER','PAD','+ ANODE'][i], .99, .23 + i * .06, .5, .69, '#e0eadb', '#42615a'));

  const tray = stations.tray = station(root, 'tray', 3.75, 1.1);
  box(tray, 1.7, .21, 1.3, 0, .13, 0, palette.teal);
  const shaker = new THREE.Group(); shaker.position.y = .3; tray.add(shaker);
  box(shaker, 1.5, .08, 1.1, 0, 0, 0, palette.dark);
  box(shaker, 1.28, .08, .9, 0, .09, 0, palette.white);
  for (const x of [-.64, .64]) box(shaker, .05, .18, .95, x, .17, 0, palette.white);
  for (const z of [-.45, .45]) box(shaker, 1.28, .18, .05, 0, .17, z, palette.white);
  box(shaker, .98, .02, .65, 0, .15, 0, 0xd1d9bd);
  const fluid = box(shaker, 1.2, .04, .82, 0, .19, 0, 0x7caeac); const fluidMat = fluid.material as THREE.MeshStandardMaterial; fluidMat.transparent = true; fluidMat.opacity = .35;
  const antibodies = new THREE.Group(); shaker.add(antibodies);
  for (let i = 0; i < 8; i++) { const x = -.43 + (i % 4) * .28; const z = -.18 + Math.floor(i / 4) * .35; const a = box(antibodies, .035, .16, .035, x, .27, z, palette.amber, .008); const branch = box(antibodies, .12, .025, .035, x, .33, z, palette.amber, .008); branch.rotation.z = -.22; a.rotation.z = .1; }
  const secondaryMarkers=new THREE.Group();shaker.add(secondaryMarkers);for(let i=0;i<8;i++){const dot=new THREE.Mesh(new THREE.SphereGeometry(.045,12,12),material(0xcc9255));dot.position.set(-.43+(i%4)*.28,.4,-.18+Math.floor(i/4)*.35);secondaryMarkers.add(dot);}
  const washParticles=new THREE.Group();shaker.add(washParticles);for(let i=0;i<8;i++){const dot=new THREE.Mesh(new THREE.SphereGeometry(.025,8,8),material(palette.amber));washParticles.add(dot);}
  label(tray, '05 / INCUBATE', 0, .1, .79, 1.4);

  const imager = stations.imager = station(root, 'imager', 5, -1.1);
  box(imager, 1.65, 1.8, 1.5, 0, .92, 0, palette.white, .11);
  box(imager, 1.35, 1.07, .05, 0, 1.12, .77, palette.dark);
  const image = screen(imager, 0, 1.12, .8, 1.13, .78, 'blot');
  box(imager, 1.1, .07, .05, 0, .41, .8, palette.teal);
  cylinder(imager, .055, .02, .58, 1.68, .78, palette.teal).rotation.x = Math.PI / 2;
  label(imager, '06 / IMAGE', 0, .18, .78, 1.2);
  let lastExposure = -1;
  return { root, stations, update(props, time, dt) {
    const fraction = props.action / props.total;
    pipette.position.y = THREE.MathUtils.damp(pipette.position.y, props.station === 'sample' && props.action ? .87 : 1.25, 5, dt);
    pipette.position.x = props.stepId === 'wb-lysis' ? -.2 : .6;
    tubes.forEach(t => { t.liquid.scale.y = props.action && props.station === 'sample' ? 1.5 : 1; });
    wells.forEach((well, i) => (well.material as THREE.MeshStandardMaterial).color.setHex(props.stepId === 'wb-quantify' && props.action ? [0x6e6d9f, 0x8d7faf, 0xb9a9ce][i % 3] : 0x9cacc5));
    const spinning = props.stepId === 'wb-collect' && props.action === 2;
    separated.visible=props.stepId==='wb-collect'&&props.action>=3;
    rotor.rotation.y += spinning ? dt * 13 : 0;
    lid.rotation.x = THREE.MathUtils.damp(lid.rotation.x, spinning ? 0 : -1.13, 5, dt);
    bands.forEach((band, i) => { const row = i % 3; const target = props.station === 'gel' ? 1.18 - row * (.12 + .15 * fraction) - .23 * fraction : .9 - row * .2; band.position.y = THREE.MathUtils.damp(band.position.y, target, 4, dt); });
    stack.forEach((layer, i) => { layer.position.y = THREE.MathUtils.damp(layer.position.y, .23 + i * (props.exploded ? .25 : .06), 5, dt); stackLabels[i].position.y = layer.position.y; stackLabels[i].visible = props.exploded; });
    const transferDone=props.stepId==='wb-transfer'&&props.action>=3; transferred.visible=transferDone;proteinParticles.visible=transferDone;proteinParticles.children.forEach((part,i)=>{part.position.y=.4+((time*.4+i/12)%1)*.12;});
    if(props.stepId==='wb-membrane')(stack[4].material as THREE.MeshStandardMaterial).color.setHex(props.action>=2?0xb0cdc1:0xeeeade);
    else (stack[4].material as THREE.MeshStandardMaterial).color.setHex(transferDone?0xb0cdc1:0xeeeade);
    shaker.rotation.z = props.station === 'tray' && props.action ? Math.sin(time * 2.1) * .035 : 0;
    fluid.visible = props.station !== 'tray' || props.action > 0;
    fluid.scale.y=THREE.MathUtils.damp(fluid.scale.y,props.stepId==='wb-block'&&props.action<2?.1:1,4,dt);
    secondaryMarkers.visible=['wb-secondary','wb-wash2'].includes(props.stepId)&&props.action>=2;
    const washing=props.stepId.includes('wash')&&props.action>=2; washParticles.visible=washing; washParticles.children.forEach((p,i)=>{p.position.set(-.6+((time*.25+i*.15)%1)*1.2,.25+Math.sin(i+time)*.04,-.3+(i%3)*.25);(p as THREE.Mesh<THREE.SphereGeometry,THREE.MeshStandardMaterial>).material.transparent=true;(p as THREE.Mesh<THREE.SphereGeometry,THREE.MeshStandardMaterial>).material.opacity=.7*(1-((time*.25+i*.15)%1));});
    antibodies.visible = ['wb-primary', 'wb-secondary', 'wb-wash1', 'wb-wash2'].includes(props.stepId) && props.action > 0;
    antibodies.children.forEach((part, i) => { const targetY=props.action>=2?.23+(i%2)*.06:.55+(i%2)*.06;part.position.y=THREE.MathUtils.damp(part.position.y,targetY,4,dt); (part as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>).material.color.setHex(props.stepId==='wb-secondary'?0x688d8b:palette.amber); });
    if (lastExposure !== props.exposure) { image.material.map?.dispose(); image.material.map = signalTexture('blot', props.exposure); image.material.needsUpdate = true; lastExposure = props.exposure; }
  } };
}

function buildOptics(): Model {
  const root = new THREE.Group(); bench(root, true);
  const stations: Model['stations'] = {};
  const beamY = 2.5;
  function mount(id: Station, x: number) {
    const group = station(root, id, x, 0); stations[id] = group;
    box(group, .9, .1, .8, 0, .06, 0, palette.dark); cylinder(group, .065, .9, 0, .55, 0, palette.metal);
    cylinder(group, .12, .19, 0, .32, 0, palette.dark); return group;
  }
  function lens(group: THREE.Group, radius: number, y = 1.4, aperture = false) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, .065, 12, 48), material(palette.dark, .6)); rim.rotation.y = Math.PI / 2; rim.position.y = y; group.add(rim);
    const disc = cylinder(group, radius - .04, .045, 0, y, 0, aperture ? palette.dark : 0x97d6d2); disc.rotation.z = Math.PI / 2;
    if (!aperture) { const mat = disc.material as THREE.MeshStandardMaterial; mat.transparent = true; mat.opacity = .32; mat.metalness = .45; mat.roughness = .1; }
    else { const hole = cylinder(group, .07, .052, 0, y, 0, 0xdbda9a); hole.rotation.z = Math.PI / 2; }
  }
  const laser = stations.laser = station(root, 'laser', -5.1, 0);
  box(laser, 1.5, .14, .9, 0, .08, 0, palette.dark); box(laser, 1.35, .65, .75, 0, 1.38, 0, palette.white, .06);
  for (const x of [-.48, .48]) cylinder(laser, .075, 1.02, x, .6, 0, palette.metal);
  const nozzle = cylinder(laser, .17, .2, .76, 1.4, 0, palette.dark); nozzle.rotation.z = Math.PI / 2;
  label(laser, 'LASER', 0, 1.43, .39, .8); label(laser, 'KEEP BEAM BELOW EYE LEVEL', 0, .05, .7, 1.6, '#ecdbc0', '#4c5546');
  const iris = mount('iris', -3.65); lens(iris, .32, 1.4, true);
  const filter = mount('filter', -2.25); lens(filter, .22, 1.4, true); box(filter, .5, .42, .62, 0, .88, 0, palette.teal);
  for (const z of [-.4, .4]) cylinder(filter, .08, .2, 0, 1.03, z, palette.metal);
  const collimator = mount('lens', -.7); lens(collimator, .5);
  const input = mount('input', 1.05); box(input, .13, 1.42, 1.36, 0, 1.4, 0, palette.dark);
  const inputFace=new THREE.Group();inputFace.rotation.y=Math.PI/2;input.add(inputFace);
  const inputDisplay = screen(inputFace, 0, 1.4, .085, 1.05, .85, 'input');
  label(input, 'INPUT / SLM', 0, .13, .55, 1.15);
  const transformLens = new THREE.Group(); transformLens.position.set(3, 1.1, 0); transformLens.userData.station = 'lens'; root.add(transformLens);
  box(transformLens, .85, .1, .8, 0, .06, 0, palette.dark); cylinder(transformLens, .065, .9, 0, .55, 0, palette.metal); lens(transformLens, .56);
  const camera = mount('camera', 5.1); box(camera, .95, .8, .95, .22, 1.4, 0, palette.white, .07);
  const objective = cylinder(camera, .25, .4, -.43, 1.4, 0, palette.dark); objective.rotation.z = Math.PI / 2;
  label(camera, 'CAMERA', .2, 1.45, .5, .75);
  const monitor = new THREE.Group(); monitor.position.set(3.85, 1.1, -1.9); monitor.rotation.y = -.1; monitor.userData.station = 'camera'; root.add(monitor);
  box(monitor, .95, .08, .55, 0, .05, 0, palette.dark); cylinder(monitor, .06, .65, 0, .4, 0, palette.metal);
  const output = screen(monitor, 0, 1.25, .06, 1.7, 1.12, 'spectrum');
  label(monitor, 'SYNTHETIC PREVIEW', 0, .57, .12, 1.3);
  cable(root, [[5.45, 2.4, .45], [5.9, 1.4, .7], [5, 1.3, -1.8], [3.85, 1.6, -1.9]], 0x293e3a, .025);
  const beam = new THREE.Group(); root.add(beam);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xf5a991, transparent: true, opacity: .55, depthWrite: false });
  const segments: THREE.Mesh[] = [];
  const beamPoints = [-4.3, -3.65, -2.25, -.7, 1.05, 3, 4.6];
  for (let i = 0; i < beamPoints.length - 1; i++) {
    const a = beamPoints[i], b = beamPoints[i + 1];
    const light = new THREE.Mesh(new THREE.CylinderGeometry(.013, .013, b - a, 12), beamMat); light.rotation.z = Math.PI / 2; light.position.set((a + b) / 2, beamY, 0); beam.add(light); segments.push(light);
    const spread = new THREE.Mesh(new THREE.CylinderGeometry(i === 1 ? .025 : .18, i === 1 ? .18 : .18, b - a, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xeaa48a, transparent: true, opacity: .05, side: THREE.DoubleSide, depthWrite: false })); spread.rotation.z = Math.PI / 2; spread.position.copy(light.position); beam.add(spread);
  }
  const target = new THREE.Mesh(new THREE.RingGeometry(.12, .14, 40), new THREE.MeshBasicMaterial({ color: 0xe9c17b, side: THREE.DoubleSide })); target.rotation.y = Math.PI / 2; target.position.set(4.55, beamY, 0); beam.add(target);
  const photons = new THREE.Group(); root.add(photons);
  for (let i = 0; i < 7; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(.035, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffd6a7 })); photons.add(p); }
  const annotation = ['LASER','AXIS','SPATIAL FILTER','COLLIMATOR','JOINT INPUT','FOURIER LENS','DETECTOR'];
  [-5.1, -3.65, -2.25, -.7, 1.05, 3, 5.1].forEach((x, i) => { const tag = label(root, annotation[i], x, 1.16, 1.23, i === 2 || i === 3 ? 1.35 : 1.1, '#c6d3c4', '#364d47'); tag.rotation.x = -Math.PI / 2; });
  let previousInput = '', previousOutput = '';
  return { root, stations, update(props, time) {
    const reload = props.stepId === 'jtc-read' || props.stepId === 'jtc-reload' && props.action >= 2;
    const inputKind = reload ? 'spectrum' : 'input';
    const outputKind = props.stepId === 'jtc-read' && props.action >= 1 ? 'correlation' : 'spectrum';
    if (previousInput !== inputKind) { inputDisplay.material.map?.dispose(); inputDisplay.material.map = signalTexture(inputKind); inputDisplay.material.needsUpdate = true; previousInput = inputKind; }
    if (previousOutput !== outputKind) { output.material.map?.dispose(); output.material.map = signalTexture(outputKind); output.material.needsUpdate = true; previousOutput = outputKind; }
    const deviation = props.alignment / 170;
    beam.position.z = deviation;
    target.scale.setScalar(props.stepId === 'jtc-collimate' ? 1 + Math.abs(props.alignment) / 25 : 1);
    photons.children.forEach((p, i) => { const t = (time * .3 + i / 7) % 1; p.position.set(-4.3 + t * 8.85, beamY, deviation); });
    beamMat.opacity = Math.abs(props.alignment) > 35 ? .22 : .65;
    segments.forEach((part, i) => { part.visible = i < 2 || Math.abs(props.alignment) < 45; });
  } };
}

export const LabScene = forwardRef<SceneHandle, Props>(function LabScene(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const current = useRef(props); current.current = props;
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelRef = useRef<Model | null>(null);
  const focusActive = useRef(false);
  const targetCamera = useRef<THREE.Vector3 | null>(null);
  const targetLook = useRef<THREE.Vector3 | null>(null);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const setView = (view: 'perspective'|'top') => {
    const camera = cameraRef.current, controls = controlsRef.current;
    if (!camera || !controls) return;
    focusActive.current = false; targetCamera.current = new THREE.Vector3(...(view === 'top' ? [0, 20, .01] : [9.6, 8.8, 12.3]) as [number,number,number]); targetLook.current = new THREE.Vector3(0,1.15,0);
  };
  const focus = () => { const active = modelRef.current?.stations[current.current.station]; if (!active) return; focusActive.current = true; targetLook.current = new THREE.Vector3(active.position.x, 1.9, active.position.z); targetCamera.current = new THREE.Vector3(active.position.x+3.5,6.4,active.position.z+6.4); };
  useEffect(()=>{if(focusActive.current)focus();},[props.station]);
  useImperativeHandle(ref, () => ({ reset: () => setView('perspective'), view: setView, focus }));
  useEffect(() => {
    const container = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); }
    catch { setError(true); return; }
    setReady(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(37, 1, .1, 100); camera.position.set(9.6, 8.8, 12.3); cameraRef.current = camera;
    const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, 1.15, 0); controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 5; controls.maxDistance = 29; controls.minPolarAngle = .03; controls.maxPolarAngle = Math.PI * .49; controlsRef.current = controls;
    const room = new RoomEnvironment(); const pmrem = new THREE.PMREMGenerator(renderer); const environment = pmrem.fromScene(room, .05); scene.environment = environment.texture; room.dispose(); pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xdceee2, 0x314f44, 1.2));
    const sun = new THREE.DirectionalLight(0xfff4d6, 3); sun.position.set(-4, 12, 6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -10; sun.shadow.camera.right = 10; sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8; sun.shadow.normalBias = .03; sun.shadow.bias = -.0003; scene.add(sun);
    const fill = new THREE.DirectionalLight(0xbadfd9, 2); fill.position.set(6, 6, -6); scene.add(fill);
    const model = props.caseId === 'jtc' ? buildOptics() : buildWB(); scene.add(model.root); modelRef.current = model;
    const ring = new THREE.Mesh(new THREE.RingGeometry(.55, .58, 64), new THREE.MeshBasicMaterial({ color: 0xd0dcb5, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 1.165; scene.add(ring);
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
    const hit = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera); const hits = raycaster.intersectObject(model.root, true);
      for (const item of hits) { let object: THREE.Object3D | null = item.object; while (object && !object.userData.station) object = object.parent; if (object?.userData.station) return object.userData.station as Station; }
      return undefined;
    };
    let downX = 0, downY = 0;
    const down = (event: PointerEvent) => { targetCamera.current=null;targetLook.current=null; downX = event.clientX; downY = event.clientY; };
    const up = (event: PointerEvent) => { if (Math.hypot(event.clientX - downX, event.clientY - downY) < 5) { const selected = hit(event); if (selected) current.current.onInspect(selected); } };
    const move = (event: PointerEvent) => { renderer.domElement.style.cursor = hit(event) ? 'pointer' : 'grab'; };
    const contextLost = (event: Event) => { event.preventDefault(); setError(true); };
    renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointerup', up); renderer.domElement.addEventListener('pointermove', move); renderer.domElement.addEventListener('webglcontextlost', contextLost);
    const resize = () => { const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(container); resize();
    let visible = true;
    const intersection = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? true; }); intersection.observe(container);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, previous = performance.now(), elapsed = 0;
    const animate = (now: number) => {
      frame = requestAnimationFrame(animate);
      const dt = Math.min((now - previous) / 1000, .05); previous = now;
      if (!visible || document.hidden) return;
      const operationDt=current.current.paused?0:dt;
      if (!reducedMotion.matches && !current.current.paused) elapsed += dt;
      if (targetCamera.current && targetLook.current) { const blend = reducedMotion.matches ? 1 : 1-Math.exp(-dt*5); camera.position.lerp(targetCamera.current,blend); controls.target.lerp(targetLook.current,blend); if(camera.position.distanceTo(targetCamera.current)<.01) {targetCamera.current=null;targetLook.current=null;} }
      controls.update(); model.update(current.current, elapsed, operationDt);
      const active = model.stations[current.current.station];
      if (active) { ring.position.x = active.position.x; ring.position.z = active.position.z; ring.scale.setScalar(current.current.station === 'imager' ? 1.65 : 1.3); }
      renderer.render(scene, camera);
    };
    animate(performance.now()); setReady(true);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointerup', up); renderer.domElement.removeEventListener('pointermove', move); renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>(); const textures = new Set<THREE.Texture>();
      scene.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); for (const m of Array.isArray(object.material) ? object.material : [object.material]) { materials.add(m); if (m.map) textures.add(m.map); } } });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); environment.dispose(); renderer.dispose(); container.replaceChildren(); controlsRef.current = null; cameraRef.current = null;
    };
  }, [props.caseId]);
  return <><div ref={host} className="lab-webgl" role="img" aria-label={`${props.caseId === 'jtc' ? '光学' : '生物'}实验器材三维教学模型，可拖动旋转。操作导览提供等效文字说明。`}/>{error ? <div className="scene-fallback"><strong>三维场景暂不可用</strong><p>浏览器未能启用 WebGL。可继续使用操作导览，或在支持硬件加速的浏览器中打开。</p></div> : !ready && <div className="scene-fallback">正在布置实验台…</div>}</>;
});
