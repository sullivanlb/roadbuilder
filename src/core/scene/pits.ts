import type { Project } from '../project/schema';
import { sampleAt } from '../track/centerline';
import type { Sample } from '../track/centerline';
import { LAYOUT, roadEdge } from '../track/layout';
import { pitLaneLayout } from '../track/pitLane';
import { wrapDistance } from '../track/positions';
import { solidWall } from './barriers';
import type { Frame } from './barriers';
import { createMesh } from './mesh';
import type { Mesh } from './mesh';

/** Spacing of the wall's sections along the track, in metres. */
const STEP = 3;
/** The wall reaches below the ground so cars cannot slip under it on uneven terrain. */
const BOTTOM = -0.4;
/** Gap kept between the collider and the kerb or lane edge, so cars on the surfaces never touch it. */
const COLLIDER_MARGIN = 0.05;

/**
 * The concrete pit wall between the track and the pit lane, along the parallel
 * part of the lane. The thin visible wall is decor only; collisions come from an
 * invisible, open-topped block filling the strip between the kerb and the lane:
 * one vertical face for the track, one for the lane, a metre apart (see
 * solidWall and SOLID_COLLIDER_DEPTH).
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
  const edge = roadEdge(project.road);
  const at = (offset: number) => () => sign * (edge + offset);
  const decor = createMesh('divider_decor', 'concrete', 'barrier');
  solidWall(
    decor,
    frames,
    at((wallGap - wall.thickness) / 2),
    at((wallGap + wall.thickness) / 2),
    BOTTOM,
    wall.height,
    sign,
  );
  // The name must not contain another surface key (ROAD, GRASS, KERB, PIT):
  // Assetto Corsa may read « 1WALL_pitwall » as pit lane floor, with no collision.
  const collider = createMesh('1WALL_divider', 'concrete', 'barrier', false);
  solidWall(
    collider,
    frames,
    at(COLLIDER_MARGIN),
    at(wallGap - COLLIDER_MARGIN),
    BOTTOM,
    wall.height,
    sign,
    false,
  );
  return [collider, decor];
}
