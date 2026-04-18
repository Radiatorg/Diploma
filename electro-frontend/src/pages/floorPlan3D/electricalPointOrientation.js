import * as THREE from 'three';

const FLOOR_Y = 0.05;

/**
 * Поворачивает группу розетки/выключателя/светильника так, чтобы она смотрела внутрь комнаты
 * вдоль нормали к грани (а не «на центр» по диагонали — из‑за этого символ казался кривым и уходил в стену).
 * Модель в builders3D: видимая сторона ориентирована вдоль +local Z; lookAt задаёт -Z → «внутрь», поэтому цель — точка снаружи по нормали.
 */
export function orientElectricalPointGroup(group, x, y, z, bounds, roomHeightM, wallInsetM) {
  const fy = FLOOR_Y;
  const cy = Math.max(roomHeightM, 0.25) - 0.05;
  const zn = bounds.minZ + wallInsetM;
  const zs = bounds.maxZ - wallInsetM;
  const xw = bounds.minX + wallInsetM;
  const xe = bounds.maxX - wallInsetM;

  const rcx = (bounds.minX + bounds.maxX) / 2;
  const rcz = (bounds.minZ + bounds.maxZ) / 2;

  // Пол
  if (y <= fy + 0.12) {
    group.position.set(x, y + 0.012, z);
    group.rotation.set(-Math.PI / 2, Math.atan2(rcx - x, rcz - z), 0);
    return;
  }

  // Потолок
  if (y >= cy - 0.12) {
    group.position.set(x, y - 0.012, z);
    group.rotation.set(Math.PI / 2, Math.atan2(rcx - x, rcz - z), 0);
    return;
  }

  const dn = Math.abs(z - zn);
  const ds = Math.abs(z - zs);
  const dw = Math.abs(x - xw);
  const de = Math.abs(x - xe);

  const cand = [
    { d: dn, inward: new THREE.Vector3(0, 0, 1) },
    { d: ds, inward: new THREE.Vector3(0, 0, -1) },
    { d: dw, inward: new THREE.Vector3(1, 0, 0) },
    { d: de, inward: new THREE.Vector3(-1, 0, 0) },
  ];
  cand.sort((a, b) => a.d - b.d);
  const inward = cand[0].inward.clone();

  const surfaceOffset = 0.022;
  group.position.set(
    x + inward.x * surfaceOffset,
    y + inward.y * surfaceOffset,
    z + inward.z * surfaceOffset,
  );

  const lookTarget = new THREE.Vector3(
    x - inward.x,
    y - inward.y,
    z - inward.z,
  );
  group.lookAt(lookTarget);
}
