import { planDistance } from '../math';
import type { PlanPoint } from '../math';
import { isCircuit } from '../project/schema';
import type { Project } from '../project/schema';

// Straights and rounded points (docs/adr/0012). A rounded point is the corner of
// two straight sides: the track runs along the first, turns on an arc tangent to
// both, and leaves along the second. Its own place on the track is the middle of
// the arc.

type Points = Pick<Project, 'road' | 'points'>;

/** Turns smaller than this, in radians, go straight through a rounded point. */
const STRAIGHT_THROUGH = 1e-6;

/** The arc of a rounded point, as laid out from the radius asked for and the room its sides leave. */
export interface Corner {
  index: number;
  /** Where the arc leaves the incoming side and joins the outgoing one. */
  enter: PlanPoint;
  exit: PlanPoint;
  center: PlanPoint;
  /** Middle of the arc: where the point sits on the track. */
  middle: PlanPoint;
  /** Direction of the incoming side, a unit vector. */
  heading: PlanPoint;
  /** Turn, in radians, from 0 to π. */
  angle: number;
  /** 1 when the track turns right, -1 when it turns left. */
  sign: 1 | -1;
  /** The radius asked for, and the one the sides leave room for. */
  requested: number;
  radius: number;
}

const unit = (from: PlanPoint, to: PlanPoint): PlanPoint => {
  const length = planDistance(from, to) || 1;
  return { x: (to.x - from.x) / length, z: (to.z - from.z) / length };
};

/** The neighbours of a point that has two, or null at the ends of a road. */
function neighbours(track: Points, index: number) {
  const points = track.points,
    n = points.length;
  if (isCircuit(track))
    return { before: points[(index + n - 1) % n], after: points[(index + 1) % n] };
  if (index <= 0 || index >= n - 1) return null;
  return { before: points[index - 1], after: points[index + 1] };
}

/** Turn and requested tangent length of a rounded point, or null when it cannot be rounded. */
function turnOf(track: Points, index: number) {
  const point = track.points[index];
  const around = point?.radius !== undefined ? neighbours(track, index) : null;
  if (!around || !point.radius) return null;
  if (planDistance(around.before, point) < 1e-6 || planDistance(point, around.after) < 1e-6)
    return null;
  const a = unit(around.before, point),
    b = unit(point, around.after);
  const cross = a.x * b.z - a.z * b.x,
    angle = Math.atan2(Math.abs(cross), a.x * b.x + a.z * b.z);
  const tangent = angle < STRAIGHT_THROUGH ? 0 : point.radius * Math.tan(angle / 2);
  const sign: 1 | -1 = cross >= 0 ? 1 : -1;
  return { a, b, angle, sign, tangent, around };
}

/**
 * The arcs of every rounded point, by point index. Two arcs sharing a side get
 * its length in proportion to what they ask for; a radius that does not fit is
 * reduced.
 */
export function corners(track: Points): Map<number, Corner> {
  const points = track.points,
    n = points.length;
  const turns = points.map((_, i) => turnOf(track, i));
  const asked = (i: number) => turns[(i + n) % n]?.tangent ?? 0;
  // How much of the side between i and its neighbour j the arc of i may take.
  const room = (i: number, j: number) => {
    const length = planDistance(points[i], points[(j + n) % n]),
      wanted = asked(i) + asked(j);
    return wanted <= length * (1 + 1e-9) ? asked(i) : (length * asked(i)) / wanted;
  };
  const found = new Map<number, Corner>();
  turns.forEach((turn, i) => {
    if (!turn) return;
    const point = points[i],
      requested = point.radius!;
    const tangent = Math.min(turn.tangent, room(i, i - 1), room(i, i + 1));
    const radius = turn.tangent ? (requested * tangent) / turn.tangent : requested;
    const enter = { x: point.x - turn.a.x * tangent, z: point.z - turn.a.z * tangent };
    const exit = { x: point.x + turn.b.x * tangent, z: point.z + turn.b.z * tangent };
    // The centre lies on the side the track turns to, square to the incoming side.
    const center = {
      x: enter.x - turn.a.z * radius * turn.sign,
      z: enter.z + turn.a.x * radius * turn.sign,
    };
    const corner: Corner = {
      index: i,
      enter,
      exit,
      center,
      middle: enter,
      heading: turn.a,
      angle: turn.angle,
      sign: turn.sign,
      requested,
      radius,
    };
    corner.middle = arcPoint(corner, turn.angle / 2);
    found.set(i, corner);
  });
  return found;
}

/** The point of a corner's arc after turning by `angle` from where it enters. */
export function arcPoint(corner: Corner, angle: number): PlanPoint {
  if (!corner.angle) return corner.enter;
  const { center, enter, heading, radius } = corner;
  const ex = (enter.x - center.x) / radius,
    ez = (enter.z - center.z) / radius;
  return {
    x: center.x + radius * (Math.cos(angle) * ex + Math.sin(angle) * heading.x),
    z: center.z + radius * (Math.cos(angle) * ez + Math.sin(angle) * heading.z),
  };
}

/** A part of a segment, walked by its length. */
export interface Piece {
  length: number;
  at(along: number): PlanPoint;
}

const line = (from: PlanPoint, to: PlanPoint): Piece => {
  const length = planDistance(from, to);
  return {
    length,
    at: (along) => {
      const f = length ? along / length : 0;
      return { x: from.x + (to.x - from.x) * f, z: from.z + (to.z - from.z) * f };
    },
  };
};

const arc = (corner: Corner, from: number, to: number): Piece => ({
  length: corner.radius * (to - from),
  at: (along) => arcPoint(corner, from + (corner.radius ? along / corner.radius : 0)),
});

/**
 * The straight layout of segment `index`, from the place of its first point to
 * that of the next: half arcs at rounded ends, a line in between. Null for a
 * curved segment, which the centerline interpolates.
 */
export function straightPieces(
  track: Points,
  found: ReadonlyMap<number, Corner>,
  index: number,
): Piece[] | null {
  const points = track.points,
    next = (index + 1) % points.length;
  const first = found.get(index),
    last = found.get(next);
  if (!first && !last && !isStraight(track, index)) return null;
  const pieces: Piece[] = [];
  if (first) pieces.push(arc(first, first.angle / 2, first.angle));
  pieces.push(line(first ? first.exit : points[index], last ? last.enter : points[next]));
  if (last) pieces.push(arc(last, 0, last.angle / 2));
  return pieces.filter((piece) => piece.length > 1e-9);
}

/** Whether the segment leaving point `index` is drawn straight by the user. */
export const isStraight = (track: Points, index: number) => track.points[index]?.straight === true;

/** The point at `along` metres into a chain of pieces (clamped). */
export function along(pieces: readonly Piece[], distance: number): PlanPoint {
  for (const piece of pieces) {
    if (distance <= piece.length) return piece.at(Math.max(0, distance));
    distance -= piece.length;
  }
  const last = pieces.at(-1)!;
  return last.at(last.length);
}

/** Direction of the straight side that meets point `index` from `side`, when there is one. */
export function straightSide(
  track: Points,
  found: ReadonlyMap<number, Corner>,
  index: number,
  side: 'before' | 'after',
): PlanPoint | null {
  const points = track.points,
    n = points.length;
  const circuit = isCircuit(track);
  const segment = side === 'before' ? index - 1 : index;
  if (!circuit && (segment < 0 || segment >= n - 1)) return null;
  const from = (segment + n) % n,
    to = (from + 1) % n;
  if (!found.has(from) && !found.has(to) && !isStraight(track, from)) return null;
  return unit(points[from], points[to]);
}

/** An arc drawn from a place on the track, tangent to its heading. */
export interface ArcShape {
  /** Unit direction of the track where the arc starts. */
  heading: PlanPoint;
  radius: number;
  /** Turn, in radians. */
  angle: number;
  sign: 1 | -1;
}

/** Largest turn an arc is drawn with: beyond, it would come back over itself. */
export const MAX_ARC_ANGLE = (3 * Math.PI) / 2;

/** Turns of one rounded point are kept to a quarter turn, so their sides stay short. */
const QUARTER = Math.PI / 2;

/** The arc tangent to `heading` at `start` that goes through `target`, or null when it would be straight. */
export function arcThrough(
  start: PlanPoint,
  heading: PlanPoint,
  target: PlanPoint,
): Omit<ArcShape, 'heading'> | null {
  const dx = target.x - start.x,
    dz = target.z - start.z;
  const cross = heading.x * dz - heading.z * dx,
    dot = heading.x * dx + heading.z * dz;
  if (Math.abs(cross) < 1e-9) return null;
  // The chord makes half the turn with the heading.
  let angle = 2 * Math.atan2(Math.abs(cross), dot);
  if (angle > MAX_ARC_ANGLE) angle = MAX_ARC_ANGLE;
  return {
    radius: (dx * dx + dz * dz) / (2 * Math.abs(cross)),
    angle,
    sign: cross > 0 ? 1 : -1,
  };
}

/**
 * The rounded points that draw an arc from `start`, a quarter turn at most each,
 * and where it ends. Their sides are exactly the length of their tangents, so
 * the arcs follow on from one another.
 */
export function arcLayout(start: PlanPoint, shape: ArcShape) {
  const count = Math.max(1, Math.ceil(shape.angle / QUARTER - 1e-9)),
    turn = shape.angle / count;
  const tangent = shape.radius * Math.tan(turn / 2);
  const vertices: PlanPoint[] = [];
  let at = start,
    heading = shape.heading;
  for (let i = 0; i < count; i++) {
    const vertex = { x: at.x + heading.x * tangent, z: at.z + heading.z * tangent };
    const cos = Math.cos(turn),
      sin = Math.sin(turn) * shape.sign;
    // Turning right takes the heading towards its right-hand normal (-z, x).
    heading = { x: heading.x * cos - heading.z * sin, z: heading.z * cos + heading.x * sin };
    vertices.push(vertex);
    at = { x: vertex.x + heading.x * tangent, z: vertex.z + heading.z * tangent };
  }
  return { vertices, end: at, tangent, heading };
}
