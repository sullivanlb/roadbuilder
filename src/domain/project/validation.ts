import type { Barrier, BarrierSide, BarrierType, Point, Project } from '../types';
import type { BarrierEnd, ProjectField } from '../diagnostics';
import { ProjectError } from '../diagnostics';
import { DEFAULT_TERRAIN_MARGIN, LIMITS } from './limits';

export const BARRIER_TYPES: readonly BarrierType[] = ['guardrail', 'tires', 'tecpro', 'wall'];
export const BARRIER_SIDES: readonly BarrierSide[] = ['left', 'right'];

function readNumber(value: unknown, field: ProjectField, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    throw new ProjectError({ code: 'value-range', field, min, max });
  return value;
}

/** Validates a parsed payload and rebuilds a clean project, or throws a typed ProjectError. */
export function validateProject(input: unknown): Project {
  if (!input || typeof input !== 'object') throw new ProjectError({ code: 'project-format' });
  const value = input as Record<string, unknown>;
  if (value.format !== 'assetto-roadbuilder' || value.version !== 1)
    throw new ProjectError({ code: 'project-format' });
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 80)
    throw new ProjectError({ code: 'name-length', min: 1, max: 80 });
  if (typeof value.author !== 'string' || value.author.length > 80)
    throw new ProjectError({ code: 'author-length', max: 80 });
  if (typeof value.closed !== 'boolean' || typeof value.kerbs !== 'boolean')
    throw new ProjectError({ code: 'track-options' });
  if (!Array.isArray(value.points) || value.points.length > LIMITS.points)
    throw new ProjectError({ code: 'points-limit', max: LIMITS.points });
  const points = value.points.map((input: unknown): Point => {
    if (!input || typeof input !== 'object') throw new ProjectError({ code: 'invalid-point' });
    const p = input as Record<string, unknown>;
    return {
      x: readNumber(p.x, 'x', -LIMITS.coordinate, LIMITS.coordinate),
      y: readNumber(p.y, 'y', LIMITS.minAltitude, LIMITS.maxAltitude),
      z: readNumber(p.z, 'z', -LIMITS.coordinate, LIMITS.coordinate),
    };
  });
  // Barriers stay an optional field: an old project receives none.
  const barriers = validateBarriers(value.barriers, points.length, value.closed === true);
  return {
    format: 'assetto-roadbuilder',
    version: 1,
    name: value.name.trim(),
    author: value.author.trim(),
    closed: value.closed,
    width: readNumber(value.width, 'width', 4, 24),
    shoulder: readNumber(value.shoulder, 'shoulder', 2, 20),
    kerbs: value.kerbs,
    terrainMargin:
      value.terrainMargin === undefined
        ? DEFAULT_TERRAIN_MARGIN
        : readNumber(value.terrainMargin, 'terrainMargin', 50, 500),
    ...(barriers === undefined ? {} : { barriers }),
    points,
  };
}

function validateBarriers(
  input: unknown,
  pointCount: number,
  closed: boolean,
): Barrier[] | undefined {
  if (input === undefined) return undefined;
  if (!Array.isArray(input) || input.length > LIMITS.barriers)
    throw new ProjectError({ code: 'barriers-limit', max: LIMITS.barriers });
  if (input.length && pointCount < 2) throw new ProjectError({ code: 'barriers-min-points' });
  // A span can only wrap when the circuit is actually closed.
  const wrapping = closed && pointCount > 2;
  return input.map((raw): Barrier => {
    if (!raw || typeof raw !== 'object') throw new ProjectError({ code: 'invalid-barrier' });
    const item = raw as Record<string, unknown>;
    const type = item.type;
    if (typeof type !== 'string' || !BARRIER_TYPES.includes(type as BarrierType))
      throw new ProjectError({ code: 'barrier-type' });
    const side = item.side;
    if (typeof side !== 'string' || !BARRIER_SIDES.includes(side as BarrierSide))
      throw new ProjectError({ code: 'barrier-side' });
    const index = (candidate: unknown, end: BarrierEnd): number => {
      if (
        typeof candidate !== 'number' ||
        !Number.isInteger(candidate) ||
        candidate < 0 ||
        candidate >= pointCount
      )
        throw new ProjectError({ code: 'barrier-index', end });
      return candidate;
    };
    const from = index(item.from, 'from');
    const to = index(item.to, 'to');
    if (from === to) throw new ProjectError({ code: 'barrier-span' });
    if (!wrapping && from > to) throw new ProjectError({ code: 'barrier-direction' });
    return {
      type: type as BarrierType,
      side: side as BarrierSide,
      from,
      to,
      offset: readNumber(item.offset, 'barrierOffset', 0, 10),
    };
  });
}
