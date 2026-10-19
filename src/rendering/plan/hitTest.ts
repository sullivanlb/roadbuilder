import type { Id } from '../../core/ids';
import { clamp } from '../../core/math';
import type { Vec3 } from '../../core/math';
import type { Project, Side } from '../../core/project/schema';
import { barrierPath } from '../../core/scene/barriers';
import type { Sample } from '../../core/track/centerline';
import type { PlanProjection, ScreenPoint } from './projection';

/** Pick distances, in pixels. */
const PICK = { point: 15, road: 20, barrier: 8 };

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
    threshold = Math.max(PICK.road, project.road.width * view.camera.scale);
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

/** The control point nearest the cursor along the road, with the side of the road it points at. */
export function findRoadSide(
  view: PlanProjection,
  project: Project,
  samples: readonly Sample[],
  at: ScreenPoint,
): { pointId: Id; side: Side } | null {
  const road = findRoad(view, project, samples, at);
  const points = project.points;
  if (!road || !points.length) return null;
  const a = points[road.segment],
    b = points[(road.segment + 1) % points.length];
  const distanceTo = (point: Vec3) => {
    const p = view.toScreen(point);
    return Math.hypot(p.x - at.x, p.y - at.y);
  };
  const side = sideOf(view, road, at);
  return { pointId: distanceTo(a) <= distanceTo(b) ? a.id : b.id, side };
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
