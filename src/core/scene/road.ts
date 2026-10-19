import { distance } from '../math';
import type { Project } from '../project/schema';
import { sampleAt, trackLength } from '../track/centerline';
import type { Sample } from '../track/centerline';
import { clampToBend, kerbWidth, LAYOUT } from '../track/layout';
import { addQuad, createMesh, offsetPoint } from './mesh';
import type { Mesh } from './mesh';

/** Driving surfaces built along the centerline. The names follow the Assetto Corsa surface prefixes. */
export interface RoadMeshes {
  road: Mesh;
  shoulders: Mesh;
  kerbRed: Mesh;
  kerbWhite: Mesh;
  markings: Mesh;
  pit: Mesh;
}

// Samples are guaranteed by the caller: at least two.
const at = (samples: readonly Sample[], s: number) => sampleAt(samples, s)!;

/** UVs of a strip: one texture tile every 4 m across and along the track. */
const stripUvs = (a: Sample, b: Sample, left: number, right: number): [number, number][] => [
  [left / 4, a.s / 4],
  [right / 4, a.s / 4],
  [right / 4, b.s / 4],
  [left / 4, b.s / 4],
];

/** A flat strip between two lateral offsets (left < right), facing up. */
function strip(mesh: Mesh, a: Sample, b: Sample, left: number, right: number, height = 0) {
  addQuad(
    mesh,
    [
      offsetPoint(a, left, height),
      offsetPoint(a, right, height),
      offsetPoint(b, right, height),
      offsetPoint(b, left, height),
    ],
    stripUvs(a, b, left, right),
  );
}

export function buildRoad(project: Project, samples: readonly Sample[]): RoadMeshes {
  const meshes: RoadMeshes = {
    road: createMesh('1ROAD_main', 'asphalt', 'surface'),
    shoulders: createMesh('1GRASS_verge', 'grass', 'surface'),
    kerbRed: createMesh('1KERB_red', 'kerbRed', 'surface'),
    kerbWhite: createMesh('1KERB_white', 'paint', 'surface'),
    markings: createMesh('road_markings', 'paint', 'surface'),
    pit: createMesh('1PIT_spawn', 'pit', 'surface'),
  };
  const road = project.road;
  const half = road.width / 2,
    kerb = kerbWidth(road),
    edge = half + kerb;
  // On the inside of a bend the shoulder narrows before reaching the centre of
  // curvature, so it never folds over itself on tight karting corners.
  const shoulder = (a: Sample, b: Sample, side: 1 | -1) => {
    const outer = (p: Sample) => side * clampToBend(road, p, side, edge + road.shoulder);
    const [la, ra] = side > 0 ? [edge, outer(a)] : [outer(a), -edge];
    const [lb, rb] = side > 0 ? [edge, outer(b)] : [outer(b), -edge];
    addQuad(meshes.shoulders, [
      offsetPoint(a, la, -0.04),
      offsetPoint(a, ra, -0.04),
      offsetPoint(b, rb, -0.04),
      offsetPoint(b, lb, -0.04),
    ]);
  };
  const line = LAYOUT.edgeLine;
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i],
      b = samples[i + 1];
    if (distance(a, b) < 0.0001) continue;
    strip(meshes.road, a, b, -half, half);
    shoulder(a, b, -1);
    shoulder(a, b, 1);
    strip(meshes.markings, a, b, -half + line.outer, -half + line.inner, 0.012);
    strip(meshes.markings, a, b, half - line.inner, half - line.outer, 0.012);
    if (road.kerbs) {
      // Kerb colours alternate every 5 m.
      const mesh = Math.floor(a.s / 5) % 2 ? meshes.kerbRed : meshes.kerbWhite;
      strip(mesh, a, b, -edge, -half, 0.025);
      strip(mesh, a, b, half, edge, 0.025);
    }
  }
  const length = trackLength(samples);
  const spawn = startPosition(samples);
  strip(
    meshes.pit,
    at(samples, Math.max(0, spawn.s - LAYOUT.pitLength / 2)),
    at(samples, Math.min(length, spawn.s + LAYOUT.pitLength / 2)),
    -edge - LAYOUT.pitDepth,
    -edge,
    0.04,
  );
  const start = startLine(samples);
  strip(meshes.markings, start, at(samples, start.s + 0.6), -half, half, 0.018);
  if (!project.road.closed) {
    const finish = length - LAYOUT.finishBeforeEnd;
    strip(meshes.markings, at(samples, finish), at(samples, finish + 0.6), -half, half, 0.018);
  }
  return meshes;
}

/** Where the car starts: a little after the beginning, leaving a run-up to the start line. */
export const startPosition = (samples: readonly Sample[]) =>
  at(samples, Math.min(LAYOUT.startPosition, trackLength(samples) * 0.1));

export const startLine = (samples: readonly Sample[]) =>
  at(samples, Math.min(LAYOUT.startLine, trackLength(samples) * 0.25));
