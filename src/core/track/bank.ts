import type { BankZone } from '../project/schema';
import { trackLength } from './centerline';
import type { Sample, Track } from './centerline';
import { positionRange, rangeContains, rangeEase } from './ranges';
import type { TrackRange } from './ranges';

/** A bank zone resolved on the current track. */
export interface BankZoneRange extends TrackRange {
  zone: BankZone;
}

/**
 * The bank zones laid out on the track, in project order. A zone whose end comes
 * before its start runs through the start of a circuit; on a road it is empty.
 * Zones shorter than a metre are left out.
 */
export function bankZoneRanges(track: Track, samples: readonly Sample[]): BankZoneRange[] {
  const zones = track.bankZones ?? [];
  if (!zones.length || samples.length < 2) return [];
  return zones.flatMap((zone) => {
    const range = positionRange(track, samples, zone.from, zone.to);
    return range && range.length >= 1 ? [{ zone, ...range }] : [];
  });
}

/** The bank zone at track distance `s`, the later one where zones overlap, or null. */
export function bankZoneAt(track: Track, samples: readonly Sample[], s: number): BankZone | null {
  const total = trackLength(samples);
  const ranges = bankZoneRanges(track, samples).filter((range) => rangeContains(range, total, s));
  return ranges.at(-1)?.zone ?? null;
}

/** Cross slope of a bank zone: rise per metre towards the right of the track. */
export const zoneSlope = (zone: Pick<BankZone, 'angle' | 'high'>) =>
  Math.tan((zone.angle * Math.PI) / 180) * (zone.high === 'right' ? 1 : -1);

/**
 * Cross slope of the roadway at track distance `s`, rise per metre towards the
 * right: 0 outside bank zones. Each zone eases in and out over its transition;
 * where zones overlap, the later one wins.
 */
export function bankAt(ranges: readonly BankZoneRange[], total: number, s: number): number {
  let slope = 0;
  for (const range of ranges)
    slope += (zoneSlope(range.zone) - slope) * rangeEase(range, total, s, range.zone.transition);
  return slope;
}

/**
 * The side a bank zone over a stretch should raise: the outside of the way the
 * centerline mostly bends along it, the right on a straight.
 */
export function outsideOf(samples: readonly Sample[]): BankZone['high'] {
  const turn = samples.reduce((sum, sample) => sum + sample.curvature, 0);
  return turn > 0 ? 'left' : 'right';
}
