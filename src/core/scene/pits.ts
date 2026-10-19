import type { Project } from '../project/schema';
import { sampleAt } from '../track/centerline';
import type { Sample } from '../track/centerline';
import { LAYOUT, roadEdge } from '../track/layout';
import { pitLaneLayout } from '../track/pitLane';
import { wrapDistance } from '../track/positions';
import { capQuad, topQuad, wallQuad } from './barriers';
import type { Frame } from './barriers';
import { createMesh } from './mesh';
import type { Mesh } from './mesh';

/** Spacing of the wall's sections along the track, in metres. */
const STEP = 3;
/** The wall reaches below the ground so cars cannot slip under it on uneven terrain. */
const BOTTOM = -0.4;

/**
 * The concrete pit wall between the track and the pit lane, along the parallel
 * part of the lane. Like the concrete barriers, it is its own collider.
 */
export function buildPitWall(project: Project, samples: readonly Sample[]): Mesh[] {
  const lane = pitLaneLayout(project, samples);
  if (!lane) return [];
  const [start, end] = lane.parallel;
  if (end - start < STEP) return [];
  const frames: Frame[] = [];
  for (let s = start; s < end; s += STEP)
    frames.push(sampleAt(samples, wrapDistance(project, samples, s))!);
  frames.push(sampleAt(samples, wrapDistance(project, samples, end))!);

  const { wall, wallGap } = LAYOUT.pitLane;
  const sign = lane.sign;
  const center = roadEdge(project.road) + wallGap / 2;
  const inner = sign * (center - wall.thickness / 2),
    outer = sign * (center + wall.thickness / 2);
  const mesh = createMesh('1WALL_pitwall', 'concrete', 'barrier');
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1],
      b = frames[i];
    wallQuad(mesh, a, b, inner, inner, BOTTOM, wall.height, sign);
    topQuad(mesh, a, b, [inner, outer], [inner, outer], wall.height);
    wallQuad(mesh, a, b, outer, outer, BOTTOM, wall.height, -sign);
  }
  capQuad(mesh, frames[0], inner, outer, BOTTOM, wall.height, -1);
  capQuad(mesh, frames.at(-1)!, inner, outer, BOTTOM, wall.height, 1);
  return [mesh];
}
