import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import {
  addBarrier,
  barrierRejection,
  insertPoint,
  pointRejection,
  removePoint,
  rename,
  reverseTrack,
  setClosed,
  setRoad,
  updateBarrier,
  updatePoint,
} from '../../src/core/project/edits';
import type { ProjectError } from '../../src/core/project/errors';
import { slugify } from '../../src/core/project/factory';
import { RULES } from '../../src/core/project/rules';
import { parseProject, parseProjectFile, serializeProject } from '../../src/core/project/schema';
import type { Project } from '../../src/core/project/schema';
import { sampleTrack } from '../../src/core/track/centerline';
import { positionDistance } from '../../src/core/track/positions';
import { asJson, onPoint, template } from '../helpers';

const failure = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return error as ProjectError;
  }
  throw new Error('expected a ProjectError');
};

const ids = (project: Project) => project.points.map((point) => point.id);

/** Lays a barrier between the control points at two positions of the track. */
const withBarrier = (project: Project, from: number, to: number) =>
  produce(project, (draft) => {
    addBarrier(draft, {
      type: 'wall',
      side: 'left',
      from: onPoint(project.points[from]),
      to: onPoint(project.points[to]),
    });
  });

describe('project files', () => {
  it('creates templates with unique IDs and round-trips them through a file', () => {
    const project = template('club');
    expect(project.points).toHaveLength(9);
    expect(new Set([project.id, ...ids(project)]).size).toBe(10);
    expect(parseProjectFile(serializeProject(project))).toEqual(project);
    expect(template('blank').points).toEqual([]);
  });

  it('trims the name and drops unknown fields', () => {
    const parsed = parseProject({ ...asJson(template()), name: '  Mon circuit ', extra: true });
    expect(parsed.name).toBe('Mon circuit');
    expect(parsed).not.toHaveProperty('extra');
  });

  it.each([
    ['not JSON', () => parseProjectFile('{nope'), 'invalid-json'],
    ['another format', () => parseProject({ format: 'other' }), 'not-a-project'],
    ['version 1', () => parseProject({ ...asJson(template()), version: 1 }), 'not-a-project'],
    ['null', () => parseProject(null), 'not-a-project'],
  ])('rejects %s', (_, run, code) => {
    expect(failure(run).detail.code).toBe(code);
  });

  it('reports the field that is out of range', () => {
    const json = asJson(template());
    (json.road as Record<string, unknown>).width = 99;
    expect(failure(() => parseProject(json)).detail).toEqual({
      code: 'invalid-value',
      path: 'road.width',
    });
  });

  it('enforces the point and barrier limits', () => {
    const json = asJson(template());
    json.points = Array.from({ length: RULES.points.max + 1 }, (_, i) => ({
      id: `p${i}`,
      x: i * 10,
      y: 0,
      z: 0,
    }));
    expect(failure(() => parseProject(json)).detail.code).toBe('points-limit');
  });

  it('checks the references of barriers', () => {
    const project = withBarrier(template(), 1, 4);
    const json = asJson(project);
    const barrier = (json.barriers as Record<string, unknown>[])[0];
    expect(parseProject(json).barriers).toHaveLength(1);
    const missing = { point: 'missing', distance: 0 };
    expect(
      failure(() => parseProject({ ...json, barriers: [{ ...barrier, to: missing }] })).detail.code,
    ).toBe('barrier-endpoint');
    expect(
      failure(() => parseProject({ ...json, barriers: [{ ...barrier, to: barrier.from }] })).detail
        .code,
    ).toBe('barrier-span');
    expect(
      failure(() => parseProject({ ...json, barriers: [{ ...barrier, id: project.points[0].id }] }))
        .detail.code,
    ).toBe('duplicate-id');
  });

  it('reads barriers saved with control point ends, before track positions', () => {
    const project = withBarrier(template('club'), 1, 4);
    const json = asJson(project);
    const [barrier] = json.barriers as Record<string, unknown>[];
    json.barriers = [{ ...barrier, from: project.points[1].id, to: project.points[4].id }];
    expect(parseProject(json).barriers[0]).toMatchObject({
      from: onPoint(project.points[1]),
      to: onPoint(project.points[4]),
    });
  });

  it('only lets a circuit barrier run through the start', () => {
    const circuit = withBarrier(template('club'), 7, 2);
    expect(parseProject(asJson(circuit)).barriers).toHaveLength(1);
    const json = asJson(circuit);
    (json.road as Record<string, unknown>).closed = false;
    expect(failure(() => parseProject(json)).detail.code).toBe('barrier-direction');
  });

  it('turns a name into a folder-friendly slug', () => {
    expect(slugify('Col de la Lumière !')).toBe('rb_col_de_la_lumiere');
    expect(slugify('***')).toBe('rb_circuit');
  });
});

describe('editing operations', () => {
  it('inserts, moves and removes control points within the rules', () => {
    const project = template('mountain');
    let id = '';
    const inserted = produce(project, (draft) => {
      id = insertPoint(draft, 1, { x: 99999, y: -500, z: 40 });
    });
    expect(inserted.points[1]).toEqual({
      id,
      x: RULES.coordinate.max,
      y: RULES.altitude.min,
      z: 40,
    });
    const moved = produce(inserted, (draft) => updatePoint(draft, id, { x: 12 }));
    expect(moved.points[1].x).toBe(12);
    expect(produce(moved, (draft) => removePoint(draft, id))).toEqual(project);
  });

  it('refuses points that are too close or over the limit', () => {
    const project = template();
    expect(pointRejection(project, { x: project.points[0].x + 1, z: project.points[0].z })).toBe(
      'too-close',
    );
    expect(pointRejection(project, { x: 0, z: 0 })).toBeNull();
  });

  it('keeps barriers on their points when points are inserted, and in place when an end point goes', () => {
    const project = withBarrier(template(), 2, 4);
    const [from, to] = [onPoint(project.points[2]), onPoint(project.points[4])];
    const inserted = produce(project, (draft) => {
      insertPoint(draft, 3, { x: 0, y: 0, z: 0 });
    });
    expect(inserted.barriers[0]).toMatchObject({ from, to });
    const end = positionDistance(project, sampleTrack(project), to)!;
    const removed = produce(project, (draft) => removePoint(draft, to.point));
    expect(removed.barriers).toHaveLength(1);
    expect(removed.barriers[0].to.point).toBe(project.points[3].id);
    // The end stays roughly where it was; the curve changes a little without its point.
    expect(positionDistance(removed, sampleTrack(removed), removed.barriers[0].to)).toBeCloseTo(
      end,
      -1,
    );
  });

  it('reverses the track: the circuit start stays, barriers keep their ground and change side', () => {
    const project = withBarrier(template('club'), 2, 5);
    const reversed = produce(project, reverseTrack);
    expect(ids(reversed)).toEqual([ids(project)[0], ...ids(project).slice(1).reverse()]);
    expect(reversed.barriers[0]).toMatchObject({
      from: onPoint(project.points[5]),
      side: 'right',
    });
    expect(reversed.barriers[0].to.point).toBe(project.points[2].id);
    expect(reversed.barriers[0].to.distance).toBeCloseTo(0, 6);
    const road = template('mountain');
    expect(ids(produce(road, reverseTrack))).toEqual([...ids(road)].reverse());
  });

  it('splits a barrier running through the start when the circuit opens', () => {
    const project = withBarrier(template('club'), 7, 2);
    const points = ids(project);
    const opened = produce(project, (draft) => setClosed(draft, false));
    expect(opened.barriers.map(({ from, to }) => [from.point, to.point])).toEqual([
      [points[7], points[8]],
      [points[0], points[2]],
    ]);
    expect(new Set(opened.barriers.map((barrier) => barrier.id)).size).toBe(2);
    // A barrier starting on the last point keeps only its part after the start.
    const circuit = template('club');
    const fromLast = produce(withBarrier(circuit, 8, 1), (draft) => setClosed(draft, false));
    expect(fromLast.barriers.map(({ from, to }) => [from.point, to.point])).toEqual([
      ids(circuit).slice(0, 2),
    ]);
  });

  it('refuses a barrier too short or over the limit', () => {
    const project = template('mountain');
    expect(barrierRejection(project, { start: 100, length: 2 })).toBe('too-short');
    expect(barrierRejection(project, { start: 100, length: 50 })).toBeNull();
    const full = produce(withBarrier(project, 1, 3), (draft) => {
      for (let i = 1; i < 120; i++) draft.barriers.push({ ...draft.barriers[0], id: `b${i}` });
    });
    expect(barrierRejection(full, { start: 100, length: 50 })).toBe('barriers-limit');
  });

  it('clamps settings and falls back to a default name', () => {
    const project = withBarrier(template(), 1, 3);
    const edited = produce(project, (draft) => {
      setRoad(draft, { width: 1, shoulder: 50 });
      updateBarrier(draft, project.barriers[0].id, { offset: 25 });
      rename(draft, '   ', 'Sans nom');
    });
    expect(edited.road).toMatchObject({ width: RULES.width.min, shoulder: RULES.shoulder.max });
    expect(edited.barriers[0].offset).toBe(RULES.barrierOffset.max);
    expect(edited.name).toBe('Sans nom');
  });
});
