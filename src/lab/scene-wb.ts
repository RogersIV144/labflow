import * as THREE from 'three';
import { palette, material, box, cylinder, station, label, tube, bottle, signalTexture, screen, bench, type Model } from './scene-primitives';

// Generic instruments informed by manufacturer construction diagrams; no device
// dimensions, numeric operating conditions, or measured outputs are implied.
const steel = 0xbfc8cb, graphite = 0x273136, rubber = 0x172328, red = 0xb94039;
function ring(parent: THREE.Object3D, radius: number, thickness: number, x: number, y: number, z: number, color: number) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 10, 48), material(color, .65, .3));
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, y, z); parent.add(mesh); return mesh;
}
function glass(mesh: THREE.Mesh, opacity = .17, color = 0xc6e5e9) {
  const mat = mesh.material as THREE.MeshStandardMaterial;
  mat.color.setHex(color); mat.transparent = true; mat.opacity = opacity; mat.depthWrite = false; mat.roughness = .14; mat.metalness = .08;
  mesh.castShadow = false; mesh.renderOrder = 2; return mesh;
}
function repeat(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: number, positions: [number, number, number][]) {
  const mesh = new THREE.InstancedMesh(geometry, material(color, .15, .45), positions.length), matrix = new THREE.Matrix4();
  positions.forEach((point, index) => { matrix.makeTranslation(...point); mesh.setMatrixAt(index, matrix); });
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function feet(parent: THREE.Object3D, width: number, depth: number) {
  repeat(parent, new THREE.CylinderGeometry(.085, .09, .1, 12), rubber, [-1, 1].flatMap(x => [-1, 1].map(z => [x * width / 2, .06, z * depth / 2] as [number, number, number])));
}
function dial(parent: THREE.Object3D, x: number, y: number, z: number, radius = .08, color = graphite) {
  const knob = cylinder(parent, radius, .07, x, y, z, color); knob.rotation.x = Math.PI / 2;
  box(parent, .012, radius * .55, .008, x, y + radius * .3, z + .039, 0xcbd1cf, .002); return knob;
}
function vents(parent: THREE.Object3D, x: number, y: number, z: number, count = 8, width = .45) {
  repeat(parent, new THREE.BoxGeometry(width, .018, .012), rubber, Array.from({ length: count }, (_, i) => [x, y + i * .043, z]));
}
function trayShell(parent: THREE.Object3D, w: number, d: number, color: number, height = .17) {
  box(parent, w, .04, d, 0, .025, 0, color, .025);
  for (const x of [-w / 2, w / 2]) box(parent, .045, height, d, x, height / 2, 0, color, .012);
  for (const z of [-d / 2, d / 2]) box(parent, w, height, .045, 0, height / 2, z, color, .012);
}
function tankWalls(parent: THREE.Object3D, w: number, h: number, d: number) {
  glass(box(parent, w, .065, d, 0, .15, 0, 0xcbe5e7));
  for (const x of [-w / 2, w / 2]) glass(box(parent, .045, h, d, x, .17 + h / 2, 0, 0xcbe5e7), .22);
  for (const z of [-d / 2, d / 2]) glass(box(parent, w, h, .045, 0, .17 + h / 2, z, 0xcbe5e7), .12);
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) box(parent, .035, h, .035, x, .17 + h / 2, z, 0x9fbdbe, .009);
}
function terminal(parent: THREE.Object3D, x: number, y: number, z: number, color: number) {
  cylinder(parent, .07, .1, x, y, z, color); cylinder(parent, .027, .065, x, y + .075, z, steel);
}
function movingLead(parent: THREE.Object3D, points: number[][], color: number) {
  const path = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point as [number, number, number])));
  const geometry = new THREE.TubeGeometry(path, 24, .024, 8, false);
  const mesh = new THREE.Mesh(geometry, material(color)); parent.add(mesh);
  const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
  const center = new THREE.Vector3(), normal = new THREE.Vector3();
  const originalBendY = points[1][1]; let previousY = points[0][1];
  return (y: number) => {
    if (Math.abs(y - previousY) < .001) return;
    previousY = y; path.points[0].y = y; path.points[1].y = Math.max(originalBendY, y + .09); path.updateArcLengths();
    const frames = path.computeFrenetFrames(24, false);
    for (let i = 0; i <= 24; i++) {
      path.getPointAt(i / 24, center);
      for (let j = 0; j <= 8; j++) {
        const angle = j / 8 * Math.PI * 2, index = i * 9 + j;
        normal.copy(frames.normals[i]).multiplyScalar(-Math.cos(angle)).addScaledVector(frames.binormals[i], Math.sin(angle)).normalize();
        normals.setXYZ(index, normal.x, normal.y, normal.z);
        positions.setXYZ(index, center.x + normal.x * .024, center.y + normal.y * .024, center.z + normal.z * .024);
      }
    }
    positions.needsUpdate = true; normals.needsUpdate = true; geometry.computeBoundingSphere();
  };
}
function frontStatus(parent: THREE.Object3D, text: string, x: number, y: number, z: number, width: number) {
  box(parent, width + .08, width * .23, .035, x, y, z - .01, graphite, .018);
  return label(parent, text, x, y, z + .014, width, '#b8e3d0', '#16282b');
}

export function buildWB(): Model {
  const root = new THREE.Group(); bench(root, false);
  const stations: Model['stations'] = {};
  const reagents = stations.reagents = station(root, 'reagents', -5.15, -1.15);
  const reagentTray = new THREE.Group(); reagentTray.position.y = .02; reagents.add(reagentTray); trayShell(reagentTray, 1.6, 1.05, 0xa9b9b4, .12);
  bottle(reagents, -.45, -.1, palette.teal, 'LYSIS'); bottle(reagents, .1, -.12, 0x4676a3, 'BUFFER');
  const amberBottle = new THREE.Group(); amberBottle.position.set(.56, .05, .28); amberBottle.scale.setScalar(.63); reagents.add(amberBottle);
  cylinder(amberBottle, .22, .6, 0, .35, 0, 0x925d27); cylinder(amberBottle, .13, .14, 0, .72, 0, 0x232d2e);
  label(amberBottle, 'ANTIBODY', 0, .37, .222, .39, '#38473c', '#e6ddbc');
  box(reagents, .45, .05, .28, -.25, .09, .37, 0xe9e9de, .015).rotation.y = -.1;
  label(reagents, 'MEMBRANE', -.25, .12, .37, .37, '#3c5e62', '#f0f3ed').rotation.x = -Math.PI / 2;
  label(reagents, 'REAGENTS / CONSUMABLES', 0, .08, .57, 1.35, '#42625d', '#dbe3dc');

  const sample = stations.sample = station(root, 'sample', -4.25, 1.05);
  const iceBox = new THREE.Group(); iceBox.position.set(-.45, .02, 0); sample.add(iceBox); trayShell(iceBox, 1.36, .96, 0x8eb0bc, .29);
  box(iceBox, 1.25, .06, .85, 0, .24, 0, 0xc9dbdf); box(iceBox, 1.06, .1, .66, 0, .31, 0, 0x397d8c, .025);
  const tubePositions: [number, number, number][] = [];
  for (let x = 0; x < 4; x++) for (let z = 0; z < 2; z++) tubePositions.push([-.39 + x * .26, .368, -.17 + z * .34]);
  repeat(iceBox, new THREE.CylinderGeometry(.078, .078, .013, 20), graphite, tubePositions);
  const tubes = tubePositions.slice(0, 6).map(([x, y, z], i) => { const t = tube(iceBox, x, y - .2, z, i % 2 ? 0xc5aa61 : 0x5e96ad); t.group.scale.setScalar(.83); return t; });
  label(iceBox, 'SAMPLE RACK', 0, .14, .505, .8, '#edf4eb', '#3a616b');
  const pipette = new THREE.Group(); sample.add(pipette); pipette.position.set(-.58, 1.6, .17);
  const grip = cylinder(pipette, .092, .62, 0, .15, 0, 0xe9eae1, .067); grip.material.metalness = .02; grip.material.roughness = .44;
  cylinder(pipette, .062, .21, 0, .55, 0, graphite);
  const plunger = cylinder(pipette, .105, .06, 0, .69, 0, 0x4b8eaa);
  box(pipette, .19, .07, .12, .065, .39, 0, 0xe9eae1, .025);
  cylinder(pipette, .027, .42, .087, -.1, 0, steel); // Tip-ejector rod.
  cylinder(pipette, .049, .19, 0, -.28, 0, graphite, .038); cylinder(pipette, .031, .27, 0, -.5, 0, 0xa7bbc1, .018);
  glass(cylinder(pipette, .035, .32, 0, -.77, 0, 0xc9e8e8, .006), .48);
  box(pipette, .08, .15, .02, 0, .16, .081, graphite, .009); label(pipette, 'µL', 0, .17, .094, .065, '#dae4d5', '#1b2d32');
  const liquidDrop = new THREE.Mesh(new THREE.SphereGeometry(.018, 12, 10), material(0x6eafb5, .05, .2)); liquidDrop.position.set(0, -.94, 0); pipette.add(liquidDrop);
  const tipBox = new THREE.Group(); tipBox.position.set(-1.52, .04, -.42); tipBox.scale.setScalar(.64); sample.add(tipBox);
  box(tipBox, .64, .27, .75, 0, .15, 0, 0xd1caa9, .025); box(tipBox, .6, .045, .7, 0, .3, 0, 0xd8b75b);
  repeat(tipBox, new THREE.CylinderGeometry(.027, .011, .11, 12), 0xdce4d9, Array.from({ length: 30 }, (_, i) => [-.23 + (i % 5) * .115, .355, -.29 + Math.floor(i / 5) * .115]));
  glass(box(tipBox, .65, .04, .74, 0, .71, -.22, 0xc8dce0), .25).rotation.x = -.95;
  const heatBlock = new THREE.Group(); heatBlock.position.set(.78, 0, -.3); sample.add(heatBlock);
  feet(heatBlock, .7, .65); box(heatBlock, 1.01, .4, .94, 0, .28, 0, 0xe2e4de, .06);
  const aluminum = box(heatBlock, .79, .16, .6, 0, .56, -.09, steel, .015); aluminum.material.metalness = .72; aluminum.material.roughness = .31;
  repeat(heatBlock, new THREE.CylinderGeometry(.055, .055, .015, 20), graphite, Array.from({ length: 12 }, (_, i) => [-.27 + (i % 4) * .18, .648, -.27 + Math.floor(i / 4) * .18]));
  const warmTubes = [tube(heatBlock, -.09, .38, -.09, 0xc4ac60), tube(heatBlock, .09, .38, -.09, 0xc4ac60)]; warmTubes.forEach(t => t.group.scale.setScalar(.72));
  frontStatus(heatBlock, 'STANDBY', -.15, .29, .48, .47); dial(heatBlock, .32, .29, .5, .075);
  label(heatBlock, 'DRY BLOCK', 0, .12, .484, .67, '#60736f', '#e2e4de');
  const heatLed = cylinder(heatBlock, .025, .012, .29, .43, .48, 0x71a38b); heatLed.rotation.x = Math.PI / 2;
  const plate = new THREE.Group(); plate.position.set(.82, .06, .59); sample.add(plate); box(plate, 1.03, .09, .64, 0, .035, 0, 0xe0e2db, .012);
  repeat(plate, new THREE.CylinderGeometry(.031, .031, .012, 12), 0x667d85, Array.from({ length: 96 }, (_, i) => [-.43 + (i % 12) * .078, .085, -.245 + Math.floor(i / 12) * .07]));
  const wellLiquid = repeat(plate, new THREE.CylinderGeometry(.023, .023, .015, 10), 0xa2b5c0, Array.from({ length: 96 }, (_, i) => [-.43 + (i % 12) * .078, .093, -.245 + Math.floor(i / 12) * .07]));
  label(plate, 'A–H / 1–12', 0, .04, .329, .68, '#536b70', '#e5e9e0');
  sample.userData.inspectionBounds = new THREE.Box3(new THREE.Vector3(-1.78, 0, -.9), new THREE.Vector3(1.4, 2.48, 1));

  const centrifuge = stations.centrifuge = station(root, 'centrifuge', -2.25, -1.03);
  feet(centrifuge, 1.5, 1.25); box(centrifuge, 1.98, .63, 1.75, 0, .42, 0, 0xe4e7df, .12);
  for (const x of [-.93, .93]) box(centrifuge, .12, .26, 1.62, x, .82, -.03, 0xe4e7df, .035);
  box(centrifuge, 1.82, .26, .16, 0, .82, -.82, 0xe4e7df, .035); box(centrifuge, 1.82, .26, .23, 0, .82, .76, 0xe4e7df, .035);
  // Rounded bezel with a circular opening and a concave metal bowl.
  const bezelShape = new THREE.Shape(); const bw = .98, bd = .87, br = .12;
  bezelShape.moveTo(-bw + br, -bd); bezelShape.lineTo(bw - br, -bd); bezelShape.quadraticCurveTo(bw, -bd, bw, -bd + br);
  bezelShape.lineTo(bw, bd - br); bezelShape.quadraticCurveTo(bw, bd, bw - br, bd); bezelShape.lineTo(-bw + br, bd);
  bezelShape.quadraticCurveTo(-bw, bd, -bw, bd - br); bezelShape.lineTo(-bw, -bd + br); bezelShape.quadraticCurveTo(-bw, -bd, -bw + br, -bd);
  const wellHole = new THREE.Path(); wellHole.absarc(0, .1, .7, 0, Math.PI * 2, true); bezelShape.holes.push(wellHole);
  const bezel = new THREE.Mesh(new THREE.ExtrudeGeometry(bezelShape, { depth: .055, bevelEnabled: false, curveSegments: 36 }), material(0xe4e7df)); bezel.rotation.x = -Math.PI / 2; bezel.position.y = .92; centrifuge.add(bezel);
  cylinder(centrifuge, .66, .05, 0, .72, -.1, graphite);
  const bowl = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(.57, .72), new THREE.Vector2(.62, .77), new THREE.Vector2(.69, .94)], 48), new THREE.MeshStandardMaterial({ color: steel, metalness: .78, roughness: .29, side: THREE.DoubleSide })); bowl.position.z = -.1; centrifuge.add(bowl);
  ring(centrifuge, .7, .025, 0, .97, -.1, rubber);
  const rotor = new THREE.Group(); rotor.position.set(0, .7, -.1); centrifuge.add(rotor); cylinder(rotor, .57, .14, 0, .03, 0, 0x3d484d, .5); cylinder(rotor, .13, .17, 0, .14, 0, steel);
  repeat(rotor, new THREE.CylinderGeometry(.067, .06, .022, 20), 0x111e23, Array.from({ length: 12 }, (_, i) => [Math.cos(i * Math.PI / 6) * .44, .11, Math.sin(i * Math.PI / 6) * .44]));
  for (const i of [0, 3, 6, 9]) {
    const angle = i * Math.PI / 6, holder = new THREE.Group(); holder.position.set(Math.cos(angle) * .44, .11, Math.sin(angle) * .44);
    holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-Math.cos(angle) * .4, .9, -Math.sin(angle) * .4).normalize()); rotor.add(holder);
    const t = tube(holder, 0, -.16, 0, i % 6 === 0 ? 0x67a6aa : 0xc9ac62); t.group.scale.setScalar(.47);
  }
  const rotorCover = new THREE.Group(); rotorCover.position.y = .17; rotor.add(rotorCover);
  cylinder(rotorCover, .59, .045, 0, .05, 0, 0x35474c); ring(rotorCover, .55, .016, 0, .075, 0, steel); cylinder(rotorCover, .12, .04, 0, .07, 0, graphite); rotorCover.visible = false;
  const lid = new THREE.Group(); lid.position.set(0, .98, -.78); centrifuge.add(lid);
  box(lid, 1.96, .13, 1.7, 0, .055, .76, 0xdbe1d8, .1); cylinder(lid, .68, .055, 0, -.028, .68, 0x929f9a); ring(lid, .66, .025, 0, -.062, .68, rubber);
  box(lid, .32, .09, .08, 0, -.04, 1.53, graphite, .02); lid.rotation.x = -1.25;
  for (const x of [-.63, .63]) cylinder(centrifuge, .065, .21, x, .97, -.79, steel).rotation.z = Math.PI / 2;
  frontStatus(centrifuge, 'MICROCENTRIFUGE', -.18, .53, .883, .89); dial(centrifuge, .65, .53, .9, .105);
  label(centrifuge, 'BALANCED LOAD / LID LOCK', -.12, .28, .889, 1.35, '#4f6664', '#e4e7df'); vents(centrifuge, -.73, .38, .887, 5, .22);
  const centrifugeLed = cylinder(centrifuge, .025, .013, .48, .7, .891, 0x75a996); centrifugeLed.rotation.x = Math.PI / 2;
  const separated = new THREE.Group(); separated.position.set(1.2, .1, .64); centrifuge.add(separated);
  cylinder(separated, .15, .045, 0, .035, 0, graphite); tube(separated, 0, .05, 0, palette.teal).group.scale.setScalar(1.05); cylinder(separated, .037, .035, 0, .16, 0, palette.amber, .008); separated.visible = false;
  centrifuge.userData.inspectionBounds = new THREE.Box3(new THREE.Vector3(-1.1, 0, -1), new THREE.Vector3(1.4, 2.65, 1));
  centrifuge.userData.viewDirection = [2.5, 3.8, 5.8];

  const gel = stations.gel = station(root, 'gel', -.2, 1.12);
  box(gel, 1.62, .14, 1.25, 0, .09, 0, 0x3c737a, .035); tankWalls(gel, 1.5, 1.16, 1.06);
  glass(box(gel, 1.41, .55, .97, 0, .47, 0, 0x8cbfca), .1, 0x82b5c8);
  for (const x of [-.59, .59]) box(gel, .12, 1.13, .5, x, .78, -.05, 0x3f8587, .025);
  box(gel, 1.2, .1, .47, 0, 1.31, -.05, 0x3f8587);
  for (const z of [-.23, .22]) glass(box(gel, 1.04, 1.03, .035, 0, .79, z, 0xd2e6dc), .27);
  glass(box(gel, .97, .91, .035, 0, .78, .19, 0xa8ccd1), .45);
  for (const x of [-.5, .5]) box(gel, .028, 1.04, .06, x, .8, .21, 0xd9e8db, .004);
  const bands: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    box(gel, .075, .065, .012, -.407 + i * .116, 1.235, .242, 0x426574, .004);
    for (let j = 0; j < 3; j++) bands.push(box(gel, .072, .018, .008, -.407 + i * .116, 1.15 - j * .11, .248, [0x225489, 0x5a83a3, 0x7c6c87][j], .004));
  }
  const gelLid = new THREE.Group(); gel.add(gelLid); gelLid.position.y = 1.4;
  glass(box(gelLid, 1.62, .085, 1.2, 0, 0, 0, 0xb1cbd0), .32); box(gelLid, .54, .08, .16, 0, .08, -.22, 0x326c73, .025);
  terminal(gelLid, -.54, .09, -.35, graphite); terminal(gelLid, .54, .09, -.35, red);
  label(gel, 'VERTICAL ELECTROPHORESIS', 0, .092, .641, 1.38, '#d3e2dc', '#33616b');
  const comb = new THREE.Group(); comb.position.set(-.1, .12, .77); comb.rotation.x = Math.PI / 2; comb.rotation.z = .1; gel.add(comb);
  box(comb, .98, .07, .055, 0, 0, 0, 0x659f8c, .009); repeat(comb, new THREE.BoxGeometry(.07, .17, .05), 0x659f8c, Array.from({ length: 8 }, (_, i) => [-.407 + i * .116, -.1, 0]));
  const power = new THREE.Group(); power.position.set(-.03, 0, -1.75); gel.add(power);
  feet(power, .95, .65); box(power, 1.33, .48, .94, 0, .33, 0, 0xe6e9e2, .055); box(power, 1.15, .31, .025, 0, .34, .482, 0x36595d, .02);
  frontStatus(power, 'DC OUTPUT', -.21, .4, .502, .57); dial(power, .39, .39, .512, .07); label(power, 'POWER SUPPLY', 0, .18, .503, .9, '#e0e7dc', '#36595d');
  terminal(power, -.43, .61, -.12, graphite); terminal(power, .43, .61, -.12, red);
  const gelRedLead = movingLead(gel, [[.54, 1.57, -.35], [.88, 1.66, -.75], [.76, .79, -1.6], [.4, .72, -1.87]], red);
  const gelBlackLead = movingLead(gel, [[-.54, 1.57, -.35], [-.85, 1.59, -.82], [-.78, .72, -1.65], [-.46, .72, -1.87]], graphite);
  gel.userData.inspectionBounds = new THREE.Box3(new THREE.Vector3(-1, 0, -2.25), new THREE.Vector3(1, 2.1, .95)); gel.userData.viewDirection = [2.5, 3, 6];

  const transfer = stations.transfer = station(root, 'transfer', 2.08, -.92);
  box(transfer, 1.7, .14, 1.34, .08, .09, 0, 0x4a727c, .025);
  const transferTank = new THREE.Group(); transferTank.position.x = .08; transfer.add(transferTank); tankWalls(transferTank, 1.58, 1.32, 1.2);
  glass(box(transferTank, 1.48, 1.08, 1.1, 0, .73, 0, 0x94c4d1), .09, 0x9cc5d3);
  box(transferTank, .25, 1.2, .8, .55, .81, -.02, 0x538eab, .05); box(transferTank, .12, .08, .24, .55, 1.46, -.02, 0x306a83, .02);
  // Electrodes remain outside the removable cassette; the membrane faces positive.
  for (const [z, color] of [[-.48, graphite], [.48, red]] as const) {
    for (const x of [-.6, .34]) box(transferTank, .055, 1.08, .055, x, .87, z, color, .008);
    for (const y of [.34, 1.4]) box(transferTank, .99, .055, .055, -.13, y, z, color, .008);
    repeat(transferTank, new THREE.CylinderGeometry(.008, .008, .98, 6), steel, Array.from({ length: 7 }, (_, i) => [-.54 + i * .135, .86, z]));
  }
  const stack = new THREE.Group(); stack.position.set(-.05, .87, 0); transfer.add(stack);
  const layers: THREE.Group[] = [], layerSurfaces: THREE.Mesh[] = [];
  const layerColors = [graphite, 0xc4c9b4, 0xf1ecda, 0xa0c7d1, 0xf0efdf, 0xf1ecda, 0xc4c9b4, 0xb8c9c6];
  const layerNames = ['BLACK CASSETTE', 'FIBRE PAD', 'FILTER PAPER', 'GEL', 'MEMBRANE', 'FILTER PAPER', 'FIBRE PAD', 'CLEAR CASSETTE'];
  layerColors.forEach((color, i) => {
    const layer = new THREE.Group(); stack.add(layer); layers.push(layer); layer.position.z = -.21 + i * .06;
    if (i === 0 || i === 7) {
      for (const x of [-.48, .48]) box(layer, .05, 1.02, .04, x, 0, 0, color, .008);
      for (const y of [-.51, .51]) box(layer, 1.01, .05, .04, 0, y, 0, color, .008);
      repeat(layer, new THREE.BoxGeometry(.028, .96, .025), color, Array.from({ length: 9 }, (_, index) => [-.4 + index * .1, 0, 0]));
      repeat(layer, new THREE.BoxGeometry(.94, .025, .025), color, Array.from({ length: 7 }, (_, index) => [0, -.42 + index * .14, .006]));
      box(layer, .2, .12, .055, 0, .58, 0, color, .015);
    } else {
      const sheet = box(layer, .89, .91, i === 1 || i === 6 ? .045 : .018, 0, 0, 0, color, .006); layerSurfaces.push(sheet); sheet.material.roughness = i === 3 ? .24 : .85;
    }
  });
  const stackLabels = layers.map((layer, i) => label(layer, layerNames[i], 1.02, .9 - i * .21, .025, .91, '#dfebe5', '#325963'));
  const transferLid = new THREE.Group(); transferLid.position.set(.08, 1.55, 0); transfer.add(transferLid);
  glass(box(transferLid, 1.72, .09, 1.34, 0, 0, 0, 0xa9c8c9), .28); terminal(transferLid, -.55, .11, -.43, graphite); terminal(transferLid, .55, .11, .43, red); box(transferLid, .42, .1, .14, 0, .1, 0, 0x4a727c, .025);
  label(transfer, '− CATHODE', -.39, .18, -.63, .7, '#e5e9dc', '#2e454d'); label(transfer, '+ ANODE', -.39, .18, .69, .7, '#f0e6d6', '#9c4b42');
  const transferPower = new THREE.Group(); transferPower.position.set(1.55, 0, -.35); transfer.add(transferPower);
  feet(transferPower, .58, .62); box(transferPower, .82, .42, .88, 0, .31, 0, 0xe3e7e2, .045);
  frontStatus(transferPower, 'DC OUTPUT', 0, .34, .453, .56); label(transferPower, 'TRANSFER', 0, .17, .455, .57, '#526b6d', '#e3e7e2');
  terminal(transferPower, -.18, .57, -.12, graphite); terminal(transferPower, .18, .57, -.12, red);
  const transferRedLead = movingLead(transfer, [[.63, 1.72, .43], [1.02, 1.81, .58], [1.95, .92, .19], [1.73, .645, -.47]], red);
  const transferBlackLead = movingLead(transfer, [[-.47, 1.72, -.43], [-.81, 1.8, -.72], [.55, .78, -1.06], [1.37, .645, -.47]], graphite);
  const wetting = new THREE.Group(); wetting.position.set(-1.13, .05, .07); transfer.add(wetting); trayShell(wetting, .58, .93, 0xe5e9df, .12);
  glass(box(wetting, .52, .02, .85, 0, .09, 0, 0xb1d1ca), .34); box(wetting, .36, .012, .55, 0, .08, 0, 0xeeecdf, .006);
  const forceps = new THREE.Group(); forceps.position.set(-1.12, .19, .55); forceps.rotation.y = -.3; transfer.add(forceps); for (const x of [-.025, .025]) box(forceps, .025, .02, .45, x, 0, 0, steel, .004);
  const transferBands = new THREE.Group(); layers[4].add(transferBands); for (let i = 0; i < 5; i++) box(transferBands, .1, .022, .006, -.34 + i * .17, -.08 + (i % 2) * .13, .015, 0x50778a, .004);
  const transferParticles = repeat(stack, new THREE.SphereGeometry(.014, 8, 8), 0x4b8198, Array.from({ length: 10 }, (_, i) => [-.34 + (i % 5) * .17, -.12 + Math.floor(i / 5) * .24, 0]));
  transfer.userData.inspectionBounds = new THREE.Box3(new THREE.Vector3(-1.5, 0, -1.15), new THREE.Vector3(2.1, 2.5, 1.15)); transfer.userData.viewDirection = [4, 2.7, 5.6];

  const tray = stations.tray = station(root, 'tray', 3.02, 1.3);
  feet(tray, 1.25, .95); box(tray, 1.77, .26, 1.3, 0, .24, 0, 0xe3e5de, .055); frontStatus(tray, 'ROCKING PLATFORM', -.17, .24, .667, .95); dial(tray, .64, .25, .682, .09); cylinder(tray, .16, .24, 0, .45, 0, steel);
  const shaker = new THREE.Group(); shaker.position.y = .56; tray.add(shaker); box(shaker, 1.66, .08, 1.19, 0, 0, 0, graphite, .025);
  repeat(shaker, new THREE.BoxGeometry(1.45, .012, .025), 0x485756, Array.from({ length: 14 }, (_, i) => [0, .046, -.5 + i * .077]));
  const incubationTray = new THREE.Group(); incubationTray.position.y = .1; shaker.add(incubationTray); trayShell(incubationTray, 1.22, .83, 0xe5e9df, .17);
  box(incubationTray, .85, .012, .53, 0, .055, 0, 0xd9dfc7, .004); const fluid = glass(box(incubationTray, 1.15, .035, .76, 0, .11, 0, 0xa8d2cb), .32);
  const antibodies = new THREE.Group(); antibodies.position.y = .19; incubationTray.add(antibodies);
  for (let i = 0; i < 8; i++) {
    const a = new THREE.Group(); a.position.set(-.32 + (i % 4) * .21, .015, -.15 + Math.floor(i / 4) * .3); antibodies.add(a); box(a, .013, .06, .012, 0, 0, 0, 0xc09c59, .003);
    box(a, .013, .045, .012, -.014, .04, 0, 0xc09c59, .003).rotation.z = -.6; box(a, .013, .045, .012, .014, .04, 0, 0xc09c59, .003).rotation.z = .6;
  }
  const secondaryMarkers = repeat(antibodies, new THREE.SphereGeometry(.019, 8, 8), 0x76a2b3, Array.from({ length: 8 }, (_, i) => [-.32 + (i % 4) * .21, .09, -.15 + Math.floor(i / 4) * .3]));
  const wash = new THREE.Group(); incubationTray.add(wash); for (let i = 0; i < 6; i++) wash.add(new THREE.Mesh(new THREE.SphereGeometry(.012, 8, 8), material(0xc2a771)));
  label(tray, 'INCUBATION / WASH', 0, .11, .67, 1.3, '#58706a', '#e3e5de');

  const imager = stations.imager = station(root, 'imager', 4.97, -.78);
  feet(imager, 1.15, 1.05); box(imager, 1.64, .22, 1.5, 0, .2, 0, 0xdfe4df, .065);
  for (const x of [-.72, .72]) box(imager, .18, 1.64, 1.43, x, 1.09, 0, 0xe1e5df, .045);
  box(imager, 1.5, 1.64, .16, 0, 1.09, -.65, 0xe1e5df, .035); box(imager, 1.64, .3, 1.5, 0, 1.91, 0, 0xdfe4df, .065);
  box(imager, 1.35, .03, 1.25, 0, .35, 0, graphite); box(imager, 1.3, 1.37, .04, 0, 1.1, -.55, 0x18292f, .015);
  cylinder(imager, .16, .28, 0, 1.65, -.02, graphite); ring(imager, .14, .02, 0, 1.5, -.02, steel); cylinder(imager, .115, .012, 0, 1.5, -.02, 0x3b7184);
  for (const x of [-.61, .61]) box(imager, .035, .035, 1.12, x, .43, .02, steel, .009);
  const imageTray = new THREE.Group(); imageTray.position.set(0, .46, .42); imager.add(imageTray);
  box(imageTray, 1.22, .06, 1.08, 0, 0, 0, graphite, .02); box(imageTray, 1.05, .025, .84, 0, .047, 0, 0xe5e8df, .01); box(imageTray, .65, .009, .48, 0, .067, 0, 0xeeece1, .004); box(imageTray, .5, .055, .09, 0, .02, .57, steel, .012);
  const door = new THREE.Group(); door.position.set(-.69, 1.07, .75); imager.add(door);
  box(door, 1.39, 1.43, .13, .695, 0, 0, 0x354d55, .055); box(door, 1.24, 1.28, .025, .695, 0, -.08, rubber, .035); box(door, .065, .48, .09, 1.2, .03, .12, steel, .025);
  label(door, 'CHEMILUMINESCENCE', .69, .34, .071, 1.07, '#cddcd6', '#354d55'); label(door, 'DARK CHAMBER', .69, -.49, .071, .9, '#b4c8c4', '#354d55'); door.rotation.y = -1.65;
  for (const y of [.58, 1.58]) cylinder(imager, .045, .18, -.72, y, .75, steel); vents(imager, 0, 1.86, .762, 4, .85);
  const monitor = new THREE.Group(); monitor.position.set(.84, 1.65, .16); monitor.rotation.y = -.22; imager.add(monitor); cylinder(monitor, .045, .37, 0, .06, -.08, steel);
  box(imager, .3, .065, .13, .76, 1.59, .08, steel, .012);
  const image = screen(monitor, 0, .62, .015, 1.12, .79, 'empty'); box(monitor, 1.3, .08, .13, 0, .16, -.025, graphite, .02); label(monitor, 'SYNTHETIC PREVIEW', 0, .17, .056, .95, '#b7cac4', '#253638');
  cylinder(imager, .028, .018, .51, 1.91, .762, 0x79b09e).rotation.x = Math.PI / 2;
  imager.userData.inspectionBounds = new THREE.Box3(new THREE.Vector3(-.95, 0, -.85), new THREE.Vector3(1.55, 2.8, 2.25)); imager.userData.viewDirection = [3.4, 2.4, 6];
  let lastImage = '', lastWellState = false;
  const scratchMatrix = new THREE.Matrix4();
  return { root, stations, update(props, time, dt) {
    const fraction = props.action / Math.max(1, props.total), pipetting = props.stepId === 'wb-lysis' && props.action >= 2;
    const targetTube = tubes[3], openTube = props.stepId === 'wb-lysis' && props.action >= 1;
    // The cap opens before the tip descends, and stays clear until the tip leaves.
    const capTarget = openTube || pipette.position.y < 1.68 ? -1.9 : 0;
    targetTube.cap.rotation.x = THREE.MathUtils.damp(targetTube.cap.rotation.x, capTarget, 8, dt);
    const tipMayEnter = pipetting && targetTube.cap.rotation.x < -1.45;
    pipette.position.y = THREE.MathUtils.damp(pipette.position.y, tipMayEnter ? 1.48 : 1.72, 6, dt); plunger.position.y = THREE.MathUtils.damp(plunger.position.y, tipMayEnter ? .62 : .69, 5, dt);
    liquidDrop.visible = tipMayEnter && pipette.position.y < 1.53; tubes.forEach(t => { t.liquid.scale.y = pipetting ? 1.3 : 1; }); warmTubes.forEach(t => { t.group.visible = props.stepId === 'wb-denature'; });
    (heatLed.material as THREE.MeshStandardMaterial).color.setHex(props.stepId === 'wb-denature' && props.action > 0 ? 0xd0a35b : 0x71a38b);
    const quantified = props.stepId === 'wb-quantify' && props.action >= 2;
    if (quantified !== lastWellState || !wellLiquid.instanceColor) { for (let i = 0; i < 96; i++) wellLiquid.setColorAt(i, new THREE.Color(quantified ? [0x9a8db4, 0x796995, 0xbbb0ca, 0x8b7ca5][Math.floor(i / 12) % 4] : 0xa2b5c0)); if (wellLiquid.instanceColor) wellLiquid.instanceColor.needsUpdate = true; lastWellState = quantified; }
    const spinning = props.stepId === 'wb-collect' && props.action === 2;
    lid.rotation.x = THREE.MathUtils.damp(lid.rotation.x, spinning ? 0 : -1.25, 6, dt); rotorCover.visible = spinning;
    // An exposed rotor never spins, including the closing-lid transition.
    if (spinning && props.running && Math.abs(lid.rotation.x) < .035) rotor.rotation.y += dt * 11;
    separated.visible = props.stepId === 'wb-collect' && props.action >= 3; (centrifugeLed.material as THREE.MeshStandardMaterial).color.setHex(spinning ? 0xd0a35b : 0x75a996);
    gelLid.position.y = THREE.MathUtils.damp(gelLid.position.y, props.stepId === 'wb-gel' && props.action < 3 ? 1.73 : 1.4, 5, dt);
    gelRedLead(gelLid.position.y + .17); gelBlackLead(gelLid.position.y + .17);
    bands.forEach((band, i) => { const row = i % 3, target = props.station === 'gel' ? 1.15 - row * (.08 + .13 * fraction) - .21 * fraction : .97 - row * .19; band.position.y = THREE.MathUtils.damp(band.position.y, target, 4, dt); });
    const expanded = props.station === 'transfer' && props.exploded;
    layers.forEach((layer, i) => { layer.position.z = THREE.MathUtils.damp(layer.position.z, (i - 3.5) * (expanded ? .24 : .06), 5, dt); stackLabels[i].visible = expanded; });
    stack.position.y = THREE.MathUtils.damp(stack.position.y, expanded ? 1.3 : .87, 5, dt); transferLid.position.y = THREE.MathUtils.damp(transferLid.position.y, expanded ? 2.16 : 1.55, 5, dt); transferTank.visible = !expanded;
    transferRedLead(transferLid.position.y + .17); transferBlackLead(transferLid.position.y + .17);
    const transferred = props.stepId === 'wb-transfer' && props.action >= 3; transferBands.visible = transferred;
    (layerSurfaces[3].material as THREE.MeshStandardMaterial).color.setHex(transferred || props.stepId === 'wb-membrane' && props.action >= 2 ? 0xc4dace : 0xf0efdf);
    transferParticles.visible = transferred && expanded;
    if (transferParticles.visible) { for (let i = 0; i < 10; i++) { scratchMatrix.makeTranslation(-.34 + (i % 5) * .17, -.12 + Math.floor(i / 5) * .24, layers[3].position.z + ((time * .4 + i / 10) % 1) * (layers[4].position.z - layers[3].position.z)); transferParticles.setMatrixAt(i, scratchMatrix); } transferParticles.instanceMatrix.needsUpdate = true; }
    shaker.rotation.z = props.station === 'tray' && props.action ? Math.sin(time * 1.7) * .045 : 0; fluid.visible = props.station !== 'tray' || props.action > 0; fluid.scale.y = THREE.MathUtils.damp(fluid.scale.y, props.stepId === 'wb-block' && props.action < 2 ? .2 : 1, 4, dt);
    antibodies.visible = ['wb-primary', 'wb-secondary', 'wb-wash1', 'wb-wash2'].includes(props.stepId) && props.action > 0; antibodies.position.y = THREE.MathUtils.damp(antibodies.position.y, props.action >= 2 ? .1 : .19, 4, dt);
    secondaryMarkers.visible = ['wb-secondary', 'wb-wash2'].includes(props.stepId) && props.action >= 2; wash.visible = props.stepId.includes('wash') && props.action >= 2; wash.children.forEach((part, i) => { part.position.set(-.5 + ((time * .22 + i * .17) % 1), .14, -.2 + (i % 3) * .2); });
    const loadingImage = props.stepId === 'wb-image' && props.action <= 1;
    // Door clears 90° before the tray extends; the tray retracts before closing.
    const doorTarget = loadingImage || imageTray.position.z > .07 ? -1.65 : 0;
    door.rotation.y = THREE.MathUtils.damp(door.rotation.y, doorTarget, 8, dt);
    const trayTarget = loadingImage && door.rotation.y < -1.59 ? .62 : .03;
    imageTray.position.z = THREE.MathUtils.damp(imageTray.position.z, trayTarget, 8, dt);
    const preview = props.station === 'imager' && !loadingImage ? `blot-${props.exposure}` : 'empty';
    if (preview !== lastImage) { image.material.map?.dispose(); image.material.map = signalTexture(preview === 'empty' ? 'empty' : 'blot', props.exposure); image.material.needsUpdate = true; lastImage = preview; }
  } };
}
