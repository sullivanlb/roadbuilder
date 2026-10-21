import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { addBarrier, setRoad } from '../../src/core/project/edits';
import type { BarrierType, Project, Side } from '../../src/core/project/schema';
import { barrierLateral } from '../../src/core/scene/barriers';
import { vertexCount } from '../../src/core/scene/mesh';
import type { Mesh } from '../../src/core/scene/mesh';
import { buildScene, findFoldedSurface } from '../../src/core/scene/scene';
import { sampleTrack } from '../../src/core/track/centerline';
import { roadEdge } from '../../src/core/track/layout';
import { onPoint, template, tightTurnProject } from '../helpers';

const barrier = (project: Project, type: BarrierType, side: Side, from: number, to: number) =>
  produce(project, (draft) => {
    addBarrier(draft, {
      type,
      side,
      from: onPoint(draft.points[from]),
      to: onPoint(draft.points[to]),
    });
  });

const allBarrierTypes = (project: Project) =>
  [
    ['guardrail', 'right', 1, 3],
    ['tires', 'left', 3, 5],
    ['tecpro', 'right', 5, 7],
    ['wall', 'left', 7, 2],
  ].reduce(
    (current, [type, side, from, to]) =>
      barrier(current, type as BarrierType, side as Side, from as number, to as number),
    project,
  );

/** Every attribute is finite, every index valid and fits 16 bits. */
function assertWellFormed(mesh: Mesh) {
  const count = vertexCount(mesh);
  expect(count).toBeLessThanOrEqual(65535);
  expect(mesh.normals).toHaveLength(count * 3);
  expect(mesh.uvs).toHaveLength(count * 2);
  expect([...mesh.positions, ...mesh.normals, ...mesh.uvs].every(Number.isFinite)).toBe(true);
  expect(mesh.indices.every((index) => index >= 0 && index < count)).toBe(true);
}

describe('scene', () => {
  it.each(['club', 'kart', 'mountain'] as const)('builds the %s template', (name) => {
    const scene = buildScene(template(name));
    scene.meshes.forEach(assertWellFormed);
    expect(findFoldedSurface(scene)).toBeUndefined();
    expect(scene.meshes.some((mesh) => mesh.kind === 'terrain')).toBe(true);
    expect(scene.markers.map((marker) => marker.name)).toEqual(
      expect.arrayContaining(['AC_START_0', 'AC_PIT_0', 'AC_TIME_0_L', 'AC_TIME_2_R']),
    );
    expect(
      scene.meshes.map((mesh) => ({
        name: mesh.name,
        vertices: vertexCount(mesh),
        indices: mesh.indices.length,
      })),
    ).toMatchSnapshot();
  });

  it('is empty without a track', () => {
    expect(buildScene(template('blank'))).toEqual({
      meshes: [],
      markers: [],
      lights: [],
      sceneryFloors: {},
    });
  });
});

describe('barriers', () => {
  it('stand one offset beyond the kerb and stay clear of the centre of tight bends', () => {
    const project = template('club');
    const straight = sampleTrack(project).find((s) => Math.abs(s.curvature) < 0.005)!;
    const edge = roadEdge(project.road, straight);
    expect(barrierLateral(project, null, straight, 'right', 1)).toBeCloseTo(edge + 1, 5);
    expect(barrierLateral(project, null, straight, 'left', 10)).toBeCloseTo(-(edge + 10), 5);

    const tight = tightTurnProject();
    const tightEdge = roadEdge(tight.road, { half: tight.road.width / 2 });
    const bend = sampleTrack(tight).reduce((a, b) =>
      Math.abs(b.curvature) > Math.abs(a.curvature) ? b : a,
    );
    const inside = bend.curvature > 0 ? 'right' : 'left';
    const outside = inside === 'right' ? 'left' : 'right';
    const clamped = Math.abs(barrierLateral(tight, null, bend, inside, 10));
    expect(clamped).toBeGreaterThanOrEqual(tightEdge + 0.05);
    expect(clamped).toBeLessThan(tightEdge + 10);
    expect(Math.abs(barrierLateral(tight, null, bend, outside, 10))).toBeCloseTo(tightEdge + 10, 5);
  });

  it('produce invisible colliders facing the track and visible decor', () => {
    const project = allBarrierTypes(template('club'));
    const samples = sampleTrack(project);
    const scene = buildScene(project, samples);
    // Ribbon colliders face the track; solid blocks (concrete, pit wall) are checked for depth below.
    const colliders = scene.meshes.filter(
      (mesh) => /^1WALL_(guardrail|tires|tecpro)_/.test(mesh.name) && !mesh.visible,
    );
    expect(colliders).toHaveLength(3);
    let inward = 0,
      total = 0;
    for (const mesh of colliders) {
      assertWellFormed(mesh);
      for (let i = 0; i < vertexCount(mesh); i++) {
        const [x, z] = [mesh.positions[i * 3], mesh.positions[i * 3 + 2]];
        const nearest = samples.reduce((a, b) =>
          Math.hypot(a.x - x, a.z - z) < Math.hypot(b.x - x, b.z - z) ? a : b,
        );
        const length = Math.hypot(nearest.x - x, nearest.z - z) || 1;
        const dot =
          (mesh.normals[i * 3] * (nearest.x - x) + mesh.normals[i * 3 + 2] * (nearest.z - z)) /
          length;
        expect(dot).toBeGreaterThan(-0.25);
        if (dot > 0.9) inward++;
        total++;
      }
    }
    expect(inward / total).toBeGreaterThan(0.6);
    // The concrete wall is drawn by its decor; its collider is invisible like the others.
    expect(
      scene.meshes.some((mesh) => mesh.name.startsWith('concrete_decor') && mesh.visible),
    ).toBe(true);
    expect(
      scene.meshes.filter((mesh) => mesh.kind === 'barrier' && !mesh.name.startsWith('1WALL'))
        .length,
    ).toBeGreaterThanOrEqual(4);
  });

  it('give solid walls a collider a metre deep, so cars cannot slip through', () => {
    const project = allBarrierTypes(template('club'));
    const samples = sampleTrack(project);
    const scene = buildScene(project, samples);
    for (const name of ['1WALL_wall_3_0', '1WALL_divider_0']) {
      const mesh = scene.meshes.find((candidate) => candidate.name === name)!;
      const distances = [];
      for (let i = 0; i < vertexCount(mesh); i++) {
        const [x, z] = [mesh.positions[i * 3], mesh.positions[i * 3 + 2]];
        distances.push(Math.min(...samples.map((s) => Math.hypot(s.x - x, s.z - z))));
      }
      expect(Math.max(...distances) - Math.min(...distances), name).toBeGreaterThanOrEqual(0.95);
    }
  });

  it('name every physical mesh after one surface key only', () => {
    // Assetto Corsa may find the surface key anywhere in the name, ignoring case:
    // « 1WALL_pitwall » would read as pit floor and let cars through.
    const keys = ['ROAD', 'GRASS', 'KERB', 'PIT', 'WALL'];
    const scene = buildScene(allBarrierTypes(template('club')));
    for (const mesh of scene.meshes) {
      const prefix = /^\d+([A-Z]+)/.exec(mesh.name);
      if (!prefix) continue;
      const found = keys.filter((key) => mesh.name.toUpperCase().includes(key));
      expect(found, mesh.name).toEqual([prefix[1]]);
    }
  });

  it('build colliders from vertical faces only, like the ribbons proven in game', () => {
    const scene = buildScene(allBarrierTypes(template('club')));
    const colliders = scene.meshes.filter((mesh) => mesh.name.startsWith('1WALL'));
    expect(colliders.map((mesh) => mesh.name)).toEqual(
      expect.arrayContaining(['1WALL_divider_0', '1WALL_wall_3_0']),
    );
    for (const mesh of colliders)
      for (let i = 1; i < mesh.normals.length; i += 3)
        expect(Math.abs(mesh.normals[i]), mesh.name).toBeLessThan(0.5);
  });

  it('keep the collider off the roadway in a very tight bend', () => {
    let project = produce(tightTurnProject(), (draft) => setRoad(draft, { width: 4 }));
    project = barrier(barrier(project, 'guardrail', 'right', 0, 6), 'guardrail', 'left', 0, 6);
    const samples = sampleTrack(project);
    const colliders = buildScene(project, samples).meshes.filter((mesh) =>
      mesh.name.startsWith('1WALL'),
    );
    let closest = Infinity;
    for (const mesh of colliders)
      for (let i = 0; i < vertexCount(mesh); i++)
        for (const s of samples)
          closest = Math.min(
            closest,
            Math.hypot(s.x - mesh.positions[i * 3], s.z - mesh.positions[i * 3 + 2]),
          );
    expect(closest).toBeGreaterThan(project.road.width / 2);
  });
});
