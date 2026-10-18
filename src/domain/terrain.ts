import type { Point, PlanPoint, Project, Sample, Mesh, Bounds } from './types';
import { DEFAULT_TERRAIN_MARGIN, clamp } from './project';
import { bounds, sampleTrack } from './geometry';
import { newMesh } from './mesh';
function terrainBounds(project: Project, samples = sampleTrack(project)) {
  return bounds(
    samples,
    project.width / 2 +
      (project.kerbs ? 0.65 : 0) +
      Math.max(project.shoulder, 4.2) +
      (project.terrainMargin ?? DEFAULT_TERRAIN_MARGIN),
  );
}

// Terrain is a tiled height field with the actual road/verge/pit footprint cut out.
// Clipping the footprint (instead of hiding a plane under the road) keeps elevated
// routes attached to the ground without grass intersecting their driving surface.
function buildTerrain(project: Project, samples: Sample[], surfaces: Mesh[]) {
  if (samples.length < 2) return { meshes: [], bounds: null };
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
    triangles: { points: Point[]; bounds: Bounds }[] = [];
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
  const subtract = (poly: PlanPoint[], triangle: Point[]) => {
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
        const p = surface.vertices[index].position;
        return { x: p[0], y: p[1], z: p[2] };
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
  const polygons = [];
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++) {
      const x = extent.minX + column * dx,
        z = extent.minZ + row * dz;
      let parts = [
        [
          { x, z },
          { x: x + dx, z },
          { x: x + dx, z: z + dz },
          { x, z: z + dz },
        ],
      ];
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
  const points: Point[] = [],
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
  const anchors = samples.filter((_, i) => i % Math.max(1, Math.ceil(samples.length / 400)) === 0);
  if (anchors.at(-1) !== samples.at(-1)!) anchors.push(samples.at(-1)!);
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
    if (Number.isFinite(border)) return border;
    let weighted = 0,
      total = 0;
    for (const a of anchors) {
      const d2 = (p.x - a.x) ** 2 + (p.z - a.z) ** 2 + 36,
        weight = 1 / (d2 * Math.sqrt(d2));
      weighted += weight * (a.y - 0.04);
      total += weight;
    }
    return weighted / total;
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
    mesh = newMesh(`1GRASS_terrain_${meshes.length}`, 1);
    mesh.terrain = true;
    local = new Map();
    meshes.push(mesh);
  };
  nextMesh();
  for (const face of faces) {
    if (mesh.vertices.length + face.filter((id) => !local.has(id)).length > 60000) nextMesh();
    for (const id of face) {
      if (!local.has(id)) {
        const p = points[id],
          n = normals[id],
          length = Math.hypot(...n) || 1;
        local.set(id, mesh.vertices.length);
        mesh.vertices.push({
          position: [p.x, p.y, p.z],
          normal: n.map((value) => value / length),
          uv: [p.x / 8, p.z / 8],
          tangent: [1, 0, 0],
        });
      }
      mesh.indices.push(local.get(id)!);
    }
  }
  return { meshes: meshes.filter((mesh) => mesh.indices.length), bounds: extent };
}
export { terrainBounds, buildTerrain };
