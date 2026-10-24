import type { WidthZone } from '../project/schema';
import { trackLength } from './centerline';
import type { Sample, Track } from './centerline';
import { LAYOUT } from './layout';
import { laidRanges, rangeContains, rangeEase } from './ranges';
import type { TrackRange } from './ranges';

/** A width zone resolved on the current track. */
export interface WidthZoneRange extends TrackRange {
  zone: WidthZone;
}

/** The width zones laid out on the track, in project order (see laidRanges). */
export const widthZoneRanges = (track: Track, samples: readonly Sample[]): WidthZoneRange[] =>
  laidRanges(track, samples, track.widthZones ?? [], 'zone');

/** The width zone at track distance `s`, the later one where zones overlap, or null. */
export function widthZoneAt(track: Track, samples: readonly Sample[], s: number): WidthZone | null {
  const total = trackLength(samples);
  const ranges = widthZoneRanges(track, samples).filter((range) => rangeContains(range, total, s));
  return ranges.at(-1)?.zone ?? null;
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
  for (const range of ranges)
    half += (range.zone.width / 2 - half) * rangeEase(range, total, s, LAYOUT.widthTaper);
  return half;
}
