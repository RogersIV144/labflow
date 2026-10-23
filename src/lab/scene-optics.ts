import * as THREE from 'three';
import { material, box, cylinder, station, label, cable, signalTexture, screen, bench, type Model } from './scene-primitives';
import { opticalSignals } from './scene-state';
import type { Station } from './scene-data';
import { opticalMetrics, type OpticalCapture } from './interaction-state';

// Generic optomechanics informed by manufacturers' construction drawings.
// Dimensions, signals and visible beam volumes are instructional illustrations.
const finish = { black: 0x20272b, edge: 0x3b454b, metal: 0xbfc7cb, chrome: 0xd5dcdf, rubber: 0x151d21 };
const axisHeight = 1.4;

function alloy(mesh: THREE.Mesh, metalness = .72, roughness = .3) {
  const surface = mesh.material as THREE.MeshStandardMaterial;
  surface.metalness = metalness; surface.roughness = roughness;
  return mesh;
}

/** A real annular barrel whose bore stays open along the X optical axis. */
function barrel(parent: THREE.Object3D, outer: number, inner: number, depth: number, x: number, y = axisHeight, z = 0, color = finish.black) {
  const profile = [[inner, -depth / 2], [outer, -depth / 2], [outer, depth / 2], [inner, depth / 2], [inner, -depth / 2]].map(([r, h]) => new THREE.Vector2(r, h));
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(profile, 48), material(color, .65, .29));
  mesh.rotation.z = Math.PI / 2; mesh.position.set(x, y, z);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

/** Repeated fasteners use two draw calls per mounting plate. */
function screws(parent: THREE.Object3D, positions: number[][], along: 'y'|'x' = 'y') {
  const heads = new THREE.InstancedMesh(new THREE.CylinderGeometry(.037, .037, .024, 16), material(finish.chrome, .85, .25), positions.length);
  const sockets = new THREE.InstancedMesh(new THREE.CylinderGeometry(.017, .017, .003, 6), material(0x11171a, .3, .45), positions.length);
  const dummy = new THREE.Object3D();
  positions.forEach(([x, y, z], i) => {
    dummy.position.set(x, y, z); dummy.rotation.set(0, 0, along === 'x' ? -Math.PI / 2 : 0); dummy.updateMatrix(); heads.setMatrixAt(i, dummy.matrix);
    if (along === 'x') dummy.position.x += .014; else dummy.position.y += .014;
    dummy.updateMatrix(); sockets.setMatrixAt(i, dummy.matrix);
  });
  heads.castShadow = true; parent.add(heads, sockets);
}

function knob(parent: THREE.Object3D, x: number, y: number, z: number, direction: 'x'|'y'|'z', size = .09) {
  const group = new THREE.Group(); group.position.set(x, y, z); parent.add(group);
  if (direction === 'x') group.rotation.z = -Math.PI / 2;
  if (direction === 'z') group.rotation.x = Math.PI / 2;
  alloy(cylinder(group, size * .42, .14, 0, 0, 0, finish.chrome), .85, .22);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(size, size, .15, 20, 1), material(finish.black, .5, .4)); grip.position.y = .11; group.add(grip);
  alloy(cylinder(group, size * .87, .014, 0, .19, 0, finish.edge), .65, .3);
  box(group, size * 1.05, .007, .012, 0, .201, 0, 0xd8d9ce, .001);
  return group;
}

function pedestal(parent: THREE.Object3D, x = 0, z = 0, height = .99, width = .7) {
  const holder = new THREE.Group(); holder.position.set(x, -.035, z); parent.add(holder);
  alloy(box(holder, width, .09, .8, 0, .08, 0, finish.black, .02), .6);
  for (const sx of [-width * .32, width * .32]) box(holder, .1, .009, .35, sx, .128, 0, 0x10191e, .025);
  screws(holder, [-width * .32, width * .32].map(sx => [sx, .143, .06]));
  alloy(cylinder(holder, .14, .08, 0, .17, 0, finish.edge), .65);
  alloy(cylinder(holder, .115, height * .58, 0, .19 + height * .29, 0, finish.black), .6);
  alloy(cylinder(holder, .068, height * .72, 0, .34 + height * .36, 0, finish.chrome), .9, .2);
  alloy(cylinder(holder, .123, .065, 0, .19 + height * .58, 0, finish.edge), .6);
  knob(holder, 0, .4, .155, 'z', .08);
  return holder;
}

function stationTag(parent: THREE.Object3D, title: string, width = 1.1) {
  const tag = label(parent, title, 0, .15, .67, width, '#dee3df', '#303c40'); tag.rotation.x = -Math.PI / 2;
}

function mountedLens(parent: THREE.Object3D, radius: number, x = 0) {
  pedestal(parent, x, 0, .85);
  box(parent, .22, .25, .2, x, .93, 0, finish.black);
  barrel(parent, radius + .075, radius - .025, .18, x);
  barrel(parent, radius + .05, radius - .028, .022, x + .102, axisHeight, 0, finish.metal);
  barrel(parent, radius + .045, radius - .025, .022, x - .102);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), new THREE.MeshPhysicalMaterial({
    color: 0xb8d4da, metalness: .02, roughness: .075, transparent: true, opacity: .28,
    clearcoat: 1, clearcoatRoughness: .04, side: THREE.DoubleSide, depthWrite: false,
  }));
  glass.scale.set(.07, radius - .035, radius - .035); glass.position.set(x, axisHeight, 0); parent.add(glass);
  const reflection = new THREE.Mesh(new THREE.TorusGeometry(radius * .74, .008, 5, 30, Math.PI * .58), new THREE.MeshBasicMaterial({ color: 0xc9e2ee, transparent: true, opacity: .4, depthWrite: false }));
  reflection.rotation.y = Math.PI / 2; reflection.rotation.z = -.65; reflection.position.set(x + .055, axisHeight, 0); parent.add(reflection);
  knob(parent, x, axisHeight - radius * .45, radius + .07, 'z', .06);
}

function irisDiaphragm(parent: THREE.Object3D, x: number, aperture: number) {
  pedestal(parent, x, 0, .98, .52);
  // A tapped neck connects the post to the ring without entering the aperture.
  alloy(cylinder(parent, .083, .11, x, 1.04, 0, finish.black), .6);
  barrel(parent, .34, .275, .13, x);
  barrel(parent, .31, .27, .017, x + .079, axisHeight, 0, finish.metal);
  // Leaf sectors leave a real central aperture rather than a painted dot.
  for (let blade = 0; blade < 8; blade++) {
    const theta = blade / 8 * Math.PI * 2;
    const geometry = new THREE.RingGeometry(aperture, .278, 8, 1, theta, Math.PI / 4 + .04);
    const mesh = new THREE.Mesh(geometry, material(blade % 2 ? 0x455054 : 0x374348, .68, .33));
    (mesh.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    mesh.rotation.y = Math.PI / 2; mesh.position.set(x + .078 + blade * .0005, axisHeight, 0); parent.add(mesh);
  }
  const lever = new THREE.Group(); lever.position.set(x, axisHeight, 0); parent.add(lever);
  const handle = alloy(cylinder(lever, .025, .22, 0, .37, -.06, finish.chrome), .85, .22); handle.rotation.x = -.2;
  cylinder(lever, .04, .08, 0, .48, -.082, finish.black);
  return lever;
}

// Saved acquisitions deliberately retain their own quality and displacement.
// This is a qualitative teaching image, not a diffraction calculation.
function captureTexture(capture: OpticalCapture) {
  const template = signalTexture(capture.kind);
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 180;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0b161d'; ctx.fillRect(0, 0, 256, 180);
  const quality = Math.max(0, Math.min(1, capture.quality));
  ctx.globalAlpha = quality;
  ctx.filter = `blur(${(1 - quality) * 5}px)`;
  ctx.drawImage(template.image as HTMLCanvasElement, capture.offsetX * .3, -capture.offsetY * .3);
  ctx.filter = 'none'; ctx.globalAlpha = 1;
  // Fixed background grain makes repeated acquisitions comparable.
  for (let i = 0; i < 170; i++) {
    ctx.fillStyle = `rgba(174,204,206,${.012 + (1 - quality) * .03})`;
    ctx.fillRect((i * 71) % 256, (i * 37) % 180, 1, 1);
  }
  template.dispose();
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

function observationScreen(parent: THREE.Object3D, x: number, title: string) {
  const group = new THREE.Group(); group.position.set(x, .76, .83); group.userData.pickThrough = true; parent.add(group);
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 192;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#102934'; ctx.fillRect(0, 0, 256, 192);
  ctx.strokeStyle = '#86a8ab'; ctx.lineWidth = 2; ctx.strokeRect(2, 2, 252, 188);
  ctx.strokeStyle = '#587b87'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(128, 8); ctx.lineTo(128, 184); ctx.moveTo(8, 96); ctx.lineTo(248, 96); ctx.stroke();
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(.59, .43), new THREE.MeshBasicMaterial({ map, transparent: true, opacity: .88, side: THREE.DoubleSide })); group.add(surface);
  const spot = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: 0xffd0a0, transparent: true, opacity: .9, depthWrite: false })); spot.position.z = .008; group.add(spot);
  const halo = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: 0xffa070, transparent: true, opacity: .11, depthWrite: false })); halo.position.z = .006; group.add(halo);
  label(group, title, 0, -.26, .006, .48, '#c8dfe0', '#183341');
  return { group, spot, halo };
}

function controlHandle(handle: THREE.Group, axis: 'offsetX'|'offsetY'|'focus', name: string) {
  handle.userData.control = axis; handle.userData.interactionLabel = name;
  // A larger knurled cap keeps the pointer target usable at equipment scale.
  const spin = new THREE.Group(); handle.add(spin);
  cylinder(spin, .12, .04, 0, .22, 0, 0x517f84);
  box(spin, .1, .008, .015, 0, .246, 0, 0xe4e8cf, .001);
  return spin;
}

export function buildOptics(): Model {
  const root = new THREE.Group(); bench(root, true);
  const stations: Model['stations'] = {};
  const create = (id: Station, x: number, z = 0) => {
    const group = stations[id] = station(root, id, x, z);
    group.userData.viewDirection = [-3, 2.3, 4.6];
    return group;
  };

  const laser = create('laser', -5.55);
  pedestal(laser, -.4, 0, .9, .46); pedestal(laser, .4, 0, .9, .46);
  for (const x of [-.4, .4]) {
    alloy(cylinder(laser, .068, .15, x, 1.02, 0, finish.chrome), .85, .22);
    alloy(box(laser, .32, .075, .55, x, 1.1125, 0, finish.black, .012), .65);
  }
  alloy(box(laser, 1.3, .56, .62, 0, axisHeight, 0, finish.metal, .04));
  const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(1.19, .065, .022), material(finish.edge, .65, .35), 8);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < 8; i++) { matrix.makeTranslation(0, axisHeight + .3, -.26 + i * .074); fins.setMatrixAt(i, matrix); } laser.add(fins);
  alloy(box(laser, .05, .59, .65, .66, axisHeight, 0, finish.black, .02));
  barrel(laser, .15, .064, .15, .755); barrel(laser, .116, .058, .025, .84, axisHeight, 0, finish.chrome);
  screws(laser, [[.692, 1.61, -.22], [.692, 1.61, .22], [.692, 1.19, -.22], [.692, 1.19, .22]], 'x');
  label(laser, 'LASER HEAD', -.06, 1.44, .318, .8, '#dde4e3', '#364248');
  label(laser, 'AVOID DIRECT EXPOSURE', -.04, 1.27, .319, .93, '#252c2b', '#dec279');
  const laserSwitch = box(laser, .18, .07, .16, -.37, 1.721, .19, finish.black, .01);
  laserSwitch.userData.interaction = { type: 'opt-laser' }; laserSwitch.userData.interactionLabel = '切换激光电源';
  const laserLed = cylinder(laser, .025, .012, .34, 1.721, .21, 0x8cbb87); (laserLed.material as THREE.MeshStandardMaterial).emissive.setHex(0x284b24);
  cable(laser, [[-.67, 1.42, -.16], [-.9, 1.2, -.3], [-.81, .16, -.78], [-.18, .13, -1.15]], finish.rubber, .024);
  const control = new THREE.Group(); control.position.set(.35, 0, -1.35); laser.add(control);
  box(control, 1.2, .37, .62, 0, .25, 0, finish.metal);
  label(control, 'LASER CONTROL', -.1, .28, .32, .8, '#c7d9d9', '#202d33');
  const powerSwitch = knob(control, .43, .25, .35, 'z', .1);
  powerSwitch.userData.interaction = { type: 'opt-laser' }; powerSwitch.userData.interactionLabel = '切换激光电源';
  label(control, 'ON / OFF', .4, .1, .32, .36, '#d4dfd5', '#27393f').userData.interaction = { type: 'opt-laser' };
  stationTag(laser, '01  LASER', 1.15);

  const iris = create('iris', -4.08);
  const nearLever = irisDiaphragm(iris, 0, .19);
  const farLever = irisDiaphragm(iris, .67, .14);
  const nearScreen = observationScreen(iris, -.02, 'NEAR');
  const farScreen = observationScreen(iris, .69, 'FAR');
  stationTag(iris, '02  AXIS / IRIS', 1.35);

  const filter = create('filter', -2.32);
  alloy(box(filter, 1.22, .12, .82, -.03, .06, 0, finish.black));
  screws(filter, [[-.48, .136, -.3], [-.48, .136, .3], [.45, .136, -.3], [.45, .136, .3]]);
  for (const z of [-.26, .26]) alloy(cylinder(filter, .04, .76, -.03, .5, z, finish.chrome), .85);
  box(filter, .86, .12, .64, -.03, .88, 0, finish.edge);
  const focusStage = new THREE.Group(); focusStage.position.x = -.25; filter.add(focusStage);
  box(focusStage, .44, .18, .56, 0, .99, 0, finish.black);
  box(focusStage, .17, .36, .48, .06, 1.14, 0, finish.black);
  barrel(focusStage, .225, .14, .39, -.09, axisHeight, 0, finish.metal);
  barrel(focusStage, .25, .14, .045, -.3, axisHeight, 0, finish.black);
  barrel(focusStage, .19, .115, .16, .16, axisHeight, 0, finish.edge);
  barrel(focusStage, .155, .09, .09, .275, axisHeight, 0, finish.chrome);
  const objectiveGlass = cylinder(focusStage, .09, .018, -.323, axisHeight, 0, 0x91c5d1); objectiveGlass.rotation.z = Math.PI / 2;
  const objectiveMaterial = objectiveGlass.material as THREE.MeshStandardMaterial;
  objectiveMaterial.roughness = .1; objectiveMaterial.transparent = true; objectiveMaterial.opacity = .45; objectiveMaterial.depthWrite = false;
  const pinholeStage = new THREE.Group(); pinholeStage.position.x = .3; filter.add(pinholeStage);
  for (const z of [-.3, .3]) box(pinholeStage, .16, .66, .09, 0, axisHeight, z, finish.black, .012);
  for (const y of [1.08, 1.72]) box(pinholeStage, .16, .08, .52, 0, y, 0, finish.black, .012);
  barrel(pinholeStage, .238, .025, .018, .005, axisHeight, 0, finish.metal);
  barrel(pinholeStage, .267, .229, .07, .005);
  const adjustY = knob(pinholeStage, 0, 1.8, 0, 'y', .075);
  const adjustZ = knob(pinholeStage, 0, axisHeight, .4, 'z', .075);
  const adjustX = knob(filter, -.63, .98, .13, 'x', .075);
  const verticalControl = controlHandle(adjustY, 'offsetY', '拖动垂直旋钮');
  const horizontalControl = controlHandle(adjustZ, 'offsetX', '拖动水平旋钮');
  label(filter, 'XYZ / PINHOLE', 0, .55, .35, .88, '#d7dfdf', '#29353a');
  stationTag(filter, '03  SPATIAL FILTER', 1.42);

  const collimator = create('lens', -.72);
  const lensCarriage = new THREE.Group(); collimator.add(lensCarriage); mountedLens(lensCarriage, .43);
  const focusDial = knob(collimator, -.39, .8, .47, 'z', .09);
  const focusControl = controlHandle(focusDial, 'focus', '拖动准直旋钮');
  stationTag(collimator, '04  COLLIMATOR', 1.22);

  // A transmissive LCD SLM with an open four-sided housing and a thin active
  // window perpendicular to X, appropriate for the existing straight path.
  const input = create('input', 1.03); pedestal(input, 0, 0, .72, .88);
  input.userData.interaction = { type: 'opt-input' }; input.userData.interactionLabel = '装载双目标图';
  box(input, .2, .32, .29, 0, .84, 0, finish.black);
  for (const z of [-.56, .56]) box(input, .19, 1.12, .13, 0, axisHeight, z, finish.black, .025);
  for (const y of [.89, 1.91]) box(input, .19, .14, 1.01, 0, y, 0, finish.black, .025);
  const slmWindow = new THREE.Mesh(new THREE.PlaneGeometry(.99, .86), new THREE.MeshBasicMaterial({ map: signalTexture('input'), side: THREE.DoubleSide, transparent: true, opacity: .88 }));
  slmWindow.rotation.y = Math.PI / 2; slmWindow.position.set(.006, axisHeight, 0); input.add(slmWindow);
  screws(input, [[.107, .94, -.53], [.107, .94, .53], [.107, 1.87, -.53], [.107, 1.87, .53]], 'x');
  box(input, .2, .1, .2, 0, 1.79, -.71, finish.edge);
  cable(input, [[0, 1.79, -.77], [.1, 1.4, -.94], [.3, .24, -1.03], [.15, .17, -1.42]], finish.rubber, .038);
  box(input, 1.05, .2, .52, .15, .16, -1.6, finish.metal);
  label(input, 'SLM DRIVER', .15, .2, -1.331, .73, '#cbd9dc', '#263439');
  label(input, 'TRANSMISSIVE LCD', .02, .8, .59, 1.13, '#cad5d7', '#303c40');
  stationTag(input, '05  JOINT INPUT', 1.22);

  const fourier = create('fourier', 2.85); mountedLens(fourier, .5); stationTag(fourier, '06  FOURIER LENS', 1.28);

  const camera = create('camera', 4.73); pedestal(camera, .18, 0, .86, .83);
  camera.userData.interaction = { type: 'opt-capture' }; camera.userData.interactionLabel = '采集当前光学输出';
  box(camera, .7, .14, .63, .18, .98, 0, finish.black);
  alloy(box(camera, .84, .64, .66, .22, axisHeight, 0, 0x839ca6, .035), .7, .3);
  for (const z of [-.295, .295]) alloy(box(camera, .08, .68, .11, -.235, axisHeight, z, finish.metal, .016));
  for (const y of [1.115, 1.685]) alloy(box(camera, .08, .11, .48, -.235, y, 0, finish.metal, .016));
  // Short C-mount protective tube and detector window, not an extra imaging lens.
  barrel(camera, .26, .192, .17, -.36, axisHeight, 0, finish.black);
  barrel(camera, .242, .188, .029, -.46, axisHeight, 0, finish.chrome);
  const sensor = new THREE.Mesh(new THREE.PlaneGeometry(.24, .2), new THREE.MeshPhysicalMaterial({ color: 0x537992, metalness: .45, roughness: .12, clearcoat: 1, side: THREE.DoubleSide }));
  sensor.rotation.y = Math.PI / 2; sensor.position.set(-.24, axisHeight, 0); camera.add(sensor);
  screws(camera, [[-.282, 1.64, -.25], [-.282, 1.64, .25], [-.282, 1.16, -.25], [-.282, 1.16, .25]], 'x');
  const cooling = new THREE.InstancedMesh(new THREE.BoxGeometry(.59, .018, .014), material(finish.edge, .55, .35), 6);
  for (let i = 0; i < 6; i++) { matrix.makeTranslation(.2, 1.21 + i * .074, .338); cooling.setMatrixAt(i, matrix); } camera.add(cooling);
  box(camera, .11, .21, .25, .69, 1.41, -.1, finish.black, .012);
  box(camera, .16, .1, .18, .8, 1.41, -.1, finish.edge, .01);
  label(camera, 'MONO CAMERA', .18, 1.76, .19, .9, '#1d343c', '#b6c5cb').rotation.x = -Math.PI / 2;
  const led = cylinder(camera, .024, .015, .655, 1.62, .23, 0x71bc9a); led.rotation.z = Math.PI / 2;
  stationTag(camera, '07  DETECTOR', 1.15);

  const monitor = new THREE.Group(); monitor.position.set(-.55, 0, -1.77); monitor.rotation.y = -.08; camera.add(monitor);
  box(monitor, 1.13, .07, .65, 0, .1, 0, finish.black, .025);
  box(monitor, .18, .54, .16, 0, .4, -.1, finish.metal);
  box(monitor, 1.94, 1.34, .13, 0, 1.16, -.055, finish.black, .045);
  const output = screen(monitor, 0, 1.2, .025, 1.72, 1.03, 'empty');
  label(monitor, 'ACQUISITION / SYNTHETIC', 0, .599, .041, 1.45, '#b8c7cc', '#253138');
  box(monitor, .06, .014, .014, .8, .6, .04, 0xaac9a7, .002);
  cable(camera, [[.85, 1.41, -.1], [1.12, 1.15, -.3], [1.05, .15, -.9], [.55, .13, -1.89], [-.3, .6, -1.86]], finish.rubber, .027);
  box(monitor, 1.34, .06, .42, 0, .1, .65, finish.edge, .022);
  const keys = new THREE.InstancedMesh(new THREE.BoxGeometry(.092, .02, .073), material(0x838f91, .18, .5), 36);
  for (let i = 0; i < 36; i++) { matrix.makeTranslation(-.59 + i % 12 * .108, .145, .51 + Math.floor(i / 12) * .1); keys.setMatrixAt(i, matrix); } monitor.add(keys);

  // Thin core + faint envelope visualize the path without dominating apparatus.
  const beam = new THREE.Group(); beam.userData.pickThrough = true; root.add(beam);
  const beamY = 1.1 + axisHeight;
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xff9e7d, transparent: true, opacity: .8, depthWrite: false, toneMapped: false });
  const beamPoints = [-4.7, -4.08, -3.41, -2.97, -2.02, -.72, 1.03, 2.85, 4.28];
  const segments: THREE.Mesh[] = [], spreads: THREE.Mesh[] = [];
  const radii = [.032, .032, .032, .12, .025, .29, .29, .29, .035];
  for (let i = 0; i < beamPoints.length - 1; i++) {
    const a = beamPoints[i], b = beamPoints[i + 1];
    const light = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, b - a, 8), i === 0 ? beamMat : beamMat.clone());
    light.rotation.z = -Math.PI / 2; light.position.set((a + b) / 2, beamY, 0); beam.add(light); segments.push(light);
    const spread = new THREE.Mesh(new THREE.CylinderGeometry(radii[i + 1], radii[i], b - a, 28, 1, true), new THREE.MeshBasicMaterial({ color: 0xf3a890, transparent: true, opacity: .055, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    spread.rotation.z = -Math.PI / 2; spread.position.copy(light.position); beam.add(spread); spreads.push(spread);
  }
  const nearSpot = new THREE.Mesh(new THREE.CircleGeometry(.028, 20), new THREE.MeshBasicMaterial({ color: 0xffbb91, side: THREE.DoubleSide, depthWrite: false }));
  nearSpot.rotation.y = Math.PI / 2; nearSpot.position.set(-4.091, beamY, 0); beam.add(nearSpot);
  const farSpot = nearSpot.clone(); farSpot.position.x = -3.423; beam.add(farSpot);
  const photons = new THREE.InstancedMesh(new THREE.SphereGeometry(.018, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe5c9, toneMapped: false }), 7); photons.userData.pickThrough = true; root.add(photons);
  iris.userData.inspectionBounds = new THREE.Box3(new THREE.Vector3(-.4, 0, -.5), new THREE.Vector3(1.1, 2.05, 1.1));
  const startPoint = new THREE.Vector3(), endPoint = new THREE.Vector3(), direction = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  let previousInput = '', previousOutput = '';

  return { root, stations, update(props, time) {
    const manual = props.handsOn?.optics;
    const demo = opticalSignals(props.stepId, props.action);
    const inputKind = manual ? manual.input === 'objects' ? 'input' : manual.input === 'spectrum' ? 'spectrum' : 'empty' : demo.input;
    const outputKind = manual ? manual.capture?.kind || 'empty' : demo.output;
    const inputKey = manual ? `manual:${inputKind}:${inputKind === 'spectrum' ? JSON.stringify(manual.spectrum) : ''}` : `demo:${inputKind}`;
    const outputKey = manual ? `manual:${JSON.stringify(manual.capture)}` : `demo:${outputKind}`;
    if (previousInput !== inputKey) {
      slmWindow.material.map?.dispose();
      slmWindow.material.map = manual?.input === 'spectrum' && manual.spectrum ? captureTexture(manual.spectrum) : signalTexture(inputKind);
      slmWindow.material.needsUpdate = true; previousInput = inputKey;
    }
    if (previousOutput !== outputKey) {
      output.material.map?.dispose(); output.material.map = manual?.capture ? captureTexture(manual.capture) : signalTexture(outputKind);
      output.material.needsUpdate = true; previousOutput = outputKey;
    }
    nearScreen.group.visible = farScreen.group.visible = Boolean(manual);
    verticalControl.visible = horizontalControl.visible = focusControl.visible = Boolean(manual);
    (laserLed.material as THREE.MeshStandardMaterial).color.setHex(manual && !manual.laserOn ? 0x47535a : 0x8cbb87);
    (laserLed.material as THREE.MeshStandardMaterial).emissive.setHex(manual && !manual.laserOn ? 0 : 0x284b24);
    (led.material as THREE.MeshStandardMaterial).color.setHex(outputKind === 'empty' ? 0xb7ab70 : 0x71bc9a);
    if (manual) {
      const metrics = opticalMetrics(manual), dz = manual.offsetX / 240, dy = manual.offsetY / 240;
      // Enlarged movements relate the knobs, beam offset and specimen plane.
      // The attenuated envelope represents partial clipping, not a binary gate.
      horizontalControl.rotation.y = manual.offsetX * .12; verticalControl.rotation.y = manual.offsetY * .12; focusControl.rotation.y = manual.focus * .12;
      adjustY.rotation.y = adjustZ.rotation.y = 0;
      adjustX.rotation.x = 0;
      pinholeStage.position.y = manual.offsetY / 650; pinholeStage.position.z = manual.offsetX / 650;
      lensCarriage.position.x = manual.focus / 190;
      nearLever.rotation.x = -.25; farLever.rotation.x = -.15;
      powerSwitch.rotation.y = manual.laserOn ? .25 : -.25;
      [nearScreen, farScreen].forEach((screen, index) => {
        const spot = index ? metrics.far : metrics.near;
        screen.spot.visible = screen.halo.visible = manual.laserOn;
        screen.spot.position.set(spot.x * .0055, spot.y * .0055, .008); screen.halo.position.set(spot.x * .0055, spot.y * .0055, .006);
        screen.spot.scale.setScalar(spot.r * .0055); screen.halo.scale.setScalar(spot.r * .008);
      });
      beam.visible = manual.laserOn && !props.isolated; photons.visible = manual.laserOn && !props.isolated;
      beam.position.set(0, 0, 0);
      segments.forEach((part, i) => {
        const a = beamPoints[i], b = beamPoints[i + 1], distance = b - a;
        startPoint.set(a, beamY + (i ? dy : 0), i ? dz : 0); endPoint.set(b, beamY + dy, dz);
        direction.subVectors(endPoint, startPoint);
        part.scale.y = direction.length() / distance;
        part.position.copy(startPoint).add(endPoint).multiplyScalar(.5); part.quaternion.setFromUnitVectors(up, direction.normalize()); part.visible = true;
        (part.material as THREE.MeshBasicMaterial).opacity = i < 2 ? .8 : .8 * metrics.transmission;
        const spread = spreads[i]; spread.position.copy(part.position); spread.quaternion.copy(part.quaternion); spread.scale.y = part.scale.y; spread.visible = true;
        const expansion = i < 5 ? 1 : 1 + Math.abs(manual.focus) / 42 * (i - 4) / 3;
        spread.scale.x = spread.scale.z = expansion;
        (spread.material as THREE.MeshBasicMaterial).opacity = .065 * (i < 2 ? 1 : metrics.transmission);
      });
      nearSpot.visible = farSpot.visible = false;
      // Static markers remain readable while the scene is idle; continuous
      // rendering is unnecessary when a learner merely leaves the laser on.
      const end = metrics.transmission < .05 ? -3.41 : metrics.transmission < .3 ? -2.02 : 4.28;
      for (let i = 0; i < 7; i++) {
        const x = -4.7 + (i + .5) / 7 * (end + 4.7), proportion = Math.min(1, (x + 4.7) / .62);
        matrix.makeTranslation(x, beamY + dy * proportion, dz * proportion); photons.setMatrixAt(i, matrix);
      }
      photons.instanceMatrix.needsUpdate = true;
      return;
    }
    beam.visible = photons.visible = !props.isolated;
    powerSwitch.rotation.y = 0;
    pinholeStage.position.y = pinholeStage.position.z = lensCarriage.position.x = 0;
    beam.position.y = 0;
    const deviation = props.alignment / 210;
    beam.position.z = deviation;
    // Motion is enlarged for visibility; this is not a micrometer calibration.
    adjustY.rotation.y = props.alignment * .035;
    adjustZ.rotation.y = props.alignment * .035;
    adjustX.rotation.x = props.stepId === 'jtc-filter' ? props.action * .5 : 0;
    nearLever.rotation.x = props.stepId === 'jtc-axis' ? -.25 : -.1;
    farLever.rotation.x = props.stepId === 'jtc-coaxial' ? -.2 : -.08;
    const pastNear = Math.abs(deviation) < .18, pastFar = Math.abs(deviation) < .13, pastPinhole = Math.abs(props.alignment) < 8;
    segments.forEach((part, i) => {
      part.position.set((beamPoints[i] + beamPoints[i + 1]) / 2, beamY, 0); part.rotation.set(0, 0, -Math.PI / 2); part.scale.set(1, 1, 1);
      (part.material as THREE.MeshBasicMaterial).opacity = .8;
      spreads[i].position.copy(part.position); spreads[i].rotation.copy(part.rotation); spreads[i].scale.set(1, 1, 1); (spreads[i].material as THREE.MeshBasicMaterial).opacity = .055;
      part.visible = i === 0 || i === 1 && pastNear || i > 1 && i < 4 && pastNear && pastFar || i >= 4 && pastNear && pastFar && pastPinhole;
      spreads[i].visible = part.visible;
    });
    nearSpot.visible = !pastNear; farSpot.visible = pastNear && !pastFar;
    const end = !pastNear ? -4.08 : !pastFar ? -3.41 : !pastPinhole ? -2.02 : 4.28;
    for (let i = 0; i < 7; i++) {
      const x = -4.7 + ((time * .16 + i / 7) % 1) * (end + 4.7);
      matrix.makeTranslation(x, beamY, deviation); photons.setMatrixAt(i, matrix);
    }
    photons.instanceMatrix.needsUpdate = true;
  } };
}
