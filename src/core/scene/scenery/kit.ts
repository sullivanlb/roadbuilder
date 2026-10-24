import type { SceneryModel } from '../../../assets/scenery';
import { look } from '../materials';
import type { MaterialId } from '../materials';
import { addQuad, addVertex, createMesh, vertexCount } from '../mesh';
import type { Mesh, Pair, Triple } from '../mesh';

/** Walls and posts reach this far below the ground, so nothing floats on uneven terrain. */
export const FOUNDATION = 0.4;
/** Colliders stop at this height: cars never climb higher. */
const COLLIDER_TOP = 3;
/** A collider is never thinner than this, so a car touching one face never reaches the other. */
const COLLIDER_MIN = 1;

/** A lamp of a light, for the night lights of Custom Shaders Patch. */
export interface SceneLight {
  position: Triple;
  /** Unit vector the lamp shines along. */
  direction: Triple;
}

/** The plan frame of an item: its centre, its floor and the way its front faces. */
export interface ItemFrame {
  x: number;
  z: number;
  /** Ground height under the item, where its floor stands. */
  y: number;
  /** Unit vector its front faces, on the plan. */
  fx: number;
  fz: number;
}

/** Puts a point given in some frame of an item into world coordinates. */
export type Place = (x: number, y: number, z: number) => Triple;

/** The frame of an item: `u` metres to its right, `v` to its front, `h` above its floor. */
export const itemPlace =
  (frame: ItemFrame): Place =>
  (u, v, h) => [
    frame.x + frame.fx * v - frame.fz * u,
    frame.y + h,
    frame.z + frame.fz * v + frame.fx * u,
  ];

/**
 * A frame along a wall of an item: `x` along the wall from `origin` in the
 * direction `along`, stretched by `stretch`; `y` out of the wall, on its right
 * when walking along it; `z` up from `floor`, stretched by `rise`.
 */
export const wallPlace =
  (
    item: Place,
    origin: readonly [number, number],
    along: readonly [number, number],
    stretch = 1,
    floor = 0,
    rise = 1,
  ): Place =>
  (x, y, z) =>
    item(
      origin[0] + along[0] * x * stretch + along[1] * y,
      origin[1] + along[1] * x * stretch - along[0] * y,
      floor + z * rise,
    );

/** A frame turned by `angle` (radians) about its vertical axis, then about its x axis by `tilt`. */
export const turnedPlace =
  (base: Place, angle: number, tilt = 0): Place =>
  (x, y, z) => {
    const ty = y * Math.cos(tilt) - z * Math.sin(tilt),
      tz = y * Math.sin(tilt) + z * Math.cos(tilt);
    return base(
      x * Math.cos(angle) - ty * Math.sin(angle),
      x * Math.sin(angle) + ty * Math.cos(angle),
      tz,
    );
  };

/** A frame moved to `origin`, a point of the frame it is based on. */
export const movedPlace =
  (base: Place, [ox, oy, oz]: Triple): Place =>
  (x, y, z) =>
    base(ox + x, oy + y, oz + z);

const sub = (a: Triple, b: Triple): Triple => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Triple, b: Triple) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Triple, b: Triple): Triple => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: Triple): Triple => {
  const length = Math.hypot(...a) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
};

/**
 * Texture coordinates of a face on a material that tiles: along the face and
 * up it on walls, across the plan on roofs and floors, one repeat per `tile` metres.
 */
function tiled(tile: number, corners: Triple[], normal: Triple): Pair[] {
  if (Math.abs(normal[1]) > 0.7) return corners.map((p) => [p[0] / tile, p[2] / tile]);
  // Along the face, rightwards when looking at it.
  const across = unit([normal[2], 0, -normal[0]]);
  return corners.map((p) => [dot(p, across) / tile, p[1] / tile]);
}

const ONCE: Pair[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

/** The meshes of the scenery, one per material, the collider and the lamps, filled by the builders. */
export class Parts {
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

  /**
   * A quad in world coordinates, turned round if need be to face `outward`. Its
   * texture spans it once unless `uvs` say otherwise or its material tiles.
   */
  quad(
    material: MaterialId,
    corners: Triple[],
    outward?: Triple,
    uvs?: Pair[],
    mesh = this.part(material),
  ) {
    let points = corners,
      coords = uvs;
    if (
      outward &&
      dot(cross(sub(corners[1], corners[0]), sub(corners[2], corners[0])), outward) < 0
    ) {
      points = [...corners].reverse();
      coords = uvs && [...uvs].reverse();
    }
    const tile = look(material).tile;
    if (!coords && tile)
      coords = tiled(
        tile,
        points,
        unit(cross(sub(points[1], points[0]), sub(points[2], points[0]))),
      );
    addQuad(mesh, points, coords ?? ONCE);
  }

  /** A box between bounds in a frame, its faces turned outwards. */
  box(
    material: MaterialId,
    place: Place,
    [x0, x1]: readonly [number, number],
    [y0, y1]: readonly [number, number],
    [z0, z1]: readonly [number, number],
    { top = true, bottom = false, sides = true } = {},
    mesh = this.part(material),
  ) {
    const c = place((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const face = (corners: Triple[]) => {
      const middle = corners.reduce<Triple>(
        (sum, p) => [sum[0] + p[0] / 4, sum[1] + p[1] / 4, sum[2] + p[2] / 4],
        [0, 0, 0],
      );
      this.quad(material, corners, sub(middle, c), undefined, mesh);
    };
    if (sides) {
      face([place(x0, y0, z0), place(x1, y0, z0), place(x1, y0, z1), place(x0, y0, z1)]);
      face([place(x0, y1, z0), place(x1, y1, z0), place(x1, y1, z1), place(x0, y1, z1)]);
      face([place(x0, y0, z0), place(x0, y1, z0), place(x0, y1, z1), place(x0, y0, z1)]);
      face([place(x1, y0, z0), place(x1, y1, z0), place(x1, y1, z1), place(x1, y0, z1)]);
    }
    if (top) face([place(x0, y0, z1), place(x1, y0, z1), place(x1, y1, z1), place(x0, y1, z1)]);
    if (bottom) face([place(x0, y0, z0), place(x1, y0, z0), place(x1, y1, z0), place(x0, y1, z0)]);
  }

  /** A tapered tube from p0 to p1 in a frame, faceted, with a cap at its far end if asked. */
  tube(
    material: MaterialId,
    place: Place,
    p0: Triple,
    p1: Triple,
    r0: number,
    r1 = r0,
    sides = 8,
    cap = false,
  ) {
    const axis = unit(sub(p1, p0));
    const a = unit(cross(axis, Math.abs(axis[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
    const b = cross(axis, a);
    const ring = (p: Triple, r: number) =>
      Array.from({ length: sides }, (_, k) => {
        const angle = (2 * Math.PI * k) / sides;
        const [ca, sa] = [Math.cos(angle) * r, Math.sin(angle) * r];
        return place(
          p[0] + a[0] * ca + b[0] * sa,
          p[1] + a[1] * ca + b[1] * sa,
          p[2] + a[2] * ca + b[2] * sa,
        );
      });
    const low = ring(p0, r0),
      high = ring(p1, r1);
    const centre = place(...p0);
    for (let k = 0; k < sides; k++) {
      const n = (k + 1) % sides;
      const corners = [low[k], low[n], high[n], high[k]];
      this.quad(material, corners, sub(low[k], centre), [
        [k / sides, 0],
        [(k + 1) / sides, 0],
        [(k + 1) / sides, 1],
        [k / sides, 1],
      ]);
    }
    if (cap) {
      const end = place(...p1);
      for (let k = 0; k < sides; k++)
        this.quad(material, [end, high[k], high[(k + 1) % sides], end], sub(end, centre));
    }
  }

  /** A model made in Blender, scaled along its own axes, then placed. */
  model(model: SceneryModel, place: Place, [sx, sy, sz]: Triple) {
    const origin = place(0, 0, 0);
    for (const piece of model.parts) {
      const mesh = this.part(piece.material as MaterialId);
      const first = vertexCount(mesh);
      const { positions: p, normals: n, uvs } = piece;
      for (let i = 0; i < p.length / 3; i++) {
        // Normals of a stretched shape scale by the inverse of the stretch.
        const normal = unit(
          sub(place(n[i * 3] / sx, n[i * 3 + 1] / sy, n[i * 3 + 2] / sz), origin),
        );
        addVertex(mesh, place(p[i * 3] * sx, p[i * 3 + 1] * sy, p[i * 3 + 2] * sz), normal, [
          uvs[i * 2],
          uvs[i * 2 + 1],
        ]);
      }
      for (const index of piece.indices) mesh.indices.push(first + index);
    }
  }

  /** An open-topped block of vertical faces around a rectangle of a frame, at least a metre thick. */
  block(place: Place, u: number, v: number, width: number, depth: number) {
    const w = Math.max(width, COLLIDER_MIN) / 2,
      d = Math.max(depth, COLLIDER_MIN) / 2;
    this.box(
      'concrete',
      place,
      [u - w, u + w],
      [v - d, v + d],
      [-FOUNDATION, COLLIDER_TOP],
      { top: false },
      this.collider,
    );
  }
}

/** A seeded random sequence in [0, 1), the same for the same seed. */
export function random(seed: string) {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
