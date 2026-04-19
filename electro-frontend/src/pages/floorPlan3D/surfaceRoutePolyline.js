import * as THREE from 'three';

const FLOOR_Y = 0.05;
const MIN_VERTEX_M = 0.035;

/* ── helpers ─────────────────────────────────────────────────────── */

function pushD(arr, v) {
  const p = v.clone();
  const last = arr[arr.length - 1];
  if (!last || last.distanceTo(p) >= MIN_VERTEX_M) arr.push(p);
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

function chainLength(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i += 1) s += pts[i - 1].distanceTo(pts[i]);
  return s;
}

function bestManhattan2D(arr, a, b, fixedY) {
  const fa = new THREE.Vector3(a.x, fixedY, a.z);
  const fb = new THREE.Vector3(b.x, fixedY, b.z);
  if (fa.distanceTo(fb) < MIN_VERTEX_M) return;
  const mid1 = new THREE.Vector3(fb.x, fixedY, fa.z);
  const d1 = fa.distanceTo(mid1) + mid1.distanceTo(fb);
  const mid2 = new THREE.Vector3(fa.x, fixedY, fb.z);
  const d2 = fa.distanceTo(mid2) + mid2.distanceTo(fb);
  if (d1 <= d2) {
    if (fa.distanceTo(mid1) >= MIN_VERTEX_M) pushD(arr, mid1);
    if (mid1.distanceTo(fb) >= MIN_VERTEX_M) pushD(arr, fb);
  } else {
    if (fa.distanceTo(mid2) >= MIN_VERTEX_M) pushD(arr, mid2);
    if (mid2.distanceTo(fb) >= MIN_VERTEX_M) pushD(arr, fb);
  }
}

/* ── room geometry shortcuts ─────────────────────────────────────── */

function roomParams(bounds, wallInsetM, roomHeightM) {
  const fy = FLOOR_Y;
  const cy = Math.max(roomHeightM, 0.25) - 0.05;
  const zn = bounds.minZ + wallInsetM;
  const zs = bounds.maxZ - wallInsetM;
  const xw = bounds.minX + wallInsetM;
  const xe = bounds.maxX - wallInsetM;
  const clampX = (x) => Math.min(Math.max(x, xw), xe);
  const clampZ = (z) => Math.min(Math.max(z, zn), zs);
  const isFloor = (p) => p.y <= fy + 0.10;
  const isCeil = (p) => p.y >= cy - 0.10;
  const isWall = (p) => !isFloor(p) && !isCeil(p);
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
  const wallTopCorner = (w, p) => {
    if (w === 'n') return new THREE.Vector3(clampX(p.x), cy, zn);
    if (w === 's') return new THREE.Vector3(clampX(p.x), cy, zs);
    if (w === 'w') return new THREE.Vector3(xw, cy, clampZ(p.z));
    return new THREE.Vector3(xe, cy, clampZ(p.z));
  };
  const wallBottomCorner = (w, p) => {
    if (w === 'n') return new THREE.Vector3(clampX(p.x), fy, zn);
    if (w === 's') return new THREE.Vector3(clampX(p.x), fy, zs);
    if (w === 'w') return new THREE.Vector3(xw, fy, clampZ(p.z));
    return new THREE.Vector3(xe, fy, clampZ(p.z));
  };
  return { fy, cy, zn, zs, xw, xe, clampX, clampZ, isFloor, isCeil, isWall, wallOf, snapToWall, wallTopCorner, wallBottomCorner };
}

/* ── Surface kind detection ──────────────────────────────────────── */

function detectSurfaceKind(p, fy, cy) {
  if (p.y <= fy + 0.10) return 'floor';
  if (p.y >= cy - 0.10) return 'ceiling';
  return 'wall';
}

/* ── Same-surface routing (fast paths) ───────────────────────────── */

function routeFloorToFloor(A, B) {
  const fy = FLOOR_Y;
  const fa = new THREE.Vector3(A.x, fy, A.z);
  const fb = new THREE.Vector3(B.x, fy, B.z);
  if (fa.distanceTo(fb) < MIN_VERTEX_M) return dedupeChain([A.clone(), B.clone()]);
  const out = [A.clone()];
  if (A.y > fy + 0.10) pushD(out, fa);
  bestManhattan2D(out, fa, fb, fy);
  if (B.y > fy + 0.10) pushD(out, B.clone()); else pushD(out, fb);
  return dedupeChain(out);
}

function routeCeilToCeil(A, B, cy) {
  const ca = new THREE.Vector3(A.x, cy, A.z);
  const cb = new THREE.Vector3(B.x, cy, B.z);
  if (ca.distanceTo(cb) < MIN_VERTEX_M) return dedupeChain([A.clone(), B.clone()]);
  const out = [A.clone()];
  if (A.y < cy - 0.10) pushD(out, ca);
  bestManhattan2D(out, ca, cb, cy);
  if (B.y < cy - 0.10) pushD(out, B.clone()); else pushD(out, cb);
  return dedupeChain(out);
}

/* ── Wall-to-Wall routing along wall surfaces ────────────────────── */

function routeWallToWall(A, B, r) {
  const wA = r.wallOf(A);
  const wB = r.wallOf(B);
  const a = r.snapToWall(A, wA);
  const b = r.snapToWall(B, wB);

  if (wA === wB) {
    return dedupeChain([a.clone(), b.clone()]);
  }

  const adjacentCorner = (w1, w2, y) => {
    const s = new Set([w1, w2]);
    if (s.has('n') && s.has('e')) return new THREE.Vector3(r.xe, y, r.zn);
    if (s.has('n') && s.has('w')) return new THREE.Vector3(r.xw, y, r.zn);
    if (s.has('s') && s.has('e')) return new THREE.Vector3(r.xe, y, r.zs);
    if (s.has('s') && s.has('w')) return new THREE.Vector3(r.xw, y, r.zs);
    return null;
  };

  const C0 = adjacentCorner(wA, wB, a.y);
  if (C0) {
    const out = [a.clone()];
    const toward = (wA === 'n' || wA === 's')
      ? new THREE.Vector3(C0.x, a.y, a.z)
      : new THREE.Vector3(a.x, a.y, C0.z);
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

  /* opposite walls — route via the shorter adjacent wall */
  const makePathVia = (cornerWall) => {
    const cc = adjacentCorner(wA, cornerWall, a.y);
    const cc2 = adjacentCorner(cornerWall, wB, a.y);
    if (!cc || !cc2) return null;
    const out = [a.clone()];
    const t1 = (wA === 'n' || wA === 's')
      ? new THREE.Vector3(cc.x, a.y, a.z)
      : new THREE.Vector3(a.x, a.y, cc.z);
    pushD(out, t1);
    pushD(out, new THREE.Vector3(cc.x, a.y, cc.z));
    const t2 = (wB === 'n' || wB === 's')
      ? new THREE.Vector3(cc2.x, a.y, cc2.z)
      : new THREE.Vector3(cc2.x, a.y, cc2.z);
    pushD(out, t2);
    if (Math.abs(b.y - a.y) > 1e-4) {
      pushD(out, new THREE.Vector3(t2.x, b.y, t2.z));
    }
    const t3 = (wB === 'n' || wB === 's')
      ? new THREE.Vector3(b.x, b.y, t2.z)
      : new THREE.Vector3(t2.x, b.y, b.z);
    pushD(out, t3);
    pushD(out, b.clone());
    return dedupeChain(out);
  };

  const sides = ['n', 's', 'e', 'w'].filter((s) => s !== wA && s !== wB);
  const candidates = sides.map((s) => makePathVia(s)).filter(Boolean);
  if (candidates.length === 0) return dedupeChain([a.clone(), b.clone()]);
  candidates.sort((c1, c2) => chainLength(c1) - chainLength(c2));
  return candidates[0];
}

/* ── Cross-surface transitions ───────────────────────────────────── */

function routeWallToCeiling(A, B, r) {
  const wA = r.wallOf(A);
  const a = r.snapToWall(A, wA);
  const topCorner = r.wallTopCorner(wA, A);
  const out = [a.clone()];
  /* vertical climb on the same wall */
  pushD(out, topCorner);
  /* manhattan on ceiling to target */
  const bOnCeil = new THREE.Vector3(B.x, r.cy, B.z);
  if (topCorner.distanceTo(bOnCeil) >= MIN_VERTEX_M) {
    const straight = Math.abs(topCorner.x - bOnCeil.x) < 0.02 || Math.abs(topCorner.z - bOnCeil.z) < 0.02;
    if (straight) {
      pushD(out, bOnCeil);
    } else {
      bestManhattan2D(out, topCorner, bOnCeil, r.cy);
    }
  }
  pushD(out, B.clone());
  return dedupeChain(out);
}

function routeCeilingToWall(A, B, r) {
  return routeWallToCeiling(B, A, r).slice().reverse();
}

function routeWallToFloor(A, B, r) {
  const wA = r.wallOf(A);
  const a = r.snapToWall(A, wA);
  const bottomCorner = r.wallBottomCorner(wA, A);
  const out = [a.clone()];
  /* vertical descent on the same wall */
  pushD(out, bottomCorner);
  /* manhattan on floor to target */
  const bOnFloor = new THREE.Vector3(B.x, r.fy, B.z);
  if (bottomCorner.distanceTo(bOnFloor) >= MIN_VERTEX_M) {
    const straight = Math.abs(bottomCorner.x - bOnFloor.x) < 0.02 || Math.abs(bottomCorner.z - bOnFloor.z) < 0.02;
    if (straight) {
      pushD(out, bOnFloor);
    } else {
      bestManhattan2D(out, bottomCorner, bOnFloor, r.fy);
    }
  }
  pushD(out, B.clone());
  return dedupeChain(out);
}

function routeFloorToWall(A, B, r) {
  return routeWallToFloor(B, A, r).slice().reverse();
}

function routeFloorToCeiling(A, B, r) {
  /* floor → nearest wall → climb → ceiling */
  const aFloor = new THREE.Vector3(A.x, r.fy, A.z);
  const bCeil = new THREE.Vector3(B.x, r.cy, B.z);
  /* pick nearest wall to A for transit */
  const wA = r.wallOf(A);
  const footOnWall = r.wallBottomCorner(wA, A);
  const topOnWall = r.wallTopCorner(wA, A);
  const out = [A.clone()];
  if (aFloor.distanceTo(footOnWall) >= MIN_VERTEX_M) {
    bestManhattan2D(out, aFloor, footOnWall, r.fy);
  }
  pushD(out, footOnWall);
  pushD(out, topOnWall);
  if (topOnWall.distanceTo(bCeil) >= MIN_VERTEX_M) {
    const straight = Math.abs(topOnWall.x - bCeil.x) < 0.02 || Math.abs(topOnWall.z - bCeil.z) < 0.02;
    if (straight) {
      pushD(out, bCeil);
    } else {
      bestManhattan2D(out, topOnWall, bCeil, r.cy);
    }
  }
  pushD(out, B.clone());
  return dedupeChain(out);
}

function routeCeilingToFloor(A, B, r) {
  return routeFloorToCeiling(B, A, r).slice().reverse();
}

/* ── Main entry point ────────────────────────────────────────────── */

/**
 * Build an optimal polyline segment between two points along room surfaces.
 *
 * placementMode restricts surfaces:
 *   'wall'    — only walls
 *   'floor'   — only floor
 *   'ceiling' — only ceiling
 *   'auto'    — all surfaces, shortest transition path
 *
 * fromSurfaceKind / toSurfaceKind are hints from the picker about which
 * surface each endpoint is on ('wall' | 'floor' | 'ceiling').
 */
export function expandSurfaceRouteSegment(prev, next, bounds, roomHeightM, wallInsetM, options = {}) {
  const { placementMode = 'auto', fromSurfaceKind, toSurfaceKind } = options;
  const r = roomParams(bounds, wallInsetM, roomHeightM);

  const from = fromSurfaceKind || detectSurfaceKind(prev, r.fy, r.cy);
  const to = toSurfaceKind || detectSurfaceKind(next, r.fy, r.cy);

  /* Same surface on the same plane — simple connection */
  const onSameWallFace = (a, b) => {
    const wA = r.wallOf(a);
    const wB = r.wallOf(b);
    if (wA !== wB) return false;
    const d = (wA === 'n' || wA === 's')
      ? Math.abs(a.z - b.z)
      : Math.abs(a.x - b.x);
    return d < 0.12;
  };

  if (from === to && from === 'wall' && onSameWallFace(prev, next)) {
    return dedupeChain([prev.clone(), next.clone()]);
  }

  /* ── Forced single-surface modes ──────────────────────────────── */

  if (placementMode === 'wall') {
    return routeWallToWall(prev, next, r);
  }
  if (placementMode === 'floor') {
    return routeFloorToFloor(prev, next);
  }
  if (placementMode === 'ceiling') {
    return routeCeilToCeil(prev, next, r.cy);
  }

  /* ── Auto mode — route based on surface kinds ─────────────────── */

  if (from === 'wall' && to === 'wall') return routeWallToWall(prev, next, r);
  if (from === 'floor' && to === 'floor') return routeFloorToFloor(prev, next);
  if (from === 'ceiling' && to === 'ceiling') return routeCeilToCeil(prev, next, r.cy);

  if (from === 'wall' && to === 'ceiling') return routeWallToCeiling(prev, next, r);
  if (from === 'ceiling' && to === 'wall') return routeCeilingToWall(prev, next, r);
  if (from === 'wall' && to === 'floor') return routeWallToFloor(prev, next, r);
  if (from === 'floor' && to === 'wall') return routeFloorToWall(prev, next, r);
  if (from === 'floor' && to === 'ceiling') return routeFloorToCeiling(prev, next, r);
  if (from === 'ceiling' && to === 'floor') return routeCeilingToFloor(prev, next, r);

  /* fallback */
  return dedupeChain([prev.clone(), next.clone()]);
}
