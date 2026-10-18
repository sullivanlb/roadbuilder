import type { Point } from './types';

/** Clamps a value into the [min, max] range. */
export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** 3D distance between two points. */
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
