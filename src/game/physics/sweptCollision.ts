/**
 * Shared Swept Collision & Physics Primitives
 * Used by both client GameEngine and ServerGameRoom.
 * Uses strictly WORLD coordinates.
 */

/**
 * Swept segment vs axis-aligned bounding box (expanded by radius r).
 * Finds the first parameter t in [0, 1] along (ax,ay) -> (bx,by) where
 * a circle of radius r enters the AABB.
 * Returns null if no collision occurs.
 */
export function sweepSegmentVsAABB(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  r: number,
  wx: number,
  wy: number,
  ww: number,
  wh: number
): number | null {
  // Expand AABB by r on all sides (Minkowski sum for circle vs AABB)
  const minX = wx - r;
  const maxX = wx + ww + r;
  const minY = wy - r;
  const maxY = wy + wh + r;

  const dx = bx - ax;
  const dy = by - ay;
  let tMin = 0;
  let tMax = 1;

  // Check X slab
  if (Math.abs(dx) < 1e-9) {
    if (ax < minX || ax > maxX) return null;
  } else {
    const t1 = (minX - ax) / dx;
    const t2 = (maxX - ax) / dx;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
    if (tMin > tMax) return null;
  }

  // Check Y slab
  if (Math.abs(dy) < 1e-9) {
    if (ay < minY || ay > maxY) return null;
  } else {
    const t1 = (minY - ay) / dy;
    const t2 = (maxY - ay) / dy;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
    if (tMin > tMax) return null;
  }

  return tMin >= 0 && tMin <= 1 ? tMin : null;
}

/**
 * Swept segment vs circle. Returns first t in [0, 1] where the point
 * on the segment is within combinedRadius of the circle center (cx, cy).
 * If already overlapping at start (t=0), returns 0.
 */
export function sweepSegmentVsCircle(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  combinedRadius: number
): number | null {
  const dx = bx - ax;
  const dy = by - ay;
  const fx = ax - cx;
  const fy = ay - cy;
  const r = combinedRadius;

  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;

  // Already overlapping at segment start
  if (c < 0) return 0;
  if (a < 1e-9) return null; // Zero-length segment

  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;

  const sqrtDisc = Math.sqrt(disc);
  const t = (-b - sqrtDisc) / (2 * a);

  return t >= 0 && t <= 1 ? t : null;
}

/**
 * Circle vs AABB overlap test (for player vs wall collision)
 */
export function circleVsAABB(
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): boolean {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const distX = cx - closestX;
  const distY = cy - closestY;
  return distX * distX + distY * distY < r * r;
}

/**
 * Strict world-coordinate boundary clamping
 */
export function clampToBounds(
  x: number,
  y: number,
  radius: number,
  arenaW: number,
  arenaH: number
): { x: number; y: number } {
  return {
    x: Math.max(radius, Math.min(arenaW - radius, x)),
    y: Math.max(radius, Math.min(arenaH - radius, y)),
  };
}
