import type { PlanPoint } from '../math';
import { SIDES } from '../project/schema';
import type { Project, Side } from '../project/schema';
import type { Sample } from '../track/centerline';
import { besideShoulders, earthworkStations, sideProfiles } from '../track/earthworks';
import { pitLaneLayout } from '../track/pitLane';
import { SHOULDER_DROP } from './ground';
import { addVertex, createMesh, offsetPoint } from './mesh';
import type { Mesh } from './mesh';

/** Stations closer than this across the track are merged. */
const MERGE = 0.05;

/**
 * Strips of grass meshing the ground where earthworks shape it (docs/adr/0015):
 * the terrain grid is too coarse for a ditch. Each strip runs along the samples
 * where earthworks act on one side, plus one sample at each end, from the outer
 * edge of the shoulders out to where the earthworks end. Its first row is the
 * edge of the shoulders itself; the others take the ground height, so the terrain
 * cut around the strip meets it everywhere.
 */
export function buildEarthworks(
  project: Project,
  samples: readonly Sample[],
  height: (p: PlanPoint) => number,
): Mesh[] {
  if (!project.earthworks.length || samples.length < 2) return [];
  const profiles = sideProfiles(project, samples);
  const lane = pitLaneLayout(project, samples);
  const mesh = createMesh('1GRASS_earthwork', 'grass', 'terrain');
  for (const side of SIDES)
    for (const [first, last] of spans(samples.length, (i) => profiles.acting(i, side).length > 0)) {
      const stations = [0];
      for (let i = first; i <= last; i++)
        for (const { earthwork } of profiles.acting(i, side))
          stations.push(...earthworkStations(earthwork));
      stations.sort((a, b) => a - b);
      const across = stations.filter((b, k) => k === 0 || b - stations[k - 1] > MERGE);
      strip(project, lane, samples.slice(first, last + 1), side, across, height, mesh);
    }
  return mesh.indices.length ? [mesh] : [];
}

/** Runs of consecutive indices where `active` holds, each widened by one index at both ends. */
function spans(count: number, active: (i: number) => boolean): [number, number][] {
  const result: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    if (!active(i)) continue;
    const first = Math.max(0, i - 1);
    while (i + 1 < count && active(i + 1)) i++;
    const last = Math.min(count - 1, i + 1);
    const previous = result.at(-1);
    if (previous && previous[1] >= first) previous[1] = last;
    else result.push([first, last]);
  }
  return result;
}

function strip(
  project: Project,
  lane: ReturnType<typeof pitLaneLayout>,
  rows: readonly Sample[],
  side: Side,
  across: readonly number[],
  height: (p: PlanPoint) => number,
  mesh: Mesh,
) {
  const sign = side === 'right' ? 1 : -1;
  const points = rows.map((sample) =>
    across.map((beyond) => {
      const lateral = sign * besideShoulders(project, lane, sample, side, beyond);
      const [x, y, z] = offsetPoint(sample, lateral, -SHOULDER_DROP);
      return { x, z, y: beyond ? height({ x, z }) : y };
    }),
  );
  // Faces wind so they face up; those squeezed flat inside a tight bend are left
  // out, and the terrain fills their place.
  const faces: [number, number, number][] = [];
  const id = (row: number, station: number) => row * across.length + station;
  const flat = points.flat();
  const upward = (a: number, b: number, c: number) => {
    const [p, q, r] = [flat[a], flat[b], flat[c]];
    return (q.z - p.z) * (r.x - p.x) - (q.x - p.x) * (r.z - p.z) > 1e-6;
  };
  for (let row = 0; row < rows.length - 1; row++)
    for (let k = 0; k < across.length - 1; k++) {
      const quad = [
        [id(row, k), id(row, k + 1), id(row + 1, k)],
        [id(row, k + 1), id(row + 1, k + 1), id(row + 1, k)],
      ] as [number, number, number][];
      for (const [a, b, c] of quad) {
        const face: [number, number, number] = sign > 0 ? [a, b, c] : [a, c, b];
        if (upward(...face)) faces.push(face);
      }
    }
  // Smooth normals, from the faces around each vertex.
  const normals = flat.map(() => [0, 0, 0]);
  for (const face of faces) {
    const [a, b, c] = face.map((i) => flat[i]),
      u = [b.x - a.x, b.y - a.y, b.z - a.z],
      v = [c.x - a.x, c.y - a.y, c.z - a.z];
    const normal = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    for (const i of face) for (let axis = 0; axis < 3; axis++) normals[i][axis] += normal[axis];
  }
  const local = new Map<number, number>();
  for (const face of faces)
    for (const i of face) {
      if (!local.has(i)) {
        const p = flat[i],
          n = normals[i],
          length = Math.hypot(...n) || 1;
        // Same grass scale as the terrain, so the two meet without a seam.
        local.set(
          i,
          addVertex(
            mesh,
            [p.x, p.y, p.z],
            [n[0] / length, n[1] / length, n[2] / length],
            [p.x / 8, p.z / 8],
          ),
        );
      }
      mesh.indices.push(local.get(i)!);
    }
}
