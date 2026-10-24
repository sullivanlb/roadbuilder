import { clamp } from '../math';
import type { Vec3 } from '../math';
import type { MaterialId } from './materials';

/**
 * What a mesh is for. `surface` and `terrain` are driven on and face up;
 * `barrier` and `scenery` meshes stand on them and are excluded from the
 * fold-back check.
 */
export type MeshKind = 'surface' | 'terrain' | 'barrier' | 'scenery';

/**
 * What of the track a mesh shows: the editor dims or hides it with that layer,
 * and shows the roadway on every one. Names stay what the game reads
 * (docs/adr/0005): the part is told beside them, not read from them.
 */
export type MeshPart = 'roadway' | 'pits' | 'edges' | 'terrain' | 'scenery';

/** The part a mesh of a kind shows, unless it is told otherwise. */
const KIND_PART: Record<MeshKind, MeshPart> = {
  surface: 'roadway',
  terrain: 'terrain',
  barrier: 'edges',
  scenery: 'scenery',
};

/**
 * Triangle mesh with flat attribute arrays: 3 numbers per position and normal,
 * 2 per UV, 3 indices per triangle. The layout feeds WebGL buffers and the
 * exporters without conversion.
 */
export interface Mesh {
  name: string;
  material: MaterialId;
  kind: MeshKind;
  part: MeshPart;
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
  part = KIND_PART[kind],
): Mesh {
  return { name, material, kind, part, visible, positions: [], normals: [], uvs: [], indices: [] };
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

/** A place on the centerline with what is needed to step across the track. */
export type CrossFrame = Vec3 & { nx: number; nz: number; bank: number; edge: number };

/**
 * Height of the ground `lateral` metres to the right of the centerline (negative:
 * left), above the centerline. A bank zone tilts the roadway and kerbs about their
 * low edge, which keeps the altitude of the track, so the raised side climbs and
 * nothing sinks into the ground; beyond the kerbs the ground stays flat at the
 * height of their edge.
 */
export const bankLift = (frame: Pick<CrossFrame, 'bank' | 'edge'>, lateral: number) =>
  (clamp(lateral, -frame.edge, frame.edge) + Math.sign(frame.bank) * frame.edge) * frame.bank;

/** A point beside the centerline: `lateral` metres to the right (negative: left), lifted by `height` above the ground. */
export function offsetPoint(frame: CrossFrame, lateral: number, height = 0): Triple {
  return [
    frame.x + frame.nx * lateral,
    frame.y + bankLift(frame, lateral) + height,
    frame.z + frame.nz * lateral,
  ];
}

/** KN5 indexes vertices with 16 bits: larger meshes are split. */
export const MAX_MESH_VERTICES = 60000;

/**
 * Splits a triangle mesh into pieces small enough for 16-bit indices, keeping
 * whole triangles and the vertices they use; an empty mesh yields none.
 */
export function splitTriangles(mesh: Mesh): Mesh[] {
  const pieces: Mesh[] = [];
  let piece: Mesh | null = null,
    remap = new Map<number, number>();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const corners = mesh.indices.slice(i, i + 3);
    const fresh = corners.filter((index) => !remap.has(index)).length;
    if (!piece || vertexCount(piece) + fresh > MAX_MESH_VERTICES) {
      piece = {
        ...mesh,
        name: `${mesh.name}_${pieces.length}`,
        positions: [],
        normals: [],
        uvs: [],
        indices: [],
      };
      pieces.push(piece);
      remap = new Map();
    }
    for (const index of corners) {
      let mapped = remap.get(index);
      if (mapped === undefined) {
        mapped = addVertex(
          piece,
          vertexPosition(mesh, index),
          [mesh.normals[index * 3], mesh.normals[index * 3 + 1], mesh.normals[index * 3 + 2]],
          [mesh.uvs[index * 2], mesh.uvs[index * 2 + 1]],
        );
        remap.set(index, mapped);
      }
      piece.indices.push(mapped);
    }
  }
  return pieces;
}

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
