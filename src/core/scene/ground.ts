import { clamp } from '../math';
import type { PlanPoint } from '../math';
import { SIDES } from '../project/schema';
import type { Project } from '../project/schema';
import type { Sample } from '../track/centerline';
import { LAYOUT } from '../track/layout';
import { pitLaneLayout, sideEdge } from '../track/pitLane';
import { bankLift } from './mesh';

/** Shoulders sit this far below the roadway; the ground beside them starts at their height. */
const SHOULDER_DROP = 0.04;
/** Size of the cells the centerline is filed in, to find what runs near a point. */
const CELL = 40;

/** The ground beside one centerline segment, at its point nearest to a place. */
interface Beside {
  height: number;
  /** Distance beyond the outer edge of the shoulders, 0 on or inside them. */
  beyond: number;
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/**
 * Height of the ground around the track (docs/adr/0011). Beside the track the
 * ground carries the shoulders on flat, at the height of their outer edge, then
 * eases into a height averaged over the whole track, far away. Every segment of
 * the track nearby pulls the ground to its own edge height, the nearer the
 * stronger, so the ground slopes between two passes of the track without a step.
 */
export function groundHeight(
  project: Project,
  samples: readonly Sample[],
): (p: PlanPoint) => number {
  const { flat, blend } = LAYOUT.terrain;
  const lane = pitLaneLayout(project, samples);
  // Outer edge of the shoulders on each side, from the centerline.
  const footprint = samples.map((sample) =>
    SIDES.map((side) => sideEdge(project, lane, sample, side) + project.road.shoulder),
  );
  const reachMax = Math.max(...footprint.flat()) + flat + blend;

  // Each centerline segment is filed in every cell its surroundings overlap.
  const cells = new Map<string, number[]>();
  const key = (x: number, z: number) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i],
      b = samples[i + 1];
    const minX = Math.floor((Math.min(a.x, b.x) - reachMax) / CELL),
      maxX = Math.floor((Math.max(a.x, b.x) + reachMax) / CELL),
      minZ = Math.floor((Math.min(a.z, b.z) - reachMax) / CELL),
      maxZ = Math.floor((Math.max(a.z, b.z) + reachMax) / CELL);
    for (let x = minX; x <= maxX; x++)
      for (let z = minZ; z <= maxZ; z++) {
        const cell = `${x},${z}`;
        if (!cells.has(cell)) cells.set(cell, []);
        cells.get(cell)!.push(i);
      }
  }

  /** The ground beside segment i, at its point nearest to p. */
  const besideAt = (p: PlanPoint, i: number): Beside => {
    const a = samples[i],
      b = samples[i + 1];
    const dx = b.x - a.x,
      dz = b.z - a.z;
    const t = clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
    const mix = (u: number, v: number) => u + (v - u) * t;
    const at = {
      x: mix(a.x, b.x),
      y: mix(a.y, b.y),
      z: mix(a.z, b.z),
      nx: mix(a.nx, b.nx),
      nz: mix(a.nz, b.nz),
      bank: mix(a.bank, b.bank),
      edge: mix(a.edge, b.edge),
    };
    const lateral = (p.x - at.x) * at.nx + (p.z - at.z) * at.nz;
    const side = lateral < 0 ? 0 : 1;
    const outer = mix(footprint[i][side], footprint[i + 1][side]);
    // Measured to the nearest point, so it keeps growing past the ends of a road.
    return {
      height: at.y + bankLift(at, lateral) - SHOULDER_DROP,
      beyond: Math.max(0, Math.hypot(p.x - at.x, p.z - at.z) - outer),
    };
  };

  // Far from the track: an average of the track heights, weighted by distance.
  const anchors = samples.filter((_, i) => i % Math.max(1, Math.ceil(samples.length / 400)) === 0);
  if (anchors.at(-1) !== samples.at(-1)) anchors.push(samples.at(-1)!);
  const farHeight = (p: PlanPoint) => {
    let weighted = 0,
      total = 0;
    for (const a of anchors) {
      const d2 = (p.x - a.x) ** 2 + (p.z - a.z) ** 2 + 36,
        weight = 1 / (d2 * Math.sqrt(d2));
      weighted += weight * (a.y - SHOULDER_DROP);
      total += weight;
    }
    return weighted / total;
  };

  const limit = flat + blend;
  return (p) => {
    let weighted = 0,
      total = 0,
      closest = Infinity;
    for (const i of cells.get(key(p.x, p.z)) ?? []) {
      const { height, beyond } = besideAt(p, i);
      if (beyond >= limit) continue;
      // Fades out towards the limit, so a segment leaves the sum without a step.
      const weight = (1 - smoothstep(beyond / limit)) / (beyond * beyond + 0.01) ** 2;
      weighted += weight * height;
      total += weight;
      closest = Math.min(closest, beyond);
    }
    if (!total) return farHeight(p);
    const along = weighted / total;
    const far = smoothstep(clamp((closest - flat) / blend, 0, 1));
    return far ? along + (farHeight(p) - along) * far : along;
  };
}
