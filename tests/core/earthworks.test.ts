import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import {
  addEarthwork,
  addHill,
  removePoint,
  reverseTrack,
  setClosed,
  updateEarthwork,
  updateHill,
} from '../../src/core/project/edits';
import { parseProject } from '../../src/core/project/schema';
import type { EarthworkType, Project, Side } from '../../src/core/project/schema';
import { EARTHWORK_DEFAULTS, EARTHWORK_REACH } from '../../src/core/project/terrain';
import { sampleTrack, trackLength } from '../../src/core/track/centerline';
import { pointDistance, positionAt } from '../../src/core/track/positions';
import { positionRange } from '../../src/core/track/ranges';
import { asJson, template } from '../helpers';

/** A project with an earthwork of a type from track distance `from` to `to`. */
export function withEarthwork(
  project: Project,
  type: EarthworkType,
  from: number,
  to: number,
  side: Side = 'right',
  settings = {},
): Project {
  const samples = sampleTrack(project);
  return produce(project, (draft) => {
    const id = addEarthwork(draft, {
      type,
      side,
      from: positionAt(project, samples, from),
      to: positionAt(project, samples, to),
    });
    updateEarthwork(draft, id, settings);
  });
}

describe('earthworks in the project', () => {
  it('opens projects saved before them with none', () => {
    const json = asJson(template('club'));
    delete json.earthworks;
    delete json.hills;
    const project = parseProject(json);
    expect(project.earthworks).toEqual([]);
    expect(project.hills).toEqual([]);
  });

  it('saves and reopens earthworks and hills', () => {
    const project = produce(withEarthwork(template('club'), 'ditch', 100, 200), (draft) => {
      addHill(draft, { x: 400, z: 300 }, 45);
    });
    expect(parseProject(asJson(project))).toEqual(project);
  });

  it('starts each type from its defaults and keeps settings within its rules', () => {
    const project = withEarthwork(template('club'), 'runoff', 100, 200, 'left', {
      offset: 10,
      height: 3,
      width: 500,
    });
    const [runoff] = project.earthworks;
    expect(runoff).toMatchObject({ offset: 0, height: 0, width: EARTHWORK_REACH });
    const embankment = produce(project, (draft) =>
      updateEarthwork(draft, runoff.id, { type: 'embankment' }),
    ).earthworks[0];
    expect(embankment).toMatchObject(EARTHWORK_DEFAULTS.embankment);
    // Offset and width together stay within the reach of an earthwork.
    const far = produce(project, (draft) => {
      updateEarthwork(draft, runoff.id, { type: 'embankment' });
      updateEarthwork(draft, runoff.id, { offset: 30, width: 40 });
    }).earthworks[0];
    expect(far.offset + far.width).toBe(EARTHWORK_REACH);
  });

  it('refuses settings a type does not accept, and unknown control points', () => {
    const project = asJson(withEarthwork(template('club'), 'ditch', 100, 200));
    const earthworks = project.earthworks as Record<string, unknown>[];
    expect(() =>
      parseProject({ ...project, earthworks: [{ ...earthworks[0], height: 8 }] }),
    ).toThrow();
    expect(() =>
      parseProject({
        ...project,
        earthworks: [{ ...earthworks[0], from: { point: 'gone', distance: 0 } }],
      }),
    ).toThrow();
  });

  it('keeps covering the same ground when the track is reversed', () => {
    const project = withEarthwork(template('club'), 'embankment', 100, 300, 'right');
    const length = trackLength(sampleTrack(project));
    const reversed = produce(project, reverseTrack);
    const [earthwork] = reversed.earthworks;
    expect(earthwork.side).toBe('left');
    const range = positionRange(reversed, sampleTrack(reversed), earthwork.from, earthwork.to)!;
    expect(range.start).toBeCloseTo(length - 300, 0);
    expect(range.length).toBeCloseTo(200, 0);
  });

  it('follows its control points and splits at the start when the circuit is opened', () => {
    const circuit = template('club');
    const lastPoint = pointDistance(sampleTrack(circuit), circuit.points.length - 1);
    const project = withEarthwork(circuit, 'ditch', lastPoint - 50, 80);
    const road = produce(project, (draft) => setClosed(draft, false));
    expect(road.earthworks).toHaveLength(2);
    expect(() => parseProject(asJson(road))).not.toThrow();
    const removed = produce(project, (draft) => removePoint(draft, project.earthworks[0].to.point));
    expect(() => parseProject(asJson(removed))).not.toThrow();
  });

  it('keeps hills within their rules', () => {
    const project = produce(template('club'), (draft) => {
      const id = addHill(draft, { x: 0, z: 0 }, 400);
      updateHill(draft, id, { width: 2, height: -90 });
    });
    expect(project.hills[0]).toMatchObject({ heading: 40, width: 10, height: -40 });
  });
});
