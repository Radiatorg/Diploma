import * as THREE from 'three';

export const DEFAULT_ROOM_HEIGHT_M = 2.8;

export function parseSocketsCountFromNotes(notes) {
  if (!notes) return 1;
  const m = String(notes).match(/sockets:(\d)/);
  return m ? Math.max(1, Math.min(4, parseInt(m[1], 10))) : 1;
}

function buildOutletGroup(accentColor, socketsCount = 1) {
  const group = new THREE.Group();
  const count = Math.max(1, Math.min(4, socketsCount));
  // Width per socket unit; total plate scales with count
  const unitW = 0.12;
  const gap = 0.01;
  const totalW = unitW * count + gap * (count - 1);
  const plateH = 0.12;
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.7, emissive: 0x888880, emissiveIntensity: 0.4 });
  const borderMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.5, emissive: accentColor, emissiveIntensity: 0.5 });
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });

  const border = new THREE.Mesh(new THREE.BoxGeometry(totalW + 0.02, plateH + 0.02, 0.018), borderMat);
  border.position.z = -0.004;
  group.add(border);

  const plate = new THREE.Mesh(new THREE.BoxGeometry(totalW, plateH, 0.024), plateMat);
  group.add(plate);

  for (let i = 0; i < count; i++) {
    const ox = -totalW / 2 + unitW / 2 + i * (unitW + gap);
    [-0.026, 0.026].forEach((dx) => {
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.03, 8), holeMat);
      pin.rotation.x = Math.PI / 2;
      pin.position.set(ox + dx, 0.015, 0.001);
      group.add(pin);
    });
    const gnd = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.03, 8), holeMat);
    gnd.rotation.x = Math.PI / 2;
    gnd.position.set(ox, -0.021, 0.001);
    group.add(gnd);
  }

  return group;
}

function buildSwitchGroup(accentColor) {
  const group = new THREE.Group();
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xf0ede8, roughness: 0.7, emissive: 0x888880, emissiveIntensity: 0.4 });
  const borderMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.5, emissive: accentColor, emissiveIntensity: 0.5 });
  const rockerMat = new THREE.MeshStandardMaterial({ color: 0xddeeff, roughness: 0.4, emissive: 0x667788, emissiveIntensity: 0.3 });

  const border = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.018), borderMat);
  border.position.z = -0.004;
  group.add(border);

  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.024), plateMat);
  group.add(plate);

  const rocker = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.1, 0.028), rockerMat);
  rocker.rotation.x = -0.18;
  group.add(rocker);

  const notchMat = new THREE.MeshStandardMaterial({ color: 0xaabbcc });
  const notch = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.006, 0.012), notchMat);
  notch.position.set(0, 0.02, 0.017);
  group.add(notch);

  return group;
}

function buildLightGroup(accentColor) {
  const group = new THREE.Group();

  const mountMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.5, metalness: 0.45 });
  const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.085, 0.025, 16), mountMat);
  mount.position.y = 0.01;
  group.add(mount);

  const rimMat = new THREE.MeshStandardMaterial({ color: 0xb8960c, roughness: 0.4, metalness: 0.6 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.008, 6, 24), rimMat);
  rim.rotation.x = Math.PI / 2;
  group.add(rim);

  const cordMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.11, 6), cordMat);
  cord.position.y = -0.067;
  group.add(cord);

  const socketMat = new THREE.MeshStandardMaterial({ color: 0x888877, roughness: 0.6 });
  const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.04, 10), socketMat);
  socket.position.y = -0.14;
  group.add(socket);

  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfffde7,
    emissive: 0xffee66,
    emissiveIntensity: 0.9,
    roughness: 0.2,
    transparent: true,
    opacity: 0.92,
  });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12), bulbMat);
  bulb.position.y = -0.195;
  group.add(bulb);

  return group;
}

function buildSourceGroup() {
  const group = new THREE.Group();

  const boxMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.55, metalness: 0.35, emissive: 0x222830, emissiveIntensity: 0.6 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.15, 0.045), boxMat);
  group.add(box);

  const doorMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.7 });
  const innerDoor = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.006), doorMat);
  innerDoor.position.set(-0.005, -0.005, 0.026);
  group.add(innerDoor);

  const handleMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.025, 6), handleMat);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0.028, -0.005, 0.03);
  group.add(handle);

  const ledMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 1.2 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 8), ledMat);
  led.position.set(0.03, 0.055, 0.027);
  group.add(led);

  return group;
}

export function isSourcePointByNotes(point) {
  const notes = (point?.notes || '').toLowerCase();
  return notes.includes('стартов') || notes.includes('start');
}

export function buildPointGroup(point) {
  const type = point?.electricalSymbol?.type || '';
  const isSource = isSourcePointByNotes(point);
  if (type === 'outlet') return buildOutletGroup(0x10b981, parseSocketsCountFromNotes(point?.notes));
  if (type === 'switch') return buildSwitchGroup(0x60a5fa);
  if (type === 'light' && !isSource) return buildLightGroup(0xffc857);
  return buildSourceGroup();
}

export function buildGhostGroup(toolType, socketsCount = 1) {
  let group;
  if (toolType === 'add-outlet') group = buildOutletGroup(0x34d399, socketsCount);
  else if (toolType === 'add-switch') group = buildSwitchGroup(0x93c5fd);
  else if (toolType === 'add-light') group = buildLightGroup(0xfde68a);
  else group = buildSourceGroup();
  group.traverse((child) => {
    if (child.isMesh && child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat) => {
        mat.transparent = true;
        mat.opacity = 0.48;
        mat.depthWrite = false;
      });
    }
  });
  return group;
}

export function buildDoorGroup(oWidthM, oHeightM, wallThickness) {
  const group = new THREE.Group();
  const depth = wallThickness + 0.06;
  const jambW = 0.065;
  const lintH = 0.075;

  const frameMat = new THREE.MeshStandardMaterial({ color: 0xe8ddd0, roughness: 0.75 });
  const lJamb = new THREE.Mesh(new THREE.BoxGeometry(jambW, oHeightM + lintH, depth), frameMat);
  lJamb.position.set(-oWidthM / 2 - jambW / 2, lintH / 2, 0);
  group.add(lJamb);

  const rJamb = new THREE.Mesh(new THREE.BoxGeometry(jambW, oHeightM + lintH, depth), frameMat);
  rJamb.position.set(oWidthM / 2 + jambW / 2, lintH / 2, 0);
  group.add(rJamb);

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(oWidthM + jambW * 2, lintH, depth), frameMat);
  lintel.position.set(0, oHeightM / 2 + lintH / 2, 0);
  group.add(lintel);

  const leafMat = new THREE.MeshStandardMaterial({ color: 0xc8935a, roughness: 0.65, transparent: true, opacity: 0.92 });
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(oWidthM - 0.03, oHeightM - 0.015, 0.045), leafMat);
  group.add(leaf);

  const panelMat = new THREE.MeshStandardMaterial({ color: 0xb5824a, roughness: 0.7 });
  [
    [0, oHeightM * 0.22, 0.025],
    [0, -oHeightM * 0.22, 0.025],
  ].forEach(([px, py, pz]) => {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(oWidthM * 0.7, oHeightM * 0.28, 0.008), panelMat);
    panel.position.set(px, py, pz);
    group.add(panel);
  });

  const handleMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.8 });
  const handleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.11, 8), handleMat);
  handleBar.rotation.x = Math.PI / 2;
  handleBar.position.set(oWidthM / 2 - 0.09, -oHeightM * 0.05, 0.03);
  group.add(handleBar);

  const handleStem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.04, 8), handleMat);
  handleStem.position.set(oWidthM / 2 - 0.09, -oHeightM * 0.05, 0.05);
  group.add(handleStem);

  const arcMat = new THREE.MeshStandardMaterial({ color: 0xf97316, transparent: true, opacity: 0.35, roughness: 0.8 });
  const arc = new THREE.Mesh(new THREE.TorusGeometry(oWidthM * 0.85, 0.012, 4, 20, Math.PI / 2), arcMat);
  arc.rotation.x = Math.PI / 2;
  arc.position.set(-oWidthM / 2, -oHeightM / 2, 0);
  group.add(arc);

  return group;
}

export function buildWindowGroup(oWidthM, oHeightM, wallThickness) {
  const group = new THREE.Group();
  const depth = wallThickness + 0.06;
  const frameW = 0.06;

  const frameMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.7 });

  const top = new THREE.Mesh(new THREE.BoxGeometry(oWidthM + frameW * 2, frameW, depth), frameMat);
  top.position.set(0, oHeightM / 2 + frameW / 2, 0);
  group.add(top);

  const bot = new THREE.Mesh(new THREE.BoxGeometry(oWidthM + frameW * 2, frameW, depth), frameMat);
  bot.position.set(0, -oHeightM / 2 - frameW / 2, 0);
  group.add(bot);

  const lSide = new THREE.Mesh(new THREE.BoxGeometry(frameW, oHeightM + frameW * 2, depth), frameMat);
  lSide.position.set(-oWidthM / 2 - frameW / 2, 0, 0);
  group.add(lSide);

  const rSide = new THREE.Mesh(new THREE.BoxGeometry(frameW, oHeightM + frameW * 2, depth), frameMat);
  rSide.position.set(oWidthM / 2 + frameW / 2, 0, 0);
  group.add(rSide);

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xbfdbfe,
    transparent: true,
    opacity: 0.38,
    roughness: 0.05,
    metalness: 0.1,
  });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(oWidthM - 0.01, oHeightM - 0.01, 0.008), glassMat);
  group.add(glass);

  const mullionMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.6 });
  const vMullion = new THREE.Mesh(new THREE.BoxGeometry(0.04, oHeightM, depth * 0.6), mullionMat);
  group.add(vMullion);

  const hMullion = new THREE.Mesh(new THREE.BoxGeometry(oWidthM, 0.04, depth * 0.6), mullionMat);
  group.add(hMullion);

  return group;
}
