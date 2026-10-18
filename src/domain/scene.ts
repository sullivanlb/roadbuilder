import type { Project, Sample, Scene, Mesh, Marker } from './types';
import { distance } from './project';
import { sampleTrack, sampleAt } from './geometry';
import { newMesh, offsetPoint, addQuad } from './mesh';
import { buildBarrierMeshes } from './barriers';
import { buildTerrain } from './terrain';
// Scene construction requires at least two samples; checked at the entry point.
const at = (samples: Sample[], s: number): Sample => sampleAt(samples, s)!;
// KN5 uses uint16 vertex indices; split large meshes on quad boundaries.
function splitMesh(mesh: Mesh): Mesh[] {
  const pieces: Mesh[] = [];
  for (let begin = 0; begin < mesh.vertices.length; begin += 60000) {
    const vertices = mesh.vertices.slice(begin, begin + 60000);
    const indices = mesh.indices
      .slice((begin / 4) * 6, ((begin + vertices.length) / 4) * 6)
      .map((i) => i - begin);
    pieces.push({
      name: `${mesh.name}_${begin / 60000}`,
      material: mesh.material,
      vertices,
      indices,
      barrier: mesh.barrier,
      renderable: mesh.renderable,
    });
  }
  return pieces;
}
function buildScene(project: Project, samples = sampleTrack(project)): Scene {
  if (samples.length < 2) return { meshes: [], markers: [], samples };
  const road = newMesh('1ROAD_main', 0),
    grass = newMesh('1GRASS_verge', 1);
  const red = newMesh('1KERB_red', 2),
    white = newMesh('1KERB_white', 3),
    paint = newMesh('road_markings', 3);
  const pit = newMesh('1PIT_spawn', 4);
  const half = project.width / 2,
    kerb = project.kerbs ? 0.65 : 0;
  const strip = (mesh: Mesh, a: Sample, b: Sample, left: number, right: number, height = 0) =>
    addQuad(
      mesh,
      [
        offsetPoint(a, left, height),
        offsetPoint(a, right, height),
        offsetPoint(b, right, height),
        offsetPoint(b, left, height),
      ],
      [
        [left / 4, a.s / 4],
        [right / 4, a.s / 4],
        [right / 4, b.s / 4],
        [left / 4, b.s / 4],
      ],
    );
  // Narrow the inner verge before it reaches the curve's center of curvature.
  // This avoids folded/inverted terrain on tight karting corners.
  const verge = (a: Sample, b: Sample, side: number) => {
    const inner = side * (half + kerb);
    const outer = (p: Sample) => {
      const curvature = (p.curvature || 0) * side;
      const limit = curvature > 0 ? Math.max(half + kerb + 0.05, 0.8 / curvature) : Infinity;
      return side * Math.min(half + kerb + project.shoulder, limit);
    };
    const offsetsA = side > 0 ? [inner, outer(a)] : [outer(a), inner];
    const offsetsB = side > 0 ? [inner, outer(b)] : [outer(b), inner];
    addQuad(grass, [
      offsetPoint(a, offsetsA[0], -0.04),
      offsetPoint(a, offsetsA[1], -0.04),
      offsetPoint(b, offsetsB[1], -0.04),
      offsetPoint(b, offsetsB[0], -0.04),
    ]);
  };
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i],
      b = samples[i + 1];
    if (distance(a, b) < 0.0001) continue;
    // Positive lateral is to the driver's right in the X/Z plane; faces point up.
    strip(road, a, b, -half, half);
    verge(a, b, -1);
    verge(a, b, 1);
    strip(paint, a, b, -half + 0.18, -half + 0.33, 0.012);
    strip(paint, a, b, half - 0.33, half - 0.18, 0.012);
    if (project.kerbs) {
      const m = Math.floor(a.s / 5) % 2 ? red : white;
      strip(m, a, b, -half - kerb, -half, 0.025);
      strip(m, a, b, half, half + kerb, 0.025);
    }
  }
  const length = samples.at(-1)!.s;
  const spawn = at(samples, Math.min(12, length * 0.1));
  const pitOffset = -(half + kerb + 2.1);
  const pitA = at(samples, Math.max(0, spawn.s - 8));
  const pitB = at(samples, Math.min(length, spawn.s + 8));
  strip(pit, pitA, pitB, -half - kerb - 4.2, -half - kerb, 0.04);
  // Start/finish line a little after spawn, leaving a useful run-up.
  const startS = Math.min(28, length * 0.25),
    start = at(samples, startS);
  strip(paint, start, at(samples, startS + 0.6), -half, half, 0.018);
  if (!project.closed)
    strip(paint, at(samples, length - 12), at(samples, length - 11.4), -half, half, 0.018);
  const markers: Marker[] = [];
  const marker = (name: string, p: Sample, lateral = 0, lift = 0) => {
    const [x, y, z] = offsetPoint(p, lateral, lift);
    // AC dummy convention: local Y up, local -Z forward. Include road grade.
    const tangent = [p.nz, p.grade, -p.nx];
    const l = Math.hypot(...tangent),
      forward = tangent.map((v) => v / l);
    const right = [p.nx, 0, p.nz];
    const up = [
      -forward[1] * right[2],
      right[2] * forward[0] - right[0] * forward[2],
      right[0] * forward[1],
    ];
    markers.push({
      name,
      transform: [...right, 0, ...up, 0, ...forward.map((v) => -v), 0, x, y, z, 1],
    });
  };
  marker('AC_START_0', spawn, 0, 0.25);
  marker('AC_HOTLAP_START_0', spawn, 0, 0.25);
  marker('AC_PIT_0', spawn, pitOffset, 0.3);
  const timing = (number: number, at: Sample) => {
    marker(`AC_TIME_${number}_L`, at, -half - 1);
    marker(`AC_TIME_${number}_R`, at, half + 1);
  };
  timing(0, start);
  timing(1, at(samples, project.closed ? length / 3 : length / 2));
  timing(2, at(samples, project.closed ? (2 * length) / 3 : length - 12));
  // Barriers: invisible 1WALL colliders + visible decors, on the same samples as the track.
  const meshes = [];
  for (const mesh of [road, grass, red, white, paint, pit, ...buildBarrierMeshes(project, samples)])
    meshes.push(...splitMesh(mesh));
  const terrain = buildTerrain(project, samples, [road, grass, red, white, pit]);
  meshes.push(...terrain.meshes);
  return { meshes, markers, samples, terrainBounds: terrain.bounds ?? undefined };
}
export { buildScene };
