import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { addScenery, updateScenery } from '../../src/core/project/edits';
import { SCENERY_KINDS } from '../../src/core/project/schema';
import type { Project, SceneryKind } from '../../src/core/project/schema';
import type { Mesh } from '../../src/core/scene/mesh';
import { buildScene } from '../../src/core/scene/scene';
import { trackIssues } from '../../src/core/track/issues';
import { issueLayer } from '../../src/editor/layers';
import { headingTowards, headingVector } from '../../src/core/project/scenery';
import { groveTrees, meshHeight } from '../../src/core/scene/scenery';
import { template } from '../helpers';

/** The club circuit with one item of each kind, well outside the track. */
const withScenery = (kinds: readonly SceneryKind[] = SCENERY_KINDS, patch = {}) =>
  produce(template('club'), (draft) => {
    kinds.forEach((kind, i) => {
      const id = addScenery(draft, kind, { x: -150 + i * 60, z: 0 }, 30);
      updateScenery(draft, id, patch);
    });
  });

const scenery = (project: Project) =>
  buildScene(project).meshes.filter((mesh) => mesh.kind === 'scenery');

/** Whether every face of a mesh winds the way its normal points. */
function windsOutward(mesh: Mesh) {
  const p = mesh.positions,
    n = mesh.normals;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => mesh.indices[i + k] * 3);
    const u = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]],
      v = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
    const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (Math.hypot(...cross) < 1e-9) continue;
    if (cross[0] * n[a] + cross[1] * n[a + 1] + cross[2] * n[a + 2] < 0) return false;
  }
  return true;
}

describe('scenery', () => {
  it('builds every kind from quads grouped by material, faces winding outward', () => {
    const meshes = scenery(withScenery());
    expect(meshes.map((mesh) => mesh.name).sort()).toEqual(
      [
        'scenery_bark',
        'scenery_concrete',
        'scenery_facade',
        'scenery_foliage',
        'scenery_glass',
        'scenery_lamp',
        'scenery_roof',
        'scenery_seat',
        'scenery_signBoard',
        'scenery_steel',
        // Buildings and grandstands stop cars by default.
        '1WALL_scenery',
      ]
        .map((name) => `${name}_0`)
        .sort(),
    );
    for (const mesh of meshes) {
      expect(mesh.indices.length, mesh.name).toBe((mesh.positions.length / 12) * 6);
      expect(windsOutward(mesh), mesh.name).toBe(true);
    }
    expect(meshes.find((mesh) => mesh.name.startsWith('1WALL'))!.visible).toBe(false);
  });

  it('adds a collider only to solid items', () => {
    const names = (project: Project) => scenery(project).map((mesh) => mesh.name);
    expect(names(withScenery(['tree', 'sign', 'light']))).not.toContain('1WALL_scenery_0');
    expect(names(withScenery(['tree'], { solid: true }))).toContain('1WALL_scenery_0');
    expect(names(withScenery(['building'], { solid: false }))).not.toContain('1WALL_scenery_0');
  });

  it('stands items on the meshed ground, foundations below it', () => {
    const project = withScenery(['building']);
    const scene = buildScene(project);
    const ground = meshHeight(scene.meshes.filter((mesh) => mesh.kind === 'terrain'));
    const facade = scene.meshes.find((mesh) => mesh.name === 'scenery_facade_0')!;
    const lowest = Math.min(...facade.positions.filter((_, i) => i % 3 === 1));
    const item = project.scenery[0];
    const under = ground({ x: item.x, z: item.z })!;
    expect(under).not.toBeNull();
    expect(lowest).toBeLessThan(under);
    expect(lowest).toBeGreaterThan(under - 3);
  });

  it('grows the same trees for the same grove', () => {
    const project = withScenery(['tree'], { width: 30, count: 12 });
    const item = project.scenery[0];
    const trees = groveTrees(item);
    expect(trees).toHaveLength(12);
    expect(groveTrees(item)).toEqual(trees);
    for (const tree of trees) expect(Math.hypot(tree.u, tree.v)).toBeLessThanOrEqual(15);
    expect(groveTrees({ ...item, id: 'other' })).not.toEqual(trees);
  });

  it('turns headings into plan directions and back', () => {
    expect(headingVector(0).z).toBeCloseTo(-1);
    expect(headingVector(90).x).toBeCloseTo(1);
    expect(headingTowards({ x: 0, z: 0 }, { x: 0, z: 10 })).toBeCloseTo(180);
    expect(headingTowards({ x: 0, z: 0 }, { x: -5, z: 0 })).toBeCloseTo(270);
  });

  it('puts one night light under each lamp', () => {
    const scene = buildScene(withScenery(['light', 'light'], { variant: 'double' }));
    expect(scene.lights).toHaveLength(4);
    for (const light of scene.lights) {
      expect(light.direction[1]).toBeLessThan(-0.9);
      expect(Math.hypot(...light.direction)).toBeCloseTo(1);
    }
  });

  it('warns about items reaching the track or its shoulders, without blocking the export', () => {
    const check = (at: { x: number; z: number }, kind: SceneryKind = 'building') => {
      let id = '';
      const project = produce(template('club'), (draft) => {
        id = addScenery(draft, kind, at);
      });
      return { id, issues: trackIssues(project) };
    };
    // The main straight passes x = -100 at z = 203; its shoulders end 12.65 m from it.
    const far = check({ x: -100, z: 240 });
    expect(far.issues.warnings.map((issue) => issue.code)).not.toContain('scenery-on-track');
    for (const at of [
      { x: -100, z: 203 },
      // The building is 10 m deep: its front reaches the shoulder.
      { x: -100, z: 218 },
    ]) {
      const near = check(at);
      const warning = near.issues.warnings.find((issue) => issue.code === 'scenery-on-track')!;
      expect(warning).toEqual({ code: 'scenery-on-track', count: 1, ids: [near.id] });
      expect(issueLayer(warning)).toBe('decor');
      expect(near.issues.errors).toEqual([]);
    }
  });
});
