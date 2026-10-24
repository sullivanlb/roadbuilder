import type { Id } from '../../core/ids';
import { planDistance } from '../../core/math';
import type { PlanPoint } from '../../core/math';
import type { Project } from '../../core/project/schema';
import { barrierPath } from '../../core/scene/barriers';
import type { Sample } from '../../core/track/centerline';
import { lazyHit, sceneryAt, terrainHit } from '../hits';
import type { TrackHit } from '../hits';

/** How close, in metres, a place on the ground must be to count as on a point or a barrier. */
const REACH = { point: 4, barrier: 2.5, scenery: 1.5 };

/**
 * What lies at a place on the ground, for the pointer in the 3D preview, with
 * the preview's reach in metres. A control point already hit in the view (its
 * post) wins over the nearest one.
 */
export function trackHitNear(
  project: Project,
  samples: readonly Sample[],
  at: PlanPoint & { y?: number },
  pointId: Id | null = null,
): TrackHit {
  const ground = { x: at.x, z: at.z, ...(at.y === undefined ? {} : { y: at.y }) };
  return lazyHit({
    ground: () => ground,
    road() {
      let nearest: Sample | null = null,
        best = Infinity;
      for (const sample of samples) {
        const d = planDistance(sample, at);
        if (d < best) {
          best = d;
          nearest = sample;
        }
      }
      if (!nearest || best > nearest.half + project.road.shoulder + 4) return null;
      const across = (at.x - nearest.x) * nearest.nx + (at.z - nearest.z) * nearest.nz;
      return { s: nearest.s, side: across >= 0 ? 'right' : 'left' };
    },
    pointId: () =>
      pointId ??
      project.points.find((candidate) => planDistance(candidate, at) <= REACH.point)?.id ??
      null,
    barrierId() {
      let found: Id | null = null,
        closest: number = REACH.barrier;
      for (const barrier of project.barriers)
        for (const p of barrierPath(project, samples, barrier)) {
          const d = planDistance(p, at);
          if (d < closest) {
            closest = d;
            found = barrier.id;
          }
        }
      return found;
    },
    sceneryId: () => sceneryAt(project, at, REACH.scenery),
    ...terrainHit(project, samples, ground),
  });
}
