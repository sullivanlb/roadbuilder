import { clamp } from '../math';
import { isCircuit } from '../project/schema';
import type { Project, Side } from '../project/schema';
import { trackLength } from './centerline';
import type { Sample } from './centerline';
import { LAYOUT, roadEdge } from './layout';
import { positionDistance } from './positions';

/** How far the lane reaches at one place along it, in metres from the centerline (unsigned). */
export interface PitLaneProfile {
  /** 0 at the entry and exit, 1 along the parallel part. */
  t: number;
  /** Lane surface: from the kerb edge out to `outer`. */
  outer: number;
  /** Middle of the driven part of the lane. */
  center: number;
}

/** The pit lane resolved on the current track. */
export interface PitLaneLayout {
  side: Side;
  /** +1 on the right of the track direction, -1 on the left. */
  sign: 1 | -1;
  width: number;
  /** Track distance of the entry. */
  entry: number;
  /** Length of the lane along the track, entry to exit. */
  length: number;
  taper: number;
  /** Track distances where the parallel part (wall, boxes) starts and ends, unwrapped past the end of a circuit. */
  parallel: [start: number, end: number];
  /** Distance along the lane from its entry, or null when `s` is outside the lane. */
  along(s: number): number | null;
  profile(s: number): PitLaneProfile | null;
}

/** Lays the pit lane out on the track, or null when the project has none. */
export function pitLaneLayout(project: Project, samples: readonly Sample[]): PitLaneLayout | null {
  const lane = project.pitLane;
  if (!lane || !isCircuit(project) || samples.length < 2) return null;
  const entry = positionDistance(project, samples, lane.entry);
  const exit = positionDistance(project, samples, lane.exit);
  if (entry === null || exit === null) return null;
  const total = trackLength(samples);
  const length = exit > entry ? exit - entry : exit + total - entry;
  // Entry and exit on the same spot: nothing to build.
  if (length < 1) return null;
  const taper = Math.min(LAYOUT.pitLane.taper, length / 2);
  const edge = roadEdge(project.road),
    gap = LAYOUT.pitLane.wallGap;
  const along = (s: number) => {
    const offset = (((s - entry) % total) + total) % total;
    return offset <= length ? offset : null;
  };
  return {
    side: lane.side,
    sign: lane.side === 'right' ? 1 : -1,
    width: lane.width,
    entry,
    length,
    taper,
    parallel: [entry + taper, entry + length - taper],
    along,
    profile(s) {
      const offset = along(s);
      if (offset === null) return null;
      const t = clamp(Math.min(offset, length - offset) / taper, 0, 1);
      return {
        t,
        // A sliver of lane even at the very entry, so no surface triangle is flat.
        outer: edge + Math.max(0.05, (gap + lane.width) * t),
        center: edge + (gap + lane.width / 2) * t,
      };
    },
  };
}

/**
 * Distance from the centerline to the outer edge of what is built beside the road
 * on one side: the kerb, or the pit lane where it runs. Shoulders and barriers
 * start from there.
 */
export function sideEdge(
  project: Project,
  lane: PitLaneLayout | null,
  sample: Pick<Sample, 's'>,
  side: Side,
): number {
  const edge = roadEdge(project.road);
  if (!lane || lane.side !== side) return edge;
  return Math.max(edge, lane.profile(sample.s)?.outer ?? edge);
}

/** How many pit boxes fit along the parallel part of the lane. */
export const pitBoxCapacity = (lane: PitLaneLayout) =>
  Math.max(0, Math.floor((lane.parallel[1] - lane.parallel[0]) / LAYOUT.pitLane.boxSpacing));
