import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import {
  addEarthwork,
  addHill,
  addScenery,
  removePoint,
  reverseTrack,
  setClosed,
  updateEarthwork,
  updateHill,
} from '../../src/core/project/edits';
import { parseProject } from '../../src/core/project/schema';
import type { EarthworkType, Project, Side } from '../../src/core/project/schema';
import { EARTHWORK_DEFAULTS, EARTHWORK_REACH } from '../../src/core/project/terrain';
import { groundHeight, SHOULDER_DROP } from '../../src/core/scene/ground';
import { bankLift } from '../../src/core/scene/mesh';
import { buildScene, findFoldedSurface } from '../../src/core/scene/scene';
import { sampleAt, sampleTrack, trackLength } from '../../src/core/track/centerline';
import { trackIssues } from '../../src/core/track/issues';
import { LAYOUT, terrainBounds } from '../../src/core/track/layout';
import { pitLaneLayout, sideEdge } from '../../src/core/track/pitLane';
import { pointDistance, positionAt } from '../../src/core/track/positions';
import { positionRange } from '../../src/core/track/ranges';
import { issueLayer } from '../../src/editor/layers';
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

/** Ground beside track distance `s`, `beyond` metres past the outer edge of the shoulders on a side. */
function groundBeside(project: Project, s: number, side: Side, beyond: number) {
  const samples = sampleTrack(project);
  const lane = pitLaneLayout(project, samples);
  const at = sampleAt(samples, s)!;
  const sign = side === 'right' ? 1 : -1;
  const lateral = sign * (sideEdge(project, lane, at, side) + project.road.shoulder + beyond);
  const p = { x: at.x + at.nx * lateral, z: at.z + at.nz * lateral };
  return groundHeight(project, samples)(p) - (at.y + bankLift(at, lateral) - SHOULDER_DROP);
}

describe('earthworks on the ground', () => {
  const club = template('club');

  it('raises an embankment on its side only, the shoulders kept', () => {
    const project = withEarthwork(club, 'embankment', 100, 300, 'right', {
      offset: 2,
      width: 8,
      height: 4,
    });
    expect(groundBeside(project, 200, 'right', 0)).toBeCloseTo(0, 1);
    expect(groundBeside(project, 200, 'right', 1)).toBeCloseTo(0, 1);
    expect(groundBeside(project, 200, 'right', 10)).toBeCloseTo(4, 1);
    expect(groundBeside(project, 200, 'right', 14)).toBeCloseTo(4, 0);
    expect(groundBeside(project, 200, 'left', 10)).toBeCloseTo(
      groundBeside(club, 200, 'left', 10),
      2,
    );
    // Outside its range, the ground is as it was.
    expect(groundBeside(project, 500, 'right', 10)).toBeCloseTo(
      groundBeside(club, 500, 'right', 10),
      2,
    );
  });

  it('digs a ditch deepest in its middle and eases it in at its ends', () => {
    const project = withEarthwork(club, 'ditch', 100, 300, 'left', {
      offset: 1,
      width: 4,
      height: 1,
    });
    expect(groundBeside(project, 200, 'left', 3)).toBeCloseTo(-1, 1);
    expect(groundBeside(project, 200, 'left', 0.5)).toBeCloseTo(0, 1);
    expect(groundBeside(project, 200, 'left', 6)).toBeCloseTo(0, 1);
    const halfway = groundBeside(project, 100 + LAYOUT.earthworkTaper / 2, 'left', 3);
    expect(halfway).toBeLessThan(-0.2);
    expect(halfway).toBeGreaterThan(-0.8);
  });

  it('keeps a run-off flat over its width', () => {
    const project = withEarthwork(club, 'runoff', 100, 300, 'right', { width: 30 });
    const plain = Math.abs(groundBeside(club, 200, 'right', 25));
    for (const beyond of [5, 15, 28]) {
      const kept = groundBeside(project, 200, 'right', beyond);
      expect(Math.abs(kept)).toBeLessThan(0.05);
    }
    expect(plain).toBeGreaterThanOrEqual(0);
  });

  it('meshes earthworks as strips facing up, cut out of the terrain', () => {
    const project = withEarthwork(
      withEarthwork(club, 'ditch', 100, 300, 'left'),
      'embankment',
      150,
      400,
      'left',
      { offset: 5, height: -3 },
    );
    const scene = buildScene(project);
    const strips = scene.meshes.filter((mesh) => mesh.name.startsWith('1GRASS_earthwork'));
    expect(strips.length).toBeGreaterThan(0);
    for (const mesh of strips) {
      expect(mesh.name).toMatch(/^1GRASS_earthwork_\d+$/);
      expect(mesh.positions.every(Number.isFinite)).toBe(true);
      expect(mesh.indices.length % 3).toBe(0);
    }
    expect(findFoldedSurface(scene)).toBeUndefined();
    // The ditch's bottom shows in the strip, a metre below the shoulders' edge or so.
    const ys = strips.flatMap((mesh) => mesh.positions.filter((_, i) => i % 3 === 1));
    expect(Math.min(...ys)).toBeLessThan(Math.min(...club.points.map((p) => p.y)) - 0.5);
  });

  it('builds the same scene as before without earthworks', () => {
    const scene = buildScene(club);
    expect(scene.meshes.some((mesh) => mesh.name.startsWith('1GRASS_earthwork'))).toBe(false);
  });
});

describe('earthworks far from the shoulders', () => {
  it('keeps the depth of a ditch dug away from the track', () => {
    const project = withEarthwork(template('club'), 'ditch', 100, 300, 'right', {
      offset: 25,
      width: 4,
      height: 1.5,
    });
    const plain = groundBeside(template('club'), 200, 'right', 27);
    expect(groundBeside(project, 200, 'right', 27) - plain).toBeCloseTo(-1.5, 1);
  });
});

describe('earthworks reaching the track', () => {
  /** A road turning back on itself, its two passes 34 m apart, centre to centre. */
  const hairpin = () =>
    parseProject({
      format: 'roadbuilder',
      version: 2,
      id: 'hairpin',
      name: 'Hairpin',
      author: '',
      road: { closed: false, width: 8, shoulder: 6, kerbs: false },
      terrain: { margin: 150 },
      points: [
        { id: 'a', x: 0, y: 0, z: 0 },
        { id: 'b', x: 150, y: 0, z: 0 },
        { id: 'c', x: 185, y: 0, z: 17 },
        { id: 'd', x: 150, y: 0, z: 34 },
        { id: 'e', x: 0, y: 0, z: 34 },
      ],
      barriers: [],
    });
  const warning = (project: Project) =>
    trackIssues(project).warnings.find((issue) => issue.code === 'earthwork-on-track');

  it('warns about an earthwork reaching across a hairpin, not one turned away', () => {
    const across = withEarthwork(hairpin(), 'embankment', 20, 120, 'right', { width: 14 });
    expect(warning(across)).toMatchObject({ count: 1, ids: [across.earthworks[0].id] });
    expect(issueLayer(warning(across)!)).toBe('terrain');
    expect(warning(withEarthwork(hairpin(), 'embankment', 20, 120, 'left', { width: 14 }))).toBe(
      undefined,
    );
    expect(warning(withEarthwork(hairpin(), 'ditch', 20, 120, 'right'))).toBeUndefined();
  });

  it('does not warn about earthworks along a plain circuit', () => {
    let project = template('club');
    for (const side of ['left', 'right'] as const)
      project = withEarthwork(project, 'embankment', 50, 600, side, { offset: 4, width: 10 });
    expect(warning(project)).toBeUndefined();
  });
});

describe('hills', () => {
  const club = template('club');
  /** A place of the club terrain at least 120 m from the track. */
  const away = () => {
    const samples = sampleTrack(club);
    const extent = terrainBounds(club, samples);
    for (let x = extent.minX + 40; x < extent.maxX; x += 10)
      for (let z = extent.minZ + 40; z < extent.maxZ; z += 10)
        if (samples.every((sample) => Math.hypot(sample.x - x, sample.z - z) > 120))
          return { x, z };
    throw new Error('no room');
  };
  const withHill = (project: Project, at: { x: number; z: number }, patch = {}) =>
    produce(project, (draft) => {
      updateHill(draft, addHill(draft, at), { width: 80, depth: 60, ...patch });
    });
  const rise = (project: Project, p: { x: number; z: number }) =>
    groundHeight(project, sampleTrack(project))(p) - groundHeight(club, sampleTrack(club))(p);

  it('rises to its height on top and eases out to its outline', () => {
    const top = away();
    const project = withHill(club, top, { height: 10, heading: 90 });
    expect(rise(project, top)).toBeCloseTo(10, 3);
    // Heading 90 faces +X: the width runs along Z, the depth along X.
    expect(rise(project, { x: top.x, z: top.z + 20 })).toBeCloseTo(5, 3);
    expect(rise(project, { x: top.x + 15, z: top.z })).toBeCloseTo(5, 3);
    expect(rise(project, { x: top.x + 31, z: top.z })).toBe(0);
    expect(rise(withHill(club, top, { height: -6 }), top)).toBeCloseTo(-6, 3);
  });

  it('fades out near the track, whose shoulders keep their heights', () => {
    const at = sampleAt(sampleTrack(club), 200)!;
    const project = withHill(club, at, { width: 200, depth: 200, height: 20 });
    expect(groundBeside(project, 200, 'right', 0)).toBeCloseTo(0, 1);
    expect(groundBeside(project, 200, 'right', 4)).toBeCloseTo(0, 1);
    expect(
      groundBeside(project, 200, 'right', LAYOUT.terrain.flat + LAYOUT.hillEase + 5),
    ).toBeGreaterThan(10);
  });

  it('grows the terrain over it and meshes its shape finely', () => {
    const samples = sampleTrack(club);
    const extent = terrainBounds(club, samples);
    const top = { x: extent.maxX + 150, z: (extent.minZ + extent.maxZ) / 2 };
    const project = withHill(club, top, { height: 15 });
    expect(terrainBounds(project, samples).maxX).toBeGreaterThanOrEqual(top.x + 40);
    const scene = buildScene(project);
    expect(findFoldedSurface(scene)).toBeUndefined();
    const height = groundHeight(project, samples);
    const near = scene.meshes
      .filter((mesh) => mesh.kind === 'terrain')
      .flatMap((mesh) =>
        Array.from({ length: mesh.positions.length / 3 }, (_, i) =>
          mesh.positions.slice(i * 3, i * 3 + 3),
        ),
      )
      .filter(([x, , z]) => Math.hypot(x - top.x, z - top.z) < 6);
    expect(near.length).toBeGreaterThan(0);
    for (const [x, y, z] of near) expect(y).toBeCloseTo(height({ x, z }), 3);
    expect(Math.max(...near.map(([, y]) => y))).toBeGreaterThan(height(top) - 1.5);
  });

  it('carries scenery standing on it', () => {
    const top = away();
    const project = produce(withHill(club, top, { height: 12 }), (draft) => {
      addScenery(draft, 'tree', top);
    });
    const floor = buildScene(project).sceneryFloors[project.scenery[0].id];
    expect(floor).toBeCloseTo(groundHeight(project, sampleTrack(project))(top), 0);
    expect(floor).toBeGreaterThan(groundHeight(club, sampleTrack(club))(top) + 10);
  });
});
