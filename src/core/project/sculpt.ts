import { clamp } from '../math';
import type { Bounds, PlanPoint } from '../math';
import { RULES } from './rules';
import type { SculptTile } from './schema';

/**
 * The relief painted with the brush (docs/adr/0016): heights added to the
 * terrain at the nodes of a grid of `cell` metres, stored by square tiles of
 * `tile` nodes a side. A tile holds its heights in centimetres, as 16-bit
 * integers encoded in base64; tiles left flat are not stored.
 */
export const SCULPT = { cell: 4, tile: 16 } as const;

const NODES = SCULPT.tile * SCULPT.tile;
const TILE_METRES = SCULPT.cell * SCULPT.tile;
/** Length of the base64 text of a tile: two bytes a node. */
export const SCULPT_TILE_LENGTH = Math.ceil((NODES * 2) / 3) * 4;

const tileKey = (i: number, j: number) => `${i},${j}`;

/** The heights of a tile, in metres, read from its stored text. */
export function decodeTile(heights: string): Float32Array {
  const bytes = Uint8Array.from(atob(heights), (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  return Float32Array.from({ length: NODES }, (_, k) => view.getInt16(k * 2, true) / 100);
}

/** The stored text of a tile's heights, rounded to the centimetre. */
export function encodeTile(values: Float32Array): string {
  const view = new DataView(new ArrayBuffer(NODES * 2));
  values.forEach((value, k) => view.setInt16(k * 2, Math.round(value * 100), true));
  let text = '';
  for (const byte of new Uint8Array(view.buffer)) text += String.fromCharCode(byte);
  return btoa(text);
}

/** How a brush stroke changes the relief. */
export const BRUSH_MODES = ['raise', 'lower', 'smooth', 'flatten'] as const;
export type BrushMode = (typeof BRUSH_MODES)[number];

export interface Brush {
  mode: BrushMode;
  /** Reach of the brush on the ground, in metres. */
  radius: number;
  /** Height added in a second at the centre of the brush, in metres. */
  strength: number;
}

/** The terrain under the relief, as the brush needs it to flatten. */
export interface SculptGround {
  /** Height of the ground without the painted relief. */
  base: (p: PlanPoint) => number;
  /** How much of the relief shows at a place, from 0 beside the track to 1 away from it. */
  clearance: (p: PlanPoint) => number;
}

/** Weight of the brush at a share `t` of its radius from its centre: 1 there, easing to 0 at its edge. */
const falloff = (t: number) => (t < 1 ? (1 - t * t) ** 2 : 0);

/**
 * The painted relief as a grid of heights that the brush changes in place. A
 * stroke works on one, built from the project, and writes it back when it ends.
 */
export class SculptField {
  private readonly tiles = new Map<string, Float32Array>();

  constructor(tiles: readonly SculptTile[] = []) {
    for (const tile of tiles) this.tiles.set(tileKey(tile.i, tile.j), decodeTile(tile.heights));
  }

  get size() {
    return this.tiles.size;
  }

  /** The height at a node of the grid, 0 where nothing is painted. */
  node(x: number, z: number): number {
    const i = Math.floor(x / SCULPT.tile),
      j = Math.floor(z / SCULPT.tile);
    const tile = this.tiles.get(tileKey(i, j));
    return tile ? tile[(z - j * SCULPT.tile) * SCULPT.tile + (x - i * SCULPT.tile)] : 0;
  }

  /** Sets the height at a node; false when it would need a tile beyond the limit. */
  private setNode(x: number, z: number, value: number): boolean {
    const i = Math.floor(x / SCULPT.tile),
      j = Math.floor(z / SCULPT.tile);
    const key = tileKey(i, j);
    let tile = this.tiles.get(key);
    if (!tile) {
      if (value === 0) return true;
      if (this.tiles.size >= RULES.sculptTiles.max) return false;
      tile = new Float32Array(NODES);
      this.tiles.set(key, tile);
    }
    tile[(z - j * SCULPT.tile) * SCULPT.tile + (x - i * SCULPT.tile)] = clamp(
      value,
      RULES.sculptHeight.min,
      RULES.sculptHeight.max,
    );
    return true;
  }

  /** The painted height at a place on the plan, between the four nodes around it. */
  at(p: PlanPoint): number {
    if (!this.tiles.size) return 0;
    const gx = p.x / SCULPT.cell,
      gz = p.z / SCULPT.cell;
    const x = Math.floor(gx),
      z = Math.floor(gz),
      u = gx - x,
      v = gz - z;
    return (
      (this.node(x, z) * (1 - u) + this.node(x + 1, z) * u) * (1 - v) +
      (this.node(x, z + 1) * (1 - u) + this.node(x + 1, z + 1) * u) * v
    );
  }

  /** The tiles holding relief, flat ones left out, in a stable order. */
  toTiles(): SculptTile[] {
    return [...this.tiles]
      .flatMap(([key, values]) => {
        const heights = encodeTile(values);
        if (decodeTile(heights).every((value) => value === 0)) return [];
        const [i, j] = key.split(',').map(Number);
        return [{ i, j, heights }];
      })
      .sort((a, b) => a.j - b.j || a.i - b.i);
  }

  /** The extent of the painted tiles on the plan, or null when nothing is painted. */
  bounds(): Pick<Bounds, 'minX' | 'maxX' | 'minZ' | 'maxZ'> | null {
    return tileBounds([...this.tiles.keys()].map((key) => key.split(',').map(Number)));
  }

  /**
   * Paints for `dt` seconds with a brush centred on `at`. Raising and lowering
   * add height, the more the nearer the centre; smoothing pulls each node
   * towards its neighbours; flattening pulls the ground towards `target`. Where
   * the relief does not show, beside the track, flattening leaves it alone.
   * Returns false when the brush reached the limit of tiles.
   */
  paint(brush: Brush, at: PlanPoint, dt: number, ground: SculptGround, target = 0): boolean {
    const reach = Math.ceil(brush.radius / SCULPT.cell);
    const cx = Math.round(at.x / SCULPT.cell),
      cz = Math.round(at.z / SCULPT.cell);
    // Pulls take a share of the gap each second, as fast as the strength asks.
    const pull = Math.min(1, (brush.strength * dt) / 2);
    const changes: [number, number, number][] = [];
    for (let z = cz - reach; z <= cz + reach; z++)
      for (let x = cx - reach; x <= cx + reach; x++) {
        const p = { x: x * SCULPT.cell, z: z * SCULPT.cell };
        const weight = falloff(Math.hypot(p.x - at.x, p.z - at.z) / brush.radius);
        if (!weight) continue;
        const value = this.node(x, z);
        if (brush.mode === 'raise' || brush.mode === 'lower') {
          const sign = brush.mode === 'raise' ? 1 : -1;
          changes.push([x, z, value + sign * brush.strength * dt * weight]);
        } else if (brush.mode === 'smooth') {
          const around =
            (this.node(x - 1, z) +
              this.node(x + 1, z) +
              this.node(x, z - 1) +
              this.node(x, z + 1)) /
            4;
          changes.push([x, z, value + (around - value) * pull * weight]);
        } else {
          const shown = ground.clearance(p);
          if (shown < 0.05) continue;
          const wanted = (target - ground.base(p)) / shown;
          changes.push([x, z, value + (wanted - value) * pull * weight]);
        }
      }
    // Applied together, so smoothing reads the heights before this step.
    return changes.every(([x, z, value]) => this.setNode(x, z, value));
  }
}

/** The extent on the plan of tiles given by their indices, or null for none. */
function tileBounds(indices: readonly number[][]) {
  if (!indices.length) return null;
  const is = indices.map(([i]) => i),
    js = indices.map(([, j]) => j);
  // A tile's last nodes blend into the next tile over one more cell.
  return {
    minX: Math.min(...is) * TILE_METRES - SCULPT.cell,
    maxX: (Math.max(...is) + 1) * TILE_METRES,
    minZ: Math.min(...js) * TILE_METRES - SCULPT.cell,
    maxZ: (Math.max(...js) + 1) * TILE_METRES,
  };
}

/** The extent of a project's painted relief on the plan, or null when there is none. */
export const sculptBounds = (tiles: readonly SculptTile[]) =>
  tileBounds(tiles.map((tile) => [tile.i, tile.j]));
