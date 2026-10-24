import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { addBarrier, addScenery, addWidthZone } from '../src/core/project/edits';
import { buildScene } from '../src/core/scene/scene';
import { sampleTrack } from '../src/core/track/centerline';
import { positionAt } from '../src/core/track/positions';
import { buildOverlay, meshLayer } from '../src/rendering/preview/overlay';
import { template } from './helpers';

describe('3D preview by layers', () => {
  it('sorts the scene meshes into layers, the roadway on none', () => {
    const base = template('club');
    const samples = sampleTrack(base);
    const project = produce(base, (draft) => {
      addBarrier(draft, {
        type: 'guardrail',
        side: 'left',
        from: positionAt(base, samples, 100),
        to: positionAt(base, samples, 300),
      });
    });
    const layers = new Map(buildScene(project).meshes.map((mesh) => [mesh.name, meshLayer(mesh)]));
    expect([...layers].find(([name]) => name.startsWith('1ROAD_main'))?.[1]).toBeNull();
    expect([...layers].find(([name]) => name.startsWith('1PIT_lane'))?.[1]).toBe('pits');
    expect([...layers].find(([name]) => name.startsWith('divider_decor'))?.[1]).toBe('pits');
    expect([...layers].find(([name]) => name.startsWith('1GRASS_terrain'))?.[1]).toBe('terrain');
    expect([...layers].find(([name]) => name.startsWith('guardrail'))?.[1]).toBe('edges');
  });

  it('highlights the selection and the picked stretch, with posts on the track layer only', () => {
    const base = template('club');
    const samples = sampleTrack(base);
    const project = produce(base, (draft) => {
      addWidthZone(draft, {
        from: positionAt(base, samples, 100),
        to: positionAt(base, samples, 300),
      });
    });
    const zone = project.widthZones[0];
    const state = {
      layer: 'road' as const,
      selection: { kind: 'widthZone' as const, id: zone.id },
      range: { start: 500, length: 100 },
      draft: null,
      hoverS: 50,
      sceneryFloors: {},
    };
    const overlay = buildOverlay(project, sampleTrack(project), state);
    expect(overlay.strips).toHaveLength(2);
    expect(overlay.strips.every((strip) => strip.positions.length > 0)).toBe(true);
    expect(overlay.posts).toEqual([]);
    expect(overlay.cursor).not.toBeNull();
    const track = buildOverlay(project, sampleTrack(project), {
      ...state,
      layer: 'track',
      selection: { kind: 'points', ids: [project.points[1].id] },
    });
    expect(track.posts).toHaveLength(project.points.length);
    expect(track.posts.filter((post) => post.selected).map((post) => post.id)).toEqual([
      project.points[1].id,
    ]);
  });

  it('outlines the selected scenery items from the floor they stand on', () => {
    let id = '';
    const project = produce(template('club'), (draft) => {
      id = addScenery(draft, 'building', { x: -100, z: 260 });
    });
    const scene = buildScene(project);
    const overlay = buildOverlay(project, sampleTrack(project), {
      layer: 'scenery',
      selection: { kind: 'scenery', ids: [id] },
      range: null,
      draft: null,
      hoverS: null,
      sceneryFloors: scene.sceneryFloors,
    });
    const heights = overlay.outlines.filter((_, i) => i % 3 === 1);
    const floor = scene.sceneryFloors[id];
    expect(Math.min(...heights)).toBeCloseTo(floor);
    expect(Math.max(...heights)).toBeCloseTo(floor + project.scenery[0].height);
    expect(scene.meshes.filter((mesh) => mesh.kind === 'scenery').map(meshLayer)).toContain(
      'scenery',
    );
  });
});
