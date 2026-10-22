import { bounds, clamp } from '../math';
import type { Bounds, PlanPoint, Vec3 } from '../math';
import type { Project } from '../project/schema';
import { SCULPT } from '../project/sculpt';
import { hillReach } from '../project/terrain';
import type { Sample } from '../track/centerline';
import { terrainBounds } from '../track/layout';
import { groundHeight } from './ground';
import { addVertex, createMesh, MAX_MESH_VERTICES, vertexCount, vertexPosition } from './mesh';
import type { Mesh } from './mesh';

/** Size of the terrain cells under a hill: a share of its size, within bounds, in metres. */
const HILL_STEP = { min: 2, perSize: 10, maxDivision: 8 };
/** Cells under painted relief are divided down to its grid, at most this many times a side. */
const SCULPT_DIVISION = 10;

// Terrain is a tiled height field with the actual road/verge/pit footprint cut out.
// Clipping the footprint (instead of hiding a plane under the road) keeps elevated
// routes attached to the ground without grass intersecting their driving surface.
export function buildTerrain(
  project: Project,
  samples: readonly Sample[],
  surfaces: readonly Mesh[],
): Mesh[] {
  if (samples.length < 2) return [];
  const extent = terrainBounds(project, samples),
    spanX = extent.maxX - extent.minX,
    spanZ = extent.maxZ - extent.minZ;
  const step = Math.max(18, Math.sqrt((spanX * spanZ) / 2400), Math.max(spanX, spanZ) / 180);
  const columns = Math.max(1, Math.ceil(spanX / step)),
    rows = Math.max(1, Math.ceil(spanZ / step));
  const dx = spanX / columns,
    dz = spanZ / rows,
    epsilon = 1e-7;
  const cells = new Map<number, number[]>(),
    triangles: { points: Vec3[]; bounds: Bounds }[] = [];
  const cellX = (x: number) => clamp(Math.floor((x - extent.minX) / dx), 0, columns - 1);
  const cellZ = (z: number) => clamp(Math.floor((z - extent.minZ) / dz), 0, rows - 1);
  const area = (poly: PlanPoint[]) =>
    poly.reduce((sum, p, i) => {
      const q = poly[(i + 1) % poly.length];
      return sum + (p.x - poly[0].x) * (q.z - poly[0].z) - (q.x - poly[0].x) * (p.z - poly[0].z);
    }, 0) / 2;
  const clean = (poly: PlanPoint[]) => {
    const result: PlanPoint[] = [];
    for (const p of poly) {
      const last = result.at(-1);
      if (!last || Math.hypot(p.x - last.x, p.z - last.z) > epsilon) result.push(p);
    }
    if (
      result.length > 1 &&
      Math.hypot(result[0].x - result.at(-1)!.x, result[0].z - result.at(-1)!.z) <= epsilon
    )
      result.pop();
    return result.length >= 3 && Math.abs(area(result)) > 1e-8 ? result : [];
  };
  const clip = (poly: PlanPoint[], a: PlanPoint, b: PlanPoint, inside: boolean) => {
    if (!poly.length) return [];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length < epsilon) return poly;
    const side = (p: PlanPoint) => ((b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x)) / length;
    const result = [];
    let previous = poly.at(-1)!,
      previousD = side(previous),
      previousIn = inside ? previousD >= 0 : previousD <= 0;
    for (const p of poly) {
      const d = side(p),
        currentIn = inside ? d >= 0 : d <= 0;
      if (currentIn !== previousIn) {
        const t = clamp(previousD / (previousD - d), 0, 1);
        result.push({
          x: previous.x + (p.x - previous.x) * t,
          z: previous.z + (p.z - previous.z) * t,
        });
      }
      if (currentIn) result.push(p);
      previous = p;
      previousD = d;
      previousIn = currentIn;
    }
    return clean(result);
  };
  const subtract = (poly: PlanPoint[], triangle: Vec3[]) => {
    let intersection = poly;
    for (let edge = 0; edge < 3 && intersection.length; edge++)
      intersection = clip(intersection, triangle[edge], triangle[(edge + 1) % 3], true);
    if (!intersection.length) return [poly];
    const outside = [];
    let remainder = poly;
    for (let edge = 0; edge < 3 && remainder.length; edge++) {
      const a = triangle[edge],
        b = triangle[(edge + 1) % 3];
      const part = clip(remainder, a, b, false);
      if (part.length) outside.push(part);
      remainder = clip(remainder, a, b, true);
    }
    return outside;
  };
  for (const surface of surfaces) {
    for (let i = 0; i < surface.indices.length; i += 3) {
      const points = surface.indices.slice(i, i + 3).map((index) => {
        const [x, y, z] = vertexPosition(surface, index);
        return { x, y, z };
      });
      if (Math.abs(area(points)) < 1e-8) continue;
      if (area(points) < 0) points.reverse();
      const bb = bounds(points),
        triangle = { points, bounds: bb };
      const index = triangles.push(triangle) - 1;
      for (let z = cellZ(bb.minZ); z <= cellZ(bb.maxZ); z++)
        for (let x = cellX(bb.minX); x <= cellX(bb.maxX); x++) {
          const key = z * columns + x;
          if (!cells.has(key)) cells.set(key, []);
          cells.get(key)!.push(index);
        }
    }
  }
  // Cells under a hill or painted relief are divided to show its shape
  // (docs/adr/0015, 0016); the alignment below stitches them to their
  // undivided neighbours.
  const hills = project.hills.map((hill) => ({
    hill,
    reach: hillReach(hill),
    step: Math.max(HILL_STEP.min, Math.min(hill.width, hill.depth) / HILL_STEP.perSize),
  }));
  const tile = SCULPT.cell * SCULPT.tile;
  const painted = new Set(project.sculpt.map((t) => `${t.i},${t.j}`));
  /** Whether painted relief reaches into the cell at (x, z), a tile's edge blending one cell further. */
  const underSculpt = (x: number, z: number) => {
    if (!painted.size) return false;
    for (let j = Math.floor((z - SCULPT.cell) / tile); j <= Math.floor((z + dz) / tile); j++)
      for (let i = Math.floor((x - SCULPT.cell) / tile); i <= Math.floor((x + dx) / tile); i++)
        if (painted.has(`${i},${j}`)) return true;
    return false;
  };
  const sculptDivision = Math.min(SCULPT_DIVISION, Math.ceil(Math.max(dx, dz) / SCULPT.cell));
  const division = (x: number, z: number) =>
    hills.reduce(
      (n, { hill, reach, step }) =>
        x > hill.x + reach ||
        x + dx < hill.x - reach ||
        z > hill.z + reach ||
        z + dz < hill.z - reach
          ? n
          : Math.max(n, Math.min(HILL_STEP.maxDivision, Math.ceil(Math.max(dx, dz) / step))),
      underSculpt(x, z) ? sculptDivision : 1,
    );
  const polygons = [];
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++) {
      const x = extent.minX + column * dx,
        z = extent.minZ + row * dz;
      const n = division(x, z);
      let parts = Array.from({ length: n * n }, (_, k) => {
        const x0 = x + (dx * (k % n)) / n,
          x1 = x + (dx * ((k % n) + 1)) / n,
          z0 = z + (dz * Math.floor(k / n)) / n,
          z1 = z + (dz * (Math.floor(k / n) + 1)) / n;
        return [
          { x: x0, z: z0 },
          { x: x1, z: z0 },
          { x: x1, z: z1 },
          { x: x0, z: z1 },
        ];
      });
      for (const index of cells.get(row * columns + column) || []) {
        const triangle = triangles[index],
          bb = triangle.bounds;
        parts = parts.flatMap((poly) => {
          const pbb = bounds(poly);
          if (
            pbb.maxX < bb.minX - epsilon ||
            pbb.minX > bb.maxX + epsilon ||
            pbb.maxZ < bb.minZ - epsilon ||
            pbb.minZ > bb.maxZ + epsilon
          )
            return [poly];
          return subtract(poly, triangle.points);
        });
        if (!parts.length) break;
      }
      polygons.push(...parts);
    }

  // Shared vertices and edge subdivision remove T-junctions introduced by cuts:
  // neighboring patches must use the same heights all along their common edge.
  const points: Vec3[] = [],
    pointMap = new Map<string, number>(),
    pointCells = new Map<number, number[]>();
  const pointId = (p: PlanPoint): number => {
    const key = `${Math.round(p.x * 1e8)},${Math.round(p.z * 1e8)}`;
    if (pointMap.has(key)) return pointMap.get(key)!;
    const id = points.length;
    points.push({ x: p.x, z: p.z, y: 0 });
    pointMap.set(key, id);
    const bucket = cellZ(p.z) * columns + cellX(p.x);
    if (!pointCells.has(bucket)) pointCells.set(bucket, []);
    pointCells.get(bucket)!.push(id);
    return id;
  };
  const indexed = polygons.map((poly) => poly.map(pointId));
  // Keep every surface corner available when subdividing the cut boundary.
  // Collinear road/verge end caps still need a vertex at each height change.
  for (const triangle of triangles) for (const point of triangle.points) pointId(point);
  const aligned = indexed.map((poly) => {
    const result = [];
    for (let i = 0; i < poly.length; i++) {
      const start = poly[i],
        end = poly[(i + 1) % poly.length],
        a = points[start],
        b = points[end];
      const vx = b.x - a.x,
        vz = b.z - a.z,
        length2 = vx * vx + vz * vz;
      if (length2 < epsilon * epsilon) continue;
      const between = [];
      for (
        let row = cellZ(Math.min(a.z, b.z) - epsilon);
        row <= cellZ(Math.max(a.z, b.z) + epsilon);
        row++
      ) {
        for (
          let column = cellX(Math.min(a.x, b.x) - epsilon);
          column <= cellX(Math.max(a.x, b.x) + epsilon);
          column++
        ) {
          for (const id of pointCells.get(row * columns + column) || []) {
            if (id === start || id === end) continue;
            const p = points[id],
              t = ((p.x - a.x) * vx + (p.z - a.z) * vz) / length2;
            if (
              t > 1e-8 &&
              t < 1 - 1e-8 &&
              Math.abs(vx * (p.z - a.z) - vz * (p.x - a.x)) < Math.sqrt(length2) * 1e-8
            )
              between.push({ id, t });
          }
        }
      }
      between.sort((a, b) => a.t - b.t);
      result.push(start, ...between.map((item) => item.id));
    }
    return result;
  });
  const ground = groundHeight(project, samples);
  const heightAt = (p: PlanPoint) => {
    let border = -Infinity;
    for (let row = cellZ(p.z - 2e-6); row <= cellZ(p.z + 2e-6); row++) {
      for (let column = cellX(p.x - 2e-6); column <= cellX(p.x + 2e-6); column++) {
        for (const index of cells.get(row * columns + column) || []) {
          const [a, b, c] = triangles[index].points;
          const denominator = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
          const u = ((b.z - c.z) * (p.x - c.x) + (c.x - b.x) * (p.z - c.z)) / denominator;
          const v = ((c.z - a.z) * (p.x - c.x) + (a.x - c.x) * (p.z - c.z)) / denominator;
          const w = 1 - u - v;
          if (Math.min(u, v, w) >= -1e-6) border = Math.max(border, u * a.y + v * b.y + w * c.y);
        }
      }
    }
    return Number.isFinite(border) ? border : ground(p);
  };
  for (const id of new Set(aligned.flat())) points[id].y = heightAt(points[id]);
  const faces = [];
  for (const poly of aligned) {
    if (poly.length < 3) continue;
    const center = { x: 0, z: 0, y: 0 };
    for (const id of poly) {
      center.x += points[id].x / poly.length;
      center.z += points[id].z / poly.length;
    }
    center.y = heightAt(center);
    const centerId = points.push(center) - 1;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length];
      if (Math.abs(area([center, points[a], points[b]])) > 1e-9) faces.push([centerId, b, a]);
    }
  }
  const normals = points.map(() => [0, 0, 0]);
  for (const face of faces) {
    const [a, b, c] = face.map((id) => points[id]),
      u = [b.x - a.x, b.y - a.y, b.z - a.z],
      v = [c.x - a.x, c.y - a.y, c.z - a.z];
    const normal = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    for (const id of face) for (let axis = 0; axis < 3; axis++) normals[id][axis] += normal[axis];
  }
  const meshes: Mesh[] = [];
  let mesh!: Mesh, local!: Map<number, number>;
  const nextMesh = () => {
    mesh = createMesh(`1GRASS_terrain_${meshes.length}`, 'grass', 'terrain');
    local = new Map();
    meshes.push(mesh);
  };
  nextMesh();
  for (const face of faces) {
    if (vertexCount(mesh) + face.filter((id) => !local.has(id)).length > MAX_MESH_VERTICES)
      nextMesh();
    for (const id of face) {
      if (!local.has(id)) {
        const p = points[id],
          n = normals[id],
          length = Math.hypot(...n) || 1;
        local.set(
          id,
          addVertex(
            mesh,
            [p.x, p.y, p.z],
            [n[0] / length, n[1] / length, n[2] / length],
            [p.x / 8, p.z / 8],
          ),
        );
      }
      mesh.indices.push(local.get(id)!);
    }
  }
  return meshes.filter((mesh) => mesh.indices.length);
}
