import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import {
  addWidthZone,
  removePoint,
  reverseTrack,
  setClosed,
  updateWidthZone,
  widthZoneRejection,
} from '../../src/core/project/edits';
import type { ProjectError } from '../../src/core/project/errors';
import { parseProject } from '../../src/core/project/schema';
import type { Project } from '../../src/core/project/schema';
import { barrierLateral } from '../../src/core/scene/barriers';
import { buildScene, findFoldedSurface } from '../../src/core/scene/scene';
import { sampleAt, sampleTrack, trackLength } from '../../src/core/track/centerline';
import type { Sample } from '../../src/core/track/centerline';
import { trackIssues } from '../../src/core/track/issues';
import { LAYOUT, roadEdge } from '../../src/core/track/layout';
import { pitLaneLayout } from '../../src/core/track/pitLane';
import { pointDistance, positionAt, positionDistance } from '../../src/core/track/positions';
import { rangeBetween, widthZoneRanges } from '../../src/core/track/width';
import { asJson, template, tightTurnProject } from '../helpers';

/** A project with one width zone laid between two track distances. */
function withZone(project: Project, from: number, to: number, width: number): Project {
  const samples = sampleTrack(project);
  return produce(project, (draft) => {
    addWidthZone(draft, {
      from: positionAt(project, samples, from),
      to: positionAt(project, samples, to),
      width,
    });
  });
}

/** Lateral extent of a surface across the track at a sample: its farthest vertex on each side. */
function extent(project: Project, name: string, at: Sample) {
  let left = 0,
    right = 0;
  for (const mesh of buildScene(project).meshes.filter((m) => m.name.startsWith(name)))
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const dx = mesh.positions[i] - at.x,
        dz = mesh.positions[i + 2] - at.z;
      // Only the vertices near the cross-section through the sample.
      if (Math.abs(dx * at.nz - dz * at.nx) > 0.5 || Math.hypot(dx, dz) > 30) continue;
      const lateral = dx * at.nx + dz * at.nz;
      left = Math.min(left, lateral);
      right = Math.max(right, lateral);
    }
  return { left, right };
}

const failure = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return (error as ProjectError).detail.code;
  }
  throw new Error('expected a ProjectError');
};

describe('width zone model', () => {
  it('accepts older files without width zones and checks their references', () => {
    const file = asJson(template('club'));
    delete file.widthZones;
    expect(parseProject(file).widthZones).toEqual([]);
    const zoned = asJson(withZone(template('club'), 100, 300, 16));
    expect(parseProject(zoned).widthZones).toHaveLength(1);
    (zoned.widthZones as { to: { point: string } }[])[0].to.point = 'missing';
    expect(failure(() => parseProject(zoned))).toBe('position-point');
  });
});

describe('width profile', () => {
  it('keeps the base width outside zones and eases into the zone width at both ends', () => {
    const project = withZone(template('club'), 100, 300, 16);
    const samples = sampleTrack(project);
    const at = (s: number) => sampleAt(samples, s)!.half;
    expect(at(50)).toBe(6);
    expect(at(200)).toBeCloseTo(8, 6);
    expect(at(100 + LAYOUT.widthTaper + 3)).toBeCloseTo(8, 6);
    expect(at(100 + LAYOUT.widthTaper / 2)).toBeCloseTo(7, 1);
    expect(at(300 - LAYOUT.widthTaper / 2)).toBeCloseTo(7, 1);
    expect(at(350)).toBe(6);
    // Gradual: no step between neighbouring samples.
    for (let i = 1; i < samples.length; i++)
      expect(Math.abs(samples[i].half - samples[i - 1].half)).toBeLessThan(0.5);
  });

  it('runs through the start of a circuit, and stops at the ends of a road', () => {
    const circuit = template('club');
    const length = trackLength(sampleTrack(circuit));
    const through = sampleTrack(withZone(circuit, length - 60, 60, 4));
    expect(sampleAt(through, 0)!.half).toBeCloseTo(2, 6);
    expect(sampleAt(through, length / 2)!.half).toBe(6);

    const road = template('mountain');
    const end = trackLength(sampleTrack(road));
    const tail = sampleTrack(withZone(road, end - 100, end, 12));
    expect(sampleAt(tail, end - 50)!.half).toBeCloseTo(6, 6);
    expect(sampleAt(tail, 50)!.half).toBe(4);
  });

  it('lets the later zone win where two overlap, with a warning located on the overlap', () => {
    const one = withZone(template('club'), 100, 300, 16);
    const both = withZone(one, 250, 400, 4);
    const samples = sampleTrack(both);
    expect(sampleAt(samples, 320)!.half).toBeCloseTo(2, 6);
    const issues = trackIssues(both, samples);
    expect(issues.errors).toEqual([]);
    expect(issues.warnings).toEqual([{ code: 'width-zones-overlap' }]);
    const location = issues.locations.find((spot) => spot.issue.code === 'width-zones-overlap')!;
    expect(samples[location.sampleIndex].s).toBeCloseTo(250, -1);
  });

  it('picks the stretch between two clicks: track order on a road, the shorter way on a circuit', () => {
    const circuit = template('club');
    const samples = sampleTrack(circuit);
    const length = trackLength(samples);
    expect(rangeBetween(circuit, samples, 300, 100)).toEqual({ start: 100, length: 200 });
    const around = rangeBetween(circuit, samples, 50, length - 50);
    expect(around.start).toBeCloseTo(length - 50, 6);
    expect(around.length).toBeCloseTo(100, 6);
    const road = template('mountain');
    expect(rangeBetween(road, sampleTrack(road), 300, 100)).toEqual({ start: 100, length: 200 });
  });
});

describe('width zone geometry', () => {
  it('widens the roadway, kerbs, shoulders and barriers and keeps the lane against the kerb', () => {
    const base = template('club');
    const samples = sampleTrack(base);
    const lane = pitLaneLayout(base, samples)!;
    // In the middle of the pit lane: the lane, its wall and the kerb all move out.
    const middle = ((lane.parallel[0] + lane.parallel[1]) / 2) % trackLength(samples);
    const project = withZone(base, middle - 60, middle + 60, 16);
    const zoned = sampleTrack(project);
    const at = sampleAt(zoned, middle)!;
    expect(at.half).toBeCloseTo(8, 6);
    const road = extent(project, '1ROAD_main', at);
    expect(road.right).toBeCloseTo(8, 1);
    expect(road.left).toBeCloseTo(-8, 1);
    const zonedLane = pitLaneLayout(project, zoned)!;
    expect(zonedLane.profile(middle)!.edge).toBeCloseTo(roadEdge(project.road, at), 6);
    expect(zonedLane.profile(middle)!.outer).toBeCloseTo(lane.profile(middle)!.outer + 2, 6);
    const away = lane.side === 'right' ? 'left' : 'right';
    expect(Math.abs(barrierLateral(project, zonedLane, at, away, 1))).toBeCloseTo(
      roadEdge(project.road, at) + 1,
      6,
    );
    expect(findFoldedSurface(buildScene(project))).toBeUndefined();
  });

  it('narrows a passage, and a narrower hairpin is no longer too tight', () => {
    const tight = tightTurnProject();
    const samples = sampleTrack(tight);
    expect(trackIssues(tight, samples).tightTurns).not.toEqual([]);
    const narrowed = withZone(tight, 0, trackLength(samples), 4);
    expect(trackIssues(narrowed).tightTurns).toEqual([]);
    expect(findFoldedSurface(buildScene(narrowed))).toBeUndefined();
  });
});

describe('width zone editing', () => {
  it('refuses zones that are too short, overlap another or exceed the limit', () => {
    const project = withZone(template('club'), 100, 300, 16);
    const samples = sampleTrack(project);
    expect(widthZoneRejection(project, samples, { start: 400, length: 2 })).toBe('too-short');
    expect(widthZoneRejection(project, samples, { start: 250, length: 100 })).toBe('overlap');
    expect(widthZoneRejection(project, samples, { start: 50, length: 400 })).toBe('overlap');
    expect(widthZoneRejection(project, samples, { start: 400, length: 100 })).toBeNull();
    const full = produce(project, (draft) => {
      for (let i = 1; i < 40; i++) draft.widthZones.push({ ...draft.widthZones[0], id: `w${i}` });
    });
    expect(widthZoneRejection(full, samples, { start: 400, length: 100 })).toBe(
      'width-zones-limit',
    );
  });

  it('clamps the width, and starts 4 m wider than the base width', () => {
    const project = withZone(template('club'), 100, 300, 99);
    expect(project.widthZones[0].width).toBe(24);
    const samples = sampleTrack(project);
    const fresh = produce(project, (draft) => {
      addWidthZone(draft, {
        from: positionAt(project, samples, 400),
        to: positionAt(project, samples, 500),
      });
      updateWidthZone(draft, draft.widthZones[0].id, { width: 1 });
    });
    expect(fresh.widthZones.map((zone) => zone.width)).toEqual([4, 16]);
  });

  it('keeps its ground when a control point is deleted or the track is reversed', () => {
    const project = withZone(template('club'), 100, 300, 16);
    const samples = sampleTrack(project);
    const where = (p: Project) => {
      const s = sampleTrack(p);
      return [
        positionDistance(p, s, p.widthZones[0].from)!,
        positionDistance(p, s, p.widthZones[0].to)!,
      ];
    };
    const anchor = project.widthZones[0].to.point;
    const removed = produce(project, (draft) => removePoint(draft, anchor));
    expect(removed.widthZones[0].to.point).not.toBe(anchor);

    const reversed = produce(project, reverseTrack);
    const length = trackLength(samples);
    const [from, to] = where(reversed);
    expect(from).toBeCloseTo(length - 300, 0);
    expect(to).toBeCloseTo(length - 100, 0);
    const middle = sampleAt(samples, 200)!;
    const mirrored = sampleTrack(reversed).reduce((a, b) =>
      Math.hypot(b.x - middle.x, b.z - middle.z) < Math.hypot(a.x - middle.x, a.z - middle.z)
        ? b
        : a,
    );
    expect(mirrored.half).toBeCloseTo(8, 1);
  });

  it('splits a zone running through the start when the circuit opens', () => {
    const circuit = template('club');
    // From 50 m before the last control point, over the closing segment, to 80 m after the start.
    const lastPoint = pointDistance(sampleTrack(circuit), circuit.points.length - 1);
    const project = withZone(circuit, lastPoint - 50, 80, 16);
    const road = produce(project, (draft) => setClosed(draft, false));
    expect(road.widthZones).toHaveLength(2);
    const ranges = widthZoneRanges(road, sampleTrack(road));
    expect(ranges).toHaveLength(2);
    expect(ranges[1].start).toBe(0);
    expect(ranges[1].length).toBeCloseTo(80, 0);
    expect(new Set(road.widthZones.map((zone) => zone.id)).size).toBe(2);
    expect(() => parseProject(asJson(road))).not.toThrow();
  });
});
