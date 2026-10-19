import { DEFAULTS } from '../project/rules';
import { isCircuit } from '../project/schema';
import type { Project, TrackPosition } from '../project/schema';
import { controlPointSample, trackLength } from './centerline';
import type { Sample, Track } from './centerline';

/** Track distance of the control point at `index`. */
export function pointDistance(samples: readonly Sample[], index: number): number {
  return index === 0 ? 0 : (controlPointSample(samples, index)?.s ?? trackLength(samples));
}

/** Keeps a track distance on the track: around a circuit, clamped to the ends of a road. */
export function wrapDistance(track: Track, samples: readonly Sample[], s: number): number {
  const length = trackLength(samples);
  if (!length) return 0;
  return isCircuit(track) ? ((s % length) + length) % length : Math.min(Math.max(s, 0), length);
}

/** Track distance of a position, or null when its control point is gone. */
export function positionDistance(
  track: Track,
  samples: readonly Sample[],
  position: TrackPosition,
): number | null {
  const index = track.points.findIndex((point) => point.id === position.point);
  if (index < 0) return null;
  return wrapDistance(track, samples, pointDistance(samples, index) + position.distance);
}

/** The position at track distance `s`, anchored on the nearest control point before it. */
export function positionAt(track: Track, samples: readonly Sample[], s: number): TrackPosition {
  const target = wrapDistance(track, samples, s);
  let anchor = 0;
  for (let i = 1; i < track.points.length; i++) if (pointDistance(samples, i) <= target) anchor = i;
  return {
    point: track.points[anchor].id,
    distance: Math.max(0, target - pointDistance(samples, anchor)),
  };
}

/** Where the start line is: as set by the user, or a little after the first control point. */
export function startLinePosition(project: Project): TrackPosition | null {
  if (project.startLine) return project.startLine;
  const first = project.points[0];
  return first ? { point: first.id, distance: DEFAULTS.startLine } : null;
}

/**
 * The same place once the control point at `removed` is deleted: a position on
 * that point moves to the previous one, its distance growing by the segment in
 * between. On a road, a position on the first point moves to the next one.
 */
export function reanchorPosition(
  track: Track,
  samples: readonly Sample[],
  position: TrackPosition,
  removed: number,
): TrackPosition {
  const points = track.points;
  if (points[removed]?.id !== position.point) return position;
  const s = pointDistance(samples, removed) + position.distance;
  if (removed === 0 && !isCircuit(track)) {
    const next = points[1];
    if (!next) return position;
    return { point: next.id, distance: Math.max(0, s - pointDistance(samples, 1)) };
  }
  const previous = (removed + points.length - 1) % points.length;
  const before = pointDistance(samples, previous);
  const distance = s >= before ? s - before : s + trackLength(samples) - before;
  return { point: points[previous].id, distance };
}
