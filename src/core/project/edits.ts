import { current } from 'immer';
import type { Draft } from 'immer';
import { createId } from '../ids';
import type { Id } from '../ids';
import { clamp, planDistance } from '../math';
import type { PlanPoint, Vec3 } from '../math';
import { arcLayout, corners } from '../track/geometry';
import type { ArcShape } from '../track/geometry';
import { DEFAULTS, RULES } from './rules';
import type { NumericRule } from './rules';
import { sampleTrack, trackLength } from '../track/centerline';
import type { Sample } from '../track/centerline';
import { positionAt, positionDistance, reanchorPosition } from '../track/positions';
import { overlapStart } from '../track/ranges';
import { bankZoneRanges } from '../track/bank';
import { widthZoneRanges } from '../track/width';
import type { TrackRange } from '../track/ranges';
import { newScenery, SCENERY_SIZES, SCENERY_VARIANTS } from './scenery';
import { EARTHWORK_DEFAULTS, EARTHWORK_REACH, EARTHWORK_RULES, HILL_DEFAULTS } from './terrain';
import type { EarthworkSettings } from './terrain';
import { isCircuit } from './schema';
import type {
  BankZone,
  Barrier,
  ControlPoint,
  Earthwork,
  EarthworkType,
  Hill,
  PitLane,
  Project,
  RoadSettings,
  SceneryItem,
  SceneryKind,
  Side,
  TrackPosition,
  WidthZone,
} from './schema';

/**
 * Editing operations. Each one is an immer recipe: it receives a draft of the
 * project and changes it in place; the caller decides when the result becomes a
 * new history entry. Values are clamped to the project rules here, so no caller
 * can produce a project the schema would refuse.
 */
type ProjectDraft = Draft<Project>;

const within = (rule: NumericRule, value: number) => clamp(value, rule.min, rule.max);

const clampPosition = (position: TrackPosition): TrackPosition => ({
  ...position,
  distance: within(RULES.positionDistance, position.distance),
});

/** Why a control point cannot be added, or null when it can. */
export function pointRejection(
  project: Project,
  at: PlanPoint,
): 'points-limit' | 'too-close' | null {
  if (project.points.length >= RULES.points.max) return 'points-limit';
  if (project.points.some((point) => planDistance(point, at) < RULES.pointSpacing))
    return 'too-close';
  return null;
}

/**
 * Inserts a control point at `index` and returns its ID. Check pointRejection()
 * first. A point landing on a straight splits it into two straights.
 */
export function insertPoint(draft: ProjectDraft, index: number, at: Vec3): Id {
  const id = createId();
  const points = draft.points;
  index = clamp(index, 0, points.length);
  const circuit = isCircuit(draft);
  const previous = index > 0 ? points[index - 1] : circuit ? points.at(-1) : undefined;
  const point: Draft<ControlPoint> = {
    id,
    x: within(RULES.coordinate, at.x),
    y: within(RULES.altitude, at.y),
    z: within(RULES.coordinate, at.z),
  };
  if (previous && (circuit || index < points.length)) {
    if (previous.straight) point.straight = true;
  } else if (previous) {
    // The last point of a road leads nowhere yet: the new segment starts curved.
    delete previous.straight;
  }
  points.splice(index, 0, point);
  return id;
}

/** Draws the segment leaving a control point as a straight line, or curved again. */
export function setStraight(draft: ProjectDraft, id: Id, straight: boolean) {
  const point = draft.points.find((candidate) => candidate.id === id);
  if (!point) return;
  if (straight) point.straight = true;
  else delete point.straight;
}

/** Rounds a control point with an arc of `radius`, or takes the rounding off with null. */
export function setRadius(draft: ProjectDraft, id: Id, radius: number | null) {
  const point = draft.points.find((candidate) => candidate.id === id);
  if (!point) return;
  if (radius === null) delete point.radius;
  else point.radius = within(RULES.radius, radius);
}

/**
 * Rounds a control point with the default radius, or less when its sides leave
 * no room for it, so the arc gets the radius it shows.
 */
export function roundPoint(draft: ProjectDraft, id: Id) {
  setRadius(draft, id, DEFAULTS.radius);
  const track: Project = current(draft);
  const corner = corners(track).get(track.points.findIndex((point) => point.id === id));
  if (corner && corner.radius < corner.requested) setRadius(draft, id, Math.floor(corner.radius));
}

/**
 * Gives the segment leaving a control point another length, from point to point,
 * by moving the next point along the segment.
 */
export function setSegmentLength(draft: ProjectDraft, id: Id, length: number) {
  const points = draft.points;
  const index = points.findIndex((candidate) => candidate.id === id);
  const next = index < 0 ? undefined : points[(index + 1) % points.length];
  if (!next || next === points[index] || (index === points.length - 1 && !isCircuit(draft))) return;
  const point = points[index];
  const current = planDistance(point, next) || 1;
  const scale = within(RULES.segmentLength, length) / current;
  next.x = within(RULES.coordinate, point.x + (next.x - point.x) * scale);
  next.z = within(RULES.coordinate, point.z + (next.z - point.z) * scale);
}

/** Why an arc cannot be drawn, or null when it can. */
export function arcRejection(
  project: Project,
  start: PlanPoint,
  shape: ArcShape,
): 'points-limit' | 'too-close' | 'too-small' | null {
  const layout = arcLayout(start, shape);
  if (project.points.length + layout.vertices.length + 1 > RULES.points.max) return 'points-limit';
  if (shape.radius < RULES.radius.min || layout.tangent < RULES.pointSpacing) return 'too-small';
  if (project.points.some((point) => planDistance(point, layout.end) < RULES.pointSpacing))
    return 'too-close';
  return null;
}

/**
 * Draws an arc after the control point at `after`, from `start` along its
 * heading: rounded points of the arc's radius, then a plain point where it
 * ends, which is returned. Altitude stays at `y`. Check arcRejection() first.
 */
export function addArc(
  draft: ProjectDraft,
  after: number,
  start: PlanPoint,
  shape: ArcShape,
  y: number,
): Id {
  const layout = arcLayout(start, shape);
  const radius = within(RULES.radius, shape.radius);
  let index = after + 1;
  for (const vertex of layout.vertices) {
    const id = insertPoint(draft, index++, { ...vertex, y });
    setRadius(draft, id, radius);
  }
  const end = insertPoint(draft, index, { ...layout.end, y });
  // The point the arc leaves from now leads into it: what followed it follows the arc.
  const from = draft.points[after];
  if (from?.straight) {
    delete from.straight;
    for (let i = after + 1; i < index; i++) delete draft.points[i].straight;
    draft.points[index].straight = true;
  }
  return end;
}

export function updatePoint(draft: ProjectDraft, id: Id, patch: Partial<Vec3>) {
  const point = draft.points.find((candidate) => candidate.id === id);
  if (!point) return;
  if (patch.x !== undefined) point.x = within(RULES.coordinate, patch.x);
  if (patch.y !== undefined) point.y = within(RULES.altitude, patch.y);
  if (patch.z !== undefined) point.z = within(RULES.coordinate, patch.z);
}

/** A snapshot of the draft with its centerline, to work out track positions. */
function measured(draft: ProjectDraft): { track: Project; samples: Sample[] } {
  const track: Project = current(draft);
  return { track, samples: sampleTrack(track) };
}

/** Rewrites every track position of the project. */
function mapPositions(draft: ProjectDraft, map: (position: TrackPosition) => TrackPosition) {
  if (draft.startLine) draft.startLine = map(draft.startLine);
  if (draft.pitLane) {
    draft.pitLane.entry = map(draft.pitLane.entry);
    draft.pitLane.exit = map(draft.pitLane.exit);
  }
  for (const item of [
    ...draft.barriers,
    ...draft.widthZones,
    ...draft.bankZones,
    ...draft.earthworks,
  ]) {
    item.from = map(item.from);
    item.to = map(item.to);
  }
}

/** Pits only exist on a circuit: a road keeps a single car and no pit lane. */
function dropPitsUnlessCircuit(draft: ProjectDraft) {
  if (isCircuit(draft)) return;
  draft.pitLane = null;
  draft.cars = 1;
}

/**
 * Removes a control point. The track positions anchored on it, barrier and zone
 * ends included, move to the previous point and keep their place.
 */
export function removePoint(draft: ProjectDraft, id: Id) {
  const { track, samples } = measured(draft);
  const removed = track.points.findIndex((point) => point.id === id);
  if (removed < 0) return;
  mapPositions(draft, (position) => reanchorPosition(track, samples, position, removed));
  // The two segments around the point become one, straight only if both were.
  const points = draft.points,
    circuit = isCircuit(track);
  const previous = removed > 0 ? points[removed - 1] : circuit ? points.at(-1) : undefined;
  if (previous && (!points[removed].straight || (!circuit && removed === points.length - 1)))
    delete previous.straight;
  draft.points.splice(removed, 1);
  if (!draft.points.length) delete draft.startLine;
  dropPitsUnlessCircuit(draft);
}

/** Removes several control points, one after the other (see removePoint). */
export function removePoints(draft: ProjectDraft, ids: readonly Id[]) {
  for (const id of ids) removePoint(draft, id);
}

/** Raises or lowers several control points by `dy`, each within the altitude rule. */
export function shiftAltitude(draft: ProjectDraft, ids: readonly Id[], dy: number) {
  for (const point of draft.points)
    if (ids.includes(point.id)) point.y = within(RULES.altitude, point.y + dy);
}

/** Puts several control points at the same altitude. */
export function setAltitude(draft: ProjectDraft, ids: readonly Id[], y: number) {
  for (const point of draft.points) if (ids.includes(point.id)) point.y = within(RULES.altitude, y);
}

/**
 * Drives the track the other way. A circuit keeps its first control point so the
 * start stays in place. Barriers, zones and earthworks keep covering the same
 * ground: their start becomes their end, and barriers, earthworks and the raised
 * edge of bank zones change side, since left and right follow the direction.
 */
export function reverseTrack(draft: ProjectDraft) {
  const before = measured(draft);
  const length = trackLength(before.samples);
  // Track distances measured before the reversal, to put positions back in place.
  const distance = (position: TrackPosition) =>
    positionDistance(before.track, before.samples, position) ?? 0;
  const startLine = draft.startLine && distance(draft.startLine);
  const pits = draft.pitLane && [distance(draft.pitLane.entry), distance(draft.pitLane.exit)];
  const laid = () => [
    ...draft.barriers,
    ...draft.widthZones,
    ...draft.bankZones,
    ...draft.earthworks,
  ];
  const ranges = laid().map((item) => [distance(item.from), distance(item.to)]);
  // A straight is marked on the point it leaves from, which becomes the one it arrives at.
  const n = draft.points.length,
    circuit = isCircuit(draft);
  const straights = draft.points.map((_, i) =>
    i > 0 ? draft.points[i - 1].straight : circuit ? draft.points[n - 1].straight : undefined,
  );
  draft.points.forEach((point, i) => setStraight(draft, point.id, straights[i] === true));
  if (circuit) draft.points = [draft.points[0], ...draft.points.slice(1).reverse()];
  else draft.points.reverse();
  for (const item of [...draft.barriers, ...draft.earthworks]) item.side = opposite(item.side);
  for (const zone of draft.bankZones) zone.high = opposite(zone.high);
  const after = measured(draft);
  const mirrored = (s: number) => positionAt(after.track, after.samples, length - s);
  if (draft.startLine && startLine !== undefined) draft.startLine = mirrored(startLine);
  if (draft.pitLane && pits) {
    // The lane is driven the other way: its exit becomes the entry.
    draft.pitLane.entry = mirrored(pits[1]);
    draft.pitLane.exit = mirrored(pits[0]);
    draft.pitLane.side = opposite(draft.pitLane.side);
  }
  laid().forEach((item, index) => {
    const [from, to] = ranges[index];
    item.from = mirrored(to);
    item.to = mirrored(from);
  });
}

/**
 * Turns the track into a circuit or a road. A barrier, a zone or an earthwork running
 * through the start of a circuit is split at the start, since a road has no way
 * through it.
 */
export function setClosed(draft: ProjectDraft, closed: boolean) {
  const wasCircuit = isCircuit(draft);
  const before = wasCircuit ? measured(draft) : null;
  draft.road.closed = closed;
  dropPitsUnlessCircuit(draft);
  if (!before || isCircuit(draft)) return;
  const split = splitAtStart(draft, before);
  draft.barriers = split(draft.barriers);
  draft.widthZones = split(draft.widthZones);
  draft.bankZones = split(draft.bankZones);
  draft.earthworks = split(draft.earthworks);
}

/**
 * Splits what runs through the start of a circuit about to become a road: one
 * part up to the last control point, one from the first.
 */
function splitAtStart(draft: ProjectDraft, before: { track: Project; samples: Sample[] }) {
  const first = draft.points[0].id,
    last = draft.points.at(-1)!.id;
  const distance = (position: TrackPosition) =>
    positionDistance(before.track, before.samples, position) ?? 0;
  return <T extends Barrier | WidthZone | BankZone | Earthwork>(items: T[]): T[] =>
    items.flatMap((item) => {
      if (distance(item.from) <= distance(item.to)) return [item];
      const parts: T[] = [];
      // A start on the last point lies on the closing segment, which the road loses.
      if (item.from.point !== last) parts.push({ ...item, to: { point: last, distance: 0 } });
      if (item.to.point !== first || item.to.distance > 0)
        parts.push({ ...item, id: createId(), from: { point: first, distance: 0 } });
      return parts;
    });
}

export function setRoad(
  draft: ProjectDraft,
  patch: Partial<Pick<RoadSettings, 'width' | 'shoulder' | 'kerbs'>>,
) {
  if (patch.width !== undefined) draft.road.width = within(RULES.width, patch.width);
  if (patch.shoulder !== undefined) draft.road.shoulder = within(RULES.shoulder, patch.shoulder);
  if (patch.kerbs !== undefined) draft.road.kerbs = patch.kerbs;
}

export function setTerrainMargin(draft: ProjectDraft, margin: number) {
  draft.terrain.margin = within(RULES.terrainMargin, margin);
}

/** Renames the project; a blank name falls back to `fallback`. */
export function rename(draft: ProjectDraft, name: string, fallback: string) {
  draft.name = name.trim().slice(0, RULES.name.max) || fallback;
}

export function setAuthor(draft: ProjectDraft, author: string) {
  draft.author = author.trim().slice(0, RULES.author.max);
}

/** Why a barrier cannot be laid over a stretch of track, or null when it can. */
export function barrierRejection(
  project: Project,
  range: TrackRange,
): 'too-short' | 'barriers-limit' | null {
  if (range.length < RULES.rangeLength) return 'too-short';
  if (project.barriers.length >= RULES.barriers.max) return 'barriers-limit';
  return null;
}

/**
 * Lays a barrier between two track positions, in track direction, and returns
 * its ID. Check barrierRejection() first.
 */
export function addBarrier(
  draft: ProjectDraft,
  barrier: Pick<Barrier, 'type' | 'side' | 'from' | 'to'>,
): Id {
  const id = createId();
  draft.barriers.push({
    ...barrier,
    id,
    from: clampPosition(barrier.from),
    to: clampPosition(barrier.to),
    offset: DEFAULTS.barrierOffset,
  });
  return id;
}

export function updateBarrier(
  draft: ProjectDraft,
  id: Id,
  patch: Partial<Pick<Barrier, 'type' | 'side' | 'offset' | 'from' | 'to'>>,
) {
  const barrier = draft.barriers.find((candidate) => candidate.id === id);
  if (!barrier) return;
  if (patch.type !== undefined) barrier.type = patch.type;
  if (patch.side !== undefined) barrier.side = patch.side;
  if (patch.offset !== undefined) barrier.offset = within(RULES.barrierOffset, patch.offset);
  if (patch.from !== undefined) barrier.from = clampPosition(patch.from);
  if (patch.to !== undefined) barrier.to = clampPosition(patch.to);
}

export function removeBarrier(draft: ProjectDraft, id: Id) {
  draft.barriers = draft.barriers.filter((barrier) => barrier.id !== id);
}

export const opposite = (side: Side): Side => (side === 'right' ? 'left' : 'right');

/** Why a width zone cannot be laid over a stretch of track, or null when it can. */
export function widthZoneRejection(
  project: Project,
  samples: readonly Sample[],
  range: TrackRange,
): 'width-zones-limit' | 'too-short' | 'overlap' | null {
  if (project.widthZones.length >= RULES.widthZones.max) return 'width-zones-limit';
  if (range.length < RULES.rangeLength) return 'too-short';
  const total = trackLength(samples);
  if (widthZoneRanges(project, samples).some((other) => overlapStart(other, range, total) !== null))
    return 'overlap';
  return null;
}

/**
 * Lays a width zone between two track positions, in track direction, and returns
 * its ID. It starts 4 m wider than the base width. Check widthZoneRejection() first.
 */
export function addWidthZone(
  draft: ProjectDraft,
  zone: Pick<WidthZone, 'from' | 'to'> & { width?: number },
): Id {
  const id = createId();
  draft.widthZones.push({
    id,
    from: clampPosition(zone.from),
    to: clampPosition(zone.to),
    width: within(RULES.width, zone.width ?? draft.road.width + 4),
  });
  return id;
}

export function updateWidthZone(
  draft: ProjectDraft,
  id: Id,
  patch: Partial<Pick<WidthZone, 'from' | 'to' | 'width'>>,
) {
  const zone = draft.widthZones.find((candidate) => candidate.id === id);
  if (!zone) return;
  if (patch.from !== undefined) zone.from = clampPosition(patch.from);
  if (patch.to !== undefined) zone.to = clampPosition(patch.to);
  if (patch.width !== undefined) zone.width = within(RULES.width, patch.width);
}

export function removeWidthZone(draft: ProjectDraft, id: Id) {
  draft.widthZones = draft.widthZones.filter((zone) => zone.id !== id);
}

/** Why a bank zone cannot be laid over a stretch of track, or null when it can. */
export function bankZoneRejection(
  project: Project,
  samples: readonly Sample[],
  range: TrackRange,
): 'bank-zones-limit' | 'too-short' | 'overlap' | null {
  if (project.bankZones.length >= RULES.bankZones.max) return 'bank-zones-limit';
  if (range.length < RULES.rangeLength) return 'too-short';
  const total = trackLength(samples);
  if (bankZoneRanges(project, samples).some((other) => overlapStart(other, range, total) !== null))
    return 'overlap';
  return null;
}

/**
 * Lays a bank zone between two track positions, in track direction, and returns
 * its ID. It starts at the default angle and transition. Check bankZoneRejection() first.
 */
export function addBankZone(
  draft: ProjectDraft,
  zone: Pick<BankZone, 'from' | 'to' | 'high'> & { angle?: number; transition?: number },
): Id {
  const id = createId();
  draft.bankZones.push({
    id,
    from: clampPosition(zone.from),
    to: clampPosition(zone.to),
    angle: within(RULES.bankAngle, zone.angle ?? DEFAULTS.bankAngle),
    high: zone.high,
    transition: within(RULES.bankTransition, zone.transition ?? DEFAULTS.bankTransition),
  });
  return id;
}

export function updateBankZone(
  draft: ProjectDraft,
  id: Id,
  patch: Partial<Pick<BankZone, 'from' | 'to' | 'angle' | 'high' | 'transition'>>,
) {
  const zone = draft.bankZones.find((candidate) => candidate.id === id);
  if (!zone) return;
  if (patch.from !== undefined) zone.from = clampPosition(patch.from);
  if (patch.to !== undefined) zone.to = clampPosition(patch.to);
  if (patch.angle !== undefined) zone.angle = within(RULES.bankAngle, patch.angle);
  if (patch.high !== undefined) zone.high = patch.high;
  if (patch.transition !== undefined)
    zone.transition = within(RULES.bankTransition, patch.transition);
}

export function removeBankZone(draft: ProjectDraft, id: Id) {
  draft.bankZones = draft.bankZones.filter((zone) => zone.id !== id);
}

export function setStartLine(draft: ProjectDraft, position: TrackPosition) {
  draft.startLine = { ...position, distance: within(RULES.positionDistance, position.distance) };
}

/** Lays the pit lane of a circuit; with no circuit there is nothing to do. */
export function setPitLane(
  draft: ProjectDraft,
  lane: Pick<PitLane, 'side' | 'entry' | 'exit'> & { width?: number },
) {
  if (!isCircuit(draft)) return;
  draft.pitLane = {
    side: lane.side,
    entry: { ...lane.entry, distance: within(RULES.positionDistance, lane.entry.distance) },
    exit: { ...lane.exit, distance: within(RULES.positionDistance, lane.exit.distance) },
    width: within(RULES.pitLaneWidth, lane.width ?? draft.pitLane?.width ?? DEFAULTS.pitLaneWidth),
  };
}

export function updatePitLane(
  draft: ProjectDraft,
  patch: Partial<Pick<PitLane, 'side' | 'entry' | 'exit' | 'width'>>,
) {
  const lane = draft.pitLane;
  if (!lane) return;
  setPitLane(draft, { ...lane, ...patch });
}

/** Removes the pit lane; without one, the track hosts a single car. */
export function removePitLane(draft: ProjectDraft) {
  draft.pitLane = null;
  draft.cars = 1;
}

/** Sets the car count; more than one car needs a pit lane. */
export function setCars(draft: ProjectDraft, cars: number) {
  draft.cars = draft.pitLane ? Math.round(within(RULES.cars, cars)) : 1;
}

/** Why a scenery item cannot be added, or null when it can. */
export function sceneryRejection(project: Project, count = 1): 'scenery-limit' | null {
  return project.scenery.length + count > RULES.scenery.max ? 'scenery-limit' : null;
}

/** A heading brought back within a turn, in whole degrees. */
const turn = (heading: number) => Math.round(((heading % 360) + 360) % 360) % 360;

/** Places a scenery item of a kind, with the defaults of its kind, facing `heading`. */
export function addScenery(draft: ProjectDraft, kind: SceneryKind, at: PlanPoint, heading = 0): Id {
  const id = createId();
  const place = { x: within(RULES.coordinate, at.x), z: within(RULES.coordinate, at.z) };
  draft.scenery.push(newScenery(id, kind, place, turn(heading)));
  return id;
}

export type SceneryPatch = Partial<
  Pick<SceneryItem, 'x' | 'z' | 'heading' | 'solid' | 'width' | 'depth' | 'height' | 'variant'>
> & { count?: number };

/** Changes a scenery item, within the sizes and variants its kind accepts. */
export function updateScenery(draft: ProjectDraft, id: Id, patch: SceneryPatch) {
  const item = draft.scenery.find((candidate) => candidate.id === id);
  if (!item) return;
  const sizes = SCENERY_SIZES[item.kind];
  if (patch.x !== undefined) item.x = within(RULES.coordinate, patch.x);
  if (patch.z !== undefined) item.z = within(RULES.coordinate, patch.z);
  if (patch.heading !== undefined) item.heading = turn(patch.heading);
  if (patch.solid !== undefined) item.solid = patch.solid;
  if (patch.width !== undefined) item.width = within(sizes.width, patch.width);
  // A grove is round: its depth follows its width.
  if (item.kind === 'tree') item.depth = item.width;
  else if (patch.depth !== undefined) item.depth = within(sizes.depth, patch.depth);
  if (patch.height !== undefined) item.height = within(sizes.height, patch.height);
  if (patch.variant !== undefined && SCENERY_VARIANTS[item.kind].includes(patch.variant))
    item.variant = patch.variant;
  if (patch.count !== undefined && item.kind === 'tree')
    item.count = Math.round(within(RULES.groveCount, patch.count));
}

export function removeScenery(draft: ProjectDraft, ids: readonly Id[]) {
  draft.scenery = draft.scenery.filter((item) => !ids.includes(item.id));
}

/** Copies scenery items a little aside of the originals and returns the IDs of the copies. */
export function duplicateScenery(draft: ProjectDraft, ids: readonly Id[], offset: PlanPoint): Id[] {
  const copies = draft.scenery
    .filter((item) => ids.includes(item.id))
    .map((item) => ({
      ...item,
      id: createId(),
      x: within(RULES.coordinate, item.x + offset.x),
      z: within(RULES.coordinate, item.z + offset.z),
    }));
  draft.scenery.push(...copies);
  return copies.map((item) => item.id);
}

/** Why an earthwork cannot be laid over a stretch of track, or null when it can. */
export function earthworkRejection(
  project: Project,
  range: TrackRange,
): 'too-short' | 'earthworks-limit' | null {
  if (range.length < RULES.rangeLength) return 'too-short';
  if (project.earthworks.length >= RULES.earthworks.max) return 'earthworks-limit';
  return null;
}

/** Settings brought within the rules of a type, offset and width within the earthwork reach. */
function earthworkSettings(type: EarthworkType, settings: EarthworkSettings): EarthworkSettings {
  const rules = EARTHWORK_RULES[type];
  const offset = within(rules.offset, settings.offset);
  return {
    offset,
    width: Math.min(within(rules.width, settings.width), EARTHWORK_REACH - offset),
    height: within(rules.height, settings.height),
  };
}

/**
 * Lays an earthwork of a type between two track positions, in track direction,
 * with the defaults of its type, and returns its ID. Check earthworkRejection() first.
 */
export function addEarthwork(
  draft: ProjectDraft,
  earthwork: Pick<Earthwork, 'type' | 'side' | 'from' | 'to'>,
): Id {
  const id = createId();
  draft.earthworks.push({
    ...earthwork,
    id,
    from: clampPosition(earthwork.from),
    to: clampPosition(earthwork.to),
    ...EARTHWORK_DEFAULTS[earthwork.type],
  });
  return id;
}

export type EarthworkPatch = Partial<
  Pick<Earthwork, 'type' | 'side' | 'from' | 'to' | 'offset' | 'width' | 'height'>
>;

/** Changes an earthwork. A new type starts from the defaults of that type. */
export function updateEarthwork(draft: ProjectDraft, id: Id, patch: EarthworkPatch) {
  const earthwork = draft.earthworks.find((candidate) => candidate.id === id);
  if (!earthwork) return;
  if (patch.type !== undefined && patch.type !== earthwork.type) {
    earthwork.type = patch.type;
    Object.assign(earthwork, EARTHWORK_DEFAULTS[patch.type]);
  }
  if (patch.side !== undefined) earthwork.side = patch.side;
  if (patch.from !== undefined) earthwork.from = clampPosition(patch.from);
  if (patch.to !== undefined) earthwork.to = clampPosition(patch.to);
  Object.assign(
    earthwork,
    earthworkSettings(earthwork.type, {
      offset: patch.offset ?? earthwork.offset,
      width: patch.width ?? earthwork.width,
      height: patch.height ?? earthwork.height,
    }),
  );
}

export function removeEarthwork(draft: ProjectDraft, id: Id) {
  draft.earthworks = draft.earthworks.filter((earthwork) => earthwork.id !== id);
}

/** Why a hill cannot be raised, or null when it can. */
export function hillRejection(project: Project): 'hills-limit' | null {
  return project.hills.length >= RULES.hills.max ? 'hills-limit' : null;
}

/** Raises a hill of the default size at a place on the plan and returns its ID. */
export function addHill(draft: ProjectDraft, at: PlanPoint, heading = 0): Id {
  const id = createId();
  draft.hills.push({
    id,
    x: within(RULES.coordinate, at.x),
    z: within(RULES.coordinate, at.z),
    heading: turn(heading),
    ...HILL_DEFAULTS,
  });
  return id;
}

export type HillPatch = Partial<Pick<Hill, 'x' | 'z' | 'heading' | 'width' | 'depth' | 'height'>>;

export function updateHill(draft: ProjectDraft, id: Id, patch: HillPatch) {
  const hill = draft.hills.find((candidate) => candidate.id === id);
  if (!hill) return;
  if (patch.x !== undefined) hill.x = within(RULES.coordinate, patch.x);
  if (patch.z !== undefined) hill.z = within(RULES.coordinate, patch.z);
  if (patch.heading !== undefined) hill.heading = turn(patch.heading);
  if (patch.width !== undefined) hill.width = within(RULES.hillSize, patch.width);
  if (patch.depth !== undefined) hill.depth = within(RULES.hillSize, patch.depth);
  if (patch.height !== undefined) hill.height = within(RULES.hillHeight, patch.height);
}

export function removeHill(draft: ProjectDraft, id: Id) {
  draft.hills = draft.hills.filter((hill) => hill.id !== id);
}
