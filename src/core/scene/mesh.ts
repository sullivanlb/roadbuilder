import type { Vec3 } from '../math';
import type { MaterialId } from './materials';

/**
 * What a mesh is for. `surface` and `terrain` are driven on and face up;
 * `barrier` meshes are vertical and excluded from the fold-back check.
 */
export type MeshKind = 'surface' | 'terrain' | 'barrier';

/**
 * Triangle mesh with flat attribute arrays: 3 numbers per position and normal,
 * 2 per UV, 3 indices per triangle. The layout feeds WebGL buffers and the
 * exporters without conversion.
 */
export interface Mesh {
  name: string;
  material: MaterialId;
  kind: MeshKind;
  /** False for colliders: kept for collisions, never drawn. */
  visible: boolean;
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

export type Triple = [number, number, number];
export type Pair = [number, number];

export function createMesh(
  name: string,
  material: MaterialId,
  kind: MeshKind,
  visible = true,
): Mesh {
  return { name, material, kind, visible, positions: [], normals: [], uvs: [], indices: [] };
}

export const vertexCount = (mesh: Mesh) => mesh.positions.length / 3;

export function vertexPosition(mesh: Mesh, index: number): Triple {
  return [mesh.positions[index * 3], mesh.positions[index * 3 + 1], mesh.positions[index * 3 + 2]];
}

export function addVertex(mesh: Mesh, position: Triple, normal: Triple, uv: Pair): number {
  mesh.positions.push(...position);
  mesh.normals.push(...normal);
  mesh.uvs.push(...uv);
  return vertexCount(mesh) - 1;
}

const DEFAULT_UVS: Pair[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

/** Adds a flat quad (two triangles) whose normal follows the winding a → b → c. */
export function addQuad(mesh: Mesh, corners: Triple[], uvs: Pair[] = DEFAULT_UVS) {
  const [a, b, c] = corners;
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
    v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const normal: Triple = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const length = Math.hypot(...normal) || 1;
  for (let i = 0; i < 3; i++) normal[i] /= length;
  const first = vertexCount(mesh);
  corners.forEach((corner, i) => addVertex(mesh, corner, normal, uvs[i]));
  mesh.indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
}

/** A point beside the centerline: `lateral` metres to the right (negative: left), lifted by `height`. */
export function offsetPoint(
  sample: Vec3 & { nx: number; nz: number },
  lateral: number,
  height = 0,
): Triple {
  return [sample.x + sample.nx * lateral, sample.y + height, sample.z + sample.nz * lateral];
}

/** KN5 indexes vertices with 16 bits: larger meshes are split. */
export const MAX_MESH_VERTICES = 60000;

/** Splits a quad-based mesh into pieces small enough for 16-bit indices; an empty mesh yields none. */
export function splitMesh(mesh: Mesh): Mesh[] {
  const count = vertexCount(mesh);
  const pieces: Mesh[] = [];
  for (let begin = 0, part = 0; begin < count; begin += MAX_MESH_VERTICES, part++) {
    const end = Math.min(count, begin + MAX_MESH_VERTICES);
    pieces.push({
      ...mesh,
      name: `${mesh.name}_${part}`,
      positions: mesh.positions.slice(begin * 3, end * 3),
      normals: mesh.normals.slice(begin * 3, end * 3),
      uvs: mesh.uvs.slice(begin * 2, end * 2),
      // Quads: 4 vertices for 6 indices, so a split on a vertex multiple of 4 never cuts a quad.
      indices: mesh.indices.slice((begin / 4) * 6, (end / 4) * 6).map((index) => index - begin),
    });
  }
  return pieces;
}
