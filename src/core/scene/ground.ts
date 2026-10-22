import { clamp } from '../math';
import type { PlanPoint } from '../math';
import { SIDES } from '../project/schema';
import { hillLift, hillReach } from '../project/terrain';
import type { Project } from '../project/schema';
import type { Sample } from '../track/centerline';
import { sideProfiles } from '../track/earthworks';
import { LAYOUT } from '../track/layout';
import { pitLaneLayout, sideEdge } from '../track/pitLane';
import { bankLift } from './mesh';

/** Shoulders sit this far below the roadway; the ground beside them starts at their height. */
export const SHOULDER_DROP = 0.04;
/** Size of the cells the centerline is filed in, to find what runs near a point. */
const CELL = 40;
/**
 * How much farther than the nearest segment another one may lie and still shape
 * the ground with its earthworks: the cross-section through the nearest point
 * decides, so a narrow ditch keeps its depth.
 */
const LIFT_SPREAD = 1;

/** The ground beside one centerline segment, at its point nearest to a place. */
interface Beside {
  height: number;
  /** Distance beyond the outer edge of the shoulders, 0 on or inside them. */
  beyond: number;
  /** How far beyond the shoulders the ground near the track is kept there (SideProfiles.hold). */
  hold: number;
  /** Height the earthworks there add to the ground (SideProfiles.lift). */
  lift: number;
  /** How far beyond the shoulders the ground stays flat there (SideProfiles.keep). */
  keep: number;
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/**
 * Height of the ground around the track (docs/adr/0011). Beside the track the
 * ground carries the shoulders on flat, at the height of their outer edge, then
 * eases into a height averaged over the whole track, far away. Every segment of
 * the track nearby pulls the ground to its own edge height, the nearer the
 * stronger, so the ground slopes between two passes of the track without a step.
 * Earthworks reshape the ground beside their segments and keep it near the track
 * farther out; hills rise from the ground beyond the flat strip (docs/adr/0015).
 */
export function groundHeight(
  project: Project,
  samples: readonly Sample[],
): (p: PlanPoint) => number {
  const { blend } = LAYOUT.terrain,
    { hillEase } = LAYOUT;
  const lane = pitLaneLayout(project, samples);
  const profiles = sideProfiles(project, samples);
  // Outer edge of the shoulders on each side, from the centerline.
  const footprint = samples.map((sample) =>
    SIDES.map((side) => sideEdge(project, lane, sample, side) + project.road.shoulder),
  );
  const reachMax = Math.max(...footprint.flat()) + profiles.widestHold + blend;

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
    const beyond = Math.max(0, Math.hypot(p.x - at.x, p.z - at.z) - outer);
    const name = SIDES[side];
    return {
      height: at.y + bankLift(at, lateral) - SHOULDER_DROP,
      beyond,
      hold: mix(profiles.hold(i, name), profiles.hold(i + 1, name)),
      lift: mix(profiles.lift(i, name, beyond), profiles.lift(i + 1, name, beyond)),
      keep: mix(profiles.keep(i, name), profiles.keep(i + 1, name)),
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

  /** Height the hills add at a place, `clear` metres beyond the flat strip of the track. */
  const hills = project.hills.map((hill) => ({ hill, reach: hillReach(hill) }));
  const hillsAt = (p: PlanPoint, clear: number) => {
    if (!hills.length || clear <= 0) return 0;
    let sum = 0;
    for (const { hill, reach } of hills)
      if (Math.abs(p.x - hill.x) < reach && Math.abs(p.z - hill.z) < reach)
        sum += hillLift(hill, p);
    return sum * smoothstep(clamp(clear / hillEase, 0, 1));
  };

  // What each segment near a place adds, kept between calls to spare allocations.
  const lifts: number[] = [],
    distances: number[] = [];
  return (p) => {
    let weighted = 0,
      total = 0,
      nearest = Infinity,
      lifted = false,
      // Distance beyond what the nearest segment keeps, where the far terrain takes over.
      closest = Infinity,
      clear = Infinity;
    lifts.length = distances.length = 0;
    for (const i of cells.get(key(p.x, p.z)) ?? []) {
      const { height, beyond, hold, lift, keep } = besideAt(p, i);
      const limit = hold + blend;
      if (beyond >= limit) continue;
      // Fades out towards the limit, so a segment leaves the sum without a step.
      const weight = (1 - smoothstep(beyond / limit)) / (beyond * beyond + 0.01) ** 2;
      weighted += weight * height;
      total += weight;
      closest = Math.min(closest, beyond - hold);
      clear = Math.min(clear, beyond - keep);
      nearest = Math.min(nearest, beyond);
      lifted ||= lift !== 0;
      lifts.push(lift);
      distances.push(beyond);
    }
    if (!total) return farHeight(p) + hillsAt(p, Infinity);
    let along = weighted / total;
    if (lifted) {
      // Segments farther than the nearest one fade out of the lift, which still
      // changes smoothly where the nearest pass of the track changes.
      let sum = 0,
        share = 0;
      lifts.forEach((lift, k) => {
        const weight = Math.exp(-(((distances[k] - nearest) / LIFT_SPREAD) ** 2));
        sum += lift * weight;
        share += weight;
      });
      along += sum / share;
    }
    const far = smoothstep(clamp(closest / blend, 0, 1));
    return (far ? along + (farHeight(p) - along) * far : along) + hillsAt(p, clear);
  };
}
