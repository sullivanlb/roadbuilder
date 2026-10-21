import { planDistance } from '../math';
import type { PlanPoint } from '../math';
import type { Sample } from '../track/centerline';
import type { NumericRule } from './rules';
import type { SceneryItem, SceneryKind, SceneryVariant } from './schema';

export const SCENERY_SIZE_NAMES = ['width', 'depth', 'height'] as const;
type Size = Pick<SceneryItem, (typeof SCENERY_SIZE_NAMES)[number]>;

/** The variants each kind of scenery accepts, the first one by default; none for buildings and grandstands. */
export const SCENERY_VARIANTS: Record<SceneryKind, readonly SceneryVariant[]> = {
  tree: ['leafy', 'conifer'],
  building: [],
  grandstand: [],
  sign: ['billboard', 'board'],
  light: ['single', 'double'],
};

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

/** A new scenery item of a kind, with the defaults of its kind. */
export function newScenery(
  id: string,
  kind: SceneryKind,
  at: PlanPoint,
  heading: number,
): SceneryItem {
  const variant = SCENERY_VARIANTS[kind][0];
  return {
    id,
    kind,
    x: at.x,
    z: at.z,
    heading,
    ...SCENERY_DEFAULTS[kind],
    ...(variant ? { variant } : {}),
    ...(kind === 'tree' ? { count: 1 } : {}),
  };
}

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

/** The heading of an item at `at` facing the nearest part of the track. */
export function facingTrack(samples: readonly Sample[], at: PlanPoint): number {
  let nearest: Sample | null = null,
    best = Infinity;
  for (const sample of samples) {
    const d = planDistance(sample, at);
    if (d < best) {
      best = d;
      nearest = sample;
    }
  }
  return nearest ? headingTowards(at, nearest) : 0;
}

/** Half the size of a lamp head along a light's arm, beyond the arm's end. */
const LAMP_REACH = 0.35;

/**
 * The rectangle an item covers on the plan, in its own frame: `u` across its
 * front, `v` towards it. A light covers its pole and the arms reaching forward
 * (and back, with two) by its width.
 */
function sceneryExtent(item: SceneryItem): { u: [number, number]; v: [number, number] } {
  if (item.kind === 'light') {
    const reach = item.width + LAMP_REACH,
      half = item.depth / 2;
    return { u: [-half, half], v: [item.variant === 'double' ? -reach : -half, reach] };
  }
  return { u: [-item.width / 2, item.width / 2], v: [-item.depth / 2, item.depth / 2] };
}

/**
 * How far a place on the plan lies outside an item's footprint, in metres: 0
 * inside it. A tree's footprint is the round of its crown or grove.
 */
export function outsideScenery(item: SceneryItem, p: PlanPoint): number {
  const dx = p.x - item.x,
    dz = p.z - item.z;
  if (item.kind === 'tree') return Math.max(0, Math.hypot(dx, dz) - item.width / 2);
  const front = headingVector(item.heading);
  const u = dx * -front.z + dz * front.x,
    v = dx * front.x + dz * front.z;
  const extent = sceneryExtent(item);
  const beyond = ([low, high]: [number, number], at: number) => Math.max(low - at, 0, at - high);
  return Math.hypot(beyond(extent.u, u), beyond(extent.v, v));
}

/** The corners of an item's footprint on the plan, a rectangle; its front edge joins the last two. */
export function sceneryFootprint(item: SceneryItem): PlanPoint[] {
  const front = headingVector(item.heading);
  const {
    u: [u0, u1],
    v: [v0, v1],
  } = sceneryExtent(item);
  return [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ].map(([u, v]) => ({
    x: item.x + front.x * v - front.z * u,
    z: item.z + front.z * v + front.x * u,
  }));
}

/** How far an item's footprint reaches from its centre, in metres. */
export const sceneryReach = (item: SceneryItem) =>
  item.kind === 'tree'
    ? item.width / 2
    : Math.max(...sceneryFootprint(item).map((corner) => planDistance(corner, item)));
