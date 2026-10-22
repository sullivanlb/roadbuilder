import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { clearSculpt, setSculpt } from '../../src/core/project/edits';
import { RULES } from '../../src/core/project/rules';
import { parseProject } from '../../src/core/project/schema';
import type { Project } from '../../src/core/project/schema';
import { decodeTile, encodeTile, SCULPT, SculptField } from '../../src/core/project/sculpt';
import type { Brush, SculptGround } from '../../src/core/project/sculpt';
import { groundModel } from '../../src/core/scene/ground';
import { buildScene, findFoldedSurface } from '../../src/core/scene/scene';
import { sampleAt, sampleTrack } from '../../src/core/track/centerline';
import { terrainBounds } from '../../src/core/track/layout';
import { buildOverlay } from '../../src/rendering/preview/overlay';
import { asJson, template } from '../helpers';

const flat: SculptGround = { base: () => 0, clearance: () => 1 };
const brush = (patch: Partial<Brush> = {}): Brush => ({
  mode: 'raise',
  radius: 20,
  strength: 2,
  ...patch,
});

/** Paints with a brush held still for `seconds`, in steps of a frame. */
function hold(
  field: SculptField,
  with_: Brush,
  at = { x: 0, z: 0 },
  seconds = 1,
  ground = flat,
  target = 0,
) {
  for (let t = 0; t < seconds - 1e-9; t += 1 / 30) field.paint(with_, at, 1 / 30, ground, target);
  return field;
}

/** The club circuit with relief painted at a place away from the track. */
function painted(at: { x: number; z: number }, seconds = 2): Project {
  const field = hold(new SculptField(), brush({ radius: 30, strength: 5 }), at, seconds);
  return produce(template('club'), (draft) => setSculpt(draft, field));
}

/** A place of the club terrain at least 120 m from the track. */
function away() {
  const project = template('club'),
    samples = sampleTrack(project);
  const extent = terrainBounds(project, samples);
  for (let x = extent.minX + 40; x < extent.maxX; x += 10)
    for (let z = extent.minZ + 40; z < extent.maxZ; z += 10)
      if (samples.every((sample) => Math.hypot(sample.x - x, sample.z - z) > 120)) return { x, z };
  throw new Error('no room');
}

describe('the painted relief', () => {
  it('stores heights to the centimetre, compactly', () => {
    const values = Float32Array.from({ length: SCULPT.tile ** 2 }, (_, k) => (k - 100) * 0.013);
    const back = decodeTile(encodeTile(values));
    back.forEach((value, k) => expect(value).toBeCloseTo(values[k], 2));
    expect(encodeTile(values).length).toBeLessThan(700);
  });

  it('adds matter while the brush is held, most at its centre', () => {
    const field = hold(new SculptField(), brush(), { x: 0, z: 0 }, 1);
    expect(field.at({ x: 0, z: 0 })).toBeCloseTo(2, 1);
    const once = field.at({ x: 10, z: 0 });
    expect(once).toBeGreaterThan(0.5);
    expect(once).toBeLessThan(1.8);
    expect(field.at({ x: 21, z: 0 })).toBe(0);
    hold(field, brush(), { x: 0, z: 0 }, 1);
    expect(field.at({ x: 0, z: 0 })).toBeCloseTo(4, 1);
    hold(field, brush({ mode: 'lower' }), { x: 0, z: 0 }, 3);
    expect(field.at({ x: 0, z: 0 })).toBeCloseTo(-2, 1);
  });

  it('smooths towards the neighbours and flattens towards a height', () => {
    const field = hold(new SculptField(), brush({ radius: 6, strength: 5 }), { x: 0, z: 0 }, 1);
    const peak = field.at({ x: 0, z: 0 });
    hold(field, brush({ mode: 'smooth', radius: 12 }), { x: 0, z: 0 }, 2);
    expect(field.at({ x: 0, z: 0 })).toBeLessThan(peak * 0.8);
    expect(field.at({ x: 8, z: 0 })).toBeGreaterThan(0);
    // Flattening to 3 m over ground lying at 1 m paints 2 m.
    const level = hold(
      new SculptField(),
      brush({ mode: 'flatten', strength: 4 }),
      { x: 0, z: 0 },
      3,
      {
        base: () => 1,
        clearance: () => 1,
      },
      3,
    );
    expect(level.at({ x: 0, z: 0 })).toBeCloseTo(2, 1);
  });

  it('keeps within its heights and its number of tiles', () => {
    const field = hold(new SculptField(), brush({ strength: 10 }), { x: 0, z: 0 }, 20);
    expect(field.at({ x: 0, z: 0 })).toBe(RULES.sculptHeight.max);
    const wide = new SculptField();
    let refused = false;
    for (let x = 0; x < 3000 && !refused; x += 40)
      for (let z = 0; z < 3000 && !refused; z += 40)
        refused = !wide.paint(brush({ radius: 30 }), { x, z }, 0.1, flat);
    expect(refused).toBe(true);
    expect(wide.size).toBe(RULES.sculptTiles.max);
  });

  it('saves and reopens, flat tiles left out, and refuses heights out of bounds', () => {
    const project = painted({ x: 0, z: 0 });
    expect(project.sculpt.length).toBeGreaterThan(0);
    expect(parseProject(asJson(project))).toEqual(project);
    const json = asJson(template('club'));
    delete json.sculpt;
    expect(parseProject(json).sculpt).toEqual([]);
    const tooHigh = encodeTile(new Float32Array(SCULPT.tile ** 2).fill(200));
    expect(() =>
      parseProject({ ...asJson(project), sculpt: [{ i: 0, j: 0, heights: tooHigh }] }),
    ).toThrow();
    const lowered = hold(
      new SculptField(project.sculpt),
      brush({ mode: 'lower', radius: 30, strength: 5 }),
      { x: 0, z: 0 },
      2,
    );
    expect(produce(project, (draft) => setSculpt(draft, lowered)).sculpt).toEqual([]);
    expect(produce(project, clearSculpt).sculpt).toEqual([]);
  });

  it('raises the terrain away from the track, never the shoulders', () => {
    const top = away();
    const project = painted(top);
    const samples = sampleTrack(project);
    const before = groundModel(template('club'), samples),
      after = groundModel(project, samples);
    const raised = new SculptField(project.sculpt).at(top);
    expect(after.height(top) - before.height(top)).toBeCloseTo(raised, 3);
    expect(after.base(top)).toBeCloseTo(before.height(top), 3);
    expect(after.clearance(top)).toBe(1);
    // Painted over the track, the relief fades out by the shoulders.
    const at = sampleAt(samples, 200)!;
    const over = painted(at, 3);
    const lateral = at.half + 0.65 + over.road.shoulder + 0.5;
    const edge = { x: at.x + at.nx * lateral, z: at.z + at.nz * lateral };
    expect(groundModel(over, samples).height(edge)).toBeCloseTo(before.height(edge), 1);
  });

  it('meshes the painted relief finely, the terrain grown over it', () => {
    const samples = sampleTrack(template('club'));
    const extent = terrainBounds(template('club'), samples);
    const top = { x: extent.maxX + 100, z: (extent.minZ + extent.maxZ) / 2 };
    const project = painted(top);
    expect(terrainBounds(project, samples).maxX).toBeGreaterThan(top.x + 20);
    const scene = buildScene(project);
    expect(findFoldedSurface(scene)).toBeUndefined();
    const height = groundModel(project, samples).height;
    const near = scene.meshes
      .filter((mesh) => mesh.kind === 'terrain')
      .flatMap((mesh) =>
        Array.from({ length: mesh.positions.length / 3 }, (_, i) =>
          mesh.positions.slice(i * 3, i * 3 + 3),
        ),
      )
      .filter(([x, , z]) => Math.hypot(x - top.x, z - top.z) < 4);
    expect(near.length).toBeGreaterThan(0);
    for (const [x, y, z] of near) expect(y).toBeCloseTo(height({ x, z }), 3);
  });
});

describe('the brush in 3D', () => {
  it('rings the ground under the pointer with its reach', () => {
    const project = template('club');
    const samples = sampleTrack(project);
    const brush = { x: 10, y: 3, z: -5, radius: 12 };
    const { outlines } = buildOverlay(project, samples, {
      layer: 'terrain',
      selection: null,
      range: null,
      draft: null,
      sceneryFloors: {},
      hoverS: null,
      brush,
    });
    expect(outlines.length).toBe(2 * 48 * 6);
    const reach = Math.max(
      ...Array.from({ length: outlines.length / 3 }, (_, k) =>
        Math.hypot(outlines[k * 3] - brush.x, outlines[k * 3 + 2] - brush.z),
      ),
    );
    expect(reach).toBeCloseTo(12, 3);
  });
});
