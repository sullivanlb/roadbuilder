import type { Id } from '../core/ids';
import type { PlanPoint } from '../core/math';
import type { Project, Side } from '../core/project/schema';
import { outsideScenery } from '../core/project/scenery';
import { hillAt } from '../core/project/terrain';
import { earthworkAt } from '../core/track/earthworks';
import type { Sample } from '../core/track/centerline';

/**
 * What lies under the pointer, whatever the view it is in (docs/adr/0009): each
 * view resolves it with its own reach, the tools and the layers act on it alike.
 */
export interface TrackHit {
  /** The place on the ground, with its height when the view knows it (the 3D preview). */
  ground: PlanPoint & { y?: number };
  /** Where the pointer lands on the road, when it is on or near it. */
  road: { s: number; side: Side } | null;
  pointId: Id | null;
  barrierId: Id | null;
  sceneryId: Id | null;
  earthworkId: Id | null;
  hillId: Id | null;
}

/**
 * A track hit whose parts are worked out when they are first read, once each:
 * a tool hovering the road need not look for barriers.
 */
export function lazyHit(parts: { [K in keyof TrackHit]: () => TrackHit[K] }): TrackHit {
  const hit = {} as TrackHit;
  for (const key of Object.keys(parts) as (keyof TrackHit)[])
    Object.defineProperty(hit, key, {
      enumerable: true,
      configurable: true,
      get() {
        const value = parts[key]();
        Object.defineProperty(hit, key, { value, enumerable: true });
        return value;
      },
    });
  return hit;
}

/**
 * The scenery item at a place on the plan, or within `reach` metres of it: the
 * smallest wins, so an item standing inside a larger one can still be picked.
 */
export function sceneryAt(project: Project, at: PlanPoint, reach: number): Id | null {
  let best: Id | null = null,
    smallest = Infinity;
  for (const item of project.scenery) {
    if (outsideScenery(item, at) > reach) continue;
    const area = item.width * item.depth;
    if (area < smallest) {
      smallest = area;
      best = item.id;
    }
  }
  return best;
}

/** The earthwork and the hill at a place on the ground, whatever the view. */
export const terrainHit = (project: Project, samples: readonly Sample[], at: PlanPoint) => ({
  earthworkId: () => earthworkAt(project, samples, at)?.id ?? null,
  hillId: () => hillAt(project.hills, at)?.id ?? null,
});
