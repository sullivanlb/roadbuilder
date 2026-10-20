import { distance } from '../math';
import { isCircuit } from '../project/schema';
import type { Project, Side } from '../project/schema';
import { sampleAt, trackLength } from '../track/centerline';
import type { Sample } from '../track/centerline';
import { clampToBend, kerbWidth, LAYOUT, roadEdge } from '../track/layout';
import { pitLaneLayout, sideEdge } from '../track/pitLane';
import type { PitLaneLayout } from '../track/pitLane';
import { positionDistance, startLinePosition, wrapDistance } from '../track/positions';
import { addQuad, createMesh, offsetPoint } from './mesh';
import type { Mesh } from './mesh';

/** Driving surfaces built along the centerline. The names follow the Assetto Corsa surface prefixes. */
export interface RoadMeshes {
  road: Mesh;
  shoulders: Mesh;
  kerbRed: Mesh;
  kerbWhite: Mesh;
  markings: Mesh;
  /** The pit lane, or the pad beside the start position on a track without one. */
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

/** A flat strip between two lateral offsets (left < right) at each end, facing up. */
function strip(
  mesh: Mesh,
  a: Sample,
  b: Sample,
  [leftA, rightA]: [number, number],
  [leftB, rightB]: [number, number] = [leftA, rightA],
  height = 0,
) {
  addQuad(
    mesh,
    [
      offsetPoint(a, leftA, height),
      offsetPoint(a, rightA, height),
      offsetPoint(b, rightB, height),
      offsetPoint(b, leftB, height),
    ],
    stripUvs(a, b, leftA, rightA),
  );
}

/** Lateral span between two unsigned distances on one side, ordered left to right. */
const across = (sign: 1 | -1, inner: number, outer: number): [number, number] =>
  sign > 0 ? [inner, outer] : [-outer, -inner];

export function buildRoad(project: Project, samples: readonly Sample[]): RoadMeshes {
  const lane = pitLaneLayout(project, samples);
  const meshes: RoadMeshes = {
    road: createMesh('1ROAD_main', 'asphalt', 'surface'),
    shoulders: createMesh('1GRASS_verge', 'grass', 'surface'),
    kerbRed: createMesh('1KERB_red', 'kerbRed', 'surface'),
    kerbWhite: createMesh('1KERB_white', 'paint', 'surface'),
    markings: createMesh('road_markings', 'paint', 'surface'),
    pit: createMesh(lane ? '1PIT_lane' : '1PIT_spawn', 'pit', 'surface'),
  };
  const road = project.road,
    kerb = kerbWidth(road);
  // Shoulders start beyond the kerb, or beyond the pit lane where it runs. On the
  // inside of a bend they narrow before the centre of curvature, so they never
  // fold over themselves on tight karting corners.
  const shoulder = (a: Sample, b: Sample, side: Side) => {
    const sign = side === 'right' ? 1 : -1;
    const inner = (p: Sample) => sideEdge(project, lane, p, side);
    const outer = (p: Sample) => clampToBend(road, p, sign, inner(p) + road.shoulder);
    strip(
      meshes.shoulders,
      a,
      b,
      across(sign, inner(a), Math.max(inner(a), outer(a))),
      across(sign, inner(b), Math.max(inner(b), outer(b))),
      -0.04,
    );
  };
  const line = LAYOUT.edgeLine;
  // Lateral spans measured from each roadway edge, symmetric on both sides; the
  // roadway may change width between a and b inside a width zone.
  const both = (a: Sample, b: Sample, from: number, to: number) =>
    [
      [
        [-a.half - to, -a.half - from],
        [-b.half - to, -b.half - from],
      ],
      [
        [a.half + from, a.half + to],
        [b.half + from, b.half + to],
      ],
    ] as [number, number][][];
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i],
      b = samples[i + 1];
    if (distance(a, b) < 0.0001) continue;
    strip(meshes.road, a, b, [-a.half, a.half], [-b.half, b.half]);
    shoulder(a, b, 'left');
    shoulder(a, b, 'right');
    for (const [atA, atB] of both(a, b, -line.inner, -line.outer))
      strip(meshes.markings, a, b, atA, atB, 0.012);
    if (road.kerbs) {
      // Kerb colours alternate every 5 m.
      const mesh = Math.floor(a.s / 5) % 2 ? meshes.kerbRed : meshes.kerbWhite;
      for (const [atA, atB] of both(a, b, 0, kerb)) strip(mesh, a, b, atA, atB, 0.025);
    }
    if (lane) pitLaneStrip(meshes.pit, lane, a, b);
  }
  if (!lane) {
    const spawn = startPosition(project, samples),
      length = trackLength(samples);
    const a = at(samples, Math.max(0, spawn.s - LAYOUT.spawnPad.length / 2)),
      b = at(samples, Math.min(length, spawn.s + LAYOUT.spawnPad.length / 2));
    const pad = (p: Sample): [number, number] => {
      const edge = roadEdge(road, p);
      return [-edge - LAYOUT.spawnPad.depth, -edge];
    };
    strip(meshes.pit, a, b, pad(a), pad(b), 0.04);
  }
  const crossLine = (from: Sample) => {
    const to = at(samples, from.s + 0.6);
    strip(meshes.markings, from, to, [-from.half, from.half], [-to.half, to.half], 0.018);
  };
  crossLine(startLine(project, samples));
  if (!project.road.closed) crossLine(at(samples, trackLength(samples) - LAYOUT.finishBeforeEnd));
  return meshes;
}

/** The pit lane surface between two samples, from the kerb edge out to the lane's outer edge. */
function pitLaneStrip(mesh: Mesh, lane: PitLaneLayout, a: Sample, b: Sample) {
  const pa = lane.profile(a.s),
    pb = lane.profile(b.s);
  // Both ends must be in the lane, and in the same pass (not across the end of the lane).
  if (!pa || !pb || lane.along(b.s)! < lane.along(a.s)!) return;
  strip(
    mesh,
    a,
    b,
    across(lane.sign, pa.edge, pa.outer),
    across(lane.sign, pb.edge, pb.outer),
    0.02,
  );
}

/** The start line, as placed in the project. */
export function startLine(project: Project, samples: readonly Sample[]): Sample {
  const position = startLinePosition(project);
  const s = position ? (positionDistance(project, samples, position) ?? 0) : 0;
  return at(samples, s);
}

/** Where a single car starts: a little behind the start line, on the track. */
export function startPosition(project: Project, samples: readonly Sample[]): Sample {
  const behind = startLine(project, samples).s - LAYOUT.startBehindLine;
  return at(
    samples,
    isCircuit(project) ? wrapDistance(project, samples, behind) : Math.max(0, behind),
  );
}
