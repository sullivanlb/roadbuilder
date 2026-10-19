import type { Id } from '../ids';
import { isCircuit } from '../project/schema';
import type { Sample, Track } from './centerline';

/** A stretch of track between two control points, in track direction. */
export interface Span {
  from: Id;
  to: Id;
}

/** Segments covered by a span, in driving order; empty when an endpoint is unknown. */
export function spanSegments(track: Track, span: Span): number[] {
  const count = track.points.length;
  const from = track.points.findIndex((point) => point.id === span.from);
  const to = track.points.findIndex((point) => point.id === span.to);
  if (from < 0 || to < 0 || from === to) return [];
  const segments: number[] = [];
  if (isCircuit(track)) {
    for (let i = from; i !== to; i = (i + 1) % count) segments.push(i);
    return segments;
  }
  for (let i = from; i < to; i++) segments.push(i);
  return segments;
}

/** Samples covering a span in driving order, without duplicates; a circuit span may run through the start. */
export function spanSamples(track: Track, samples: readonly Sample[], span: Span): Sample[] {
  const segments = spanSegments(track, span);
  if (samples.length < 2 || !segments.length) return [];
  const path: Sample[] = [];
  const push = (sample: Sample) => {
    const previous = path.at(-1);
    if (previous && Math.hypot(sample.x - previous.x, sample.z - previous.z) < 0.0001) return;
    path.push(sample);
  };
  for (const segment of segments)
    for (const sample of samples) if (sample.segment === segment) push(sample);
  const last = (segments.at(-1)! + 1) % track.points.length;
  const end =
    samples.find((sample) => sample.segment === last && sample.t === 0) ?? samples.at(-1)!;
  push(end);
  return path;
}
