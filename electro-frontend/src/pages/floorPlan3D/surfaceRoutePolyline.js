import * as THREE from 'three';

const FLOOR_Y = 0.05;
const MIN_VERTEX_M = 0.035;

/**
 * Ломаная вдоль граней комнаты (пол, вертикальные стены, потолок).
 * placementMode / fromSurfaceKind+toSurfaceKind задают, какие грани допустимы.
 */
export function expandSurfaceRouteSegment(prev, next, bounds, roomHeightM, wallInsetM, options = {}) {
  const { placementMode = 'auto', fromSurfaceKind, toSurfaceKind } = options;

  const useWallPath =
    placementMode === 'wall'
    || (placementMode === 'auto' && fromSurfaceKind === 'wall' && toSurfaceKind === 'wall');

  const useFloorPath =
    placementMode === 'floor'
    || (placementMode === 'auto' && fromSurfaceKind === 'floor' && toSurfaceKind === 'floor');

  const useCeilPath =
    placementMode === 'ceiling'
    || (placementMode === 'auto' && fromSurfaceKind === 'ceiling' && toSurfaceKind === 'ceiling');

  if (useWallPath) {
    return expandAlongWallsOnly(prev, next, bounds, wallInsetM);
  }
  if (useFloorPath) {
    return expandFloorOnly(prev, next);
  }
  if (useCeilPath) {
    return expandCeilingOnly(prev, next, roomHeightM);
  }

  const cyQuick = Math.max(roomHeightM, 0.25) - 0.05;
  const isCeilPt = (p) => p.y >= cyQuick - 0.08;
  if (
    placementMode === 'auto'
    && fromSurfaceKind === 'wall'
    && toSurfaceKind === 'ceiling'
    && !isCeilPt(prev)
    && isCeilPt(next)
  ) {
    return expandWallToCeiling(prev, next, bounds, roomHeightM, wallInsetM);
  }
  if (
    placementMode === 'auto'
    && fromSurfaceKind === 'ceiling'
    && toSurfaceKind === 'wall'
    && isCeilPt(prev)
    && !isCeilPt(next)
  ) {
    return expandWallToCeiling(next, prev, bounds, roomHeightM, wallInsetM).slice().reverse();
  }

  const fy = FLOOR_Y;
  const cy = Math.max(roomHeightM, 0.25) - 0.05;
  const zn = bounds.minZ + wallInsetM;
  const zs = bounds.maxZ - wallInsetM;
  const xw = bounds.minX + wallInsetM;
  const xe = bounds.maxX - wallInsetM;

  const walls = [
    { plane: 'z', val: zn },
    { plane: 'z', val: zs },
    { plane: 'x', val: xw },
    { plane: 'x', val: xe },
  ];

  const nearestWall = (p) => {
    let best = walls[0];
    let md = Infinity;
    for (const w of walls) {
      const d = w.plane === 'z' ? Math.abs(p.z - w.val) : Math.abs(p.x - w.val);
      if (d < md) {
        md = d;
        best = w;
      }
    }
    return best;
  };

  const onWallPlane = (p, w) => (w.plane === 'z'
    ? new THREE.Vector3(p.x, p.y, w.val)
    : new THREE.Vector3(w.val, p.y, p.z));

  const footFloorWall = (p, w) => (w.plane === 'z'
    ? new THREE.Vector3(p.x, fy, w.val)
    : new THREE.Vector3(w.val, fy, p.z));

  const isFloor = (p) => p.y <= fy + 0.08;
  const isCeil = (p) => p.y >= cy - 0.08;

  const segmentOnSingleFace = (a, b) => {
    if (isFloor(a) && isFloor(b)) return true;
    if (isCeil(a) && isCeil(b)) return true;
    for (const w of walls) {
      const da = w.plane === 'z' ? Math.abs(a.z - w.val) : Math.abs(a.x - w.val);
      const db = w.plane === 'z' ? Math.abs(b.z - w.val) : Math.abs(b.x - w.val);
      if (da < 0.11 && db < 0.11) return true;
    }
    return false;
  };

  if (segmentOnSingleFace(prev, next)) {
    return [prev.clone(), next.clone()];
  }

  const pushD = (arr, v) => {
    const p = v.clone();
    const last = arr[arr.length - 1];
    if (!last || last.distanceTo(p) >= MIN_VERTEX_M) arr.push(p);
  };

  const manhattanFloor = (arr, a, b) => {
    const fa = new THREE.Vector3(a.x, fy, a.z);
    const fb = new THREE.Vector3(b.x, fy, b.z);
    if (fa.distanceTo(fb) < MIN_VERTEX_M) return;
    const mid1 = new THREE.Vector3(fb.x, fy, fa.z);
    const d1 = fa.distanceTo(mid1) + mid1.distanceTo(fb);
    const mid2 = new THREE.Vector3(fa.x, fy, fb.z);
    const d2 = fa.distanceTo(mid2) + mid2.distanceTo(fb);
    if (d1 <= d2) {
      if (fa.distanceTo(mid1) >= MIN_VERTEX_M) pushD(arr, mid1);
      if (mid1.distanceTo(fb) >= MIN_VERTEX_M) pushD(arr, fb);
    } else {
      if (fa.distanceTo(mid2) >= MIN_VERTEX_M) pushD(arr, mid2);
      if (mid2.distanceTo(fb) >= MIN_VERTEX_M) pushD(arr, fb);
    }
  };

  /** Маршрут без потолка: только пол и вертикальные стены. */
  const chainFloorWalls = (A, B) => {
    const out = [A.clone()];
    const wa = !isFloor(A) && !isCeil(A) ? nearestWall(A) : null;
    const wb = !isFloor(B) && !isCeil(B) ? nearestWall(B) : null;

    let fa;
    if (isFloor(A)) fa = new THREE.Vector3(A.x, fy, A.z);
    else {
      const snap = onWallPlane(A, wa);
      fa = footFloorWall(snap, wa);
      if (A.distanceTo(fa) >= MIN_VERTEX_M) pushD(out, fa);
    }

    let fb;
    if (isFloor(B)) fb = new THREE.Vector3(B.x, fy, B.z);
    else {
      const snap = onWallPlane(B, wb);
      fb = footFloorWall(snap, wb);
    }

    if (fa.distanceTo(fb) >= MIN_VERTEX_M) {
      const straight = Math.abs(fa.x - fb.x) < 0.02 || Math.abs(fa.z - fb.z) < 0.02;
      if (straight) pushD(out, fb);
      else manhattanFloor(out, fa, fb);
    }

    pushD(out, B.clone());
    return dedupeChain(out);
  };

  /** С потолком: спуск/подъём вдоль ближайшей к середине сегмента стены. */
  const chainWithCeiling = (A, B) => {
    const mid = new THREE.Vector3((A.x + B.x) / 2, fy, (A.z + B.z) / 2);
    const w = nearestWall(mid);
    const out = [A.clone()];

    const dropFromCeiling = (C) => {
      const cCorner = w.plane === 'z'
        ? new THREE.Vector3(C.x, cy, w.val)
        : new THREE.Vector3(w.val, cy, C.z);
      const elbow = new THREE.Vector3(cCorner.x, cy, C.z);
      if (C.distanceTo(elbow) >= MIN_VERTEX_M) pushD(out, elbow);
      if (elbow.distanceTo(cCorner) >= MIN_VERTEX_M) pushD(out, cCorner);
      const atFloor = footFloorWall(cCorner, w);
      if (cCorner.distanceTo(atFloor) >= MIN_VERTEX_M) pushD(out, atFloor);
      return atFloor;
    };

    const climbFloorToCeiling = (Bceil) => {
      const wB = nearestWall(Bceil);
      const onCeilEdge = wB.plane === 'z'
        ? new THREE.Vector3(Bceil.x, cy, wB.val)
        : new THREE.Vector3(wB.val, cy, Bceil.z);
      const foot = footFloorWall(onCeilEdge, wB);
      const last = out[out.length - 1];
      if (last.distanceTo(foot) >= MIN_VERTEX_M) manhattanFloor(out, last, foot);
      if (out[out.length - 1].distanceTo(onCeilEdge) >= MIN_VERTEX_M) pushD(out, onCeilEdge);
      const midC = new THREE.Vector3(Bceil.x, cy, onCeilEdge.z);
      if (out[out.length - 1].distanceTo(midC) >= MIN_VERTEX_M) pushD(out, midC);
      if (midC.distanceTo(Bceil) >= MIN_VERTEX_M) pushD(out, Bceil.clone());
    };

    if (isCeil(A) && !isCeil(B)) {
      const atF = dropFromCeiling(A);
      const sub = chainFloorWalls(atF, B);
      sub.shift();
      sub.forEach((p) => pushD(out, p));
      return dedupeChain(out);
    }

    if (!isCeil(A) && isCeil(B)) {
      const sub = chainFloorWalls(A, new THREE.Vector3(B.x, fy, B.z));
      sub.shift();
      sub.forEach((p) => pushD(out, p));
      climbFloorToCeiling(B);
      return dedupeChain(out);
    }

    if (isCeil(A) && isCeil(B)) {
      const midC = new THREE.Vector3(B.x, cy, A.z);
      if (A.distanceTo(midC) >= MIN_VERTEX_M) pushD(out, midC);
      if (midC.distanceTo(B) >= MIN_VERTEX_M) pushD(out, B.clone());
      return dedupeChain(out);
    }

    return chainFloorWalls(A, B);
  };

  if (isCeil(prev) || isCeil(next)) {
    return chainWithCeiling(prev, next);
  }
  return chainFloorWalls(prev, next);
}

/** Стена (не пол/не потолок) → потолок: подъём по стене, далее по потолку без спуска на пол. */
function expandWallToCeiling(A, B, bounds, roomHeightM, wallInsetM) {
  const cy = Math.max(roomHeightM, 0.25) - 0.05;
  const zn = bounds.minZ + wallInsetM;
  const zs = bounds.maxZ - wallInsetM;
  const xw = bounds.minX + wallInsetM;
  const xe = bounds.maxX - wallInsetM;
  const clampX = (x) => Math.min(Math.max(x, xw), xe);
  const clampZ = (z) => Math.min(Math.max(z, zn), zs);

  const wallOf = (p) => {
    const cand = [
      ['n', Math.abs(p.z - zn)],
      ['s', Math.abs(p.z - zs)],
      ['w', Math.abs(p.x - xw)],
      ['e', Math.abs(p.x - xe)],
    ];
    cand.sort((a, b) => a[1] - b[1]);
    return cand[0][0];
  };

  const wA = wallOf(A);
  let up;
  if (wA === 'n') up = new THREE.Vector3(clampX(A.x), cy, zn);
  else if (wA === 's') up = new THREE.Vector3(clampX(A.x), cy, zs);
  else if (wA === 'w') up = new THREE.Vector3(xw, cy, clampZ(A.z));
  else up = new THREE.Vector3(xe, cy, clampZ(A.z));

  const pushD = (arr, v) => {
    const p = v.clone();
    const last = arr[arr.length - 1];
    if (!last || last.distanceTo(p) >= MIN_VERTEX_M) arr.push(p);
  };

  const bOnCeil = new THREE.Vector3(B.x, cy, B.z);

  const manhattanAtCeil = (out, a, b) => {
    const fa = new THREE.Vector3(a.x, cy, a.z);
    const fb = new THREE.Vector3(b.x, cy, b.z);
    if (fa.distanceTo(fb) < MIN_VERTEX_M) return;
    const mid1 = new THREE.Vector3(fb.x, cy, fa.z);
    const d1 = fa.distanceTo(mid1) + mid1.distanceTo(fb);
    const mid2 = new THREE.Vector3(fa.x, cy, fb.z);
    const d2 = fa.distanceTo(mid2) + mid2.distanceTo(fb);
    if (d1 <= d2) {
      if (fa.distanceTo(mid1) >= MIN_VERTEX_M) pushD(out, mid1);
      if (mid1.distanceTo(fb) >= MIN_VERTEX_M) pushD(out, fb);
    } else {
      if (fa.distanceTo(mid2) >= MIN_VERTEX_M) pushD(out, mid2);
      if (mid2.distanceTo(fb) >= MIN_VERTEX_M) pushD(out, fb);
    }
  };

  const out = [A.clone()];
  pushD(out, up);
  const last = out[out.length - 1];
  if (last.distanceTo(bOnCeil) >= MIN_VERTEX_M) {
    const straight = Math.abs(last.x - bOnCeil.x) < 0.02 || Math.abs(last.z - bOnCeil.z) < 0.02;
    if (straight) pushD(out, bOnCeil);
    else manhattanAtCeil(out, last, bOnCeil);
  }
  if (out[out.length - 1].distanceTo(B) >= MIN_VERTEX_M) pushD(out, B.clone());
  return dedupeChain(out);
}

function expandFloorOnly(prev, next) {
  const fy = FLOOR_Y;
  const fa = new THREE.Vector3(prev.x, fy, prev.z);
  const fb = new THREE.Vector3(next.x, fy, next.z);
  if (fa.distanceTo(fb) < MIN_VERTEX_M) return dedupeChain([prev.clone(), next.clone()]);
  const out = [];
  const pushD = (arr, v) => {
    const p = v.clone();
    const last = arr[arr.length - 1];
    if (!last || last.distanceTo(p) >= MIN_VERTEX_M) arr.push(p);
  };
  pushD(out, prev.y <= fy + 0.08 ? prev.clone() : fa.clone());
  const mid1 = new THREE.Vector3(fb.x, fy, out[0].z);
  const d1 = out[0].distanceTo(mid1) + mid1.distanceTo(fb);
  const mid2 = new THREE.Vector3(out[0].x, fy, fb.z);
  const d2 = out[0].distanceTo(mid2) + mid2.distanceTo(fb);
  if (d1 <= d2) {
    if (out[0].distanceTo(mid1) >= MIN_VERTEX_M) pushD(out, mid1);
    if (mid1.distanceTo(fb) >= MIN_VERTEX_M) pushD(out, fb);
  } else {
    if (out[0].distanceTo(mid2) >= MIN_VERTEX_M) pushD(out, mid2);
    if (mid2.distanceTo(fb) >= MIN_VERTEX_M) pushD(out, fb);
  }
  pushD(out, next.y <= fy + 0.08 ? next.clone() : fb.clone());
  return dedupeChain(out);
}

function expandCeilingOnly(prev, next, roomHeightM) {
  const cy = Math.max(roomHeightM, 0.25) - 0.05;
  const ca = new THREE.Vector3(prev.x, cy, prev.z);
  const cb = new THREE.Vector3(next.x, cy, next.z);
  if (ca.distanceTo(cb) < MIN_VERTEX_M) return dedupeChain([prev.clone(), next.clone()]);
  const out = [];
  const pushD = (arr, v) => {
    const p = v.clone();
    const last = arr[arr.length - 1];
    if (!last || last.distanceTo(p) >= MIN_VERTEX_M) arr.push(p);
  };
  pushD(out, prev.y >= cy - 0.08 ? prev.clone() : ca.clone());
  const mid1 = new THREE.Vector3(cb.x, cy, out[0].z);
  const d1 = out[0].distanceTo(mid1) + mid1.distanceTo(cb);
  const mid2 = new THREE.Vector3(out[0].x, cy, cb.z);
  const d2 = out[0].distanceTo(mid2) + mid2.distanceTo(cb);
  if (d1 <= d2) {
    if (out[0].distanceTo(mid1) >= MIN_VERTEX_M) pushD(out, mid1);
    if (mid1.distanceTo(cb) >= MIN_VERTEX_M) pushD(out, cb);
  } else {
    if (out[0].distanceTo(mid2) >= MIN_VERTEX_M) pushD(out, mid2);
    if (mid2.distanceTo(cb) >= MIN_VERTEX_M) pushD(out, cb);
  }
  pushD(out, next.y >= cy - 0.08 ? next.clone() : cb.clone());
  return dedupeChain(out);
}

/**
 * Только вертикальные стены комнаты (без прокладки по полу между разными гранями).
 */
function expandAlongWallsOnly(A, B, bounds, wallInsetM) {
  const zn = bounds.minZ + wallInsetM;
  const zs = bounds.maxZ - wallInsetM;
  const xw = bounds.minX + wallInsetM;
  const xe = bounds.maxX - wallInsetM;

  const pushD = (arr, v) => {
    const p = v.clone();
    const last = arr[arr.length - 1];
    if (!last || last.distanceTo(p) >= MIN_VERTEX_M) arr.push(p);
  };

  const clampX = (x) => Math.min(Math.max(x, xw), xe);
  const clampZ = (z) => Math.min(Math.max(z, zn), zs);

  const wallOf = (p) => {
    const cand = [
      ['n', Math.abs(p.z - zn)],
      ['s', Math.abs(p.z - zs)],
      ['w', Math.abs(p.x - xw)],
      ['e', Math.abs(p.x - xe)],
    ];
    cand.sort((a, b) => a[1] - b[1]);
    return cand[0][0];
  };

  const snapToWall = (p, w) => {
    if (w === 'n') return new THREE.Vector3(clampX(p.x), p.y, zn);
    if (w === 's') return new THREE.Vector3(clampX(p.x), p.y, zs);
    if (w === 'w') return new THREE.Vector3(xw, p.y, clampZ(p.z));
    if (w === 'e') return new THREE.Vector3(xe, p.y, clampZ(p.z));
    return p.clone();
  };

  const wA = wallOf(A);
  const wB = wallOf(B);
  const a = snapToWall(A, wA);
  const b = snapToWall(B, wB);

  if (wA === wB) {
    return dedupeChain([a.clone(), b.clone()]);
  }

  const adjacentCorner = (w1, w2, y) => {
    const s = new Set([w1, w2]);
    if (s.has('n') && s.has('e')) return new THREE.Vector3(xe, y, zn);
    if (s.has('n') && s.has('w')) return new THREE.Vector3(xw, y, zn);
    if (s.has('s') && s.has('e')) return new THREE.Vector3(xe, y, zs);
    if (s.has('s') && s.has('w')) return new THREE.Vector3(xw, y, zs);
    return null;
  };

  const C0 = adjacentCorner(wA, wB, a.y);
  if (C0) {
    const out = [a.clone()];
    let toward = C0.clone();
    if (wA === 'n' || wA === 's') {
      toward = new THREE.Vector3(C0.x, a.y, a.z);
    } else {
      toward = new THREE.Vector3(a.x, a.y, C0.z);
    }
    pushD(out, toward);
    if (Math.abs(b.y - a.y) > 1e-4) {
      pushD(out, new THREE.Vector3(C0.x, b.y, C0.z));
    }
    const towardB = (wB === 'n' || wB === 's')
      ? new THREE.Vector3(b.x, b.y, C0.z)
      : new THREE.Vector3(C0.x, b.y, b.z);
    pushD(out, towardB);
    pushD(out, b.clone());
    return dedupeChain(out);
  }

  const pathViaX = (xSide) => {
    const x = xSide === 'e' ? xe : xw;
    const out = [a.clone()];
    const p1 = wA === 'n' || wA === 's'
      ? new THREE.Vector3(x, a.y, a.z)
      : new THREE.Vector3(a.x, a.y, wA === 'n' ? zn : zs);
    pushD(out, p1);
    const p2 = new THREE.Vector3(x, a.y, wB === 'n' ? zn : zs);
    pushD(out, p2);
    const p3 = wB === 'n' || wB === 's'
      ? new THREE.Vector3(b.x, a.y, wB === 'n' ? zn : zs)
      : new THREE.Vector3(x, a.y, b.z);
    pushD(out, p3);
    if (Math.abs(b.y - a.y) > 1e-4) {
      const mid = wB === 'n' || wB === 's'
        ? new THREE.Vector3(b.x, b.y, wB === 'n' ? zn : zs)
        : new THREE.Vector3(x, b.y, b.z);
      pushD(out, mid);
    }
    pushD(out, b.clone());
    return dedupeChain(out);
  };

  const pathViaZ = (zSide) => {
    const z = zSide === 'n' ? zn : zs;
    const out = [a.clone()];
    const p1 = wA === 'w' || wA === 'e'
      ? new THREE.Vector3(a.x, a.y, z)
      : new THREE.Vector3(wA === 'w' ? xw : xe, a.y, a.z);
    pushD(out, p1);
    const p2 = new THREE.Vector3(wB === 'w' ? xw : xe, a.y, z);
    pushD(out, p2);
    const p3 = wB === 'w' || wB === 'e'
      ? new THREE.Vector3(b.x, a.y, z)
      : new THREE.Vector3(wB === 'w' ? xw : xe, a.y, b.z);
    pushD(out, p3);
    if (Math.abs(b.y - a.y) > 1e-4) {
      const mid = wB === 'w' || wB === 'e'
        ? new THREE.Vector3(b.x, b.y, z)
        : new THREE.Vector3(wB === 'w' ? xw : xe, b.y, b.z);
      pushD(out, mid);
    }
    pushD(out, b.clone());
    return dedupeChain(out);
  };

  if ((wA === 'n' && wB === 's') || (wA === 's' && wB === 'n')) {
    const dE = chainLength(pathViaX('e'));
    const dW = chainLength(pathViaX('w'));
    return dE <= dW ? pathViaX('e') : pathViaX('w');
  }
  if ((wA === 'w' && wB === 'e') || (wA === 'e' && wB === 'w')) {
    const dN = chainLength(pathViaZ('n'));
    const dS = chainLength(pathViaZ('s'));
    return dN <= dS ? pathViaZ('n') : pathViaZ('s');
  }

  return dedupeChain([a.clone(), b.clone()]);
}

function chainLength(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i += 1) s += pts[i - 1].distanceTo(pts[i]);
  return s;
}

function dedupeChain(pts) {
  const out = [];
  for (const p of pts) {
    if (out.length === 0 || out[out.length - 1].distanceTo(p) >= MIN_VERTEX_M) {
      out.push(p);
    }
  }
  return out;
}
