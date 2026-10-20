import type { Immutable } from 'immer';
import { z } from 'zod';
import { RULES } from './rules';
import type { NumericRule } from './rules';
import { ProjectError } from './errors';
import type { ProjectErrorDetail } from './errors';

export const PROJECT_FORMAT = 'roadbuilder';
export const PROJECT_VERSION = 2;

export const BARRIER_TYPES = ['guardrail', 'tires', 'tecpro', 'wall'] as const;
export const SIDES = ['left', 'right'] as const;

const id = z.string().min(1).max(64);
const ranged = ({ min, max }: NumericRule) => z.number().min(min).max(max);

const controlPoint = z.object({
  id,
  x: ranged(RULES.coordinate),
  y: ranged(RULES.altitude),
  z: ranged(RULES.coordinate),
});

const barrier = z.object({
  id,
  type: z.enum(BARRIER_TYPES),
  side: z.enum(SIDES),
  /** Control point where the span starts, in track direction. */
  from: id,
  /** Control point where the span ends, in track direction. */
  to: id,
  offset: ranged(RULES.barrierOffset),
});

/** A place on the track: a control point plus a distance along the track after it (docs/adr/0006). */
const trackPosition = z.object({ point: id, distance: ranged(RULES.positionDistance) });

/** A stretch where the roadway takes another width than the base one, both edges alike. */
const widthZone = z.object({
  id,
  /** Where the zone starts, in track direction. */
  from: trackPosition,
  /** Where the zone ends, in track direction. */
  to: trackPosition,
  width: ranged(RULES.width),
});

const pitLane = z.object({
  side: z.enum(SIDES),
  entry: trackPosition,
  exit: trackPosition,
  width: ranged(RULES.pitLaneWidth),
});

const projectShape = z.object({
  format: z.literal(PROJECT_FORMAT),
  version: z.literal(PROJECT_VERSION),
  id,
  name: z.string().trim().min(1).max(RULES.name.max),
  author: z.string().trim().max(RULES.author.max),
  road: z.object({
    closed: z.boolean(),
    width: ranged(RULES.width),
    shoulder: ranged(RULES.shoulder),
    kerbs: z.boolean(),
  }),
  terrain: z.object({ margin: ranged(RULES.terrainMargin) }),
  points: z.array(controlPoint).max(RULES.points.max),
  barriers: z.array(barrier).max(RULES.barriers.max),
  widthZones: z.array(widthZone).max(RULES.widthZones.max).default([]),
  /** Absent until set: the start line then sits a little after the first control point. */
  startLine: trackPosition.optional(),
  pitLane: pitLane.nullable().default(null),
  cars: z.number().int().min(RULES.cars.min).max(RULES.cars.max).default(1),
});

type ProjectShape = z.output<typeof projectShape>;

/** Cross-references a field-by-field schema cannot express. */
function checkReferences(project: ProjectShape, ctx: z.RefinementCtx<ProjectShape>) {
  const fail = (reason: ProjectErrorDetail['code'], path: (string | number)[]) =>
    ctx.addIssue({ code: 'custom', path, params: { reason } });
  const order = new Map(project.points.map((point, index) => [point.id, index]));
  const ids = new Set<string>();
  for (const item of [...project.points, ...project.barriers, ...project.widthZones]) {
    if (ids.has(item.id)) return fail('duplicate-id', []);
    ids.add(item.id);
  }
  const circuit = isCircuit(project);
  project.barriers.forEach((barrier, index) => {
    const from = order.get(barrier.from),
      to = order.get(barrier.to);
    if (from === undefined || to === undefined)
      return fail('barrier-endpoint', ['barriers', index]);
    if (from === to) return fail('barrier-span', ['barriers', index]);
    // Only a circuit lets a span run through the start.
    if (!circuit && from > to) fail('barrier-direction', ['barriers', index]);
  });
  const positions = [
    ['startLine', project.startLine],
    ['pitLane', project.pitLane?.entry],
    ['pitLane', project.pitLane?.exit],
    ...project.widthZones.flatMap((zone) => [
      ['widthZones', zone.from] as const,
      ['widthZones', zone.to] as const,
    ]),
  ] as const;
  for (const [field, position] of positions)
    if (position && !order.has(position.point)) return fail('position-point', [field]);
  if (project.pitLane && !circuit) return fail('pit-lane-on-road', ['pitLane']);
  if (project.cars > 1 && !project.pitLane) fail('cars-without-pit-lane', ['cars']);
}

const projectSchema = projectShape.superRefine(checkReferences);

/** A project as stored and edited. Values are never mutated: every edit produces a new project. */
export type Project = Immutable<ProjectShape>;
export type ControlPoint = Project['points'][number];
export type Barrier = Project['barriers'][number];
export type BarrierType = Barrier['type'];
export type Side = Barrier['side'];
export type WidthZone = Project['widthZones'][number];
export type RoadSettings = Project['road'];
export type TrackPosition = NonNullable<Project['startLine']>;
export type PitLane = NonNullable<Project['pitLane']>;

/** A circuit needs three control points to close; with fewer it is driven as a road. */
export const isCircuit = (project: Pick<Project, 'road' | 'points'>) =>
  project.road.closed && project.points.length > 2;

function toDetail(error: z.ZodError): ProjectErrorDetail {
  const issue = error.issues[0];
  const [head] = issue.path;
  if (issue.code === 'custom' && typeof issue.params?.reason === 'string')
    return { code: issue.params.reason } as ProjectErrorDetail;
  if (head === 'format' || head === 'version' || issue.path.length === 0)
    return { code: 'not-a-project' };
  if (issue.code === 'too_big' && issue.path.length === 1) {
    if (head === 'points') return { code: 'points-limit', max: RULES.points.max };
    if (head === 'barriers') return { code: 'barriers-limit', max: RULES.barriers.max };
    if (head === 'widthZones') return { code: 'width-zones-limit', max: RULES.widthZones.max };
  }
  return { code: 'invalid-value', path: issue.path.join('.') };
}

/** Checks an untrusted value and returns a clean project, or throws a ProjectError. */
export function parseProject(input: unknown): Project {
  const result = projectSchema.safeParse(input);
  if (!result.success) throw new ProjectError(toDetail(result.error));
  return result.data;
}

/** Reads the text of a project file, or throws a ProjectError. */
export function parseProjectFile(text: string): Project {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ProjectError({ code: 'invalid-json' });
  }
  return parseProject(json);
}

/** The text written to a project file. */
export const serializeProject = (project: Project) => JSON.stringify(project, null, 2);
