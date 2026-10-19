import type { Id } from '../ids';
import { planDistance } from '../math';
import type { PlanPoint } from '../math';
import { RULES } from '../project/rules';
import { isCircuit } from '../project/schema';
import type { Project } from '../project/schema';
import { sampleTrack, trackStats } from './centerline';
import type { Sample } from './centerline';

/** Thresholds of the track checks. */
export const CHECKS = {
  /** Shortest track that leaves room for the start position and the start line. */
  minLength: 80,
  /** Grade, in percent, above which a warning is raised. */
  steepGrade: 18,
  /** A bend is too tight when its radius falls below this fraction of the road width. */
  tightRadius: 0.65,
} as const;

/**
 * A problem found in the track. Control points are given by their position in
 * the track (zero-based) so messages can name them.
 */
export type TrackIssue =
  | { code: 'points-minimum'; min: number; closed: boolean }
  | { code: 'track-too-short'; min: number }
  | { code: 'points-too-close'; min: number }
  | { code: 'steep-grade'; grade: number }
  | { code: 'tight-turn'; from: number; to: number }
  | { code: 'track-crossing' };

/** The worst bend of one segment that is too tight for the road width. */
export interface TightTurn {
  segment: number;
  /** The control points around the segment. */
  pointIds: [Id, Id];
  /** Sample where the bend is tightest. */
  sampleIndex: number;
  radius: number;
  issue: Extract<TrackIssue, { code: 'tight-turn' }>;
}

export interface TrackIssues {
  /** Problems that block the export. */
  errors: TrackIssue[];
  /** Problems worth knowing about that do not block the export. */
  warnings: TrackIssue[];
  tightTurns: TightTurn[];
}

/** Checks the centerline for problems that would make the track unusable in game. */
export function trackIssues(
  project: Project,
  samples: readonly Sample[] = sampleTrack(project),
): TrackIssues {
  const errors: TrackIssue[] = [],
    warnings: TrackIssue[] = [];
  const points = project.points;
  const minimum = project.road.closed ? 3 : 2;
  if (points.length < minimum)
    errors.push({ code: 'points-minimum', min: minimum, closed: project.road.closed });
  const stats = trackStats(samples);
  if (samples.length > 1 && stats.length < CHECKS.minLength)
    errors.push({ code: 'track-too-short', min: CHECKS.minLength });
  const circuit = isCircuit(project);
  const tooClose = points.some(
    (p, i) =>
      (i > 0 || circuit) &&
      points.length > 1 &&
      planDistance(p, points[(i + points.length - 1) % points.length]) < RULES.pointSpacing,
  );
  if (tooClose) errors.push({ code: 'points-too-close', min: RULES.pointSpacing });
  if (stats.grade > CHECKS.steepGrade) warnings.push({ code: 'steep-grade', grade: stats.grade });

  // Test the interpolated curve, not only its control points, and keep the
  // tightest place of each failing segment so every view shows the same spot.
  const tightBySegment = new Map<number, TightTurn>();
  for (let i = 2; i < samples.length - 2; i++) {
    const a = samples[i - 2],
      b = samples[i + 2];
    const radius = (b.s - a.s) / (Math.hypot(a.nx - b.nx, a.nz - b.nz) || 0.00001);
    if (!(radius < project.road.width * CHECKS.tightRadius)) continue;
    const segment = samples[i].segment;
    const previous = tightBySegment.get(segment);
    if (previous && previous.radius <= radius) continue;
    const next = (segment + 1) % points.length;
    tightBySegment.set(segment, {
      segment,
      pointIds: [points[segment].id, points[next].id],
      sampleIndex: i,
      radius,
      issue: { code: 'tight-turn', from: segment, to: next },
    });
  }
  const tightTurns = [...tightBySegment.values()];
  errors.push(...tightTurns.map((turn) => turn.issue));

  if (crossesItself(samples, circuit)) errors.push({ code: 'track-crossing' });
  return { errors, warnings, tightTurns };
}

/** Whether two non-neighbouring parts of the centerline cross (bridges are not supported). */
function crossesItself(samples: readonly Sample[], circuit: boolean) {
  const stride = Math.max(1, Math.floor(samples.length / 350));
  const reduced = samples.filter((_, i) => i % stride === 0);
  if (samples.length && reduced.at(-1) !== samples.at(-1)) reduced.push(samples.at(-1)!);
  const cross = (a: PlanPoint, b: PlanPoint, c: PlanPoint) =>
    (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  for (let i = 0; i < reduced.length - 1; i++)
    for (let j = i + 3; j < reduced.length - 1; j++) {
      if (circuit && i === 0 && j >= reduced.length - 3) continue;
      const a = reduced[i],
        b = reduced[i + 1],
        c = reduced[j],
        d = reduced[j + 1];
      if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return true;
    }
  return false;
}
