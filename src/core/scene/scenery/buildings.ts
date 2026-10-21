import type { SceneryItem } from '../../project/schema';
import { FOUNDATION, itemPlace, wallPlace } from './kit';
import type { ItemFrame, Parts, Place } from './kit';

/**
 * A brick building (docs/adr/0014): each wall is a row of bays, one window
 * wide and one storey high, repeated and stretched to fill it; the ground
 * floor has shop windows and, in the middle of the front, the entrance. A
 * cornice and a parapet crown it; stone quoins, rainwater pipes and roof
 * plant finish it.
 *
 * Bays are drawn in their own frame: x along the wall, y out of it (the wall
 * face at y = 0), z up from the floor of their storey.
 */
const BAY = 3.2;
/** Half a pilaster at each edge of a bay. */
const PIER = 0.22;
/** Back of the wall, behind its face. */
const BACK = -0.35;

const span = (a: number, b: number) => [a, b] as const;

/** A framed, glazed opening set back from the wall face. */
function window(
  parts: Parts,
  place: Place,
  [x0, x1]: readonly [number, number],
  [z0, z1]: readonly [number, number],
  transom: number | null,
  mullions = 1,
  recess = 0.2,
) {
  const t = 0.06,
    y = span(-recess - 0.06, -recess);
  parts.box('frame', place, span(x0, x1), y, span(z0, z0 + t));
  parts.box('frame', place, span(x0, x1), y, span(z1 - t, z1));
  parts.box('frame', place, span(x0, x0 + t), y, span(z0, z1));
  parts.box('frame', place, span(x1 - t, x1), y, span(z0, z1));
  for (let k = 1; k <= mullions; k++) {
    const x = x0 + ((x1 - x0) * k) / (mullions + 1);
    parts.box('frame', place, span(x - t / 2, x + t / 2), y, span(z0, transom ?? z1));
  }
  if (transom !== null)
    parts.box('frame', place, span(x0, x1), y, span(transom - t / 2, transom + t / 2));
  // The glazing: dark below, the sky reflected towards the top.
  const g = -recess - 0.03;
  parts.quad(
    'glass',
    [place(x0, g, z0), place(x1, g, z0), place(x1, g, z1), place(x0, g, z1)],
    undefined,
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  );
}

/** Brick between the piers, leaving an opening with brick reveals. */
function wallAround(
  parts: Parts,
  place: Place,
  [x0, x1]: readonly [number, number],
  [z0, z1]: readonly [number, number],
) {
  const left = -BAY / 2 + PIER,
    right = BAY / 2 - PIER;
  parts.box('brick', place, span(left, x0), span(BACK, 0), span(0, BAY));
  parts.box('brick', place, span(x1, right), span(BACK, 0), span(0, BAY));
  if (z0 > 0) parts.box('brick', place, span(x0, x1), span(BACK, 0), span(0, z0));
  parts.box('brick', place, span(x0, x1), span(BACK, 0), span(z1, BAY));
}

/** Half a pilaster at each edge of a bay, standing proud of the wall. */
function piers(parts: Parts, place: Place) {
  parts.box('brick', place, span(-BAY / 2, -BAY / 2 + PIER), span(BACK, 0.09), span(0, BAY));
  parts.box('brick', place, span(BAY / 2 - PIER, BAY / 2), span(BACK, 0.09), span(0, BAY));
}

function upperBay(parts: Parts, place: Place) {
  const x = span(-0.78, 0.78),
    z = span(0.95, 2.5);
  wallAround(parts, place, x, z);
  piers(parts, place);
  // String course at the floor line, lintel and sill in stone.
  parts.box('stone', place, span(-BAY / 2, BAY / 2), span(BACK, 0.13), span(0, 0.24));
  parts.box(
    'stone',
    place,
    span(x[0] - 0.14, x[1] + 0.14),
    span(-0.2, 0.05),
    span(z[1], z[1] + 0.26),
  );
  parts.box(
    'stone',
    place,
    span(x[0] - 0.1, x[1] + 0.1),
    span(-0.2, 0.11),
    span(z[0] - 0.07, z[0]),
  );
  window(parts, place, x, z, 2.05);
}

function shopBay(parts: Parts, place: Place) {
  const x = span(-1.2, 1.2),
    z = span(0.55, 2.65);
  wallAround(parts, place, x, z);
  piers(parts, place);
  parts.box('stone', place, x, span(-0.15, 0.04), span(0, z[0]));
  parts.box(
    'stone',
    place,
    span(-BAY / 2 - 0.02, BAY / 2 + 0.02),
    span(BACK, 0.14),
    span(-FOUNDATION, 0.3),
  );
  parts.box('stone', place, span(x[0] - 0.1, x[1] + 0.1), span(-0.2, 0.06), span(z[1], z[1] + 0.3));
  window(parts, place, x, z, 2.2, 2, 0.15);
}

function doorBay(parts: Parts, place: Place) {
  const x = span(-0.85, 0.85),
    z = span(0, 2.6);
  wallAround(parts, place, x, z);
  piers(parts, place);
  parts.box('stone', place, span(-BAY / 2 - 0.02, x[0]), span(BACK, 0.14), span(-FOUNDATION, 0.3));
  parts.box('stone', place, span(x[1], BAY / 2 + 0.02), span(BACK, 0.14), span(-FOUNDATION, 0.3));
  parts.box(
    'stone',
    place,
    span(x[0] - 0.3, x[1] + 0.3),
    span(-0.25, 0.45),
    span(-FOUNDATION, 0.02),
  );
  window(parts, place, span(x[0], x[1]), span(0.02, z[1]), 2.15, 1, 0.25);
  parts.box('door', place, span(x[0] + 0.06, x[1] - 0.06), span(-0.29, -0.27), span(0.02, 0.35));
  // A stone canopy on two ties.
  parts.box('stone', place, span(x[0] - 0.45, x[1] + 0.45), span(BACK, 1.1), span(2.8, 2.95), {
    bottom: true,
  });
  parts.box('galvanised', place, span(x[0] - 0.4, x[0] - 0.36), span(0.95, 0.99), span(2.95, 3.3));
  parts.box('galvanised', place, span(x[1] + 0.36, x[1] + 0.4), span(0.95, 0.99), span(2.95, 3.3));
}

/** Cornice, parapet and coping above the top storey, z from the roof line. */
function corniceBay(parts: Parts, place: Place) {
  parts.box('stone', place, span(-BAY / 2, BAY / 2), span(BACK, 0.12), span(0, 0.18), {
    bottom: true,
  });
  parts.box('stone', place, span(-BAY / 2, BAY / 2), span(BACK, 0.28), span(0.18, 0.38), {
    bottom: true,
  });
  parts.box('brick', place, span(-BAY / 2, BAY / 2), span(-0.3, 0), span(0.38, 1.0));
  parts.box('stone', place, span(-BAY / 2, BAY / 2), span(-0.36, 0.06), span(1.0, 1.08), {
    bottom: true,
  });
}

/** The building of an item; its front, the side with the entrance, faces the track. */
export function building(parts: Parts, frame: ItemFrame, item: SceneryItem) {
  const W = item.width,
    D = item.depth;
  const place = itemPlace(frame);
  const storeys = Math.max(1, Math.round(item.height / BAY));
  // Every storey stretches a little alike, so the roof line falls at the height asked.
  const rise = item.height / storeys / BAY;
  const top = item.height;
  // Corners in turn, so the outside of each wall is on its right.
  const corners: [number, number][] = [
    [-W / 2, -D / 2],
    [W / 2, -D / 2],
    [W / 2, D / 2],
    [-W / 2, D / 2],
  ];
  corners.forEach((a, side) => {
    const b = corners[(side + 1) % 4];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const along = [(b[0] - a[0]) / length, (b[1] - a[1]) / length] as const;
    const count = Math.max(1, Math.round(length / BAY));
    const stretch = length / count / BAY;
    for (let i = 0; i < count; i++) {
      const t = (length * (i + 0.5)) / count;
      const centre = [a[0] + along[0] * t, a[1] + along[1] * t] as const;
      const bay = (storey: number) =>
        wallPlace(place, centre, along, stretch, storey * BAY * rise, rise);
      const entrance = side === 2 && i === Math.floor(count / 2);
      (entrance ? doorBay : shopBay)(parts, bay(0));
      for (let storey = 1; storey < storeys; storey++) upperBay(parts, bay(storey));
      corniceBay(parts, wallPlace(place, centre, along, stretch, top));
    }
  });

  // Quoins at the corners and rainwater pipes beside them.
  for (const [cu, cv] of corners) {
    const su = Math.sign(cu),
      sv = Math.sign(cv);
    for (let z = 0, k = 0; z < top; z += 0.6, k++) {
      const wide = k % 2 ? 0.34 : 0.24;
      const height = span(Math.max(z, 0.3), Math.min(z + 0.55, top));
      if (height[1] <= height[0]) continue;
      const edge = (from: number, sign: number, reach: number) =>
        [
          Math.min(from - sign * reach, from + sign * 0.11),
          Math.max(from - sign * reach, from + sign * 0.11),
        ] as const;
      parts.box('stone', place, edge(cu, su, wide), edge(cv, sv, 0.2), height);
      parts.box('stone', place, edge(cu, su, 0.2), edge(cv, sv, wide), height);
    }
    parts.tube(
      'galvanised',
      place,
      [cu - su * 0.8, cv + sv * 0.2, 0.1],
      [cu - su * 0.8, cv + sv * 0.2, top + 0.3],
      0.06,
    );
  }

  // The roof, and what stands on it when there is room.
  parts.box(
    'roofing',
    place,
    span(-W / 2, W / 2),
    span(-D / 2, D / 2),
    span(top - 0.3, top + 0.05),
  );
  const roof = (u: number, v: number, halfU: number, halfV: number) =>
    Math.abs(u) + halfU < W / 2 - 0.6 && Math.abs(v) + halfV < D / 2 - 0.6;
  const stair = [-W / 2 + 2.7, -D / 2 + 2.7] as const;
  if (roof(stair[0], stair[1], 1.5, 1.5)) {
    parts.box(
      'brick',
      place,
      span(stair[0] - 1.5, stair[0] + 1.5),
      span(stair[1] - 1.5, stair[1] + 1.5),
      span(top, top + 2.6),
    );
    parts.box(
      'stone',
      place,
      span(stair[0] - 1.6, stair[0] + 1.6),
      span(stair[1] - 1.6, stair[1] + 1.6),
      span(top + 2.6, top + 2.75),
    );
    parts.box(
      'door',
      place,
      span(stair[0] - 0.5, stair[0] + 0.5),
      span(stair[1] + 1.5, stair[1] + 1.53),
      span(top + 0.05, top + 2.1),
    );
  }
  for (const [u, v] of [
    [W / 2 - 3, D / 2 - 2.5],
    [W / 2 - 6.2, D / 2 - 2.5],
  ] as const) {
    if (!roof(u, v, 1.25, 0.85)) continue;
    parts.box(
      'galvanised',
      place,
      span(u - 1.2, u + 1.2),
      span(v - 0.8, v + 0.8),
      span(top + 0.05, top + 1.3),
    );
    for (const fan of [-0.55, 0.55])
      parts.tube(
        'frame',
        place,
        [u + fan, v, top + 1.3],
        [u + fan, v, top + 1.4],
        0.42,
        0.42,
        10,
        true,
      );
  }
  for (const [u, v] of [
    [-W / 4, 0],
    [0, -D / 4],
  ] as const)
    if (roof(u, v, 0.2, 0.2))
      parts.tube('galvanised', place, [u, v, top], [u, v, top + 0.9], 0.12, 0.12, 8, true);

  if (item.solid) parts.block(place, 0, 0, W, D);
}
