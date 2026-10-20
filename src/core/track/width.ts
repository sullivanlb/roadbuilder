import { clamp } from '../math';
import type { WidthZone } from '../project/schema';
import type { Sample, Track } from './centerline';
import { LAYOUT } from './layout';
import { offsetIn, positionRange } from './ranges';
import type { TrackRange } from './ranges';

/** A width zone resolved on the current track. */
export interface WidthZoneRange extends TrackRange {
  zone: WidthZone;
}

/**
 * The width zones laid out on the track, in project order. A zone whose end comes
 * before its start runs through the start of a circuit; on a road it is empty.
 * Zones shorter than a metre are left out.
 */
export function widthZoneRanges(track: Track, samples: readonly Sample[]): WidthZoneRange[] {
  const zones = track.widthZones ?? [];
  if (!zones.length || samples.length < 2) return [];
  return zones.flatMap((zone) => {
    const range = positionRange(track, samples, zone.from, zone.to);
    return range && range.length >= 1 ? [{ zone, ...range }] : [];
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
