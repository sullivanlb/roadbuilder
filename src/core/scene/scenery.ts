import { clamp } from '../math';
import type { PlanPoint } from '../math';
import type { Project, SceneryItem } from '../project/schema';
import type { Sample } from '../track/centerline';
import { groundHeight } from './ground';
import type { MaterialId } from './materials';
import { addQuad, createMesh } from './mesh';
import type { Mesh, Triple } from './mesh';

/**
 * Scenery items stand free on the plan (docs/adr/0013), on the terrain as it is
 * meshed. Their geometry is low-poly and built from quads only, so the meshes
 * split like the others; a triangle is a quad whose last two corners meet.
 */

/** Walls and posts reach this far below the ground, so nothing floats on uneven terrain. */
const FOUNDATION = 0.4;
/** Colliders stop at this height: cars never climb higher. */
const COLLIDER_TOP = 4;
/** A collider is never thinner than this, so a car touching one face never reaches the other. */
const COLLIDER_MIN = 1;
/** Facets of trunks, crowns and poles. */
const FACETS = 7;
/** Height of one storey of a building, for its window bands. */
const STOREY = 3.2;

/** A lamp of a light, for the night lights of Custom Shaders Patch. */
export interface SceneLight {
  position: Triple;
  /** Unit vector the lamp shines along. */
  direction: Triple;
}

/** The plan frame of an item: its centre, its front and its right, in world coordinates. */
interface ItemFrame {
  x: number;
  z: number;
  /** Ground height under the item, where its floor stands. */
  y: number;
  /** Unit vector its front faces, on the plan. */
  fx: number;
  fz: number;
}

/** Where the front of a heading faces on the plan: heading 0 faces -Z, 90 faces +X. */
export function headingVector(heading: number): PlanPoint {
  const angle = (heading * Math.PI) / 180;
  return { x: Math.sin(angle), z: -Math.cos(angle) };
}

/** The heading whose front faces from `from` towards `to`. */
export function headingTowards(from: PlanPoint, to: PlanPoint): number {
  const degrees = (Math.atan2(to.x - from.x, -(to.z - from.z)) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

/** A place in the frame of an item: `u` metres to its right, `v` to its front, `h` above its floor. */
const local = (frame: ItemFrame, u: number, v: number, h: number): Triple => [
  frame.x + frame.fx * v - frame.fz * u,
  frame.y + h,
  frame.z + frame.fz * v + frame.fx * u,
];

/** The corners of an item's footprint on the plan, a rectangle around its centre. */
export function sceneryFootprint(item: SceneryItem): PlanPoint[] {
  const front = headingVector(item.heading);
  const w = item.width / 2,
    d = item.depth / 2;
  return [
    [-w, -d],
    [w, -d],
    [w, d],
    [-w, d],
  ].map(([u, v]) => ({
    x: item.x + front.x * v - front.z * u,
    z: item.z + front.z * v + front.x * u,
  }));
}

/** Adds a quad facing `outward`, turning its corners round when they wind the other way. */
function facing(mesh: Mesh, corners: Triple[], outward: Triple) {
  const [a, b, c] = corners;
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
    v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const dot = normal[0] * outward[0] + normal[1] * outward[1] + normal[2] * outward[2];
  addQuad(mesh, dot < 0 ? [...corners].reverse() : corners);
}

/** The world direction of a direction given in the frame of an item. */
const turned = (frame: ItemFrame, u: number, v: number, h: number): Triple => [
  frame.fx * v - frame.fz * u,
  h,
  frame.fz * v + frame.fx * u,
];

interface BoxFaces {
  top?: boolean;
  bottom?: boolean;
  /** Leave out the vertical faces, for a slab seen only from above and below. */
  sides?: boolean;
}

/** A box in the frame of an item, between two widths, depths and heights. */
function box(
  mesh: Mesh,
  frame: ItemFrame,
  [u0, u1]: [number, number],
  [v0, v1]: [number, number],
  [h0, h1]: [number, number],
  { top = true, bottom = false, sides = true }: BoxFaces = {},
) {
  const at = (u: number, v: number, h: number) => local(frame, u, v, h);
  if (sides) {
    facing(
      mesh,
      [at(u0, v1, h0), at(u1, v1, h0), at(u1, v1, h1), at(u0, v1, h1)],
      turned(frame, 0, 1, 0),
    );
    facing(
      mesh,
      [at(u0, v0, h0), at(u1, v0, h0), at(u1, v0, h1), at(u0, v0, h1)],
      turned(frame, 0, -1, 0),
    );
    facing(
      mesh,
      [at(u1, v0, h0), at(u1, v1, h0), at(u1, v1, h1), at(u1, v0, h1)],
      turned(frame, 1, 0, 0),
    );
    facing(
      mesh,
      [at(u0, v0, h0), at(u0, v1, h0), at(u0, v1, h1), at(u0, v0, h1)],
      turned(frame, -1, 0, 0),
    );
  }
  if (top)
    facing(mesh, [at(u0, v0, h1), at(u1, v0, h1), at(u1, v1, h1), at(u0, v1, h1)], [0, 1, 0]);
  if (bottom)
    facing(mesh, [at(u0, v0, h0), at(u1, v0, h0), at(u1, v1, h0), at(u0, v1, h0)], [0, -1, 0]);
}

/**
 * A vertical solid of revolution, faceted, around (u, v) in the frame of an item:
 * a ring of `radius` at each height, from bottom to top. A radius of 0 closes it
 * in a point; `bottom` closes its base.
 */
function lathe(
  mesh: Mesh,
  frame: ItemFrame,
  u: number,
  v: number,
  rings: [radius: number, height: number][],
  bottom = false,
) {
  const ring = (radius: number, height: number) =>
    Array.from({ length: FACETS }, (_, k) => {
      const angle = (2 * Math.PI * k) / FACETS;
      return local(frame, u + Math.cos(angle) * radius, v + Math.sin(angle) * radius, height);
    });
  const centre = local(frame, u, v, 0);
  for (let r = 1; r < rings.length; r++) {
    const low = ring(...rings[r - 1]),
      high = ring(...rings[r]);
    for (let k = 0; k < FACETS; k++) {
      const next = (k + 1) % FACETS;
      const mid = [(low[k][0] + low[next][0]) / 2, 0, (low[k][2] + low[next][2]) / 2];
      const outward: Triple = [mid[0] - centre[0], 0, mid[2] - centre[2]];
      // A ring of radius 0 is a point: the facet is a triangle.
      if (rings[r][0] === 0) facing(mesh, [low[k], low[next], high[k], high[k]], outward);
      else if (rings[r - 1][0] === 0) facing(mesh, [low[k], high[next], high[k], high[k]], outward);
      else facing(mesh, [low[k], low[next], high[next], high[k]], outward);
    }
  }
  if (bottom && rings[0][0] > 0) {
    const base = ring(...rings[0]),
      middle = local(frame, u, v, rings[0][1]);
    for (let k = 0; k < FACETS; k++)
      facing(mesh, [middle, base[(k + 1) % FACETS], base[k], base[k]], [0, -1, 0]);
  }
}

/** A seeded random sequence in [0, 1), the same for the same seed. */
function random(seed: string) {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One tree of a grove: where it stands in the frame of its item, its height and crown width. */
export interface GroveTree {
  u: number;
  v: number;
  height: number;
  crown: number;
}

/**
 * The trees of a grove, spread evenly over its width on a sunflower spiral and
 * shaken a little from its ID, so the same item always grows the same trees.
 */
export function groveTrees(item: SceneryItem): GroveTree[] {
  const count = item.count ?? 1;
  if (count === 1) return [{ u: 0, v: 0, height: item.height, crown: item.width }];
  const next = random(item.id);
  const crown = clamp((item.width / Math.sqrt(count)) * 1.25, 2, item.width / 2);
  const reach = Math.max(0, item.width / 2 - crown / 2);
  return Array.from({ length: count }, (_, i) => {
    const radius = reach * Math.sqrt((i + 0.5 + (next() - 0.5) * 0.6) / count);
    const angle = i * 2.399963 + (next() - 0.5) * 0.8;
    return {
      u: Math.cos(angle) * radius,
      v: Math.sin(angle) * radius,
      height: item.height * (0.8 + next() * 0.35),
      crown: crown * (0.85 + next() * 0.3),
    };
  });
}

/** The meshes of the scenery, one per material, filled by the builders below. */
class Parts {
  readonly meshes = new Map<MaterialId, Mesh>();
  readonly collider = createMesh('1WALL_scenery', 'concrete', 'scenery', false);
  readonly lights: SceneLight[] = [];

  part(material: MaterialId) {
    let mesh = this.meshes.get(material);
    if (!mesh) {
      mesh = createMesh(`scenery_${material}`, material, 'scenery');
      this.meshes.set(material, mesh);
    }
    return mesh;
  }

  /** An open-topped block of vertical faces around a rectangle of an item, at least a metre thick. */
  block(frame: ItemFrame, u: number, v: number, width: number, depth: number) {
    const w = Math.max(width, COLLIDER_MIN) / 2,
      d = Math.max(depth, COLLIDER_MIN) / 2;
    box(this.collider, frame, [u - w, u + w], [v - d, v + d], [-FOUNDATION, COLLIDER_TOP], {
      top: false,
    });
  }
}

function tree(parts: Parts, frame: ItemFrame, item: SceneryItem) {
  const conifer = item.variant === 'conifer';
  for (const { u, v, height, crown } of groveTrees(item)) {
    const trunk = clamp(height * 0.035, 0.12, 0.5);
    const radius = crown / 2;
    if (conifer) {
      lathe(parts.part('bark'), frame, u, v, [
        [trunk, -FOUNDATION],
        [trunk * 0.7, height * 0.3],
      ]);
      const foliage = parts.part('conifer');
      lathe(
        foliage,
        frame,
        u,
        v,
        [
          [radius, height * 0.18],
          [0, height * 0.75],
        ],
        true,
      );
      lathe(
        foliage,
        frame,
        u,
        v,
        [
          [radius * 0.7, height * 0.5],
          [0, height],
        ],
        true,
      );
    } else {
      lathe(parts.part('bark'), frame, u, v, [
        [trunk, -FOUNDATION],
        [trunk * 0.7, height * 0.5],
      ]);
      lathe(
        parts.part('foliage'),
        frame,
        u,
        v,
        [
          [radius * 0.35, height * 0.35],
          [radius * 0.95, height * 0.5],
          [radius, height * 0.68],
          [radius * 0.65, height * 0.88],
          [0, height],
        ],
        true,
      );
    }
    if (item.solid) parts.block(frame, u, v, trunk * 2, trunk * 2);
  }
}

function building(parts: Parts, frame: ItemFrame, item: SceneryItem) {
  const w = item.width / 2,
    d = item.depth / 2,
    h = item.height;
  box(parts.part('facade'), frame, [-w, w], [-d, d], [-FOUNDATION, h], { top: false });
  box(parts.part('roof'), frame, [-w - 0.3, w + 0.3], [-d - 0.3, d + 0.3], [h, h + 0.35], {
    bottom: true,
  });
  // A band of windows on every storey, a hair in front of the walls.
  const glass = parts.part('glass'),
    gap = 0.03;
  for (let floor = 0; floor * STOREY + 2.4 <= h; floor++) {
    const [low, high] = [floor * STOREY + 1, floor * STOREY + 2.2];
    for (const [width, depth, along] of [
      [w, d, 'v'],
      [d, w, 'u'],
    ] as const) {
      if (width < 1.5) continue;
      for (const sign of [-1, 1]) {
        const at = (s: number, height: number) =>
          along === 'v'
            ? local(frame, s, sign * (depth + gap), height)
            : local(frame, sign * (depth + gap), s, height);
        const outward = along === 'v' ? turned(frame, 0, sign, 0) : turned(frame, sign, 0, 0);
        const inset = width - 0.8;
        facing(
          glass,
          [at(-inset, low), at(inset, low), at(inset, high), at(-inset, high)],
          outward,
        );
      }
    }
  }
  if (item.solid) parts.block(frame, 0, 0, item.width, item.depth);
}

function grandstand(parts: Parts, frame: ItemFrame, item: SceneryItem) {
  const w = item.width / 2,
    d = item.depth / 2,
    h = item.height;
  // Rows of seats climb from the front, which faces the track, to the back wall.
  const rows = Math.max(2, Math.round((item.depth - 1) / 0.85));
  const tread = (item.depth - 1) / rows,
    first = 1,
    last = Math.max(first + 0.5, h * 0.62),
    rise = (last - first) / (rows - 1);
  const seat = parts.part('seat'),
    concrete = parts.part('concrete');
  for (let row = 0; row < rows; row++) {
    const front = d - row * tread,
      back = front - tread,
      height = first + row * rise,
      below = row ? height - rise : -FOUNDATION;
    facing(
      seat,
      [
        local(frame, -w, back, height),
        local(frame, w, back, height),
        local(frame, w, front, height),
        local(frame, -w, front, height),
      ],
      [0, 1, 0],
    );
    facing(
      concrete,
      [
        local(frame, -w, front, below),
        local(frame, w, front, below),
        local(frame, w, front, height),
        local(frame, -w, front, height),
      ],
      turned(frame, 0, 1, 0),
    );
    // The sides, stepped with the rows.
    for (const sign of [-1, 1])
      facing(
        concrete,
        [
          local(frame, sign * w, back, -FOUNDATION),
          local(frame, sign * w, front, -FOUNDATION),
          local(frame, sign * w, front, height),
          local(frame, sign * w, back, height),
        ],
        turned(frame, sign, 0, 0),
      );
  }
  // A walkway behind the last row, then the back wall up to the roof.
  const top = first + (rows - 1) * rise;
  box(concrete, frame, [-w, w], [-d, -d + 1], [-FOUNDATION, top], { top: true });
  box(parts.part('facade'), frame, [-w, w], [-d - 0.3, -d], [-FOUNDATION, h], { top: false });
  box(parts.part('roof'), frame, [-w - 0.5, w + 0.5], [-d - 0.3, d + 1], [h, h + 0.3], {
    bottom: true,
  });
  const posts = Math.max(2, Math.ceil(item.width / 12) + 1),
    steel = parts.part('steel');
  for (let i = 0; i < posts; i++) {
    const u = -w + (item.width * i) / (posts - 1);
    lathe(steel, frame, u, d + 0.4, [
      [0.15, -FOUNDATION],
      [0.15, h],
    ]);
  }
  if (item.solid) parts.block(frame, 0, 0, item.width, item.depth + 1.4);
}

function sign(parts: Parts, frame: ItemFrame, item: SceneryItem) {
  const w = item.width / 2,
    d = item.depth / 2,
    h = item.height;
  const steel = parts.part('steel');
  const bottom = item.variant === 'board' ? -FOUNDATION : h * 0.45;
  if (item.variant !== 'board')
    for (const u of [-w * 0.6, w * 0.6])
      lathe(steel, frame, u, -d - 0.12, [
        [0.1, -FOUNDATION],
        [0.1, h],
      ]);
  box(steel, frame, [-w, w], [-d, d], [bottom, h]);
  // The printed face, towards the front.
  const low = Math.max(bottom, 0) + 0.1;
  facing(
    parts.part('signBoard'),
    [
      local(frame, -w + 0.1, d + 0.02, low),
      local(frame, w - 0.1, d + 0.02, low),
      local(frame, w - 0.1, d + 0.02, h - 0.1),
      local(frame, -w + 0.1, d + 0.02, h - 0.1),
    ],
    turned(frame, 0, 1, 0),
  );
  if (item.solid) parts.block(frame, 0, 0, item.width, item.depth);
}

function light(parts: Parts, frame: ItemFrame, item: SceneryItem) {
  const h = item.height,
    reach = item.width;
  const steel = parts.part('steel'),
    lamp = parts.part('lamp');
  lathe(steel, frame, 0, 0, [
    [0.16, -FOUNDATION],
    [0.1, h],
  ]);
  for (const sign of item.variant === 'double' ? [1, -1] : [1]) {
    const [near, far] = sign > 0 ? [0, reach] : [-reach, 0];
    box(steel, frame, [-0.06, 0.06], [near, far], [h - 0.15, h], { bottom: true });
    const end = sign * reach;
    box(lamp, frame, [-0.35, 0.35], [end - 0.25, end + 0.25], [h - 0.35, h - 0.15], {
      bottom: true,
    });
    // Shines down, leaning a little towards the side the arm reaches to.
    const lean = turned(frame, 0, sign * 0.35, -1),
      length = Math.hypot(...lean);
    parts.lights.push({
      position: local(frame, 0, end, h - 0.4),
      direction: lean.map((c) => c / length) as Triple,
    });
  }
  if (item.solid) parts.block(frame, 0, 0, 0.4, 0.4);
}

const BUILDERS = { tree, building, grandstand, sign, light } as const;

/**
 * A height lookup over the ground meshes: the height of the triangle under a
 * place on the plan, or null outside them.
 */
export function meshHeight(meshes: readonly Mesh[]): (p: PlanPoint) => number | null {
  const CELL = 20;
  const cells = new Map<string, number[][]>();
  for (const mesh of meshes) {
    const p = mesh.positions;
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const corners = [0, 1, 2].map((k) => mesh.indices[i + k] * 3);
      const triangle = corners.flatMap((c) => [p[c], p[c + 1], p[c + 2]]);
      const xs = [triangle[0], triangle[3], triangle[6]],
        zs = [triangle[2], triangle[5], triangle[8]];
      for (let x = Math.floor(Math.min(...xs) / CELL); x <= Math.floor(Math.max(...xs) / CELL); x++)
        for (
          let z = Math.floor(Math.min(...zs) / CELL);
          z <= Math.floor(Math.max(...zs) / CELL);
          z++
        ) {
          const key = `${x},${z}`;
          if (!cells.has(key)) cells.set(key, []);
          cells.get(key)!.push(triangle);
        }
    }
  }
  return ({ x, z }) => {
    let found: number | null = null;
    for (const [ax, ay, az, bx, by, bz, cx, cy, cz] of cells.get(
      `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`,
    ) ?? []) {
      const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(det) < 1e-12) continue;
      const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det,
        l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det,
        l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      const y = l1 * ay + l2 * by + l3 * cy;
      // Where markings lie over the road, the road below holds the item.
      found = found === null ? y : Math.min(found, y);
    }
    return found;
  };
}

/** The places an item is checked for the height of its floor: its centre, corners and edges. */
function floorProbes(item: SceneryItem): PlanPoint[] {
  const corners = sceneryFootprint(item);
  const probes = [{ x: item.x, z: item.z }, ...corners];
  corners.forEach((corner, i) => {
    const next = corners[(i + 1) % corners.length];
    probes.push({ x: (corner.x + next.x) / 2, z: (corner.z + next.z) / 2 });
  });
  return probes;
}

export interface SceneryOutput {
  meshes: Mesh[];
  lights: SceneLight[];
}

/**
 * The scenery of a project standing on `ground`, the meshes it may stand on.
 * An item's floor is the lowest ground under its footprint; a grove's trees each
 * stand on the ground under them.
 */
export function buildScenery(
  project: Project,
  samples: readonly Sample[],
  ground: readonly Mesh[],
): SceneryOutput {
  if (!project.scenery.length) return { meshes: [], lights: [] };
  const onMesh = meshHeight(ground);
  const smooth = groundHeight(project, samples);
  const heightAt = (p: PlanPoint) => onMesh(p) ?? smooth(p);
  const parts = new Parts();
  for (const item of project.scenery) {
    const front = headingVector(item.heading);
    const frame = { x: item.x, z: item.z, y: 0, fx: front.x, fz: front.z };
    if (item.kind === 'tree') {
      // Each tree of a grove stands on the ground under it.
      for (const one of groveTrees(item)) {
        const [x, , z] = local(frame, one.u, one.v, 0);
        const single = { ...item, count: 1, height: one.height, width: one.crown };
        tree(parts, { ...frame, x, z, y: heightAt({ x, z }) }, single);
      }
      continue;
    }
    frame.y = Math.min(...floorProbes(item).map(heightAt));
    BUILDERS[item.kind](parts, frame, item);
  }
  const meshes = [...parts.meshes.values()];
  if (parts.collider.indices.length) meshes.push(parts.collider);
  return { meshes, lights: parts.lights };
}
