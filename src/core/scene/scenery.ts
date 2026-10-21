import type { PlanPoint } from '../math';
import { headingVector, sceneryFootprint } from '../project/scenery';
import type { Project, SceneryItem } from '../project/schema';
import type { Sample } from '../track/centerline';
import { groundHeight } from './ground';
import type { Mesh } from './mesh';
import { building } from './scenery/buildings';
import { grandstand } from './scenery/grandstands';
import { Parts } from './scenery/kit';
import type { ItemFrame, SceneLight } from './scenery/kit';
import { light, sign } from './scenery/props';
import { trees } from './scenery/trees';

/**
 * Scenery items stand free on the plan (docs/adr/0013), on the terrain as it is
 * meshed, detailed with the assets made in Blender (docs/adr/0014). Each kind
 * is built by its own module under scenery/.
 */

type Builder = (
  parts: Parts,
  frame: ItemFrame,
  item: SceneryItem,
  heightAt: (p: PlanPoint) => number,
) => void;

const BUILDERS: Record<SceneryItem['kind'], Builder> = {
  tree: trees,
  building,
  grandstand,
  sign,
  light,
};

/**
 * A height lookup over the ground meshes: the height of the triangle under a
 * place on the plan, or null outside them.
 */
export function meshHeight(meshes: readonly Mesh[]): (p: PlanPoint) => number | null {
  const CELL = 20;
  const cells = new Map<string, number[][]>();
  for (const mesh of meshes) {
    const p = mesh.positions;
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const corners = [0, 1, 2].map((k) => mesh.indices[i + k] * 3);
      const triangle = corners.flatMap((c) => [p[c], p[c + 1], p[c + 2]]);
      const xs = [triangle[0], triangle[3], triangle[6]],
        zs = [triangle[2], triangle[5], triangle[8]];
      for (let x = Math.floor(Math.min(...xs) / CELL); x <= Math.floor(Math.max(...xs) / CELL); x++)
        for (
          let z = Math.floor(Math.min(...zs) / CELL);
          z <= Math.floor(Math.max(...zs) / CELL);
          z++
        ) {
          const key = `${x},${z}`;
          if (!cells.has(key)) cells.set(key, []);
          cells.get(key)!.push(triangle);
        }
    }
  }
  return ({ x, z }) => {
    let found: number | null = null;
    for (const [ax, ay, az, bx, by, bz, cx, cy, cz] of cells.get(
      `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`,
    ) ?? []) {
      const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(det) < 1e-12) continue;
      const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det,
        l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det,
        l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      const y = l1 * ay + l2 * by + l3 * cy;
      // Where markings lie over the road, the road below holds the item.
      found = found === null ? y : Math.min(found, y);
    }
    return found;
  };
}

/** The places an item is checked for the height of its floor: its centre, corners and edges. */
function floorProbes(item: SceneryItem): PlanPoint[] {
  const corners = sceneryFootprint(item);
  const probes = [{ x: item.x, z: item.z }, ...corners];
  corners.forEach((corner, i) => {
    const next = corners[(i + 1) % corners.length];
    probes.push({ x: (corner.x + next.x) / 2, z: (corner.z + next.z) / 2 });
  });
  return probes;
}

export interface SceneryOutput {
  meshes: Mesh[];
  lights: SceneLight[];
  /** Height of each item's floor, by ID: where it stands. */
  floors: Record<string, number>;
}

/**
 * The scenery of a project standing on `ground`, the meshes it may stand on.
 * An item's floor is the lowest ground under its footprint; a grove's trees each
 * stand on the ground under them.
 */
export function buildScenery(
  project: Project,
  samples: readonly Sample[],
  ground: readonly Mesh[],
): SceneryOutput {
  if (!project.scenery.length) return { meshes: [], lights: [], floors: {} };
  const onMesh = meshHeight(ground);
  const smooth = groundHeight(project, samples);
  const heightAt = (p: PlanPoint) => onMesh(p) ?? smooth(p);
  const parts = new Parts();
  const floors: Record<string, number> = {};
  for (const item of project.scenery) {
    const front = headingVector(item.heading);
    // The trees of a grove each stand on the ground under them; the floor of
    // anything else is the lowest ground under its footprint.
    const y = item.kind === 'tree' ? heightAt(item) : Math.min(...floorProbes(item).map(heightAt));
    floors[item.id] = y;
    BUILDERS[item.kind](
      parts,
      { x: item.x, z: item.z, y, fx: front.x, fz: front.z },
      item,
      heightAt,
    );
  }
  const meshes = [...parts.meshes.values()];
  if (parts.collider.indices.length) meshes.push(parts.collider);
  return { meshes, lights: parts.lights, floors };
}
