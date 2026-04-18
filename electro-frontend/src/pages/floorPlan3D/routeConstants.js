/** Радиус невидимой сферы для луча (наведение на символ), м. */
export const ROUTE_EQUIPMENT_RAY_HIT_RADIUS_M = 0.1;

/**
 * Запасной допуск по плану (X/Z), если луч не попал в сферу символа, м.
 * Основная привязка — только при наведении лучом на символ.
 */
export const ROUTE_EQUIPMENT_PLANAR_SNAP_RADIUS_M = 0.1;

export function formatSnapRadiusMetersRu() {
  return String(ROUTE_EQUIPMENT_PLANAR_SNAP_RADIUS_M).replace('.', ',');
}

/** Высота в метрах (ось Y в Three.js) и высота потолка комнаты, м. */
export function inferRouteSurfaceKindFromHeightM(heightM, roomHeightM) {
  const floorY = 0.05;
  const ceilY = Math.max(roomHeightM, 0.2) - 0.05;
  if (heightM <= floorY + 0.12) return 'floor';
  if (heightM >= ceilY - 0.12) return 'ceiling';
  return 'wall';
}
