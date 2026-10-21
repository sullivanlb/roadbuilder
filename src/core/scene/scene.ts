import type { Project } from '../project/schema';
import { sampleTrack } from '../track/centerline';
import type { Sample } from '../track/centerline';
import { buildBarriers } from './barriers';
import { buildMarkers } from './markers';
import type { Marker } from './markers';
import { splitMesh } from './mesh';
import { buildPitWall } from './pits';
import type { Mesh } from './mesh';
import { buildRoad } from './road';
import { buildScenery } from './scenery';
import type { SceneLight } from './scenery';
import { buildTerrain } from './terrain';

/** Everything generated from a project to be seen or driven; the preview and the exports share it. */
export interface Scene {
  meshes: Mesh[];
  markers: Marker[];
  /** The lamps of the lights, lit at night by Custom Shaders Patch. */
  lights: SceneLight[];
}

export function buildScene(
  project: Project,
  samples: readonly Sample[] = sampleTrack(project),
): Scene {
  if (samples.length < 2) return { meshes: [], markers: [], lights: [] };
  const road = buildRoad(project, samples);
  // The terrain is cut around everything that lies on the ground, markings excepted.
  const ground = [road.road, road.shoulders, road.kerbRed, road.kerbWhite, road.pit];
  const surfaces = [
    road.road,
    road.shoulders,
    road.kerbRed,
    road.kerbWhite,
    road.markings,
    road.pit,
  ];
  const meshes = [
    ...surfaces,
    ...buildPitWall(project, samples),
    ...buildBarriers(project, samples),
  ].flatMap(splitMesh);
  const terrain = buildTerrain(project, samples, ground);
  meshes.push(...terrain);
  // Scenery stands on the terrain as meshed, or on the surfaces where it reaches them.
  const scenery = buildScenery(project, samples, [...ground, ...terrain]);
  meshes.push(...scenery.meshes.flatMap(splitMesh));
  return { meshes, markers: buildMarkers(project, samples), lights: scenery.lights };
}

/** Whether a ground triangle faces down after projection, i.e. the surface folds over itself. */
export function findFoldedSurface(scene: Scene): Mesh | undefined {
  return scene.meshes.find((mesh) => {
    if (mesh.kind === 'barrier' || mesh.kind === 'scenery') return false;
    const p = mesh.positions;
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const [a, b, c] = [mesh.indices[i] * 3, mesh.indices[i + 1] * 3, mesh.indices[i + 2] * 3];
      const areaY = (p[b + 2] - p[a + 2]) * (p[c] - p[a]) - (p[b] - p[a]) * (p[c + 2] - p[a + 2]);
      if (areaY <= 1e-9) return true;
    }
    return false;
  });
}
