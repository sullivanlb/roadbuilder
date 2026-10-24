import { isCircuit } from '../project/schema';
import { trackLength } from './centerline';
import type { Sample, Track } from './centerline';
import type { TrackRange } from './ranges';

/** How corners are told apart from straights. */
export const CORNER_DETECTION = {
  /** A stretch bends when its radius falls below this, in metres. */
  maxRadius: 150,
  /** Curvature is averaged over this length, so a wobble is not a corner. */
  smoothing: 20,
  /** Bends in the same direction closer than this merge into one corner. */
  mergeGap: 15,
  /** A corner turns at least this much, in degrees. */
  minAngle: 20,
} as const;

/** A bend of the track, found from its curvature; numbered in track direction. */
export interface Corner extends TrackRange {
  /** 1 for the first corner after the start. */
  number: number;
  direction: 'left' | 'right';
  /** How much the track turns through it, in degrees. */
  angle: number;
  /** Track distance where it bends most. */
  apex: number;
}

interface Bend {
  start: number;
  end: number;
  sign: 1 | -1;
  /** Turn in radians, unsigned. */
  turn: number;
  apex: number;
  peak: number;
}

/** The corners of the track, from the first after the start. */
export function trackCorners(track: Track, samples: readonly Sample[]): Corner[] {
  if (samples.length < 3) return [];
  const total = trackLength(samples);
  const { maxRadius, smoothing, mergeGap, minAngle } = CORNER_DETECTION;
  // Curvature averaged over the smoothing length, by a running window over track distance.
  const smoothed = samples.map((sample, i) => {
    let sum = 0,
      count = 0;
    for (let j = i; j >= 0 && sample.s - samples[j].s <= smoothing / 2; j--, count++)
      sum += samples[j].curvature;
    for (
      let j = i + 1;
      j < samples.length && samples[j].s - sample.s <= smoothing / 2;
      j++, count++
    )
      sum += samples[j].curvature;
    return sum / count;
  });
  const bends: Bend[] = [];
  let current: Bend | null = null;
  samples.forEach((sample, i) => {
    const k = smoothed[i];
    const sign = k > 0 ? 1 : -1;
    if (Math.abs(k) < 1 / maxRadius) {
      current = null;
      return;
    }
    const step = i ? sample.s - samples[i - 1].s : 0;
    if (!current || current.sign !== sign) {
      current = { start: sample.s, end: sample.s, sign, turn: 0, apex: sample.s, peak: 0 };
      bends.push(current);
    }
    current.end = sample.s;
    current.turn += Math.abs(k) * step;
    if (Math.abs(k) > current.peak) {
      current.peak = Math.abs(k);
      current.apex = sample.s;
    }
  });
  const merged: Bend[] = [];
  for (const bend of bends) {
    const previous = merged.at(-1);
    if (previous && previous.sign === bend.sign && bend.start - previous.end < mergeGap) {
      previous.end = bend.end;
      previous.turn += bend.turn;
      if (bend.peak > previous.peak) Object.assign(previous, { peak: bend.peak, apex: bend.apex });
    } else merged.push({ ...bend });
  }
  // On a circuit, a corner can run through the start: join its two halves.
  if (isCircuit(track) && merged.length > 1) {
    const first = merged[0],
      last = merged.at(-1)!;
    if (first.sign === last.sign && first.start + total - last.end < mergeGap) {
      last.end = first.end + total;
      last.turn += first.turn;
      if (first.peak > last.peak) Object.assign(last, { peak: first.peak, apex: first.apex });
      merged.shift();
    }
  }
  return merged
    .filter((bend) => (bend.turn * 180) / Math.PI >= minAngle)
    .map((bend, i) => ({
      number: i + 1,
      start: bend.start,
      length: bend.end - bend.start,
      direction: bend.sign > 0 ? 'right' : 'left',
      angle: (bend.turn * 180) / Math.PI,
      apex: bend.apex % (total || 1),
    }));
}
