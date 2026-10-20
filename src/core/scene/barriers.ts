import type { Vec3 } from '../math';
import type { Barrier, Project, Side } from '../project/schema';
import type { Sample } from '../track/centerline';
import { clampToBend } from '../track/layout';
import { pitLaneLayout, sideEdge } from '../track/pitLane';
import type { PitLaneLayout } from '../track/pitLane';
import { positionRange, rangeSamples } from '../track/ranges';
import { addQuad, createMesh } from './mesh';
import type { Mesh, Pair, Triple } from './mesh';

/**
 * Barriers follow the roadway along their span. Each one gets a collider, a
 * vertical ribbon named 1WALL_* that the game uses for collisions but never
 * draws (like the walls of the official tracks), and a separate decor: rail and
 * posts, tyre stacks, TecPro blocks. The concrete wall is solid enough to be
 * its own collider.
 */
export const BARRIER_SIZES = {
  guardrail: { collider: 0.78, railBottom: 0.44, railTop: 0.78, postTop: 0.72, capWidth: 0.45 },
  tires: { collider: 0.85, stack: 0.27, courses: 3, spacing: 0.6, radius: 0.3, capWidth: 0.6 },
  tecpro: { collider: 0.85, block: 0.8, width: 0.4, blockLength: 1.6, capWidth: 0.4 },
  wall: { collider: 1.1, thickness: 0.25, capWidth: 0.25 },
} as const;

/**
 * Depth of the colliders of walls that can be hit from both sides or that are
 * solid (concrete wall, pit wall): their two faces stay far enough apart that a
 * car touching one never reaches the other.
 */
export const SOLID_COLLIDER_DEPTH = 1;

/** Colliders reach below the ground so cars cannot slip under them on uneven terrain. */
const COLLIDER_BOTTOM = -0.4;

/** Position, local frame and curvature of a point along a barrier. */
export type Frame = Pick<Sample, 'x' | 'y' | 'z' | 'nx' | 'nz' | 's' | 'curvature' | 'half'>;

const sideSign = (side: Side): 1 | -1 => (side === 'right' ? 1 : -1);

/**
 * Signed lateral position of a barrier: its offset beyond the kerb, or beyond the
 * pit lane where the lane runs on that side, kept clear of the centre of tight bends.
 */
export function barrierLateral(
  project: Project,
  lane: PitLaneLayout | null,
  point: Pick<Sample, 'curvature' | 's' | 'half'>,
  side: Side,
  offset: number,
): number {
  const sign = sideSign(side);
  return (
    sign * clampToBend(project.road, point, sign, sideEdge(project, lane, point, side) + offset)
  );
}

/** The centerline along a barrier, in driving order; empty when an end is unknown. */
export function barrierSamples(
  project: Project,
  samples: readonly Sample[],
  barrier: Pick<Barrier, 'from' | 'to'>,
): Sample[] {
  const range = positionRange(project, samples, barrier.from, barrier.to);
  return range ? rangeSamples(samples, range) : [];
}

/** A barrier line on the ground along some samples, for the plan, the map and hit tests. */
export function barrierLine(
  project: Project,
  samples: readonly Sample[],
  along: readonly Sample[],
  barrier: Pick<Barrier, 'side' | 'offset'>,
): Vec3[] {
  const lane = pitLaneLayout(project, samples);
  return along.map((sample) => {
    const lateral = barrierLateral(project, lane, sample, barrier.side, barrier.offset);
    return { x: sample.x + sample.nx * lateral, y: sample.y, z: sample.z + sample.nz * lateral };
  });
}

/** The line of a barrier of the project on the ground. */
export const barrierPath = (
  project: Project,
  samples: readonly Sample[],
  barrier: Pick<Barrier, 'from' | 'to' | 'side' | 'offset'>,
): Vec3[] => barrierLine(project, samples, barrierSamples(project, samples, barrier), barrier);

/** Frame moved along the local tangent, for posts. */
const along = (p: Frame, distance: number): Frame => ({
  ...p,
  x: p.x + p.nz * distance,
  z: p.z - p.nx * distance,
});
export const at = (p: Frame, lateral: number, height: number): Triple => [
  p.x + p.nx * lateral,
  p.y + height,
  p.z + p.nz * lateral,
];
const edgeUvs = (a: number, b: number, low: number, high: number): Pair[] => [
  [a / 4, low / 4],
  [a / 4, high / 4],
  [b / 4, high / 4],
  [b / 4, low / 4],
];

/** Evenly spaced frames along a path (posts, tyres), with their track distance. */
export function walk(path: readonly Frame[], spacing: number, phase = 0): Frame[] {
  const steps: Frame[] = [];
  let travelled = 0,
    next = spacing / 2 + phase;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length < 0.0001) continue;
    const start = travelled;
    travelled += length;
    // Track distance of b, unwrapped when the path runs through the start of a circuit.
    const sb = b.s < a.s ? a.s + length : b.s;
    for (; next <= travelled; next += spacing) {
      const t = (next - start) / length;
      steps.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t,
        nx: a.nx,
        nz: a.nz,
        s: a.s + (sb - a.s) * t,
        curvature: a.curvature,
        half: a.half + (b.half - a.half) * t,
      });
    }
  }
  return steps;
}

/**
 * Vertical face along the barrier. The winding makes its normal face the track:
 * essential to stop cars driving through it.
 */
export function wallQuad(
  mesh: Mesh,
  a: Frame,
  b: Frame,
  lateralA: number,
  lateralB: number,
  low: number,
  high: number,
  sign: number,
) {
  const corners = [
    at(a, lateralA, low),
    at(a, lateralA, high),
    at(b, lateralB, high),
    at(b, lateralB, low),
  ];
  const uvs = edgeUvs(a.s, b.s, low, high);
  if (sign < 0) {
    corners.reverse();
    uvs.reverse();
  }
  addQuad(mesh, corners, uvs);
}

/** Horizontal top face, facing up whatever the side. */
export function topQuad(
  mesh: Mesh,
  a: Frame,
  b: Frame,
  [innerA, outerA]: Pair,
  [innerB, outerB]: Pair,
  height: number,
) {
  addQuad(
    mesh,
    [
      at(a, Math.min(innerA, outerA), height),
      at(a, Math.max(innerA, outerA), height),
      at(b, Math.max(innerB, outerB), height),
      at(b, Math.min(innerB, outerB), height),
    ],
    edgeUvs(a.s, b.s, 0, 1),
  );
}

/** End cap across the barrier; `direction` 1 closes the far end, -1 the near end. */
export function capQuad(
  mesh: Mesh,
  p: Frame,
  lateralA: number,
  lateralB: number,
  low: number,
  high: number,
  direction: 1 | -1,
) {
  const a = Math.min(lateralA, lateralB),
    b = Math.max(lateralA, lateralB);
  const corners = [at(p, a, low), at(p, b, low), at(p, b, high), at(p, a, high)];
  const uvs = edgeUvs(0, b - a, low, high);
  if (direction > 0) {
    corners.reverse();
    uvs.reverse();
  }
  addQuad(mesh, corners, uvs);
}

/**
 * A block along a path, between two signed lateral offsets: front face at
 * `front`, back face at `back`, end caps and, unless `top` is false, a top.
 * `sign` is the side of the track the block stands on, so the front face looks
 * at the track.
 *
 * Colliders are built without a top, like the barrier ribbons proven in game: a
 * horizontal face at body height gives the car a second, upward contact that
 * lets it slide through the wall.
 */
export function solidWall(
  mesh: Mesh,
  path: readonly Frame[],
  front: (p: Frame) => number,
  back: (p: Frame) => number,
  low: number,
  high: number,
  sign: number,
  top = true,
) {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i];
    wallQuad(mesh, a, b, front(a), front(b), low, high, sign);
    if (top) topQuad(mesh, a, b, [front(a), back(a)], [front(b), back(b)], high);
    wallQuad(mesh, a, b, back(a), back(b), low, high, -sign);
  }
  const first = path[0],
    last = path[path.length - 1];
  capQuad(mesh, first, front(first), back(first), low, high, -1);
  capQuad(mesh, last, front(last), back(last), low, high, 1);
}

/** One tyre: an open six-sided cylinder with a vertical axis. */
function tire(
  mesh: Mesh,
  base: Frame,
  lateral: number,
  bottom: number,
  height: number,
  radius: number,
) {
  const facets = 6,
    cx = base.x + base.nx * lateral,
    cz = base.z + base.nz * lateral,
    tx = base.nz,
    tz = -base.nx,
    y0 = base.y + bottom,
    y1 = y0 + height;
  const rim = (angle: number, y: number): Triple => [
    cx + (base.nx * Math.cos(angle) + tx * Math.sin(angle)) * radius,
    y,
    cz + (base.nz * Math.cos(angle) + tz * Math.sin(angle)) * radius,
  ];
  for (let k = 0; k < facets; k++) {
    const a0 = (k / facets) * Math.PI * 2,
      a1 = ((k + 1) / facets) * Math.PI * 2;
    const u0 = (k / facets) * 2,
      u1 = ((k + 1) / facets) * 2;
    addQuad(
      mesh,
      [rim(a0, y0), rim(a1, y0), rim(a1, y1), rim(a0, y1)],
      [
        [u0, 0],
        [u1, 0],
        [u1, 1],
        [u0, 1],
      ],
    );
  }
}

/** Colliders and decor of every barrier of the project. */
export function buildBarriers(project: Project, samples: readonly Sample[]): Mesh[] {
  const lane = pitLaneLayout(project, samples);
  const meshes: Mesh[] = [];
  project.barriers.forEach((barrier, index) => {
    const path = barrierSamples(project, samples, barrier);
    if (path.length < 2) return;
    const sign = sideSign(barrier.side);
    const lateral = (p: Frame) => barrierLateral(project, lane, p, barrier.side, barrier.offset);
    const collider = (material: Mesh['material']) =>
      createMesh(`1WALL_${barrier.type}_${index}`, material, 'barrier', false);
    const decor = (name: string, material: Mesh['material']) =>
      createMesh(`${name}_${index}`, material, 'barrier');
    const first = path[0],
      last = path[path.length - 1];
    const caps = (mesh: Mesh, low: number, high: number, width: number) => {
      capQuad(mesh, first, lateral(first), lateral(first) + sign * width, low, high, -1);
      capQuad(mesh, last, lateral(last), lateral(last) + sign * width, low, high, 1);
    };
    const pairs = path.slice(1).map((b, i) => [path[i], b] as const);
    const ribbon = (mesh: Mesh, low: number, high: number) => {
      for (const [a, b] of pairs) wallQuad(mesh, a, b, lateral(a), lateral(b), low, high, sign);
    };
    switch (barrier.type) {
      case 'guardrail': {
        const size = BARRIER_SIZES.guardrail;
        const wall = collider('metal'),
          rail = decor('guardrail_decor', 'metal');
        ribbon(wall, COLLIDER_BOTTOM, size.collider);
        ribbon(rail, size.railBottom, size.railTop);
        for (const post of walk(path, 4)) {
          const back = lateral(post) + sign * 0.12;
          wallQuad(
            rail,
            along(post, -0.06),
            along(post, 0.06),
            back,
            back,
            -0.3,
            size.postTop,
            sign,
          );
          capQuad(rail, post, back - 0.05, back + 0.07, -0.3, size.postTop, -1);
        }
        caps(wall, COLLIDER_BOTTOM, size.collider, size.capWidth);
        caps(rail, size.railBottom, size.railTop, size.capWidth);
        meshes.push(wall, rail);
        break;
      }
      case 'tires': {
        const size = BARRIER_SIZES.tires;
        const wall = collider('tire'),
          stack = decor('tires_decor', 'tire');
        ribbon(wall, COLLIDER_BOTTOM, size.collider);
        // Each course is shifted by half a tyre, like a real stack.
        for (let course = 0; course < size.courses; course++)
          for (const step of walk(path, size.spacing, (course % 2) * (size.spacing / 2)))
            tire(
              stack,
              step,
              lateral(step) + sign * (size.radius + 0.06),
              -0.02 + course * size.stack,
              size.stack,
              size.radius,
            );
        caps(wall, COLLIDER_BOTTOM, size.collider, size.capWidth);
        caps(stack, -0.02, -0.02 + size.courses * size.stack, size.capWidth);
        meshes.push(wall, stack);
        break;
      }
      case 'tecpro': {
        const size = BARRIER_SIZES.tecpro;
        const wall = collider('tecproRed'),
          red = decor('tecpro_red', 'tecproRed'),
          white = decor('tecpro_white', 'tecproWhite');
        const block = (p: Frame) => (Math.floor(p.s / size.blockLength) % 2 ? white : red);
        ribbon(wall, COLLIDER_BOTTOM, size.collider);
        for (const [a, b] of pairs) {
          const latA = lateral(a),
            latB = lateral(b);
          wallQuad(block(a), a, b, latA, latB, 0, size.block, sign);
          topQuad(
            block(a),
            a,
            b,
            [latA, latA + sign * size.width],
            [latB, latB + sign * size.width],
            size.block,
          );
        }
        capQuad(
          block(first),
          first,
          lateral(first),
          lateral(first) + sign * size.capWidth,
          0,
          size.block,
          -1,
        );
        capQuad(
          block(last),
          last,
          lateral(last),
          lateral(last) + sign * size.capWidth,
          0,
          size.block,
          1,
        );
        caps(wall, COLLIDER_BOTTOM, size.collider, size.capWidth);
        meshes.push(wall, red, white);
        break;
      }
      case 'wall': {
        const size = BARRIER_SIZES.wall;
        const back = (p: Frame) => lateral(p) + sign * size.thickness;
        const behind = (p: Frame) => lateral(p) + sign * SOLID_COLLIDER_DEPTH;
        const wall = decor('concrete_decor', 'concrete');
        solidWall(wall, path, lateral, back, COLLIDER_BOTTOM, size.collider, sign);
        const block = collider('concrete');
        solidWall(block, path, lateral, behind, COLLIDER_BOTTOM, size.collider, sign, false);
        meshes.push(block, wall);
        break;
      }
    }
  });
  return meshes;
}
