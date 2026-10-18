import type { Mesh, Sample } from './types';
const MATERIALS = [
  { name: 'asphalt', color: [67, 72, 76], texture: 'asphalt.png' },
  { name: 'grass', color: [76, 103, 62], texture: 'grass.png' },
  { name: 'kerb_red', color: [184, 57, 48], texture: 'kerb_red.png' },
  { name: 'paint', color: [224, 225, 211], texture: 'paint.png' },
  { name: 'pit', color: [87, 91, 91], texture: 'pit.png' },
];

function newMesh(name: string, material: number): Mesh {
  return { name, material, vertices: [], indices: [] };
}

function addQuad(mesh: Mesh, positions: number[][], uvs?: number[][]) {
  const index = mesh.vertices.length;
  const a = positions[0],
    b = positions[1],
    c = positions[2];
  const u = b.map((n, i) => n - a[i]),
    v = c.map((n, i) => n - a[i]);
  let normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const length = Math.hypot(...normal) || 1;
  normal = normal.map((n) => n / length);
  positions.forEach((position, i) =>
    mesh.vertices.push({
      position,
      normal,
      uv:
        uvs?.[i] ||
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ][i],
      tangent: [1, 0, 0],
    }),
  );
  mesh.indices.push(index, index + 1, index + 2, index, index + 2, index + 3);
}

function offsetPoint(p: Sample, offset: number, height = 0) {
  return [p.x + p.nx * offset, p.y + height, p.z + p.nz * offset];
}
export { MATERIALS, newMesh, addQuad, offsetPoint };
