import type { PlanPoint } from '../math';
import type { NumericRule } from './rules';
import { headingVector } from './scenery';
import type { Earthwork, EarthworkType, Hill } from './schema';

/** The settings of an earthwork that can change with its type. */
export const EARTHWORK_SETTING_NAMES = ['offset', 'width', 'height'] as const;
export type EarthworkSettings = Pick<Earthwork, (typeof EARTHWORK_SETTING_NAMES)[number]>;

/**
 * Farthest an earthwork reaches beyond the shoulders, offset and width together:
 * within the narrowest terrain margin, so it always lies on the terrain.
 */
export const EARTHWORK_REACH = 50;

/**
 * The settings each type of earthwork accepts, in metres (docs/adr/0015). A rule
 * whose minimum is its maximum is fixed and not offered in the interface. The
 * height of a ditch is its depth; an embankment falls when its height is negative.
 */
export const EARTHWORK_RULES: Record<
  EarthworkType,
  Record<keyof EarthworkSettings, NumericRule>
> = {
  embankment: {
    offset: { min: 0, max: 30, step: 0.5 },
    width: { min: 2, max: 40, step: 0.5 },
    height: { min: -20, max: 20, step: 0.5 },
  },
  ditch: {
    offset: { min: 0, max: 30, step: 0.5 },
    width: { min: 1, max: 12, step: 0.5 },
    height: { min: 0.2, max: 4, step: 0.1 },
  },
  runoff: {
    offset: { min: 0, max: 0, step: 0.5 },
    width: { min: 5, max: EARTHWORK_REACH, step: 1 },
    height: { min: 0, max: 0, step: 0.5 },
  },
};

/** What a new earthwork of each type looks like. */
export const EARTHWORK_DEFAULTS: Record<EarthworkType, EarthworkSettings> = {
  embankment: { offset: 2, width: 8, height: 3 },
  ditch: { offset: 1, width: 3, height: 0.8 },
  runoff: { offset: 0, width: 25, height: 0 },
};

/** Whether a setting of a type can be changed: a fixed one cannot. */
export const editableEarthwork = (type: EarthworkType, setting: keyof EarthworkSettings) =>
  EARTHWORK_RULES[type][setting].min < EARTHWORK_RULES[type][setting].max;

/**
 * Where a place lies in a hill, as a share of its size: 0 at its top, 1 on its
 * outline. Its width runs across its heading, its depth along it, like a scenery item.
 */
export function hillRadius(hill: Hill, p: PlanPoint): number {
  const front = headingVector(hill.heading);
  const dx = p.x - hill.x,
    dz = p.z - hill.z;
  const u = dx * -front.z + dz * front.x,
    v = dx * front.x + dz * front.z;
  return Math.hypot(u / (hill.width / 2), v / (hill.depth / 2));
}

/**
 * The outline of a hill on the plan at a share of its size, 1 for its foot, as a
 * closed ring of `count` places: where hillRadius() is that share.
 */
export function hillOutline(hill: Hill, share = 1, count = 48): PlanPoint[] {
  const front = headingVector(hill.heading);
  return Array.from({ length: count }, (_, k) => {
    const angle = (k / count) * Math.PI * 2,
      u = (Math.cos(angle) * hill.width * share) / 2,
      v = (Math.sin(angle) * hill.depth * share) / 2;
    return { x: hill.x + front.x * v - front.z * u, z: hill.z + front.z * v + front.x * u };
  });
}

/** Height a hill adds to the ground at a place: its full height on top, easing to nothing at its outline. */
export function hillLift(hill: Hill, p: PlanPoint): number {
  const r = hillRadius(hill, p);
  return r < 1 ? (hill.height * (1 + Math.cos(Math.PI * r))) / 2 : 0;
}

/** How far a hill reaches from its centre, in metres. */
export const hillReach = (hill: Hill) => Math.max(hill.width, hill.depth) / 2;

/** The hill covering a place on the plan, or null: the smallest wins, so a hill on a larger one can be picked. */
export function hillAt(hills: readonly Hill[], at: PlanPoint): Hill | null {
  let found: Hill | null = null;
  for (const hill of hills)
    if (
      hillRadius(hill, at) <= 1 &&
      (!found || hill.width * hill.depth < found.width * found.depth)
    )
      found = hill;
  return found;
}

/** What a new hill looks like: an oval rise, longer across its heading. */
export const HILL_DEFAULTS: Pick<Hill, 'width' | 'depth' | 'height'> = {
  width: 120,
  depth: 80,
  height: 12,
};
