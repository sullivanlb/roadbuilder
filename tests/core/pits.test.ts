import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import {
  addBarrier,
  removePitLane,
  removePoint,
  reverseTrack,
  setCars,
  setClosed,
  setPitLane,
  setRoad,
  setStartLine,
} from '../../src/core/project/edits';
import type { ProjectError } from '../../src/core/project/errors';
import { parseProject } from '../../src/core/project/schema';
import type { Project } from '../../src/core/project/schema';
import { barrierPath } from '../../src/core/scene/barriers';
import { gridPlaces, pitBoxPlaces } from '../../src/core/scene/markers';
import { startLine } from '../../src/core/scene/road';
import { buildScene } from '../../src/core/scene/scene';
import { sampleAt, sampleTrack, trackLength } from '../../src/core/track/centerline';
import { trackIssues } from '../../src/core/track/issues';
import { roadEdge } from '../../src/core/track/layout';
import { pitLaneLayout } from '../../src/core/track/pitLane';
import { positionAt, positionDistance } from '../../src/core/track/positions';
import { asJson, template, tightTurnProject } from '../helpers';

const failure = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return (error as ProjectError).detail.code;
  }
  throw new Error('expected a ProjectError');
};

/** Plan distance between two places on the track. */
const gap = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z);

describe('track positions', () => {
  it('convert to and from track distances', () => {
    const project = template('club');
    const samples = sampleTrack(project);
    const s = 0.4 * trackLength(samples);
    const position = positionAt(project, samples, s);
    expect(positionDistance(project, samples, position)).toBeCloseTo(s, 6);
  });

  it('run past the next control point, around a circuit and up to the end of a road', () => {
    const circuit = template('club');
    const samples = sampleTrack(circuit);
    const length = trackLength(samples);
    const last = { point: circuit.points[8].id, distance: 1e4 };
    expect(positionDistance(circuit, samples, last)).toBeCloseTo(
      (1e4 + samples.find((p) => p.segment === 8)!.s) % length,
      6,
    );
    const road = template('mountain');
    const roadSamples = sampleTrack(road);
    expect(positionDistance(road, roadSamples, { point: road.points[8].id, distance: 1e4 })).toBe(
      trackLength(roadSamples),
    );
  });

  it('stay in place when their control point is deleted', () => {
    const project = produce(template('club'), (draft) => {
      setStartLine(draft, { point: draft.points[1].id, distance: 30 });
    });
    const before = startLine(project, sampleTrack(project));
    const after = produce(project, (draft) => removePoint(draft, project.points[1].id));
    expect(after.startLine!.point).toBe(project.points[0].id);
    expect(gap(startLine(after, sampleTrack(after)), before)).toBeLessThan(25);
  });

  it('keep their place when the track is reversed', () => {
    const project = template('club');
    const samples = sampleTrack(project);
    const lane = project.pitLane!;
    const reversed = produce(project, reverseTrack);
    const reversedSamples = sampleTrack(reversed);
    const at = (p: Project, s: typeof samples, position: typeof lane.entry) =>
      sampleAt(s, positionDistance(p, s, position)!)!;
    expect(gap(startLine(reversed, reversedSamples), startLine(project, samples))).toBeLessThan(
      0.5,
    );
    expect(
      gap(at(reversed, reversedSamples, reversed.pitLane!.entry), at(project, samples, lane.exit)),
    ).toBeLessThan(0.5);
    expect(
      gap(at(reversed, reversedSamples, reversed.pitLane!.exit), at(project, samples, lane.entry)),
    ).toBeLessThan(0.5);
    expect(reversed.pitLane!.side).toBe('left');
  });
});

describe('pit lane model', () => {
  it('ships with the club template only', () => {
    expect(template('club')).toMatchObject({ cars: 10, pitLane: { side: 'right', width: 7 } });
    expect(template('kart')).toMatchObject({ cars: 1, pitLane: null });
    expect(template('blank').startLine).toBeUndefined();
  });

  it('accepts older files without pit data and checks its references', () => {
    const json = asJson(template('kart'));
    delete json.pitLane;
    delete json.cars;
    delete json.startLine;
    expect(parseProject(json)).toMatchObject({ cars: 1, pitLane: null });
    const club = asJson(template('club'));
    expect(
      failure(() => parseProject({ ...club, startLine: { point: 'nope', distance: 0 } })),
    ).toBe('position-point');
    expect(failure(() => parseProject({ ...club, pitLane: null }))).toBe('cars-without-pit-lane');
    const road = asJson(template('club'));
    (road.road as Record<string, unknown>).closed = false;
    expect(failure(() => parseProject(road))).toBe('pit-lane-on-road');
  });

  it('keeps a single car without a pit lane and drops pits on a road', () => {
    const club = template('club');
    expect(produce(club, (draft) => setCars(draft, 40)).cars).toBe(24);
    expect(produce(club, removePitLane)).toMatchObject({ cars: 1, pitLane: null });
    expect(produce(template('kart'), (draft) => setCars(draft, 5)).cars).toBe(1);
    expect(produce(club, (draft) => setClosed(draft, false))).toMatchObject({
      cars: 1,
      pitLane: null,
    });
    expect(
      produce(template('mountain'), (draft) => {
        setPitLane(draft, {
          side: 'left',
          entry: { point: draft.points[0].id, distance: 0 },
          exit: { point: draft.points[3].id, distance: 0 },
        });
      }).pitLane,
    ).toBeNull();
  });
});

describe('pit lane geometry', () => {
  it('builds the lane, its wall, a box per car and the grid', () => {
    const project = template('club');
    const samples = sampleTrack(project);
    expect(trackIssues(project, samples).errors).toEqual([]);
    const scene = buildScene(project, samples);
    const names = scene.meshes.map((mesh) => mesh.name);
    expect(names).toEqual(
      expect.arrayContaining(['1PIT_lane_0', '1WALL_divider_0', 'divider_decor_0']),
    );
    expect(names.some((name) => name.startsWith('1PIT_spawn'))).toBe(false);
    expect(scene.meshes.find((mesh) => mesh.name === '1WALL_divider_0')!.visible).toBe(false);
    expect(scene.meshes.find((mesh) => mesh.name === 'divider_decor_0')!.visible).toBe(true);
    const markers = scene.markers.map((marker) => marker.name);
    for (let i = 0; i < 10; i++)
      expect(markers).toEqual(expect.arrayContaining([`AC_PIT_${i}`, `AC_START_${i}`]));
    expect(markers).not.toContain('AC_PIT_10');

    const lane = pitLaneLayout(project, samples)!;
    for (const box of pitBoxPlaces(project, samples)) {
      expect(lane.along(box.sample.s)).not.toBeNull();
      expect(Math.abs(box.lateral)).toBeGreaterThan(roadEdge(project.road, box.sample));
    }
    const line = startLine(project, samples);
    const grid = gridPlaces(project, samples);
    expect(grid).toHaveLength(10);
    for (const place of grid) expect(Math.abs(place.lateral)).toBeLessThan(project.road.width / 2);
    expect(gap(grid[0].sample, line)).toBeCloseTo(6, 0);
  });

  it('pushes a barrier on the pit side behind the lane', () => {
    const project = produce(template('club'), (draft) => {
      addBarrier(draft, {
        type: 'guardrail',
        side: 'right',
        from: draft.points[8].id,
        to: draft.points[1].id,
      });
    });
    const samples = sampleTrack(project);
    const lane = pitLaneLayout(project, samples)!;
    const path = barrierPath(project, samples, project.barriers[0]);
    const middle = sampleAt(
      samples,
      ((lane.parallel[0] + lane.parallel[1]) / 2) % trackLength(samples),
    )!;
    const nearest = Math.min(...path.map((p) => gap(p, middle)));
    expect(nearest).toBeGreaterThan(lane.profile(middle.s)!.outer);
  });

  it('reports a lane too short for its cars', () => {
    // A lane of about 170 m keeps roughly 90 m for its boxes: fewer than ten cars.
    const crowded = produce(template('club'), (draft) => {
      setPitLane(draft, { ...draft.pitLane!, exit: { point: draft.points[0].id, distance: 100 } });
    });
    const issues = trackIssues(crowded);
    const issue = issues.errors.find((error) => error.code === 'pit-lane-too-short');
    expect(issue).toMatchObject({ cars: 10 });
    expect(issues.locations.some((location) => location.issue === issue)).toBe(true);
  });

  it('reports a lane on the inside of a bend too tight for it, not on the outside', () => {
    // The hairpin of the fixture, about 10 m in radius: a wide lane folds on its inside only.
    const tight = (['left', 'right'] as const).map((side) =>
      trackIssues(
        produce(tightTurnProject(), (draft) => {
          draft.road.closed = true;
          setRoad(draft, { width: 4 });
          setPitLane(draft, {
            side,
            entry: { point: draft.points[1].id, distance: 0 },
            exit: { point: draft.points[5].id, distance: 0 },
            width: 12,
          });
        }),
      ).errors.some((error) => error.code === 'pit-lane-too-tight'),
    );
    expect(tight.filter(Boolean)).toHaveLength(1);
  });
});
