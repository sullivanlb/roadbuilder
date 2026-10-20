import { clamp } from '../math';
import { isCircuit } from '../project/schema';
import type { WidthZone } from '../project/schema';
import { trackLength } from './centerline';
import type { Sample, Track } from './centerline';
import { LAYOUT } from './layout';
import { positionDistance } from './positions';

/** A stretch of track as track distances: where it starts and how far it runs. */
export interface TrackRange {
  start: number;
  /** Length along the track, through the start of a circuit if need be. */
  length: number;
}

/** A width zone resolved on the current track. */
export interface WidthZoneRange extends TrackRange {
  zone: WidthZone;
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
const offsetIn = (range: TrackRange, total: number, s: number) =>
  (((s - range.start) % total) + total) % total;

/** Whether track distance `s` lies within a range. */
export const rangeContains = (range: TrackRange, total: number, s: number) =>
  offsetIn(range, total, s) <= range.length;

/**
 * The width zones laid out on the track, in project order. A zone whose end comes
 * before its start runs through the start of a circuit; on a road it is empty.
 * Zones shorter than a metre are left out.
 */
export function widthZoneRanges(track: Track, samples: readonly Sample[]): WidthZoneRange[] {
  const zones = track.widthZones ?? [];
  if (!zones.length || samples.length < 2) return [];
  const total = trackLength(samples),
    circuit = isCircuit(track);
  return zones.flatMap((zone) => {
    const start = positionDistance(track, samples, zone.from),
      end = positionDistance(track, samples, zone.to);
    if (start === null || end === null) return [];
    const length = end >= start ? end - start : circuit ? end + total - start : 0;
    return length < 1 ? [] : [{ zone, start, length }];
  });
}

/**
 * Half the roadway width at track distance `s`. Each zone eases from the width
 * around it to its own over the taper at both ends; where zones overlap, the
 * later one in the project wins.
 */
export function halfWidthAt(
  base: number,
  ranges: readonly WidthZoneRange[],
  total: number,
  s: number,
): number {
  let half = base;
  for (const range of ranges) {
    const offset = offsetIn(range, total, s);
    if (offset > range.length) continue;
    const taper = Math.min(LAYOUT.widthTaper, range.length / 2);
    const t = clamp(Math.min(offset, range.length - offset) / taper, 0, 1);
    half += (range.zone.width / 2 - half) * t * t * (3 - 2 * t);
  }
  return half;
}

/** Where two ranges start sharing track, on a track of length `total`, or null when they do not. */
export function overlapStart(a: TrackRange, b: TrackRange, total: number): number | null {
  if (offsetIn(a, total, b.start) < a.length) return b.start;
  if (offsetIn(b, total, a.start) < b.length) return a.start;
  return null;
}
