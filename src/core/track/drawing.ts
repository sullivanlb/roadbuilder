import { planDistance } from '../math';
import type { PlanPoint } from '../math';
import { RULES } from '../project/rules';
import type { Project } from '../project/schema';
import { controlPointSample } from './centerline';
import type { Sample } from './centerline';
import { arcLayout, arcThrough, corners } from './geometry';
import type { ArcShape } from './geometry';

// The straight and arc tools draw on from a control point, along the track.

/** Where a straight or an arc is drawn from: a control point and the heading of the track there. */
export interface DrawStart {
  index: number;
  at: PlanPoint;
  y: number;
  /** Unit direction of the track at the point. */
  heading: PlanPoint;
}

/** What the straight tool would draw, with its length and its turn from the heading in degrees. */
export interface StraightDraft {
  kind: 'straight';
  from: PlanPoint;
  to: PlanPoint;
  length: number;
  turn: number;
}

/** What the arc tool would draw. */
export interface ArcDraft {
  kind: 'arc';
  from: PlanPoint;
  to: PlanPoint;
  shape: ArcShape;
}

export type DrawDraft = StraightDraft | ArcDraft;

/** Rounding steps applied while Shift is held. */
export const DRAW_SNAP = { length: 1, radius: 5, angle: 5 } as const;

/**
 * The control point at `index` with the heading of the track there. A rounded
 * point is drawn on from along its incoming side.
 */
export function drawStart(
  project: Project,
  samples: readonly Sample[],
  index: number,
): DrawStart | null {
  const point = project.points[index];
  if (!point) return null;
  const corner = corners(project).get(index);
  if (corner) return { index, at: point, y: point.y, heading: corner.heading };
  const sample = controlPointSample(samples, index);
  // The normal points to the right of the track direction.
  const heading = sample && samples.length > 1 ? { x: sample.nz, z: -sample.nx } : { x: 1, z: 0 };
  return { index, at: point, y: point.y, heading };
}

const degrees = (radians: number) => (radians * 180) / Math.PI;

/**
 * The straight from the start to the pointer. Shift keeps it on the heading, to
 * the metre.
 */
export function straightDraft(start: DrawStart, pointer: PlanPoint, snap: boolean): StraightDraft {
  const { at, heading } = start;
  let to = pointer;
  if (snap) {
    const ahead = (pointer.x - at.x) * heading.x + (pointer.z - at.z) * heading.z;
    const length = Math.max(
      RULES.pointSpacing,
      Math.round(ahead / DRAW_SNAP.length) * DRAW_SNAP.length,
    );
    to = { x: at.x + heading.x * length, z: at.z + heading.z * length };
  }
  const dx = to.x - at.x,
    dz = to.z - at.z;
  const turn = Math.atan2(heading.x * dz - heading.z * dx, heading.x * dx + heading.z * dz);
  return { kind: 'straight', from: at, to, length: planDistance(at, to), turn: degrees(turn) };
}

/**
 * The arc from the start, tangent to the heading, that ends at the pointer.
 * Shift rounds its radius and its turn; it then ends where they lead.
 */
export function arcDraft(start: DrawStart, pointer: PlanPoint, snap: boolean): ArcDraft | null {
  const found = arcThrough(start.at, start.heading, pointer);
  if (!found) return null;
  let { radius, angle } = found;
  if (snap) {
    const step = (DRAW_SNAP.angle * Math.PI) / 180;
    radius = Math.max(RULES.radius.min, Math.round(radius / DRAW_SNAP.radius) * DRAW_SNAP.radius);
    angle = Math.max(step, Math.round(angle / step) * step);
  }
  const shape: ArcShape = { heading: start.heading, radius, angle, sign: found.sign };
  return { kind: 'arc', from: start.at, to: arcLayout(start.at, shape).end, shape };
}

/** Turn of an arc in whole degrees, for display. */
export const arcDegrees = (shape: ArcShape) => Math.round(degrees(shape.angle));
