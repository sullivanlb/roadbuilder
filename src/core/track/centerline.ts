import { clamp, distance } from '../math';
import type { Vec3 } from '../math';
import { isCircuit } from '../project/schema';
import type { Project } from '../project/schema';

/** A point of the centerline with its local frame, laid out at regular spacing. */
export interface Sample extends Vec3 {
  /** Segment the sample belongs to: index of the control point it follows. */
  segment: number;
  /** Position within the segment, from 0 at its first control point. */
  t: number;
  /** Track distance in metres. */
  s: number;
  /** Unit normal on the ground plane, pointing to the right of the track direction. */
  nx: number;
  nz: number;
  /** Slope along the track (rise over run). */
  grade: number;
  /** Signed curvature in 1/m: positive when the track bends to the right. */
  curvature: number;
}

export type Track = Pick<Project, 'road' | 'points'>;

// Centripetal Catmull–Rom: stable bends even with unevenly spaced control points.
function interpolate(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const t0 = 0,
    t1 = t0 + Math.sqrt(Math.max(distance(p0, p1), 0.01));
  const t2 = t1 + Math.sqrt(Math.max(distance(p1, p2), 0.01));
  const t3 = t2 + Math.sqrt(Math.max(distance(p2, p3), 0.01));
  const u = t1 + (t2 - t1) * t;
  const mix = (a: Vec3, b: Vec3, ta: number, tb: number): Vec3 => {
    const wa = (tb - u) / (tb - ta),
      wb = (u - ta) / (tb - ta);
    return { x: wa * a.x + wb * b.x, y: wa * a.y + wb * b.y, z: wa * a.z + wb * b.z };
  };
  const a1 = mix(p0, p1, t0, t1),
    a2 = mix(p1, p2, t1, t2),
    a3 = mix(p2, p3, t2, t3);
  const p = mix(mix(a1, a2, t0, t2), mix(a2, a3, t1, t3), t1, t2);
  // Monotone smoothstep height prevents elevation overshoot at extrema.
  p.y = p1.y + (p2.y - p1.y) * t * t * (3 - 2 * t);
  return p;
}

const frameless = { s: 0, nx: 0, nz: 1, grade: 0, curvature: 0 };

/** Lays out the centerline as samples roughly `spacing` metres apart. */
export function sampleTrack(track: Track, spacing = 3): Sample[] {
  const points = track.points,
    n = points.length;
  const position = (p: Vec3): Vec3 => ({ x: p.x, y: p.y, z: p.z });
  if (n < 2) return points.map((p) => ({ ...position(p), segment: 0, t: 0, ...frameless }));
  const circuit = isCircuit(track);
  // A road is extended past its ends in a straight line so its first and last bends stay natural.
  const get = (i: number): Vec3 => {
    if (circuit) return points[(i + n) % n];
    if (i < 0)
      return { x: 2 * points[0].x - points[1].x, y: points[0].y, z: 2 * points[0].z - points[1].z };
    if (i >= n)
      return {
        x: 2 * points[n - 1].x - points[n - 2].x,
        y: points[n - 1].y,
        z: 2 * points[n - 1].z - points[n - 2].z,
      };
    return points[i];
  };
  const roughLength =
    points.reduce((total, p, i) => total + (i ? distance(points[i - 1], p) : 0), 0) +
    (circuit ? distance(points[n - 1], points[0]) : 0);
  const step = Math.max(spacing, roughLength / 6000);
  const samples: Sample[] = [];
  for (let i = 0; i < (circuit ? n : n - 1); i++) {
    const count = Math.max(8, Math.ceil(distance(get(i), get(i + 1)) / step));
    for (let j = 0; j < count; j++)
      samples.push({
        ...interpolate(get(i - 1), get(i), get(i + 1), get(i + 2), j / count),
        segment: i,
        t: j / count,
        ...frameless,
      });
  }
  samples.push({
    ...position(circuit ? samples[0] : points[n - 1]),
    segment: circuit ? n - 1 : n - 2,
    t: 1,
    ...frameless,
  });
  let length = 0;
  samples.forEach((p, i) => {
    if (i) length += distance(samples[i - 1], p);
    const before = samples[i === 0 ? (circuit ? samples.length - 2 : 0) : i - 1];
    const after = samples[i === samples.length - 1 ? (circuit ? 1 : i) : i + 1];
    const dx = after.x - before.x,
      dz = after.z - before.z,
      l = Math.hypot(dx, dz) || 1;
    p.nx = -dz / l;
    p.nz = dx / l;
    p.s = length;
    p.grade = (after.y - before.y) / l;
    const ax = p.x - before.x,
      az = p.z - before.z,
      bx = after.x - p.x,
      bz = after.z - p.z;
    p.curvature = (2 * (ax * bz - az * bx)) / (Math.hypot(ax, az) * Math.hypot(bx, bz) * l || 1);
  });
  return samples;
}

/** Total track distance of the samples. */
export const trackLength = (samples: readonly Sample[]) => samples.at(-1)?.s ?? 0;

/** The centerline interpolated at track distance `s` (clamped), or null without samples. */
export function sampleAt(samples: readonly Sample[], s: number): Sample | null {
  if (!samples.length) return null;
  s = clamp(s, 0, trackLength(samples));
  let lo = 0,
    hi = samples.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].s < s) lo = mid;
    else hi = mid;
  }
  const a = samples[lo],
    b = samples[hi],
    t = (s - a.s) / (b.s - a.s || 1);
  const p = { ...a };
  for (const k of ['x', 'y', 'z', 'nx', 'nz', 'grade'] as const) p[k] = a[k] + (b[k] - a[k]) * t;
  const normalLength = Math.hypot(p.nx, p.nz) || 1;
  p.nx /= normalLength;
  p.nz /= normalLength;
  p.s = s;
  return p;
}

/** The sample sitting on control point `index`, the end of the track for the last point of a road. */
export function controlPointSample(samples: readonly Sample[], index: number): Sample | undefined {
  const last = samples.at(-1);
  return (
    samples.find((sample) => sample.segment === index && sample.t === 0) ??
    (last && index === last.segment + 1 ? last : undefined)
  );
}

export interface TrackStats {
  length: number;
  /** Total positive elevation change. */
  climb: number;
  /** Difference between the highest and the lowest altitude. */
  elevation: number;
  min: number;
  max: number;
  /** Steepest grade, in percent. */
  grade: number;
}

export function trackStats(samples: readonly Sample[]): TrackStats {
  if (!samples.length) return { length: 0, climb: 0, elevation: 0, min: 0, max: 0, grade: 0 };
  let climb = 0,
    min = Infinity,
    max = -Infinity,
    grade = 0;
  samples.forEach((p, i) => {
    min = Math.min(min, p.y);
    max = Math.max(max, p.y);
    grade = Math.max(grade, Math.abs(p.grade));
    if (i) climb += Math.max(0, p.y - samples[i - 1].y);
  });
  return {
    length: trackLength(samples),
    climb,
    elevation: max - min,
    min,
    max,
    grade: grade * 100,
  };
}

/** Whether a circuit is driven clockwise as seen from above (X east, Z south). */
export function isClockwise(samples: readonly Sample[]) {
  let area = 0;
  for (let i = 1; i < samples.length; i++)
    area += samples[i - 1].x * samples[i].z - samples[i].x * samples[i - 1].z;
  return area > 0;
}
