import type { PlanPoint } from '../math';
import type { NumericRule } from './rules';
import type { SceneryItem, SceneryKind } from './schema';

type Size = Pick<SceneryItem, 'width' | 'depth' | 'height'>;

/**
 * The sizes each kind of scenery accepts, in metres. A rule whose minimum is its
 * maximum is fixed and not offered in the interface; a grove's depth follows its
 * width, being round.
 */
export const SCENERY_SIZES: Record<SceneryKind, Record<keyof Size, NumericRule>> = {
  tree: {
    width: { min: 2, max: 60, step: 0.5 },
    depth: { min: 2, max: 60, step: 0.5 },
    height: { min: 3, max: 40, step: 0.5 },
  },
  building: {
    width: { min: 4, max: 120, step: 0.5 },
    depth: { min: 4, max: 120, step: 0.5 },
    height: { min: 3, max: 60, step: 0.5 },
  },
  grandstand: {
    width: { min: 6, max: 200, step: 1 },
    depth: { min: 4, max: 30, step: 0.5 },
    height: { min: 3, max: 25, step: 0.5 },
  },
  sign: {
    width: { min: 1, max: 30, step: 0.5 },
    depth: { min: 0.3, max: 0.3, step: 0.1 },
    height: { min: 1, max: 12, step: 0.5 },
  },
  light: {
    width: { min: 0.5, max: 6, step: 0.5 },
    depth: { min: 0.4, max: 0.4, step: 0.1 },
    height: { min: 5, max: 30, step: 0.5 },
  },
};

/** What a new scenery item of each kind looks like. Buildings and grandstands stop cars, the rest does not. */
export const SCENERY_DEFAULTS: Record<SceneryKind, Size & Pick<SceneryItem, 'solid'>> = {
  tree: { width: 6, depth: 6, height: 12, solid: false },
  building: { width: 16, depth: 10, height: 7, solid: true },
  grandstand: { width: 40, depth: 10, height: 8, solid: true },
  sign: { width: 8, depth: 0.3, height: 4, solid: false },
  light: { width: 2.5, depth: 0.4, height: 12, solid: false },
};

/** Whether a size of a kind can be changed: a fixed one, or a grove's depth, cannot. */
export const editableSize = (kind: SceneryKind, size: keyof Size) =>
  !(kind === 'tree' && size === 'depth') &&
  SCENERY_SIZES[kind][size].min < SCENERY_SIZES[kind][size].max;

/** Where the front of a heading faces on the plan: heading 0 faces -Z, 90 faces +X. */
export function headingVector(heading: number): PlanPoint {
  const angle = (heading * Math.PI) / 180;
  return { x: Math.sin(angle), z: -Math.cos(angle) };
}

/** The heading whose front faces from `from` towards `to`. */
export function headingTowards(from: PlanPoint, to: PlanPoint): number {
  const degrees = (Math.atan2(to.x - from.x, -(to.z - from.z)) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

/**
 * How far a place on the plan lies outside an item's footprint, in metres: 0
 * inside it. A tree's footprint is the round of its crown or grove.
 */
export function outsideScenery(item: SceneryItem, p: PlanPoint): number {
  const front = headingVector(item.heading);
  const dx = p.x - item.x,
    dz = p.z - item.z;
  if (item.kind === 'tree') return Math.max(0, Math.hypot(dx, dz) - item.width / 2);
  const u = Math.abs(dx * -front.z + dz * front.x) - item.width / 2,
    v = Math.abs(dx * front.x + dz * front.z) - item.depth / 2;
  return Math.hypot(Math.max(0, u), Math.max(0, v));
}

/** The corners of an item's footprint on the plan, a rectangle around its centre. */
export function sceneryFootprint(item: SceneryItem): PlanPoint[] {
  const front = headingVector(item.heading);
  const w = item.width / 2,
    d = item.depth / 2;
  return [
    [-w, -d],
    [w, -d],
    [w, d],
    [-w, d],
  ].map(([u, v]) => ({
    x: item.x + front.x * v - front.z * u,
    z: item.z + front.z * v + front.x * u,
  }));
}
