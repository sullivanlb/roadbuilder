/** A position on the ground plane: X east, Z south (screen down in the plan). */
export interface PlanPoint {
  x: number;
  z: number;
}

/** A world position, Y up, in metres. */
export interface Vec3 extends PlanPoint {
  y: number;
}

/** Axis-aligned box around a set of positions. */
export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

/** Clamps a value into the [min, max] range. */
export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** 3D distance between two positions. */
export const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** Distance between two positions on the ground plane. */
export const planDistance = (a: PlanPoint, b: PlanPoint) => Math.hypot(a.x - b.x, a.z - b.z);

/** Bounding box of positions grown by `padding` on the ground plane; a default area when empty. */
export function bounds(points: readonly (PlanPoint & { y?: number })[], padding = 0): Bounds {
  if (!points.length) return { minX: -300, maxX: 300, minZ: -220, maxZ: 220, minY: 0, maxY: 0 };
  const box: Bounds = {
    minX: Infinity,
    maxX: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
  };
  for (const p of points) {
    box.minX = Math.min(box.minX, p.x - padding);
    box.maxX = Math.max(box.maxX, p.x + padding);
    box.minZ = Math.min(box.minZ, p.z - padding);
    box.maxZ = Math.max(box.maxZ, p.z + padding);
    box.minY = Math.min(box.minY, p.y ?? 0);
    box.maxY = Math.max(box.maxY, p.y ?? 0);
  }
  return box;
}
