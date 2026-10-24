import type { SceneryItem } from '../../project/schema';
import { AD_MATERIALS } from '../materials';
import type { Triple } from '../mesh';
import { FOUNDATION, itemPlace, movedPlace, random, turnedPlace } from './kit';
import type { ItemFrame, Parts, Place } from './kit';

/**
 * Lights and signs (docs/adr/0014), drawn in the frame of the item: u across
 * its front, v towards it, h up. A light's arms reach towards its front by its
 * width; a sign shows its board to the front.
 */
const span = (a: number, b: number) => [a, b] as const;

const ONCE: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

/** A galvanised post on a concrete footing, with one or two arms and their LED lanterns. */
export function light(parts: Parts, frame: ItemFrame, item: SceneryItem) {
  const place = itemPlace(frame);
  const top = item.height - 0.5,
    reach = item.width;
  parts.tube('stone', place, [0, 0, -FOUNDATION], [0, 0, 0.22], 0.38, 0.38, 10, true);
  parts.box('steel', place, span(-0.22, 0.22), span(-0.22, 0.22), span(0.22, 0.25));
  for (const [du, dv] of [
    [-0.15, -0.15],
    [0.15, -0.15],
    [0.15, 0.15],
    [-0.15, 0.15],
  ])
    parts.tube('steel', place, [du, dv, 0.25], [du, dv, 0.3], 0.022, 0.022, 6, true);
  parts.tube('galvanised', place, [0, 0, 0.25], [0, 0, top], 0.13, 0.07, 10);
  parts.tube('galvanised', place, [0, 0, top], [0, 0, top + 0.06], 0.08, 0.08, 10, true);
  for (const side of item.variant === 'double' ? [1, -1] : [1]) {
    // The arm bends out of the post, then runs out to the lantern, rising slightly.
    const points = Array.from({ length: 13 }, (_, k): Triple => {
      const t = k / 12;
      const bend = Math.min(t / 0.45, 1);
      return [
        0,
        side * reach * t,
        top - 0.25 + 0.55 * Math.sin((bend * Math.PI) / 2) + 0.12 * Math.max(0, t - 0.45),
      ];
    });
    for (let k = 1; k < points.length; k++)
      parts.tube('galvanised', place, points[k - 1], points[k], 0.05, 0.05, 8);
    const end = points[points.length - 1];
    const head = turnedPlace(
      movedPlace(place, [end[0], end[1] + side * 0.35, end[2] - 0.04]),
      side > 0 ? 0 : Math.PI,
      (8 * Math.PI) / 180,
    );
    parts.box('housing', head, span(-0.18, 0.18), span(-0.39, 0.39), span(-0.045, 0.045), {
      bottom: true,
    });
    parts.box('housing', head, span(-0.12, 0.12), span(-0.39, -0.17), span(0.005, 0.085));
    parts.quad(
      'lamp',
      [
        head(-0.15, -0.3, -0.05),
        head(0.15, -0.3, -0.05),
        head(0.15, 0.3, -0.05),
        head(-0.15, 0.3, -0.05),
      ],
      [0, -1, 0],
    );
    // Shines down, leaning a little the way the arm reaches.
    const origin = head(0, 0, 0),
      aim = head(0, 0.35, -1);
    const direction: Triple = [aim[0] - origin[0], aim[1] - origin[1], aim[2] - origin[2]];
    const length = Math.hypot(...direction);
    parts.lights.push({
      position: head(0, 0, -0.08),
      direction: direction.map((c) => c / length) as Triple,
    });
  }
  if (item.solid) parts.block(place, 0, 0, 0.4, 0.4);
}

/** The advertising board an item shows, the same for the same item. */
const advert = (item: SceneryItem) =>
  AD_MATERIALS[Math.floor(random(item.id)() * AD_MATERIALS.length)];

/** The printed face of a board, read from the front: its left end is towards +u. */
function face(
  parts: Parts,
  place: Place,
  item: SceneryItem,
  [u0, u1]: readonly [number, number],
  v: number,
  [h0, h1]: readonly [number, number],
) {
  parts.quad(
    advert(item),
    [place(u1, v, h0), place(u0, v, h0), place(u0, v, h1), place(u1, v, h1)],
    undefined,
    ONCE,
  );
}

/** A billboard on two legs, with a service walkway and lamps over it; or a low board on posts. */
export function sign(parts: Parts, frame: ItemFrame, item: SceneryItem) {
  const place = itemPlace(frame);
  const W = item.width,
    H = item.height;
  if (item.variant === 'board') {
    for (let k = 0; k < 4; k++) {
      const u = -W / 2 + 0.2 + (k * (W - 0.4)) / 3;
      parts.box('steel', place, span(u - 0.04, u + 0.04), span(-0.12, -0.04), span(-0.3, H));
    }
    parts.box('panelBack', place, span(-W / 2, W / 2), span(-0.04, 0), span(0.15, H));
    face(parts, place, item, span(-W / 2, W / 2), 0.002, span(0.15, H));
  } else {
    const bottom = H * 0.42;
    for (const side of [-1, 1]) {
      const u = side * W * 0.3;
      parts.box(
        'stone',
        place,
        span(u - 0.35, u + 0.35),
        span(-0.45, 0.35),
        span(-FOUNDATION, 0.2),
      );
      parts.box('steel', place, span(u - 0.12, u + 0.12), span(-0.25, -0.05), span(0.2, H - 0.1));
    }
    for (const h of [bottom + 0.2, (bottom + H) / 2, H - 0.25])
      parts.box('steel', place, span(-W / 2, W / 2), span(-0.12, -0.02), span(h - 0.06, h + 0.06));
    parts.box(
      'panelBack',
      place,
      span(-W / 2 - 0.08, W / 2 + 0.08),
      span(-0.02, 0.1),
      span(bottom - 0.08, H + 0.08),
      { bottom: true },
    );
    face(parts, place, item, span(-W / 2, W / 2), 0.11, span(bottom, H));
    // Walkway along the foot of the board, with a rail.
    parts.box(
      'grating',
      place,
      span(-W / 2, W / 2),
      span(0.1, 0.8),
      span(bottom - 0.25, bottom - 0.2),
      { bottom: true },
    );
    for (let k = 0; k <= 4; k++) {
      const u = -W / 2 + (k * W) / 4;
      parts.box(
        'steel',
        place,
        span(u - 0.02, u + 0.02),
        span(0.76, 0.8),
        span(bottom - 0.2, bottom + 0.8),
      );
    }
    for (const h of [bottom + 0.38, bottom + 0.78])
      parts.box('steel', place, span(-W / 2, W / 2), span(0.76, 0.8), span(h - 0.02, h + 0.02));
    // Lamps leaning over the top of the board.
    for (let k = 0; k < 3; k++) {
      const u = -W / 3 + (k * W) / 3;
      parts.tube('steel', place, [u, 0.05, H + 0.05], [u, 0.9, H + 0.45], 0.03, 0.03, 6);
      const lamp = turnedPlace(movedPlace(place, [u, 1, H + 0.45]), 0, (-35 * Math.PI) / 180);
      parts.box('housing', lamp, span(-0.2, 0.2), span(-0.125, 0.125), span(-0.06, 0.06), {
        bottom: true,
      });
    }
  }
  if (item.solid) parts.block(place, 0, 0, W, item.depth);
}
