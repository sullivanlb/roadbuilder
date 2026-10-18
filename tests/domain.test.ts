import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createProject, validateProject, LIMITS } from '../src/domain/project';
import { bounds, sampleAt, sampleTrack, trackIssues, trackStats } from '../src/domain/geometry';
import { buildScene } from '../src/domain/scene';
import { buildExport } from '../src/export/trackExport';
import { crc32, zipFiles } from '../src/export/binary';
import { ProjectHistory } from '../src/domain/history';
import { persistProject, restoreProject, STORAGE_KEY } from '../src/domain/storage';
import baseline from './fixtures/legacy-baseline.json';
import tightTurnFixture from './fixtures/tight-turn.roadbuilder.json';

// These hashes were captured from the pre-migration HTML, before changing its algorithms.
describe.each(['club', 'kart', 'mountain'] as const)('compatibilité du modèle %s', (template) => {
  const project = createProject(template);
  it('conserve les projets et les mesures de la version HTML', () => {
    expect(project).toEqual(baseline[template].project);
    const samples = sampleTrack(project);
    expect(samples).toHaveLength(baseline[template].samples);
    expect(trackStats(samples)).toEqual(baseline[template].stats);
    expect(trackIssues(project, samples).errors).toEqual([]);
  });
  it('conserve des maillages finis, orientés vers le haut et des indices KN5 valides', () => {
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
  it.each(['ac', 'obj'] as const)('produit exactement la même archive %s', (format) => {
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

describe('validation et géométrie', () => {
  it('importe un ancien projet sans marge de terrain sans modifier sa source', () => {
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
  ])('rejette un projet invalide', (value) => {
    expect(() => validateProject(value)).toThrow();
  });
  it('gère la page blanche et refuse son export', () => {
    const project = createProject('blank');
    expect(sampleTrack(project)).toEqual([]);
    expect(sampleAt([], 5)).toBeNull();
    expect(buildScene(project).meshes).toEqual([]);
    expect(() => buildExport(project)).toThrow('2 points');
  });
  it('ferme les circuits et conserve les extrémités des routes ouvertes', () => {
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
  it('détecte les croisements et points trop proches', () => {
    const project = createProject('blank');
    project.points = [
      { x: -100, y: 0, z: -100 },
      { x: 100, y: 0, z: 100 },
      { x: -100, y: 0, z: 100 },
      { x: 100, y: 0, z: -100 },
    ];
    expect(trackIssues(project).errors.join(' ')).toContain('se croise');
    project.points[1] = { ...project.points[0] };
    expect(trackIssues(project).errors.join(' ')).toContain('trop proches');
  });
});

describe('historique', () => {
  it('ignore les gestes sans changement, groupe un geste et invalide le rétablissement après une nouvelle modification', () => {
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
  it('limite la session aux 60 dernières modifications', () => {
    const history = new ProjectHistory();
    for (let i = 0; i < 65; i++) history.remember(String(i), String(i + 1));
    for (let i = 65; i > 5; i--) expect(history.undo(String(i))).toBe(String(i - 1));
    expect(history.canUndo).toBe(false);
  });
});

describe('sauvegarde locale', () => {
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
  it('restaure et enregistre un projet valide', () => {
    const storage = memory(JSON.stringify(createProject('kart')));
    const restored = restoreProject(storage);
    expect(restored.project.name).toBe('Karting des Pins');
    expect(persistProject(storage, createProject(), false)).toBe('saved');
    expect(restoreProject(storage).project.name).toBe('Circuit des Collines');
  });
  it('préserve le contenu corrompu avant toute nouvelle sauvegarde', () => {
    const storage = memory('{invalid');
    const restored = restoreProject(storage);
    expect(restored.message).not.toBe('');
    expect(
      [...storage.values.keys()].some((key) => key.startsWith(`${STORAGE_KEY}.recovery.`)),
    ).toBe(true);
    expect(persistProject(storage, restored.project, false)).toBe('saved');
    expect([...storage.values.values()]).toContain('{invalid');
  });
  it('interdit l’écrasement si la copie de récupération échoue', () => {
    const storage = {
      getItem: () => '{invalid',
      setItem: () => {
        throw new Error('quota');
      },
    };
    const restored = restoreProject(storage);
    expect(restored.recoveryPending).toBe(true);
    expect(persistProject(storage, restored.project, true)).toBe('recovery');
    expect(persistProject(null, restored.project, false)).toBe('unavailable');
  });
});

it('écrit un ZIP avec CRC et refuse les chemins dangereux', () => {
  const bytes = zipFiles({ 'été.txt': 'bonjour' });
  const view = new DataView(bytes.buffer);
  expect(view.getUint32(0, true)).toBe(0x04034b50);
  expect(view.getUint32(14, true)).toBe(crc32(new TextEncoder().encode('bonjour')));
  expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50);
  expect(() => zipFiles({ '../track.kn5': 'x' })).toThrow('Chemin ZIP invalide');
});

describe('localisation des virages trop serrés', () => {
  it('rattache chaque refus à une portion entre deux points, même si le défaut se trouve entre les points de contrôle', () => {
    const project = validateProject(tightTurnFixture);
    const samples = sampleTrack(project);
    const issues = trackIssues(project, samples);
    expect(issues.tightTurns.map((turn) => turn.pointIndices)).toEqual([
      [2, 3],
      [3, 4],
    ]);
    expect(issues.errors).toEqual(issues.tightTurns.map((turn) => turn.message));
    expect(issues.errors[0]).toContain('points 3 et 4');
    const between = samples[issues.tightTurns[0].sampleIndex];
    expect(between.t).toBeGreaterThan(0);
    expect(between.t).toBeLessThan(1);
    expect(project.points).not.toContainEqual({ x: between.x, y: between.y, z: between.z });
    for (const format of ['ac', 'obj'] as const) {
      expect(() => buildExport(project, format)).toThrow(issues.errors.join('\n'));
    }
  });

  it('utilise le premier point pour la fermeture du circuit, sans l’inventer sur une route ouverte', () => {
    const project = validateProject(tightTurnFixture);
    project.closed = true;
    const closing = trackIssues(project).tightTurns.find(
      (turn) => turn.segment === project.points.length - 1,
    )!;
    expect(closing.pointIndices).toEqual([6, 0]);
    expect(closing.message).toContain('points 7 et 1');
    project.closed = false;
    expect(trackIssues(project).tightTurns.some((turn) => turn.pointIndices.includes(0))).toBe(
      false,
    );
  });

  it('retire les diagnostics après correction et autorise les deux exports', () => {
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

  it('ne produit pas de localisation invalide pour un tracé vide ou avec un seul point', () => {
    const project = createProject('blank');
    expect(trackIssues(project).tightTurns).toEqual([]);
    project.points = [{ x: 0, y: 0, z: 0 }];
    expect(trackIssues(project).tightTurns).toEqual([]);
  });
});
