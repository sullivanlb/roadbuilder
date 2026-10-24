import { clamp, planDistance } from '../math';
import { isCircuit } from '../project/schema';
import type { TrackPosition } from '../project/schema';
import { sampleAt, trackLength } from './centerline';
import type { Sample, Track } from './centerline';
import { positionDistance } from './positions';

/**
 * A stretch of track as track distances: where it starts and how far it runs.
 * Everything laid along the track (width zones, barriers) is a range between two
 * track positions (docs/adr/0008).
 */
export interface TrackRange {
  start: number;
  /** Length along the track, through the start of a circuit if need be. */
  length: number;
}

/**
 * What is laid along the track between two track positions (docs/adr/0008):
 * each kind by its own tool, all of them the same way.
 */
export type LaidKind = 'barrier' | 'widthZone' | 'bankZone' | 'pitLane' | 'earthwork';

/**
 * The range between two track positions, in track direction, or null when a
 * position's control point is gone. An end before the start runs through the
 * start of a circuit; on a road the range is then empty.
 */
export function positionRange(
  track: Track,
  samples: readonly Sample[],
  from: TrackPosition,
  to: TrackPosition,
): TrackRange | null {
  const start = positionDistance(track, samples, from),
    end = positionDistance(track, samples, to);
  if (start === null || end === null) return null;
  const length =
    end >= start ? end - start : isCircuit(track) ? end + trackLength(samples) - start : 0;
  return { start, length };
}

/**
 * Things laid between two track positions, resolved on the track in project
 * order, each under `key`. One whose end comes before its start runs through the
 * start of a circuit; on a road it is empty. Those shorter than a metre are left out.
 */
export function laidRanges<T extends { from: TrackPosition; to: TrackPosition }, K extends string>(
  track: Track,
  samples: readonly Sample[],
  items: readonly T[],
  key: K,
): (TrackRange & Record<K, T>)[] {
  if (!items.length || samples.length < 2) return [];
  return items.flatMap((item) => {
    const range = positionRange(track, samples, item.from, item.to);
    return range && range.length >= 1
      ? [{ ...range, [key]: item } as TrackRange & Record<K, T>]
      : [];
  });
}

/**
 * The stretch between two clicked track distances, in track direction: in the
 * order of the track on a road, the shorter way round on a circuit.
 */
export function rangeBetween(
  track: Track,
  samples: readonly Sample[],
  a: number,
  b: number,
): TrackRange {
  if (!isCircuit(track)) return { start: Math.min(a, b), length: Math.abs(b - a) };
  const total = trackLength(samples);
  const forward = (((b - a) % total) + total) % total;
  return forward <= total / 2
    ? { start: a, length: forward }
    : { start: b, length: total - forward };
}

/** Distance from the start of a range to track distance `s`, going forward around a circuit. */
export const offsetIn = (range: TrackRange, total: number, s: number) =>
  (((s - range.start) % total) + total) % total;

/**
 * How far into a range track distance `s` has eased: 0 outside it, rising
 * smoothly to 1 over `taper` metres after its start and falling back to 0 over
 * the same length before its end. The taper is shortened to half a short range.
 */
export function rangeEase(range: TrackRange, total: number, s: number, taper: number): number {
  const offset = offsetIn(range, total, s);
  if (offset > range.length) return 0;
  const t = clamp(
    Math.min(offset, range.length - offset) / Math.min(taper, range.length / 2),
    0,
    1,
  );
  return t * t * (3 - 2 * t);
}

/** Whether track distance `s` lies within a range. */
export const rangeContains = (range: TrackRange, total: number, s: number) =>
  offsetIn(range, total, s) <= range.length;

/** Where two ranges start sharing track, on a track of length `total`, or null when they do not. */
export function overlapStart(a: TrackRange, b: TrackRange, total: number): number | null {
  if (offsetIn(a, total, b.start) < a.length) return b.start;
  if (offsetIn(b, total, a.start) < b.length) return a.start;
  return null;
}

/**
 * The centerline along a range in driving order: the samples inside it, framed by
 * the exact places where it starts and ends. A range ending on control points
 * gives back the very samples sitting on them.
 */
export function rangeSamples(samples: readonly Sample[], range: TrackRange): Sample[] {
  if (samples.length < 2 || range.length <= 0) return [];
  const total = trackLength(samples),
    end = range.start + range.length;
  const exact = (s: number) =>
    samples.find((sample) => Math.abs(sample.s - s) < 1e-6) ?? sampleAt(samples, s)!;
  const path: Sample[] = [];
  const push = (sample: Sample) => {
    const previous = path.at(-1);
    if (!previous || planDistance(previous, sample) >= 0.0001) path.push(sample);
  };
  push(exact(range.start));
  // Two laps cover a range running through the start of a circuit.
  for (const lap of [0, total])
    for (const sample of samples) {
      const s = sample.s + lap;
      if (s > range.start && s < end) push(sample);
    }
  push(exact(end > total ? end - total : end));
  return path;
}
