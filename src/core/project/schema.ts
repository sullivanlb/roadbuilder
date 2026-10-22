import type { Immutable } from 'immer';
import { z } from 'zod';
import { DEFAULTS, RULES } from './rules';
import type { NumericRule } from './rules';
import { ProjectError } from './errors';
import { SCENERY_SIZE_NAMES, SCENERY_SIZES, SCENERY_VARIANTS } from './scenery';
import { EARTHWORK_REACH, EARTHWORK_RULES, EARTHWORK_SETTING_NAMES } from './terrain';
import type { ProjectErrorDetail } from './errors';

export const PROJECT_FORMAT = 'roadbuilder';
export const PROJECT_VERSION = 2;

export const BARRIER_TYPES = ['guardrail', 'tires', 'tecpro', 'wall'] as const;
export const SIDES = ['left', 'right'] as const;
export const SCENERY_KINDS = ['tree', 'building', 'grandstand', 'sign', 'light'] as const;
export const EARTHWORK_TYPES = ['embankment', 'ditch', 'runoff'] as const;
/** Every variant a scenery item may take; each kind accepts its own (SCENERY_VARIANTS in scenery.ts). */
export const VARIANT_NAMES = [
  'leafy',
  'conifer',
  'billboard',
  'board',
  'single',
  'double',
] as const;

const id = z.string().min(1).max(64);
const ranged = ({ min, max }: NumericRule) => z.number().min(min).max(max);

const controlPoint = z.object({
  id,
  x: ranged(RULES.coordinate),
  y: ranged(RULES.altitude),
  z: ranged(RULES.coordinate),
  /** The segment leaving this point is a straight line (docs/adr/0012). */
  straight: z.literal(true).optional(),
  /**
   * Makes the point a rounded point: the track does not go through it but turns
   * on an arc of this radius, tangent to the straight sides leading to its neighbours.
   */
  radius: ranged(RULES.radius).optional(),
});

/** A place on the track: a control point plus a distance along the track after it (docs/adr/0006). */
const trackPosition = z.object({ point: id, distance: ranged(RULES.positionDistance) });

/** Barrier ends were control point IDs before docs/adr/0008: such an end sits on its point. */
const barrierEnd = z.preprocess(
  (value) => (typeof value === 'string' ? { point: value, distance: 0 } : value),
  trackPosition,
);

const barrier = z.object({
  id,
  type: z.enum(BARRIER_TYPES),
  side: z.enum(SIDES),
  /** Where the barrier starts, in track direction. */
  from: barrierEnd,
  /** Where the barrier ends, in track direction. */
  to: barrierEnd,
  offset: ranged(RULES.barrierOffset),
});

/** A stretch where the roadway takes another width than the base one, both edges alike. */
const widthZone = z.object({
  id,
  /** Where the zone starts, in track direction. */
  from: trackPosition,
  /** Where the zone ends, in track direction. */
  to: trackPosition,
  width: ranged(RULES.width),
});

/** A stretch where the roadway is banked across the track, raised on one side. */
const bankZone = z.object({
  id,
  /** Where the zone starts, in track direction. */
  from: trackPosition,
  /** Where the zone ends, in track direction. */
  to: trackPosition,
  /** Bank angle in degrees. */
  angle: ranged(RULES.bankAngle),
  /** The raised edge of the roadway. */
  high: z.enum(SIDES),
  /** Length over which the roadway tilts at each end, shortened to half a short zone. */
  transition: ranged(RULES.bankTransition).default(DEFAULTS.bankTransition),
});

/** A free-standing object on the ground: a tree or grove, a building, a grandstand, a sign or a light. */
const sceneryItem = z.object({
  id,
  kind: z.enum(SCENERY_KINDS),
  x: ranged(RULES.coordinate),
  z: ranged(RULES.coordinate),
  /** Where its front faces, in degrees clockwise from -Z on the plan. */
  heading: ranged(RULES.heading),
  /** Stops cars in game, through an invisible collider. */
  solid: z.boolean(),
  /** Across its front, front to back, and from the ground up; a grove spreads over its width. */
  width: ranged(RULES.scenerySize),
  depth: ranged(RULES.scenerySize),
  height: ranged(RULES.scenerySize),
  variant: z.enum(VARIANT_NAMES).optional(),
  /** Trees in a grove, scattered from the item's ID so they stay in place. */
  count: z.number().int().min(RULES.groveCount.min).max(RULES.groveCount.max).optional(),
});

/**
 * A shape given to the ground beside the track, on one side between two track
 * positions (docs/adr/0015). Each type accepts its own settings (EARTHWORK_RULES in terrain.ts).
 */
const earthwork = z.object({
  id,
  type: z.enum(EARTHWORK_TYPES),
  side: z.enum(SIDES),
  /** Where the earthwork starts, in track direction. */
  from: trackPosition,
  /** Where the earthwork ends, in track direction. */
  to: trackPosition,
  /** Distance from the outer edge of the shoulders to where the ground starts changing. */
  offset: ranged(RULES.earthworkOffset),
  /** Across the track: the slope of an embankment, a ditch, the flat of a run-off. */
  width: ranged(RULES.earthworkWidth),
  /** Rise of an embankment, negative when it falls; depth of a ditch. */
  height: ranged(RULES.earthworkHeight),
});

/** A free-standing rise of the ground, oval and oriented, or a hollow when its height is negative. */
const hill = z.object({
  id,
  x: ranged(RULES.coordinate),
  z: ranged(RULES.coordinate),
  /** Where its width runs across, in degrees clockwise from -Z on the plan, like a scenery item. */
  heading: ranged(RULES.heading),
  width: ranged(RULES.hillSize),
  depth: ranged(RULES.hillSize),
  height: ranged(RULES.hillHeight),
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
  bankZones: z.array(bankZone).max(RULES.bankZones.max).default([]),
  scenery: z.array(sceneryItem).max(RULES.scenery.max).default([]),
  earthworks: z.array(earthwork).max(RULES.earthworks.max).default([]),
  hills: z.array(hill).max(RULES.hills.max).default([]),
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
  for (const item of [
    ...project.points,
    ...project.barriers,
    ...project.widthZones,
    ...project.bankZones,
    ...project.scenery,
    ...project.earthworks,
    ...project.hills,
  ]) {
    if (ids.has(item.id)) return fail('duplicate-id', []);
    ids.add(item.id);
  }
  const circuit = isCircuit(project);
  project.barriers.forEach((barrier, index) => {
    const from = order.get(barrier.from.point),
      to = order.get(barrier.to.point);
    if (from === undefined || to === undefined)
      return fail('barrier-endpoint', ['barriers', index]);
    // Positions are anchored on the nearest control point before them, so their
    // order along the track follows their points, then their distances.
    const compared = from - to || barrier.from.distance - barrier.to.distance;
    if (compared === 0) return fail('barrier-span', ['barriers', index]);
    // Only a circuit lets a barrier run through the start.
    if (!circuit && compared > 0) fail('barrier-direction', ['barriers', index]);
  });
  const positions = [
    ['startLine', project.startLine],
    ['pitLane', project.pitLane?.entry],
    ['pitLane', project.pitLane?.exit],
    ...project.widthZones.flatMap((zone) => [
      ['widthZones', zone.from] as const,
      ['widthZones', zone.to] as const,
    ]),
    ...project.bankZones.flatMap((zone) => [
      ['bankZones', zone.from] as const,
      ['bankZones', zone.to] as const,
    ]),
    ...project.earthworks.flatMap((earthwork) => [
      ['earthworks', earthwork.from] as const,
      ['earthworks', earthwork.to] as const,
    ]),
  ] as const;
  for (const [field, position] of positions)
    if (position && !order.has(position.point)) return fail('position-point', [field]);
  project.scenery.forEach((item, index) => {
    if (item.variant && !SCENERY_VARIANTS[item.kind].includes(item.variant))
      fail('invalid-value', ['scenery', index, 'variant']);
    for (const size of SCENERY_SIZE_NAMES) {
      const { min, max } = SCENERY_SIZES[item.kind][size];
      if (item[size] < min || item[size] > max) fail('invalid-value', ['scenery', index, size]);
    }
  });
  project.earthworks.forEach((earthwork, index) => {
    for (const setting of EARTHWORK_SETTING_NAMES) {
      const { min, max } = EARTHWORK_RULES[earthwork.type][setting];
      if (earthwork[setting] < min || earthwork[setting] > max)
        fail('invalid-value', ['earthworks', index, setting]);
    }
    if (earthwork.offset + earthwork.width > EARTHWORK_REACH)
      fail('invalid-value', ['earthworks', index, 'width']);
  });
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
export type BankZone = Project['bankZones'][number];
export type RoadSettings = Project['road'];
export type TrackPosition = NonNullable<Project['startLine']>;
export type PitLane = NonNullable<Project['pitLane']>;
export type SceneryItem = Project['scenery'][number];
export type SceneryKind = SceneryItem['kind'];
export type SceneryVariant = NonNullable<SceneryItem['variant']>;
export type Earthwork = Project['earthworks'][number];
export type EarthworkType = Earthwork['type'];
export type Hill = Project['hills'][number];

/** A circuit needs three control points to close; with fewer it is driven as a road. */
export const isCircuit = (project: Pick<Project, 'road' | 'points'>) =>
  project.road.closed && project.points.length > 2;

function toDetail(error: z.ZodError): ProjectErrorDetail {
  const issue = error.issues[0];
  const [head] = issue.path;
  if (issue.code === 'custom' && issue.params?.reason === 'invalid-value')
    return { code: 'invalid-value', path: issue.path.join('.') };
  if (issue.code === 'custom' && typeof issue.params?.reason === 'string')
    return { code: issue.params.reason } as ProjectErrorDetail;
  if (head === 'format' || head === 'version' || issue.path.length === 0)
    return { code: 'not-a-project' };
  if (issue.code === 'too_big' && issue.path.length === 1) {
    if (head === 'points') return { code: 'points-limit', max: RULES.points.max };
    if (head === 'barriers') return { code: 'barriers-limit', max: RULES.barriers.max };
    if (head === 'widthZones') return { code: 'width-zones-limit', max: RULES.widthZones.max };
    if (head === 'bankZones') return { code: 'bank-zones-limit', max: RULES.bankZones.max };
    if (head === 'scenery') return { code: 'scenery-limit', max: RULES.scenery.max };
    if (head === 'earthworks') return { code: 'earthworks-limit', max: RULES.earthworks.max };
    if (head === 'hills') return { code: 'hills-limit', max: RULES.hills.max };
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
