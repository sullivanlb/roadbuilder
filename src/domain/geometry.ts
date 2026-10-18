import type { Point, PlanPoint, Project, Sample, Bounds, TightTurn, TrackIssues } from './types';
import { distance, clamp } from './project';
// Centripetal Catmull–Rom: stable bends even with unevenly spaced control points.
function interpolate(p0: Point, p1: Point, p2: Point, p3: Point, t: number) {
  const t0 = 0,
    t1 = t0 + Math.sqrt(Math.max(distance(p0, p1), 0.01));
  const t2 = t1 + Math.sqrt(Math.max(distance(p1, p2), 0.01));
  const t3 = t2 + Math.sqrt(Math.max(distance(p2, p3), 0.01));
  const u = t1 + (t2 - t1) * t;
  const mix = (a: Point, b: Point, ta: number, tb: number): Point => {
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

function sampleTrack(project: Project, spacing = 3): Sample[] {
  const points = project.points,
    n = points.length;
  if (n < 2)
    return points.map((p) => ({
      ...p,
      segment: 0,
      t: 0,
      s: 0,
      nx: 0,
      nz: 1,
      grade: 0,
      curvature: 0,
    }));
  const closed = project.closed && n > 2;
  const get = (i: number) => {
    if (closed) return points[(i + n) % n];
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
    (closed ? distance(points[n - 1], points[0]) : 0);
  const step = Math.max(spacing, roughLength / 6000);
  const samples: Sample[] = [];
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const count = Math.max(8, Math.ceil(distance(get(i), get(i + 1)) / step));
    for (let j = 0; j < count; j++) {
      samples.push({
        ...interpolate(get(i - 1), get(i), get(i + 1), get(i + 2), j / count),
        segment: i,
        t: j / count,
        s: 0,
        nx: 0,
        nz: 1,
        grade: 0,
        curvature: 0,
      });
    }
  }
  samples.push({
    ...(closed ? samples[0] : points[n - 1]),
    segment: closed ? n - 1 : n - 2,
    t: 1,
    s: 0,
    nx: 0,
    nz: 1,
    grade: 0,
    curvature: 0,
  });
  let length = 0;
  samples.forEach((p, i) => {
    if (i) length += distance(samples[i - 1], p);
    const before = samples[i === 0 ? (closed ? samples.length - 2 : 0) : i - 1];
    const after = samples[i === samples.length - 1 ? (closed ? 1 : i) : i + 1];
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

function trackStats(samples: Sample[]) {
  if (!samples.length)
    return { length: 0, climb: 0, elevation: 0, min: 0, max: 0, grade: 0, curvature: 0 };
  let climb = 0,
    min = Infinity,
    max = -Infinity,
    grade = 0;
  samples.forEach((p, i) => {
    min = Math.min(min, p.y);
    max = Math.max(max, p.y);
    grade = Math.max(grade, Math.abs(p.grade || 0));
    if (i) climb += Math.max(0, p.y - samples[i - 1].y);
  });
  return {
    length: samples.at(-1)!.s || 0,
    climb,
    elevation: max - min,
    min,
    max,
    grade: grade * 100,
  };
}

function bounds(points: (PlanPoint & { y?: number })[], padding = 0): Bounds {
  if (!points.length) return { minX: -300, maxX: 300, minZ: -220, maxZ: 220, minY: 0, maxY: 0 };
  return points.reduce(
    (b, p) => ({
      minX: Math.min(b.minX, p.x - padding),
      maxX: Math.max(b.maxX, p.x + padding),
      minZ: Math.min(b.minZ, p.z - padding),
      maxZ: Math.max(b.maxZ, p.z + padding),
      minY: Math.min(b.minY, p.y ?? 0),
      maxY: Math.max(b.maxY, p.y ?? 0),
    }),
    {
      minX: Infinity,
      maxX: -Infinity,
      minZ: Infinity,
      maxZ: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
    },
  );
}

function sampleAt(samples: Sample[], s: number): Sample | null {
  if (!samples.length) return null;
  const end = samples.at(-1)!.s;
  s = clamp(s, 0, end);
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

function trackIssues(project: Project, samples = sampleTrack(project)): TrackIssues {
  const errors: string[] = [],
    warnings: string[] = [];
  if (project.points.length < (project.closed ? 3 : 2))
    errors.push(
      project.closed
        ? 'Ajoutez au moins 3 points pour fermer le circuit.'
        : 'Ajoutez au moins 2 points pour créer une route.',
    );
  const stats = trackStats(samples);
  if (samples.length > 1 && stats.length < 80)
    errors.push('Le tracé doit mesurer au moins 80 m pour accueillir le départ.');
  project.points.forEach((p, i) => {
    if ((i || project.closed) && project.points.length > 1) {
      const previous = project.points[(i + project.points.length - 1) % project.points.length];
      if (
        Math.hypot(p.x - previous.x, p.z - previous.z) < 2 &&
        !errors.includes('Deux points consécutifs sont trop proches (minimum 2 m).')
      )
        errors.push('Deux points consécutifs sont trop proches (minimum 2 m).');
    }
  });
  if (stats.grade > 18)
    warnings.push(
      `Pente maximale de ${Math.round(stats.grade)} % : certaines voitures auront des difficultés.`,
    );
  // Test the interpolated curve, not just its editable control points. Preserve
  // the existing threshold and retain the worst location on each failing segment
  // so the editor and export dialog can show the same diagnosis.
  const tightBySegment = new Map<number, TightTurn>();
  for (let i = 2; i < samples.length - 2; i++) {
    const a = samples[i - 2],
      b = samples[i + 2];
    const radius = (b.s - a.s) / (Math.hypot(a.nx - b.nx, a.nz - b.nz) || 0.00001);
    if (!(radius < project.width * 0.65)) continue;
    const segment = samples[i].segment;
    const previous = tightBySegment.get(segment);
    if (previous && previous.radius <= radius) continue;
    const next = (segment + 1) % project.points.length;
    tightBySegment.set(segment, {
      segment,
      pointIndices: [segment, next],
      sampleIndex: i,
      radius,
      message: `Virage trop serré entre les points ${segment + 1} et ${next + 1} pour cette largeur. Écartez les points du virage ou réduisez la largeur.`,
    });
  }
  const tightTurns = [...tightBySegment.values()];
  errors.push(...tightTurns.map((turn) => turn.message));
  // Detect non-neighboring centerline crossings (bridges are outside v1 scope).
  const stride = Math.max(1, Math.floor(samples.length / 350));
  const reduced = samples.filter((_, i) => i % stride === 0);
  if (samples.length && reduced.at(-1) !== samples.at(-1)!) reduced.push(samples.at(-1)!);
  const cross = (a: PlanPoint, b: PlanPoint, c: PlanPoint) =>
    (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  let crossing = false;
  for (let i = 0; i < reduced.length - 1 && !crossing; i++) {
    for (let j = i + 3; j < reduced.length - 1; j++) {
      if (project.closed && i === 0 && j >= reduced.length - 3) continue;
      const a = reduced[i],
        b = reduced[i + 1],
        c = reduced[j],
        d = reduced[j + 1];
      if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) {
        crossing = true;
        break;
      }
    }
  }
  if (crossing)
    errors.push(
      'Le tracé se croise : déplacez les points concernés. Les ponts ne sont pas pris en charge.',
    );
  return { errors, warnings, tightTurns };
}
export { sampleTrack, trackStats, bounds, sampleAt, trackIssues };
