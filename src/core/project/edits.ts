import type { Draft } from 'immer';
import { createId } from '../ids';
import type { Id } from '../ids';
import { clamp, planDistance } from '../math';
import type { PlanPoint, Vec3 } from '../math';
import { DEFAULTS, RULES } from './rules';
import type { NumericRule } from './rules';
import { isCircuit } from './schema';
import type { Barrier, BarrierType, Project, RoadSettings, Side } from './schema';

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

/** Removes a control point; the barriers that end on it go with it. */
export function removePoint(draft: ProjectDraft, id: Id) {
  draft.points = draft.points.filter((point) => point.id !== id);
  draft.barriers = draft.barriers.filter((barrier) => barrier.from !== id && barrier.to !== id);
}

/**
 * Drives the track the other way. A circuit keeps its first control point so the
 * start stays in place. Barriers keep covering the same ground: their span is
 * swapped and they change side, since left and right follow the direction.
 */
export function reverseTrack(draft: ProjectDraft) {
  if (isCircuit(draft)) draft.points = [draft.points[0], ...draft.points.slice(1).reverse()];
  else draft.points.reverse();
  for (const barrier of draft.barriers) {
    [barrier.from, barrier.to] = [barrier.to, barrier.from];
    barrier.side = opposite(barrier.side);
  }
}

/**
 * Turns the track into a circuit or a road. A barrier running through the start
 * of a circuit is split at the start, since a road has no way through it.
 */
export function setClosed(draft: ProjectDraft, closed: boolean) {
  const wasCircuit = isCircuit(draft);
  draft.road.closed = closed;
  if (!wasCircuit || isCircuit(draft)) return;
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
