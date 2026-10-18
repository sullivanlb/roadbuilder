import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { LIMITS } from '../src/domain/project/limits';
import { createProject } from '../src/domain/project/factory';
import { validateProject } from '../src/domain/project/validation';
import { ExportError, ProjectError } from '../src/domain/diagnostics';
import {
  bounds,
  sampleAt,
  sampleTrack,
  trackIssues,
  trackStats,
} from '../src/domain/track/geometry';
import { buildScene } from '../src/domain/track/scene';
import {
  barrierLateral,
  barrierPath,
  barrierSamples,
  barrierSegments,
  insertBarrierPoint,
  removeBarrierPoint,
  reverseBarriers,
  splitWrappingBarriers,
} from '../src/domain/track/barriers';
import { buildExport } from '../src/export/trackExport';
import { crc32 } from '../src/export/binary/crc32';
import { zipFiles } from '../src/export/binary/zip';
import { ProjectHistory } from '../src/domain/project/history';
import { persistProject, restoreProject, STORAGE_KEY } from '../src/domain/project/storage';
import type { Barrier } from '../src/domain/types';
import baseline from './fixtures/legacy-baseline.json';
import tightTurnFixture from './fixtures/tight-turn.roadbuilder.json';

/** Runs a call expected to fail and returns whatever it threw. */
function rejected(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('expected the call to throw');
}

// These hashes were captured from the pre-migration HTML, before changing its algorithms.
describe.each(['club', 'kart', 'mountain'] as const)('model compatibility %s', (template) => {
  const project = createProject(template);
  it('preserves projects and measurements from the HTML version', () => {
    expect(project).toEqual(baseline[template].project);
    const samples = sampleTrack(project);
    expect(samples).toHaveLength(baseline[template].samples);
    expect(trackStats(samples)).toEqual(baseline[template].stats);
    expect(trackIssues(project, samples).errors).toEqual([]);
  });
  it('preserves finite, upward-facing meshes and valid KN5 indices', () => {
    const scene = buildScene(project);
    expect(
      scene.meshes.map((m) => ({
        name: m.name,
        vertices: m.vertices.length,
        indices: m.indices.length,
      })),
    ).toEqual(baseline[template].meshes);
    let invalid = 0;
    for (const mesh of scene.meshes) {
      if (mesh.vertices.length > 65535) invalid++;
      for (const v of mesh.vertices)
        if (![...v.position, ...v.normal, ...v.uv, ...v.tangent].every(Number.isFinite)) invalid++;
      for (const index of mesh.indices) if (index < 0 || index >= mesh.vertices.length) invalid++;
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const [a, b, c] = mesh.indices
          .slice(i, i + 3)
          .map((index) => mesh.vertices[index].position);
        if ((b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]) <= 1e-9) invalid++;
      }
    }
    expect(invalid).toBe(0);
    expect(scene.meshes.some((m) => m.terrain)).toBe(true);
    expect(scene.markers.map((m) => m.name)).toContain('AC_START_0');
    expect(scene.markers.map((m) => m.name)).toContain('AC_PIT_0');
  });
  it.each(['ac', 'obj'] as const)('produces exactly the same %s archive', (format) => {
    const output = buildExport(project, format);
    expect(createHash('sha256').update(output.bytes).digest('hex')).toBe(
      baseline[template][format].sha256,
    );
    expect(output.bytes.length).toBe(baseline[template][format].size);
    expect(Object.keys(output.files)).toEqual(baseline[template][format].files);
    expect(JSON.parse(output.files['projet.roadbuilder.json'] as string)).toEqual(project);
    if (format === 'ac') {
      const path = Object.keys(output.files).find((p) => p.endsWith('.kn5'))!;
      const kn5 = output.files[path] as Uint8Array;
      expect(new TextDecoder().decode(kn5.subarray(0, 6))).toBe('sc6969');
      expect(new DataView(kn5.buffer, kn5.byteOffset).getUint32(6, true)).toBe(5);
    } else {
      expect(output.files['track.obj']).toContain('mtllib track.mtl');
      expect(output.files['track.obj']).toContain('1GRASS_terrain');
      expect(output.files['track.mtl']).toContain('map_Kd texture/grass.png');
    }
  });
});

describe('validation and geometry', () => {
  it('imports a legacy project with no terrain margin without altering its source', () => {
    const { terrainMargin: _, ...legacy } = createProject();
    expect(validateProject(legacy).terrainMargin).toBe(150);
    expect(legacy).not.toHaveProperty('terrainMargin');
  });
  it.each([
    null,
    {},
    { ...createProject(), version: 2 },
    { ...createProject(), terrainMargin: 501 },
    { ...createProject(), width: NaN },
    { ...createProject(), points: [null] },
    { ...createProject(), points: Array(LIMITS.points + 1).fill({ x: 0, y: 0, z: 0 }) },
  ])('rejects an invalid project', (value) => {
    expect(() => validateProject(value)).toThrow();
  });
  it('handles the blank template and rejects its export', () => {
    const project = createProject('blank');
    expect(sampleTrack(project)).toEqual([]);
    expect(sampleAt([], 5)).toBeNull();
    expect(buildScene(project).meshes).toEqual([]);
    const failure = rejected(() => buildExport(project));
    expect(failure).toBeInstanceOf(ExportError);
    expect(failure).toMatchObject({ issues: { errors: [{ code: 'points-minimum', min: 2 }] } });
  });
  it('closes circuits and preserves the ends of open roads', () => {
    const closed = sampleTrack(createProject('club'));
    expect([closed.at(-1)!.x, closed.at(-1)!.z]).toEqual([closed[0].x, closed[0].z]);
    const project = createProject('mountain'),
      open = sampleTrack(project);
    expect([open.at(-1)!.x, open.at(-1)!.y, open.at(-1)!.z]).toEqual(
      Object.values(project.points.at(-1)!),
    );
    expect(bounds(open).minY).toBeGreaterThanOrEqual(0);
    expect(bounds(open).maxY).toBeLessThanOrEqual(145);
  });
  it('detects crossings and points too close together', () => {
    const project = createProject('blank');
    project.points = [
      { x: -100, y: 0, z: -100 },
      { x: 100, y: 0, z: 100 },
      { x: -100, y: 0, z: 100 },
      { x: 100, y: 0, z: -100 },
    ];
    expect(trackIssues(project).errors.map((issue) => issue.code)).toContain('track-crossing');
    project.points[1] = { ...project.points[0] };
    expect(trackIssues(project).errors.map((issue) => issue.code)).toContain('points-too-close');
  });
});

describe('history', () => {
  it('ignores no-op gestures, groups a gesture and invalidates redo after a new change', () => {
    const history = new ProjectHistory();
    history.remember('a', 'a');
    expect(history.canUndo).toBe(false);
    history.remember('a', 'b');
    expect(history.undo('b')).toBe('a');
    expect(history.redo('a')).toBe('b');
    expect(history.undo('b')).toBe('a');
    history.remember('a', 'c');
    expect(history.canRedo).toBe(false);
  });
  it('limits the session to the last 60 changes', () => {
    const history = new ProjectHistory();
    for (let i = 0; i < 65; i++) history.remember(String(i), String(i + 1));
    for (let i = 65; i > 5; i--) expect(history.undo(String(i))).toBe(String(i - 1));
    expect(history.canUndo).toBe(false);
  });
});

describe('local persistence', () => {
  const memory = (initial: string) => {
    const values = new Map([[STORAGE_KEY, initial]]);
    return {
      values,
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
  };
  it('restores and saves a valid project', () => {
    const storage = memory(JSON.stringify(createProject('kart')));
    const restored = restoreProject(storage);
    expect(restored.project.name).toBe('Karting des Pins');
    expect(restored.notice).toBe(null);
    expect(persistProject(storage, createProject(), false)).toBe('saved');
    expect(restoreProject(storage).project.name).toBe('Circuit des Collines');
  });
  it('preserves corrupted content before any new save', () => {
    const storage = memory('{invalid');
    const restored = restoreProject(storage);
    expect(restored.notice).toBe('storage-unreadable');
    expect(
      [...storage.values.keys()].some((key) => key.startsWith(`${STORAGE_KEY}.recovery.`)),
    ).toBe(true);
    expect(persistProject(storage, restored.project, false)).toBe('saved');
    expect([...storage.values.values()]).toContain('{invalid');
  });
  it('refuses to overwrite when the recovery copy fails', () => {
    const storage = {
      getItem: () => '{invalid',
      setItem: () => {
        throw new Error('quota');
      },
    };
    const restored = restoreProject(storage);
    expect(restored.recoveryPending).toBe(true);
    expect(restored.notice).toBe('storage-unreadable');
    expect(persistProject(storage, restored.project, true)).toBe('recovery');
    expect(persistProject(null, restored.project, false)).toBe('unavailable');
  });
});

it('writes a ZIP with CRC and rejects dangerous paths', () => {
  const bytes = zipFiles({ 'été.txt': 'bonjour' });
  const view = new DataView(bytes.buffer);
  expect(view.getUint32(0, true)).toBe(0x04034b50);
  expect(view.getUint32(14, true)).toBe(crc32(new TextEncoder().encode('bonjour')));
  expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50);
  expect(() => zipFiles({ '../track.kn5': 'x' })).toThrow('Invalid ZIP path');
});

describe('locating overly tight turns', () => {
  it('locates each rejection on a span between two points, even when it lies mid-span', () => {
    const project = validateProject(tightTurnFixture);
    const samples = sampleTrack(project);
    const issues = trackIssues(project, samples);
    expect(issues.tightTurns.map((turn) => turn.pointIndices)).toEqual([
      [2, 3],
      [3, 4],
    ]);
    expect(issues.errors).toEqual(issues.tightTurns.map((turn) => turn.issue));
    expect(issues.errors[0]).toEqual({ code: 'tight-turn', from: 2, to: 3 });
    const between = samples[issues.tightTurns[0].sampleIndex];
    expect(between.t).toBeGreaterThan(0);
    expect(between.t).toBeLessThan(1);
    expect(project.points).not.toContainEqual({ x: between.x, y: between.y, z: between.z });
    for (const format of ['ac', 'obj'] as const) {
      const failure = rejected(() => buildExport(project, format));
      expect(failure).toBeInstanceOf(ExportError);
      expect(failure).toMatchObject({ detail: { code: 'invalid-track' }, issues });
    }
  });

  it('uses the first point to close the circuit, without inventing it on an open road', () => {
    const project = validateProject(tightTurnFixture);
    project.closed = true;
    const closing = trackIssues(project).tightTurns.find(
      (turn) => turn.segment === project.points.length - 1,
    )!;
    expect(closing.pointIndices).toEqual([6, 0]);
    expect(closing.issue).toEqual({ code: 'tight-turn', from: 6, to: 0 });
    project.closed = false;
    expect(trackIssues(project).tightTurns.some((turn) => turn.pointIndices.includes(0))).toBe(
      false,
    );
  });

  it('clears the diagnostics after a fix and allows both exports', () => {
    const project = validateProject(tightTurnFixture);
    project.width = 4;
    expect(trackIssues(project).tightTurns).toEqual([]);
    for (const format of ['ac', 'obj'] as const) {
      expect(buildExport(project, format).issues.errors).toEqual([]);
    }
    project.width = 24;
    expect(trackIssues(project).tightTurns).toHaveLength(2);
    project.points.forEach((point) => {
      point.x *= 4;
      point.z *= 4;
    });
    expect(trackIssues(project).tightTurns).toEqual([]);
  });

  it('produces no invalid location for an empty or single-point track', () => {
    const project = createProject('blank');
    expect(trackIssues(project).tightTurns).toEqual([]);
    project.points = [{ x: 0, y: 0, z: 0 }];
    expect(trackIssues(project).tightTurns).toEqual([]);
  });
});

describe('barriers', () => {
  const region = (over: Partial<Barrier> = {}): Barrier => ({
    type: 'guardrail',
    side: 'right',
    from: 1,
    to: 4,
    offset: 1,
    ...over,
  });
  const withBarriers = (barriers: unknown[], template: 'club' | 'mountain' = 'club') => ({
    ...createProject(template),
    barriers,
  });

  it('validates segments, strips unknown fields and tolerates wrapping on closed circuits', () => {
    const validated = validateProject(
      withBarriers([region({ type: 'wall', side: 'left', from: 7, to: 2, offset: 0.5 })]),
    );
    expect(validated.barriers).toEqual([
      { type: 'wall', side: 'left', from: 7, to: 2, offset: 0.5 },
    ]);
    expect(validateProject(withBarriers([])).barriers).toEqual([]);
    expect(validateProject(createProject('club'))).not.toHaveProperty('barriers');
  });

  it.each<[unknown[]]>([
    [[region({ type: 'pneu' as never })]],
    [[region({ side: 'middle' as never })]],
    [[region({ from: 2, to: 2 })]],
    [[region({ from: -1 })]],
    [[{ ...region(), to: 9 }]],
    [[region({ offset: 12 })]],
    [[{ type: 'wall', side: 'left', from: 1, to: 2 }]],
    [[null]],
    [Array<Barrier>(LIMITS.barriers + 1).fill(region())],
  ])('rejects an invalid list of segments', (barriers) => {
    expect(() => validateProject(withBarriers(barriers))).toThrow();
  });

  it('rejects a backwards segment on an open road and without a track', () => {
    const backwards = rejected(() =>
      validateProject(
        withBarriers([region({ type: 'tires', side: 'left', from: 5, to: 2 })], 'mountain'),
      ),
    );
    expect(backwards).toBeInstanceOf(ProjectError);
    expect(backwards).toMatchObject({ detail: { code: 'barrier-direction' } });
    const withoutTrack = rejected(() =>
      validateProject({ ...createProject('blank'), barriers: [region()] }),
    );
    expect(withoutTrack).toBeInstanceOf(ProjectError);
    expect(withoutTrack).toMatchObject({ detail: { code: 'barriers-min-points' } });
  });

  it('follows the track direction and wraps around on a closed circuit', () => {
    const project = createProject('club');
    expect(barrierSegments(project, region({ from: 2, to: 5 }))).toEqual([2, 3, 4]);
    expect(barrierSegments(project, region({ from: 7, to: 2 }))).toEqual([7, 8, 0, 1]);
    const samples = sampleTrack(project);
    const path = barrierSamples(project, samples, region({ from: 7, to: 2 }));
    expect([path[0].x, path[0].z]).toEqual([project.points[7].x, project.points[7].z]);
    const last = path.at(-1)!;
    expect([last.x, last.z]).toEqual([project.points[2].x, project.points[2].z]);
    for (let i = 1; i < path.length; i++)
      expect(Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z)).toBeGreaterThan(
        0.0001,
      );
    const line = barrierPath(project, samples, region({ from: 2, to: 4, offset: 1 }));
    expect(line.length).toBeGreaterThan(1);
    expect(line.every((p) => Number.isFinite(p.x) && Number.isFinite(p.z))).toBe(true);
  });

  it('offsets the collider from the track edge and clamps it in tight turns', () => {
    const project = createProject('club');
    const samples = sampleTrack(project);
    const straight = samples.find((s) => Math.abs(s.curvature) < 0.005)!;
    const base = project.width / 2 + (project.kerbs ? 0.65 : 0);
    expect(barrierLateral(project, straight, 'right', 1)).toBeCloseTo(base + 1, 5);
    expect(barrierLateral(project, straight, 'left', 1)).toBeCloseTo(-(base + 1), 5);
    expect(barrierLateral(project, straight, 'right', 10)).toBeCloseTo(base + 10, 5);
    // On the tight turn, the inner side is clamped so it does not cross to the other side.
    const tight = validateProject(tightTurnFixture);
    const tightBase = tight.width / 2 + (tight.kerbs ? 0.65 : 0);
    const curved = sampleTrack(tight).reduce((a, b) =>
      Math.abs(b.curvature) > Math.abs(a.curvature) ? b : a,
    );
    const side = curved.curvature > 0 ? 'right' : 'left';
    const value = Math.abs(barrierLateral(tight, curved, side, 10));
    expect(value).toBeGreaterThanOrEqual(tightBase + 0.05);
    expect(value).toBeLessThan(tightBase + 10);
    // The outer side keeps its full offset.
    const outside = side === 'right' ? 'left' : 'right';
    expect(Math.abs(barrierLateral(tight, curved, outside, 10))).toBeCloseTo(tightBase + 10, 5);
  });

  it('generates invisible 1WALL colliders, visible scenery and track-facing normals', () => {
    const project = createProject('club');
    project.barriers = [
      { type: 'guardrail', side: 'right', from: 1, to: 3, offset: 1 },
      { type: 'tires', side: 'left', from: 3, to: 5, offset: 1.5 },
      { type: 'tecpro', side: 'right', from: 5, to: 7, offset: 1 },
      { type: 'wall', side: 'left', from: 7, to: 2, offset: 0.5 },
    ];
    const samples = sampleTrack(project);
    const scene = buildScene(project, samples);
    const walls = scene.meshes.filter((m) => m.name.startsWith('1WALL'));
    const colliders = walls.filter((m) => !m.name.startsWith('1WALL_beton'));
    expect(colliders.length).toBeGreaterThanOrEqual(3);
    expect(walls.length).toBeGreaterThan(colliders.length);
    let inward = 0,
      total = 0;
    for (const mesh of colliders) {
      expect(mesh.renderable).toBe(false);
      expect(mesh.vertices.length).toBeGreaterThan(0);
      expect(mesh.vertices.length).toBeLessThanOrEqual(65535);
      for (const v of mesh.vertices) {
        const [x, , z] = v.position;
        const nearest = samples.reduce((a, b) =>
          Math.hypot(a.x - x, a.z - z) < Math.hypot(b.x - x, b.z - z) ? a : b,
        );
        const dx = nearest.x - x,
          dz = nearest.z - z,
          length = Math.hypot(dx, dz) || 1;
        const dot = v.normal[0] * (dx / length) + v.normal[2] * (dz / length);
        expect(dot).toBeGreaterThan(-0.25);
        if (dot > 0.9) inward++;
        total++;
      }
    }
    expect(inward / total).toBeGreaterThan(0.6);
    // The concrete wall is visible: it is its own collider.
    const beton = scene.meshes.filter((m) => m.name.startsWith('1WALL_beton'));
    expect(beton.length).toBeGreaterThanOrEqual(1);
    for (const mesh of beton) expect(mesh.renderable).not.toBe(false);
    const decors = scene.meshes.filter((m) => m.barrier && !m.name.startsWith('1WALL'));
    expect(decors.length).toBeGreaterThanOrEqual(3);
    for (const mesh of decors) expect(mesh.renderable).not.toBe(false);
  });

  it('keeps the collider off the roadway in a very tight turn', () => {
    const project = validateProject(tightTurnFixture);
    project.width = 4;
    project.barriers = [
      { type: 'guardrail', side: 'right', from: 0, to: 6, offset: 1 },
      { type: 'guardrail', side: 'left', from: 0, to: 6, offset: 1 },
    ];
    const samples = sampleTrack(project);
    const scene = buildScene(project, samples);
    const colliders = scene.meshes.filter((m) => m.name.startsWith('1WALL'));
    expect(colliders.length).toBeGreaterThanOrEqual(2);
    let minimum = Infinity;
    for (const mesh of colliders)
      for (const v of mesh.vertices) {
        const [x, , z] = v.position;
        for (const s of samples) minimum = Math.min(minimum, Math.hypot(s.x - x, s.z - z));
      }
    expect(minimum).toBeGreaterThan(project.width / 2);
  });

  it('creates no barrier mesh without segments', () => {
    const scene = buildScene(createProject('club'));
    expect(scene.meshes.some((m) => m.name.startsWith('1WALL'))).toBe(false);
    expect(scene.meshes.every((m) => m.barrier === undefined)).toBe(true);
  });

  it('exports barriers in both formats without touching the surfaces', () => {
    const project = createProject('club');
    project.barriers = [
      { type: 'guardrail', side: 'right', from: 1, to: 3, offset: 1 },
      { type: 'tires', side: 'left', from: 3, to: 5, offset: 1.5 },
      { type: 'tecpro', side: 'right', from: 5, to: 7, offset: 1 },
      { type: 'wall', side: 'left', from: 7, to: 2, offset: 0.5 },
    ];
    const ac = buildExport(project, 'ac');
    const path = Object.keys(ac.files).find((p) => p.endsWith('.kn5'))!;
    const kn5 = ac.files[path] as Uint8Array;
    expect(new DataView(kn5.buffer, kn5.byteOffset).getUint32(10, true)).toBe(10);
    const installation = ac.files['INSTALLATION.txt'] as string;
    expect(installation).toContain('Barrières : 4 tronçons avec collision');
    expect(installation).toContain('colliders simples');
    expect(installation).not.toContain('Pas de barrières, de ponts ou de décor');
    const surfaces = Object.entries(ac.files).find(([p]) =>
      p.endsWith('surfaces.ini'),
    )![1] as string;
    expect(surfaces).not.toContain('KEY=WALL');
    expect(
      (JSON.parse(ac.files['projet.roadbuilder.json'] as string) as { barriers: unknown[] })
        .barriers,
    ).toHaveLength(4);

    const obj = buildExport(project, 'obj');
    expect(obj.files['track.obj']).toContain('o 1WALL_guardrail_0_0');
    expect(obj.files['track.obj']).toContain('usemtl tecpro_red');
    expect(obj.files['track.obj']).toContain('usemtl concrete');
    expect(obj.files['texture/metal.png']).toBeTruthy();
    expect(obj.files['texture/concrete.png']).toBeTruthy();
    expect(obj.files['LIRE-MOI.txt']).toContain('1WALL');
  });

  it('shifts anchors when a point is inserted', () => {
    const b = region({ from: 2, to: 4 });
    expect(insertBarrierPoint([b], 2)).toEqual([region({ from: 3, to: 5 })]);
    expect(insertBarrierPoint([b], 3)).toEqual([region({ from: 2, to: 5 })]);
    expect(insertBarrierPoint([b], 5)).toEqual([b]);
  });

  it('removes a segment that loses an anchor and shifts the others', () => {
    const b = region({ from: 2, to: 4 });
    expect(removeBarrierPoint([b], 3, false)).toEqual([region({ from: 2, to: 3 })]);
    expect(removeBarrierPoint([b], 2, false)).toEqual([]);
    expect(removeBarrierPoint([b], 4, false)).toEqual([]);
    expect(removeBarrierPoint([b], 0, false)).toEqual([region({ from: 1, to: 3 })]);
  });

  it('replays segments in reverse, side included', () => {
    expect(reverseBarriers([region({ from: 2, to: 5 })], 9, false)).toEqual([
      region({ from: 3, to: 6, side: 'left' }),
    ]);
    expect(reverseBarriers([region({ from: 2, to: 5 })], 9, true)).toEqual([
      region({ from: 4, to: 7, side: 'left' }),
    ]);
    expect(reverseBarriers([region({ from: 7, to: 2 })], 9, true)).toEqual([
      region({ from: 7, to: 2, side: 'left' }),
    ]);
  });

  it('splits wrapping segments when switching to an open road', () => {
    expect(splitWrappingBarriers([region({ from: 7, to: 2 })], 9)).toEqual([
      region({ from: 7, to: 8 }),
      region({ from: 0, to: 2 }),
    ]);
    expect(splitWrappingBarriers([region({ from: 8, to: 1 })], 9)).toEqual([
      region({ from: 0, to: 1 }),
    ]);
    expect(splitWrappingBarriers([region({ from: 2, to: 5 })], 9)).toEqual([
      region({ from: 2, to: 5 }),
    ]);
  });
});
