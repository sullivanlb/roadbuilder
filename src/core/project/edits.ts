import { current } from 'immer';
import type { Draft } from 'immer';
import { createId } from '../ids';
import type { Id } from '../ids';
import { clamp, planDistance } from '../math';
import type { PlanPoint, Vec3 } from '../math';
import { DEFAULTS, RULES } from './rules';
import type { NumericRule } from './rules';
import { sampleTrack, trackLength } from '../track/centerline';
import type { Sample } from '../track/centerline';
import { positionAt, positionDistance, reanchorPosition } from '../track/positions';
import { overlapStart, widthZoneRanges } from '../track/width';
import type { TrackRange } from '../track/width';
import { isCircuit } from './schema';
import type {
  Barrier,
  BarrierType,
  PitLane,
  Project,
  RoadSettings,
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

/** Inserts a control point at `index` and returns its ID. Check pointRejection() first. */
export function insertPoint(draft: ProjectDraft, index: number, at: Vec3): Id {
  const id = createId();
  draft.points.splice(clamp(index, 0, draft.points.length), 0, {
    id,
    x: within(RULES.coordinate, at.x),
    y: within(RULES.altitude, at.y),
    z: within(RULES.coordinate, at.z),
  });
  return id;
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
  for (const zone of draft.widthZones) {
    zone.from = map(zone.from);
    zone.to = map(zone.to);
  }
}

/** Pits only exist on a circuit: a road keeps a single car and no pit lane. */
function dropPitsUnlessCircuit(draft: ProjectDraft) {
  if (isCircuit(draft)) return;
  draft.pitLane = null;
  draft.cars = 1;
}

/**
 * Removes a control point. The barriers that end on it go with it; the track
 * positions anchored on it move to the previous point and keep their place.
 */
export function removePoint(draft: ProjectDraft, id: Id) {
  const { track, samples } = measured(draft);
  const removed = track.points.findIndex((point) => point.id === id);
  if (removed < 0) return;
  mapPositions(draft, (position) => reanchorPosition(track, samples, position, removed));
  draft.points.splice(removed, 1);
  draft.barriers = draft.barriers.filter((barrier) => barrier.from !== id && barrier.to !== id);
  if (!draft.points.length) delete draft.startLine;
  dropPitsUnlessCircuit(draft);
}

/**
 * Drives the track the other way. A circuit keeps its first control point so the
 * start stays in place. Barriers keep covering the same ground: their span is
 * swapped and they change side, since left and right follow the direction.
 * Width zones keep their ground too: their start becomes their end.
 */
export function reverseTrack(draft: ProjectDraft) {
  const before = measured(draft);
  const length = trackLength(before.samples);
  // Track distances measured before the reversal, to put positions back in place.
  const distance = (position: TrackPosition) =>
    positionDistance(before.track, before.samples, position) ?? 0;
  const startLine = draft.startLine && distance(draft.startLine);
  const pits = draft.pitLane && [distance(draft.pitLane.entry), distance(draft.pitLane.exit)];
  const zones = draft.widthZones.map((zone) => [distance(zone.from), distance(zone.to)]);
  if (isCircuit(draft)) draft.points = [draft.points[0], ...draft.points.slice(1).reverse()];
  else draft.points.reverse();
  for (const barrier of draft.barriers) {
    [barrier.from, barrier.to] = [barrier.to, barrier.from];
    barrier.side = opposite(barrier.side);
  }
  const after = measured(draft);
  const mirrored = (s: number) => positionAt(after.track, after.samples, length - s);
  if (draft.startLine && startLine !== undefined) draft.startLine = mirrored(startLine);
  if (draft.pitLane && pits) {
    // The lane is driven the other way: its exit becomes the entry.
    draft.pitLane.entry = mirrored(pits[1]);
    draft.pitLane.exit = mirrored(pits[0]);
    draft.pitLane.side = opposite(draft.pitLane.side);
  }
  draft.widthZones.forEach((zone, index) => {
    const [from, to] = zones[index];
    zone.from = mirrored(to);
    zone.to = mirrored(from);
  });
}

/**
 * Turns the track into a circuit or a road. A barrier or a width zone running
 * through the start of a circuit is split at the start, since a road has no way
 * through it.
 */
export function setClosed(draft: ProjectDraft, closed: boolean) {
  const wasCircuit = isCircuit(draft);
  const before = wasCircuit ? measured(draft) : null;
  draft.road.closed = closed;
  dropPitsUnlessCircuit(draft);
  if (!before || isCircuit(draft)) return;
  splitWidthZonesAtStart(draft, before);
  const order = new Map(draft.points.map((point, index) => [point.id, index]));
  const first = draft.points[0].id,
    last = draft.points.at(-1)!.id;
  draft.barriers = draft.barriers.flatMap((barrier) => {
    if (order.get(barrier.from)! < order.get(barrier.to)!) return [barrier];
    const parts: Barrier[] = [];
    if (barrier.from !== last) parts.push({ ...barrier, to: last });
    if (barrier.to !== first) parts.push({ ...barrier, id: createId(), from: first });
    return parts;
  });
}

/**
 * Splits the width zones that run through the start of a circuit about to become
 * a road: one part up to the last control point, one from the first.
 */
function splitWidthZonesAtStart(
  draft: ProjectDraft,
  before: { track: Project; samples: Sample[] },
) {
  const first = draft.points[0].id,
    last = draft.points.at(-1)!.id;
  const distance = (position: TrackPosition) =>
    positionDistance(before.track, before.samples, position) ?? 0;
  draft.widthZones = draft.widthZones.flatMap((zone) => {
    if (distance(zone.from) <= distance(zone.to)) return [zone];
    const parts: WidthZone[] = [];
    // A start on the last point lies on the closing segment, which the road loses.
    if (zone.from.point !== last) parts.push({ ...zone, to: { point: last, distance: 0 } });
    if (zone.to.point !== first || zone.to.distance > 0)
      parts.push({ ...zone, id: createId(), from: { point: first, distance: 0 } });
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

/** Why a barrier cannot be laid between two control points, or null when it can. */
export function barrierRejection(
  project: Project,
  from: Id,
  to: Id,
): 'same-point' | 'barriers-limit' | null {
  if (from === to) return 'same-point';
  if (project.barriers.length >= RULES.barriers.max) return 'barriers-limit';
  return null;
}

/**
 * Lays a barrier from one control point to another and returns its ID. On a road
 * the span is reordered to follow the track direction. Check barrierRejection() first.
 */
export function addBarrier(
  draft: ProjectDraft,
  barrier: { type: BarrierType; side: Side; from: Id; to: Id },
): Id {
  let { from, to } = barrier;
  if (!isCircuit(draft)) {
    const index = (id: Id) => draft.points.findIndex((point) => point.id === id);
    if (index(from) > index(to)) [from, to] = [to, from];
  }
  const id = createId();
  draft.barriers.push({ ...barrier, id, from, to, offset: DEFAULTS.barrierOffset });
  return id;
}

export function updateBarrier(
  draft: ProjectDraft,
  id: Id,
  patch: Partial<Pick<Barrier, 'type' | 'side' | 'offset'>>,
) {
  const barrier = draft.barriers.find((candidate) => candidate.id === id);
  if (!barrier) return;
  if (patch.type !== undefined) barrier.type = patch.type;
  if (patch.side !== undefined) barrier.side = patch.side;
  if (patch.offset !== undefined) barrier.offset = within(RULES.barrierOffset, patch.offset);
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
  if (range.length < RULES.widthZoneLength) return 'too-short';
  const total = trackLength(samples);
  if (widthZoneRanges(project, samples).some((other) => overlapStart(other, range, total) !== null))
    return 'overlap';
  return null;
}

const clampPosition = (position: TrackPosition): TrackPosition => ({
  ...position,
  distance: within(RULES.positionDistance, position.distance),
});

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
