import type { Id } from '../ids';
import { planDistance } from '../math';
import type { PlanPoint } from '../math';
import { RULES } from '../project/rules';
import { isCircuit } from '../project/schema';
import type { Project } from '../project/schema';
import { sampleTrack, trackStats } from './centerline';
import type { Sample } from './centerline';
import { LAYOUT } from './layout';
import { pitBoxCapacity, pitLaneLayout } from './pitLane';
import { overlapStart, widthZoneRanges } from './width';

/** Thresholds of the track checks. */
export const CHECKS = {
  /** Shortest track that leaves room for the start position and the start line. */
  minLength: 80,
  /** Grade, in percent, above which a warning is raised. */
  steepGrade: 18,
  /** A bend is too tight when its radius falls below this fraction of the local roadway width. */
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
  | { code: 'track-crossing' }
  | { code: 'pit-lane-too-short'; cars: number; capacity: number }
  | { code: 'pit-lane-too-tight'; from: number; to: number }
  | { code: 'width-zones-overlap' };

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

/** A problem that can be shown on the plan: where it is worst and the control points around it. */
export interface IssueLocation {
  issue: TrackIssue;
  sampleIndex: number;
  pointIds: Id[];
}

export interface TrackIssues {
  /** Problems that block the export. */
  errors: TrackIssue[];
  /** Problems worth knowing about that do not block the export. */
  warnings: TrackIssue[];
  tightTurns: TightTurn[];
  /** The issues that have a place on the track, for the « show » buttons. */
  locations: IssueLocation[];
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
    if (!(radius < 2 * samples[i].half * CHECKS.tightRadius)) continue;
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
  const locations: IssueLocation[] = tightTurns.map(({ issue, sampleIndex, pointIds }) => ({
    issue,
    sampleIndex,
    pointIds,
  }));
  for (const location of pitLaneIssues(project, samples)) {
    errors.push(location.issue);
    if (location.sampleIndex >= 0) locations.push(location);
  }
  const overlap = widthZonesOverlap(project, samples);
  if (overlap) {
    warnings.push(overlap.issue);
    locations.push(overlap);
  }
  return { errors, warnings, tightTurns, locations };
}

/**
 * Width zones are laid without overlapping, but moving their positions can make
 * them overlap; the later zone then wins. Located where the first overlap starts.
 */
function widthZonesOverlap(project: Project, samples: readonly Sample[]): IssueLocation | null {
  const ranges = widthZoneRanges(project, samples);
  const total = samples.at(-1)?.s ?? 0;
  for (let i = 0; i < ranges.length; i++)
    for (let j = i + 1; j < ranges.length; j++) {
      const s = overlapStart(ranges[i], ranges[j], total);
      if (s === null) continue;
      return {
        issue: { code: 'width-zones-overlap' },
        sampleIndex: Math.max(
          0,
          samples.findIndex((sample) => sample.s >= s),
        ),
        pointIds: [],
      };
    }
  return null;
}

/** The pit lane must hold every car and must not fold on the inside of a bend. */
function pitLaneIssues(project: Project, samples: readonly Sample[]): IssueLocation[] {
  if (!project.pitLane || samples.length < 2) return [];
  const lane = pitLaneLayout(project, samples);
  const capacity = lane ? pitBoxCapacity(lane) : 0;
  const located: IssueLocation[] = [];
  if (capacity < project.cars) {
    const middle = lane
      ? samples.findIndex((sample) => (lane.along(sample.s) ?? -1) >= lane.length / 2)
      : -1;
    located.push({
      issue: { code: 'pit-lane-too-short', cars: project.cars, capacity },
      sampleIndex: middle,
      pointIds: [],
    });
  }
  if (!lane) return located;
  const points = project.points;
  let first = -1,
    last = -1,
    worst = -1,
    worstExcess = 0;
  samples.forEach((sample, i) => {
    const profile = lane.profile(sample.s);
    const curvature = sample.curvature * lane.sign;
    if (!profile || curvature <= 0) return;
    const excess = profile.outer - LAYOUT.curveClearance / curvature;
    if (excess <= 0) return;
    if (first < 0) first = i;
    last = i;
    if (excess > worstExcess) {
      worstExcess = excess;
      worst = i;
    }
  });
  if (worst >= 0) {
    const from = samples[first].segment,
      to = (samples[last].segment + 1) % points.length;
    located.push({
      issue: { code: 'pit-lane-too-tight', from, to },
      sampleIndex: worst,
      pointIds: [points[from].id, points[to].id],
    });
  }
  return located;
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
