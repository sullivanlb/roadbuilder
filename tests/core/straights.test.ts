import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { planDistance } from '../../src/core/math';
import {
  addArc,
  arcRejection,
  insertPoint,
  removePoint,
  reverseTrack,
  roundPoint,
  setRadius,
  setSegmentLength,
  setStraight,
} from '../../src/core/project/edits';
import { parseProject, serializeProject } from '../../src/core/project/schema';
import type { Project } from '../../src/core/project/schema';
import { controlPointSample, sampleTrack } from '../../src/core/track/centerline';
import type { Sample } from '../../src/core/track/centerline';
import { arcLayout, arcThrough, corners } from '../../src/core/track/geometry';
import { trackIssues } from '../../src/core/track/issues';
import { asJson, template } from '../helpers';

type Point = { id: string; x: number; z: number; straight?: true; radius?: number };

/** A track through the given points, flat, 10 m wide. */
function track(points: Point[], closed = false): Project {
  return produce(template('blank'), (draft) => {
    draft.road.closed = closed;
    draft.road.width = 10;
    draft.points = points.map((point) => ({ y: 0, ...point }));
  });
}

const heading = (sample: Sample) => Math.atan2(-sample.nx, sample.nz);

/** Largest change of heading from one sample to the next, in degrees. */
function largestKink(samples: readonly Sample[]) {
  let worst = 0;
  for (let i = 1; i < samples.length; i++) {
    let turn = Math.abs(heading(samples[i]) - heading(samples[i - 1]));
    if (turn > Math.PI) turn = 2 * Math.PI - turn;
    worst = Math.max(worst, (turn * 180) / Math.PI);
  }
  return worst;
}

describe('straights', () => {
  it('lay the segment on the line between its points', () => {
    const project = track([
      { id: 'a', x: -80, z: 60 },
      { id: 'b', x: 0, z: 0, straight: true },
      { id: 'c', x: 200, z: 0 },
      { id: 'd', x: 260, z: 80 },
    ]);
    const samples = sampleTrack(project);
    const straight = samples.filter((sample) => sample.segment === 1);
    expect(straight.length).toBeGreaterThan(8);
    for (const sample of straight) expect(sample.z).toBeCloseTo(0, 9);
    // The curves on either side leave and join it along its direction.
    expect(largestKink(samples)).toBeLessThan(6);
  });

  it('mean nothing on the last point of a road, which leads nowhere', () => {
    const points = [
      { id: 'a', x: 0, z: 0 },
      { id: 'b', x: 100, z: 40 },
      { id: 'c', x: 200, z: 0 },
    ];
    const marked = track([...points.slice(0, 2), { ...points[2], straight: true }]);
    expect(sampleTrack(marked)).toEqual(sampleTrack(track(points)));
  });

  it('meeting without a rounding make a sharp corner the checks report', () => {
    const project = track([
      { id: 'a', x: 0, z: 0, straight: true },
      { id: 'b', x: 120, z: 0, straight: true },
      { id: 'c', x: 120, z: 120 },
    ]);
    const issues = trackIssues(project);
    expect(issues.warnings).toContainEqual({ code: 'sharp-corner', point: 1, angle: 90 });
    expect(issues.locations.some((location) => location.pointIds.includes('b'))).toBe(true);
    const rounded = produce(project, (draft) => void (draft.points[1].radius = 30));
    expect(trackIssues(rounded).warnings).toEqual([]);
  });
});

describe('rounded points', () => {
  const quarter = track([
    { id: 'a', x: 0, z: 0 },
    { id: 'b', x: 100, z: 0, radius: 30 },
    { id: 'c', x: 100, z: 100 },
  ]);

  it('turn on an arc of their radius, tangent to both sides', () => {
    const samples = sampleTrack(quarter);
    const corner = corners(quarter).get(1)!;
    expect(corner.radius).toBeCloseTo(30, 9);
    expect(corner.sign).toBe(1);
    expect(corner.center.x).toBeCloseTo(70, 9);
    expect(corner.center.z).toBeCloseTo(30, 9);
    const onArc = samples.filter(
      (sample) => (sample.x > 70 && sample.z < 30) || planDistance(sample, corner.center) < 29.999,
    );
    for (const sample of onArc) expect(planDistance(sample, corner.center)).toBeCloseTo(30, 6);
    // Before the arc, the track runs along the first side.
    for (const sample of samples.filter((sample) => sample.x <= 70))
      expect(sample.z).toBeCloseTo(0, 9);
    expect(largestKink(samples)).toBeLessThan(6);
  });

  it('sit on the track at the middle of their arc', () => {
    const samples = sampleTrack(quarter);
    const place = controlPointSample(samples, 1)!;
    const corner = corners(quarter).get(1)!;
    expect(planDistance(place, corner.middle)).toBeCloseTo(0, 9);
    // R (1 / cos(θ/2) − 1) inside the corner.
    expect(planDistance(place, quarter.points[1])).toBeCloseTo(30 * (Math.SQRT2 - 1), 6);
  });

  it('shrink a radius their sides have no room for', () => {
    const tight = produce(quarter, (draft) => {
      draft.points[1].radius = 200;
    });
    const corner = corners(tight).get(1)!;
    expect(corner.requested).toBe(200);
    expect(corner.radius).toBeCloseTo(100, 6);
    const issues = trackIssues(tight);
    expect(issues.warnings).toContainEqual({
      code: 'radius-reduced',
      point: 1,
      requested: 200,
      actual: 100,
    });
    expect(issues.locations.some((location) => location.pointIds.includes('b'))).toBe(true);
    // Two rounded points share the side between them.
    const shared = track([
      { id: 'a', x: 0, z: 0 },
      { id: 'b', x: 100, z: 0, radius: 100 },
      { id: 'c', x: 100, z: 100, radius: 100 },
      { id: 'd', x: 0, z: 100 },
    ]);
    const found = corners(shared);
    expect(found.get(1)!.radius).toBeCloseTo(50, 6);
    expect(found.get(2)!.radius).toBeCloseTo(50, 6);
  });

  it('are plain points at the ends of a road', () => {
    const ends = track([
      { id: 'a', x: 0, z: 0, radius: 30 },
      { id: 'b', x: 100, z: 0 },
      { id: 'c', x: 100, z: 100, radius: 30 },
    ]);
    expect(corners(ends).size).toBe(0);
    expect(corners(produce(ends, (draft) => void (draft.road.closed = true))).size).toBe(2);
  });
});

describe('arcs', () => {
  it('go through the point aimed at, tangent to the heading', () => {
    const shape = arcThrough({ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 50, z: 50 })!;
    expect(shape.radius).toBeCloseTo(50, 9);
    expect(shape.angle).toBeCloseTo(Math.PI / 2, 9);
    expect(shape.sign).toBe(1);
    const layout = arcLayout({ x: 0, z: 0 }, { heading: { x: 1, z: 0 }, ...shape });
    expect(layout.vertices).toHaveLength(1);
    expect(layout.end.x).toBeCloseTo(50, 9);
    expect(layout.end.z).toBeCloseTo(50, 9);
    expect(arcThrough({ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 50, z: 0 })).toBeNull();
  });

  it('are drawn as rounded points that start where the track is', () => {
    const start = track([
      { id: 'a', x: -100, z: 0, straight: true },
      { id: 'b', x: 0, z: 0 },
    ]);
    const shape = { heading: { x: 1, z: 0 }, radius: 40, angle: Math.PI, sign: -1 as const };
    expect(arcRejection(start, start.points[1], shape)).toBeNull();
    let end = '';
    const drawn = produce(start, (draft) => {
      end = addArc(draft, 1, start.points[1], shape, 0);
    });
    // A half turn takes two quarter turns.
    expect(drawn.points.map((point) => point.radius)).toEqual([
      undefined,
      undefined,
      40,
      40,
      undefined,
    ]);
    expect(drawn.points.at(-1)!.id).toBe(end);
    expect(drawn.points.at(-1)!.x).toBeCloseTo(0, 9);
    expect(drawn.points.at(-1)!.z).toBeCloseTo(-80, 9);
    const found = corners(drawn);
    expect([...found.values()].map((corner) => corner.radius)).toEqual([
      expect.closeTo(40, 6),
      expect.closeTo(40, 6),
    ]);
    expect(trackIssues(drawn).warnings).toEqual([]);
    expect(largestKink(sampleTrack(drawn))).toBeLessThan(6);
    expect(arcRejection(start, start.points[1], { ...shape, radius: 2 })).toBe('too-small');
  });
});

describe('editing straights and rounded points', () => {
  const base = () =>
    track([
      { id: 'a', x: 0, z: 0, straight: true },
      { id: 'b', x: 100, z: 0 },
      { id: 'c', x: 100, z: 100, straight: true },
      { id: 'd', x: 0, z: 100 },
    ]);

  it('are saved and read back', () => {
    const project = produce(base(), (draft) => {
      setRadius(draft, 'b', 25);
      setStraight(draft, 'c', false);
    });
    const read = parseProject(JSON.parse(serializeProject(project)));
    expect(read.points.map((point) => [point.straight, point.radius])).toEqual([
      [true, undefined],
      [undefined, 25],
      [undefined, undefined],
      [undefined, undefined],
    ]);
    expect(() =>
      parseProject({ ...asJson(project), points: [{ ...project.points[0], radius: 1 }] }),
    ).toThrow();
  });

  it('split a straight when a point lands on it, and keep a straight only when both halves were', () => {
    let id = '';
    const split = produce(base(), (draft) => {
      id = insertPoint(draft, 1, { x: 50, y: 0, z: 0 });
    });
    expect(split.points.map((point) => point.straight)).toEqual([
      true,
      true,
      undefined,
      true,
      undefined,
    ]);
    expect(produce(split, (draft) => removePoint(draft, id)).points[0].straight).toBe(true);
    expect(produce(base(), (draft) => removePoint(draft, 'b')).points[0].straight).toBeUndefined();
    // A new last point of a road starts curved.
    const appended = produce(base(), (draft) => {
      draft.points[3].straight = true;
      insertPoint(draft, 4, { x: -100, y: 0, z: 100 });
    });
    expect(appended.points[3].straight).toBeUndefined();
  });

  it('keep the same segments straight when the track is reversed', () => {
    const road = produce(base(), (draft) => reverseTrack(draft));
    expect(road.points.map((point) => [point.id, point.straight])).toEqual([
      ['d', true],
      ['c', undefined],
      ['b', true],
      ['a', undefined],
    ]);
    const circuit = produce(base(), (draft) => {
      draft.road.closed = true;
      reverseTrack(draft);
    });
    expect(circuit.points.map((point) => [point.id, point.straight])).toEqual([
      ['a', undefined],
      ['d', true],
      ['c', undefined],
      ['b', true],
    ]);
  });

  it('round a point with the default radius, or what its sides leave room for', () => {
    expect(produce(base(), (draft) => roundPoint(draft, 'b')).points[1].radius).toBe(30);
    const short = produce(base(), (draft) => {
      draft.points[0].x = 90;
      roundPoint(draft, 'b');
    });
    expect(short.points[1].radius).toBe(10);
    const codes = trackIssues(short).warnings.map((issue) => issue.code);
    expect(codes).not.toContain('radius-reduced');
  });

  it('change the length of a straight by moving its next point', () => {
    const project = produce(base(), (draft) => setSegmentLength(draft, 'a', 60));
    expect([project.points[1].x, project.points[1].z]).toEqual([60, 0]);
    // The last point of a road has no segment to change.
    const unchanged = produce(base(), (draft) => setSegmentLength(draft, 'd', 60));
    expect(unchanged.points).toEqual(base().points);
  });
});
