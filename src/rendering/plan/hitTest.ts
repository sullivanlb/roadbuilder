import type { Id } from '../../core/ids';
import { clamp } from '../../core/math';
import type { Vec3 } from '../../core/math';
import type { Project, Side } from '../../core/project/schema';
import { barrierPath } from '../../core/scene/barriers';
import type { Sample } from '../../core/track/centerline';
import { widestHalf } from '../../core/track/layout';
import { lazyHit, sceneryAt, terrainHit } from '../hits';
import type { TrackHit } from '../hits';
import type { PlanProjection, ScreenPoint } from './projection';

export type { TrackHit };

/** Pick distances, in pixels. */
const PICK = { point: 15, road: 20, barrier: 8, scenery: 6 };

/** A position on the centerline under the cursor. */
interface RoadHit extends Vec3 {
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
function findPoint(view: PlanProjection, project: Project, at: ScreenPoint): Id | null {
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
function findRoad(
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
function findRoadPosition(
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
function findBarrier(
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

/** The scenery item under the cursor, or null. */
const findScenery = (view: PlanProjection, project: Project, at: ScreenPoint) =>
  sceneryAt(project, view.toWorld(at), PICK.scenery / view.camera.scale);

/** Everything under the cursor on the plan that a click could pick, with the plan's reach in pixels. */
export function trackHitAt(
  view: PlanProjection,
  project: Project,
  samples: readonly Sample[],
  at: ScreenPoint,
): TrackHit {
  const ground = view.toWorld(at);
  return lazyHit({
    ground: () => ground,
    road: () => findRoadPosition(view, project, samples, at),
    pointId: () => findPoint(view, project, at),
    barrierId: () => findBarrier(view, project, samples, at),
    sceneryId: () => findScenery(view, project, at),
    ...terrainHit(project, samples, ground),
  });
}
