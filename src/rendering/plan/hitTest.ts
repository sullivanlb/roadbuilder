import type { Id } from '../../core/ids';
import { clamp, planDistance } from '../../core/math';
import type { PlanPoint, Vec3 } from '../../core/math';
import type { Project, Side } from '../../core/project/schema';
import { barrierPath } from '../../core/scene/barriers';
import { outsideScenery } from '../../core/scene/scenery';
import type { Sample } from '../../core/track/centerline';
import { widestHalf } from '../../core/track/layout';
import type { PlanProjection, ScreenPoint } from './projection';

/** Pick distances, in pixels. */
const PICK = { point: 15, road: 20, barrier: 8, scenery: 6 };

/** A position on the centerline under the cursor. */
export interface RoadHit extends Vec3 {
  segment: number;
  /** Track distance of the hit. */
  s: number;
  nx: number;
  nz: number;
}

/** Distance from `p` to the segment a–b, with the position t ∈ [0, 1] of the closest point. */
function toSegment(p: ScreenPoint, a: ScreenPoint, b: ScreenPoint) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return { t, distance: Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t) };
}

/** The side of the road the cursor is on, relative to the track direction. */
function sideOf(view: PlanProjection, road: RoadHit, at: ScreenPoint): Side {
  const world = view.toWorld(at);
  return (world.x - road.x) * road.nx + (world.z - road.z) * road.nz >= 0 ? 'right' : 'left';
}

/** The control point under the cursor, or null. */
export function findPoint(view: PlanProjection, project: Project, at: ScreenPoint): Id | null {
  let best: Id | null = null,
    threshold = PICK.point;
  for (const point of project.points) {
    const p = view.toScreen(point),
      d = Math.hypot(p.x - at.x, p.y - at.y);
    if (d < threshold) {
      best = point.id;
      threshold = d;
    }
  }
  return best;
}

/** The centerline position nearest the cursor, when the cursor is on or near the road. */
export function findRoad(
  view: PlanProjection,
  project: Project,
  samples: readonly Sample[],
  at: ScreenPoint,
): RoadHit | null {
  let best: RoadHit | null = null,
    threshold = Math.max(PICK.road, 2 * widestHalf(project.road, samples) * view.camera.scale);
  for (let i = 1; i < samples.length; i++) {
    const p = samples[i - 1],
      q = samples[i];
    const { t, distance } = toSegment(at, view.toScreen(p), view.toScreen(q));
    if (distance >= threshold) continue;
    threshold = distance;
    best = {
      x: p.x + (q.x - p.x) * t,
      y: p.y + (q.y - p.y) * t,
      z: p.z + (q.z - p.z) * t,
      segment: p.segment,
      s: p.s + (q.s - p.s) * t,
      nx: p.nx,
      nz: p.nz,
    };
  }
  return best;
}

/** The track distance under the cursor, with the side of the road it points at. */
export function findRoadPosition(
  view: PlanProjection,
  project: Project,
  samples: readonly Sample[],
  at: ScreenPoint,
): { s: number; side: Side } | null {
  const road = findRoad(view, project, samples, at);
  if (!road) return null;
  return { s: road.s, side: sideOf(view, road, at) };
}

/** The barrier under the cursor, or null. */
export function findBarrier(
  view: PlanProjection,
  project: Project,
  samples: readonly Sample[],
  at: ScreenPoint,
): Id | null {
  let best: Id | null = null,
    threshold = PICK.barrier;
  for (const barrier of project.barriers) {
    const path = barrierPath(project, samples, barrier).map((p) => view.toScreen(p));
    for (let i = 1; i < path.length; i++) {
      const { distance } = toSegment(at, path[i - 1], path[i]);
      if (distance < threshold) {
        threshold = distance;
        best = barrier.id;
      }
    }
  }
  return best;
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

/** The scenery item under the cursor, or null. */
export const findScenery = (view: PlanProjection, project: Project, at: ScreenPoint) =>
  sceneryAt(project, view.toWorld(at), PICK.scenery / view.camera.scale);

/** What lies under a click, whatever the view it was made in, for the layers to pick from. */
export interface TrackHit {
  /** The place on the ground. */
  ground: PlanPoint;
  /** Where the click lands on the road, when it is on or near it. */
  road: { s: number; side: Side } | null;
  pointId: Id | null;
  barrierId: Id | null;
  sceneryId: Id | null;
}

/** Everything under the cursor that a click could pick. */
export function trackHitAt(
  view: PlanProjection,
  project: Project,
  samples: readonly Sample[],
  at: ScreenPoint,
): TrackHit {
  return {
    ground: view.toWorld(at),
    road: findRoadPosition(view, project, samples, at),
    pointId: findPoint(view, project, at),
    barrierId: findBarrier(view, project, samples, at),
    sceneryId: findScenery(view, project, at),
  };
}

/** How close, in metres, a place on the ground must be to count as on a point or a barrier. */
const REACH = { point: 4, barrier: 2.5, scenery: 1.5 };

/**
 * What lies at a place on the ground, for clicks made in the 3D preview. A
 * control point already hit in the view (its post) wins over the nearest one.
 */
export function trackHitNear(
  project: Project,
  samples: readonly Sample[],
  at: PlanPoint,
  pointId: Id | null = null,
): TrackHit {
  let nearest: Sample | null = null,
    best = Infinity;
  for (const sample of samples) {
    const d = planDistance(sample, at);
    if (d < best) {
      best = d;
      nearest = sample;
    }
  }
  const road =
    nearest && best <= nearest.half + project.road.shoulder + 4
      ? {
          s: nearest.s,
          side:
            (at.x - nearest.x) * nearest.nx + (at.z - nearest.z) * nearest.nz >= 0
              ? ('right' as const)
              : ('left' as const),
        }
      : null;
  const point =
    pointId ??
    project.points.find((candidate) => planDistance(candidate, at) <= REACH.point)?.id ??
    null;
  let barrierId: Id | null = null,
    closest: number = REACH.barrier;
  for (const barrier of project.barriers)
    for (const p of barrierPath(project, samples, barrier)) {
      const d = planDistance(p, at);
      if (d < closest) {
        closest = d;
        barrierId = barrier.id;
      }
    }
  return {
    ground: { x: at.x, z: at.z },
    road,
    pointId: point,
    barrierId,
    sceneryId: sceneryAt(project, at, REACH.scenery),
  };
}
