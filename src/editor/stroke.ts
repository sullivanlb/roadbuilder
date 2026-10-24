import type { Bounds, PlanPoint } from '../core/math';
import { SculptField } from '../core/project/sculpt';
import type { Brush, BrushMode } from '../core/project/sculpt';
import type { Project } from '../core/project/schema';
import { groundModel } from '../core/scene/ground';
import type { Sample } from '../core/track/centerline';
import type { TerrainBend } from '../rendering/preview/overlay';

/** How often a held brush paints, in seconds. */
export const BRUSH_STEP = 1 / 30;

const SWAPPED: Partial<Record<BrushMode, BrushMode>> = { raise: 'lower', lower: 'raise' };

/** What a stroke reports while it paints. */
export interface StrokeEvents {
  /** It painted one more step. */
  painted(): void;
  /** It reached the limit of tiles; told once a stroke. */
  full(): void;
}

/**
 * A brush stroke under way (docs/adr/0016): it paints relief where the pointer
 * is, as long as it is held, even still, and hands back the relief painted when
 * it ends, to become one step of the history. While it paints, the preview bends
 * the terrain it shows by what the stroke painted (see TerrainBend).
 */
export class BrushStroke implements TerrainBend {
  /** The relief as the stroke leaves it so far. */
  readonly relief: SculptField;
  readonly covered: Pick<Bounds, 'minX' | 'maxX' | 'minZ' | 'maxZ'> = {
    minX: Infinity,
    maxX: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
  };
  private readonly before: SculptField;
  private readonly ground: ReturnType<typeof groundModel>;
  private point: PlanPoint;
  private timer: ReturnType<typeof setInterval> | null;

  /**
   * Starts painting at `at` with the brush `brush()` gives, read at each step so
   * its settings can change mid-stroke. `invert` swaps raising and lowering.
   * Flattening levels the ground to its height under `at`.
   */
  constructor(
    project: Project,
    samples: readonly Sample[],
    brush: () => Brush,
    at: PlanPoint,
    invert: boolean,
    events: StrokeEvents,
  ) {
    this.relief = new SculptField(project.sculpt);
    this.before = new SculptField(project.sculpt);
    this.ground = groundModel(project, samples);
    this.point = { x: at.x, z: at.z };
    const first = brush();
    const mode = (invert && SWAPPED[first.mode]) || first.mode;
    const target = mode === 'flatten' ? this.ground.height(at) : 0;
    let warned = false;
    const paint = () => {
      const current = { ...brush(), mode };
      if (!this.relief.paint(current, this.point, BRUSH_STEP, this.ground, target) && !warned) {
        warned = true;
        events.full();
      }
      const box = this.covered;
      box.minX = Math.min(box.minX, this.point.x - current.radius);
      box.maxX = Math.max(box.maxX, this.point.x + current.radius);
      box.minZ = Math.min(box.minZ, this.point.z - current.radius);
      box.maxZ = Math.max(box.maxZ, this.point.z + current.radius);
      events.painted();
    };
    paint();
    this.timer = setInterval(paint, BRUSH_STEP * 1000);
  }

  /** Moves where the next steps paint. */
  moveTo(at: PlanPoint) {
    this.point = { x: at.x, z: at.z };
  }

  /** Stops painting; returns the relief painted. */
  end(): SculptField {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    return this.relief;
  }

  painted = (p: PlanPoint) => this.relief.at(p) - this.before.at(p);

  shown = (p: PlanPoint) => this.ground.clearance(p);
}
