import { clamp } from '../../core/math';
import type { Bounds, PlanPoint } from '../../core/math';

/** Top-down camera: the world point at the centre of the canvas and the pixels per metre. */
export interface PlanCamera {
  x: number;
  z: number;
  scale: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export const SCALE_LIMITS = { min: 0.005, max: 12 };

/** Room kept free around a framed area for the overlays drawn on the canvas. */
const FRAME_MARGIN = { horizontal: 100, vertical: 145 };

/** Converts between world positions and canvas pixels for one camera and canvas size. */
export class PlanProjection {
  constructor(
    readonly camera: PlanCamera,
    readonly size: ViewportSize,
  ) {}

  toScreen(p: PlanPoint): ScreenPoint {
    return {
      x: this.size.width / 2 + (p.x - this.camera.x) * this.camera.scale,
      y: this.size.height / 2 + (p.z - this.camera.z) * this.camera.scale,
    };
  }

  toWorld(p: ScreenPoint): PlanPoint {
    return {
      x: (p.x - this.size.width / 2) / this.camera.scale + this.camera.x,
      z: (p.y - this.size.height / 2) / this.camera.scale + this.camera.z,
    };
  }
}

/** The camera that fits `area` in the canvas, leaving room for the overlays. */
export function frameCamera(area: Bounds, size: ViewportSize): PlanCamera {
  const width = Math.max(100, size.width - FRAME_MARGIN.horizontal),
    height = Math.max(90, size.height - FRAME_MARGIN.vertical);
  return {
    x: (area.minX + area.maxX) / 2,
    z: (area.minZ + area.maxZ) / 2,
    scale: clamp(
      Math.min(
        width / Math.max(60, area.maxX - area.minX),
        height / Math.max(60, area.maxZ - area.minZ),
      ),
      SCALE_LIMITS.min,
      SCALE_LIMITS.max,
    ),
  };
}

/** The camera zoomed by `factor` around a screen position, which stays under the cursor. */
export function zoomCamera(
  camera: PlanCamera,
  size: ViewportSize,
  factor: number,
  at: ScreenPoint,
): PlanCamera {
  const before = new PlanProjection(camera, size).toWorld(at);
  const zoomed = {
    ...camera,
    scale: clamp(camera.scale * factor, SCALE_LIMITS.min, SCALE_LIMITS.max),
  };
  const after = new PlanProjection(zoomed, size).toWorld(at);
  return { ...zoomed, x: camera.x + before.x - after.x, z: camera.z + before.z - after.z };
}
