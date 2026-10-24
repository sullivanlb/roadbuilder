import { clamp, planDistance } from '../math';
import type { PlanPoint } from '../math';
import { SIDES } from '../project/schema';
import type { Earthwork, Project, Side } from '../project/schema';
import { trackLength } from './centerline';
import type { Sample } from './centerline';
import { clampToBend, LAYOUT } from './layout';
import { pitLaneLayout, shoulderEdge } from './pitLane';
import type { PitLaneLayout } from './pitLane';
import { positionRange, rangeContains, rangeEase, rangeSamples } from './ranges';
import type { TrackRange } from './ranges';

/** An earthwork resolved on the current track. */
export interface EarthworkRange extends TrackRange {
  earthwork: Earthwork;
}

/**
 * The earthworks laid out on the track, in project order (docs/adr/0015). One
 * whose end comes before its start runs through the start of a circuit; on a road
 * it is empty. Earthworks shorter than a metre are left out.
 */
export function earthworkRanges(
  project: Pick<Project, 'road' | 'points' | 'earthworks'>,
  samples: readonly Sample[],
): EarthworkRange[] {
  if (!project.earthworks.length || samples.length < 2) return [];
  return project.earthworks.flatMap((earthwork) => {
    const range = positionRange(project, samples, earthwork.from, earthwork.to);
    return range && range.length >= 1 ? [{ earthwork, ...range }] : [];
  });
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** Share of a ditch's width, in the middle, where it reaches its full depth. */
const DITCH_BOTTOM = 0.4;

/**
 * Height an earthwork adds to the ground `beyond` metres beyond the outer edge
 * of the shoulders: an embankment rises over its width and keeps its height, a
 * ditch dips and comes back up, a run-off only holds the ground flat.
 */
export function earthworkLift(earthwork: Earthwork, beyond: number): number {
  const { offset, width, height } = earthwork;
  if (earthwork.type === 'embankment')
    return height * smoothstep(clamp((beyond - offset) / width, 0, 1));
  if (earthwork.type === 'ditch') {
    const half = width / 2,
      inside = clamp(1 - Math.abs(beyond - offset - half) / half, 0, 1);
    return -height * smoothstep(Math.min(1, inside / (1 - DITCH_BOTTOM)));
  }
  return 0;
}

/**
 * How far beyond the shoulders an earthwork keeps the ground near the track
 * before it eases into the far terrain: out to its far edge, so a ditch keeps its
 * depth, an embankment its top and a run-off its flat.
 */
const earthworkHold = (earthwork: Earthwork) => earthwork.offset + earthwork.width;

/** Where the ground changes shape beyond the shoulders, for the strip that meshes it. */
export function earthworkStations(earthwork: Earthwork): number[] {
  const { offset, width } = earthwork;
  if (earthwork.type === 'runoff') {
    const count = Math.ceil(width / 4);
    return Array.from({ length: count + 1 }, (_, i) => (width * i) / count);
  }
  // Slopes and ditches need fine steps to show their shape.
  const count = Math.max(4, Math.ceil(width / (earthwork.type === 'ditch' ? 0.5 : 1)));
  return [
    offset,
    ...Array.from({ length: count }, (_, i) => offset + (width * (i + 1)) / count),
    offset + width + 2,
  ];
}

/** An earthwork acting on one sample, eased in or out near its ends. */
interface Acting {
  earthwork: Earthwork;
  ease: number;
}

/** The shape of the ground beside the track, sample by sample and side by side. */
export interface SideProfiles {
  /** Height added to the ground `beyond` metres beyond the shoulders of a sample. */
  lift(sample: number, side: Side, beyond: number): number;
  /** How far beyond the shoulders the ground near the track is kept before easing into the far terrain. */
  hold(sample: number, side: Side): number;
  /** How far beyond the shoulders the ground stays flat, at the height of their edge. */
  keep(sample: number, side: Side): number;
  /** The earthworks acting on a sample, eased near their ends. */
  acting(sample: number, side: Side): readonly Acting[];
  /** Farthest any earthwork keeps the ground, beyond the shoulders. */
  widestHold: number;
}

/**
 * The ground profile beside the track (docs/adr/0015). Earthworks on one side add
 * up and ease in and out over LAYOUT.earthworkTaper at their ends; without any,
 * the ground is kept flat over LAYOUT.terrain.flat, as before.
 */
export function sideProfiles(
  project: Pick<Project, 'road' | 'points' | 'earthworks'>,
  samples: readonly Sample[],
): SideProfiles {
  const { flat } = LAYOUT.terrain;
  const none: Acting[] = [];
  const acting = SIDES.map(() => samples.map(() => none));
  const total = trackLength(samples);
  for (const range of earthworkRanges(project, samples)) {
    const side = SIDES.indexOf(range.earthwork.side);
    samples.forEach((sample, i) => {
      if (!rangeContains(range, total, sample.s)) return;
      const ease = rangeEase(range, total, sample.s, LAYOUT.earthworkTaper);
      if (ease > 0) acting[side][i] = [...acting[side][i], { earthwork: range.earthwork, ease }];
    });
  }
  const at = (sample: number, side: Side) => acting[SIDES.indexOf(side)][sample];
  // Eased from the plain flat strip to what an earthwork keeps.
  const reach = (list: readonly Acting[], extent: (earthwork: Earthwork) => number) =>
    list.reduce<number>(
      (widest, { earthwork, ease }) =>
        Math.max(widest, flat + Math.max(0, extent(earthwork) - flat) * ease),
      flat,
    );
  const kept = (earthwork: Earthwork) => (earthwork.type === 'runoff' ? earthwork.width : 0);
  return {
    lift: (sample, side, beyond) =>
      at(sample, side).reduce(
        (sum, { earthwork, ease }) => sum + earthworkLift(earthwork, beyond) * ease,
        0,
      ),
    hold: (sample, side) => reach(at(sample, side), earthworkHold),
    keep: (sample, side) => reach(at(sample, side), kept),
    acting: at,
    widestHold: Math.max(flat, ...project.earthworks.map(earthworkHold)),
  };
}

/**
 * Distance from the centerline to a place `beyond` metres past the outer edge of
 * the shoulders on a side, stopping short of the centre of a bend like the
 * shoulders. The ground an earthwork covers is measured with it everywhere: its
 * mesh, its outline on the plan and in the preview, picking and its warning.
 */
export function besideShoulders(
  project: Project,
  lane: PitLaneLayout | null,
  sample: Pick<Sample, 's' | 'half' | 'curvature'>,
  side: Side,
  beyond: number,
): number {
  const edge = shoulderEdge(project, lane, sample, side);
  return beyond
    ? clampToBend(project.road, sample, side === 'right' ? 1 : -1, edge + beyond)
    : edge;
}

/** The place on the plan `beyond` metres past the shoulders of a sample (see besideShoulders). */
export function pointBesideShoulders(
  project: Project,
  lane: PitLaneLayout | null,
  sample: Sample,
  side: Side,
  beyond: number,
): PlanPoint {
  const lateral =
    (side === 'right' ? 1 : -1) * besideShoulders(project, lane, sample, side, beyond);
  return { x: sample.x + sample.nx * lateral, z: sample.z + sample.nz * lateral };
}

/**
 * The ground an earthwork covers along a range, as a closed ring on the plan:
 * along the outer edge of the shoulders, then back along its far edge.
 */
export function earthworkOutline(
  project: Project,
  samples: readonly Sample[],
  earthwork: Pick<Earthwork, 'side' | 'offset' | 'width'>,
  range: TrackRange,
): PlanPoint[] {
  const lane = pitLaneLayout(project, samples);
  const path = rangeSamples(samples, range);
  const beside = (sample: Sample, beyond: number) =>
    pointBesideShoulders(project, lane, sample, earthwork.side, beyond);
  return [
    ...path.map((sample) => beside(sample, 0)),
    ...[...path].reverse().map((sample) => beside(sample, earthwork.offset + earthwork.width)),
  ];
}

/**
 * The earthwork covering a place on the plan, between the shoulders and its far
 * edge, or null: the later one where several cover it, as drawn on top.
 */
export function earthworkAt(
  project: Project,
  samples: readonly Sample[],
  at: PlanPoint,
): Earthwork | null {
  const ranges = earthworkRanges(project, samples);
  if (!ranges.length) return null;
  let nearest = -1,
    best = Infinity;
  samples.forEach((sample, i) => {
    const d = planDistance(sample, at);
    if (d < best) {
      best = d;
      nearest = i;
    }
  });
  const sample = samples[nearest];
  const lateral = (at.x - sample.x) * sample.nx + (at.z - sample.z) * sample.nz;
  const side: Side = lateral < 0 ? 'left' : 'right';
  const lane = pitLaneLayout(project, samples);
  const across = (beyond: number) => besideShoulders(project, lane, sample, side, beyond);
  const total = trackLength(samples);
  const found = ranges.filter(
    ({ earthwork, ...range }) =>
      earthwork.side === side &&
      Math.abs(lateral) >= across(0) &&
      Math.abs(lateral) <= across(earthwork.offset + earthwork.width) &&
      rangeContains(range, total, sample.s),
  );
  return found.at(-1)?.earthwork ?? null;
}
