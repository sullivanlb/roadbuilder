import { clamp } from '../domain/math';
import { barrierPath } from '../domain/track/barriers';
import type { BarrierSide } from '../domain/types';
import type { View } from './view';

/** Point on the roadway found under the cursor. */
export interface RoadHit {
  x: number;
  y: number;
  z: number;
  segment: number;
  nx: number;
  nz: number;
}

/** Index of the control point nearest the click, or -1. */
export function findPoint(view: View, x: number, y: number): number {
  let best = -1,
    threshold = 15;
  view.project.points.forEach((p, i) => {
    const s = view.screen(p),
      d = Math.hypot(s.x - x, s.y - y);
    if (d < threshold) {
      best = i;
      threshold = d;
    }
  });
  return best;
}

/** Roadway position nearest the click, or null. */
export function findRoad(view: View, x: number, y: number): RoadHit | null {
  let best: RoadHit | null = null,
    bestDistance = Math.max(20, view.project.width * view.camera.scale);
  for (let i = 1; i < view.samples.length; i++) {
    const a = view.screen(view.samples[i - 1]),
      b = view.screen(view.samples[i]);
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    const d = Math.hypot(x - a.x - dx * t, y - a.y - dy * t);
    if (d < bestDistance) {
      bestDistance = d;
      const p = view.samples[i - 1],
        q = view.samples[i];
      best = {
        x: p.x + (q.x - p.x) * t,
        y: p.y + (q.y - p.y) * t,
        z: p.z + (q.z - p.z) * t,
        segment: p.segment,
        nx: p.nx,
        nz: p.nz,
      };
    }
  }
  return best;
}

/** Control point nearest the click, along with the targeted side. */
export function findRoadPoint(
  view: View,
  x: number,
  y: number,
): { index: number; side: BarrierSide } | null {
  const road = findRoad(view, x, y);
  const count = view.project.points.length;
  if (!road || !count) return null;
  const a = road.segment,
    b = (a + 1) % count;
  const sa = view.screen(view.project.points[a]),
    sb = view.screen(view.project.points[b]);
  const index = Math.hypot(sa.x - x, sa.y - y) <= Math.hypot(sb.x - x, sb.y - y) ? a : b;
  const world = view.world(x, y);
  const side: BarrierSide =
    (world.x - road.x) * road.nx + (world.z - road.z) * road.nz >= 0 ? 'right' : 'left';
  return { index, side };
}

/** Barrier span nearest the click, within the 8 px limit, or -1. */
export function findBarrier(view: View, x: number, y: number): number {
  let best = -1,
    bestDistance = 8;
  (view.project.barriers ?? []).forEach((barrier, index) => {
    const path = barrierPath(view.project, view.samples, barrier);
    for (let i = 1; i < path.length; i++) {
      const a = view.screen(path[i - 1]),
        b = view.screen(path[i]);
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      const d = Math.hypot(x - a.x - dx * t, y - a.y - dy * t);
      if (d < bestDistance) {
        bestDistance = d;
        best = index;
      }
    }
  });
  return best;
}
