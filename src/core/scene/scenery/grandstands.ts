import type { SceneryItem } from '../../project/schema';
import { AD_MATERIALS } from '../materials';
import type { MaterialId } from '../materials';
import type { Triple } from '../mesh';
import { FOUNDATION, itemPlace } from './kit';
import type { ItemFrame, Parts, Place } from './kit';

/**
 * A covered grandstand (docs/adr/0014): concrete rows stepping up from a front
 * wall hung with advertising, seats on every row but the aisles, a clad back
 * wall and a roof cantilevered from columns behind it, its edge over the front
 * of the item. Drawn in the frame of the item: u along it, v towards the
 * front, which faces the track, h up.
 */
const TREAD = 0.8;
const PITCH = 0.52;
const AISLE = 1.2;
const FIRST = 1.2;

const span = (a: number, b: number) => [a, b] as const;

/** A rectangular member from p0 to p1, `width` across and `depth` upwards. */
function beam(
  parts: Parts,
  material: MaterialId,
  place: Place,
  p0: Triple,
  p1: Triple,
  width: number,
  depth: number,
) {
  const along = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const length = Math.hypot(along[0], along[1], along[2]);
  const flat = Math.hypot(along[0], along[1]) || 1;
  const side = [along[1] / flat, -along[0] / flat, 0];
  const up = [
    (side[1] * along[2] - side[2] * along[1]) / length,
    (side[2] * along[0] - side[0] * along[2]) / length,
    (side[0] * along[1] - side[1] * along[0]) / length,
  ];
  const ring = (p: Triple) =>
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([s, u]) =>
      place(
        p[0] + (side[0] * s * width) / 2 + (up[0] * u * depth) / 2,
        p[1] + (side[1] * s * width) / 2 + (up[1] * u * depth) / 2,
        p[2] + (side[2] * s * width) / 2 + (up[2] * u * depth) / 2,
      ),
    );
  const a = ring(p0),
    b = ring(p1);
  const mid = place((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2);
  for (let k = 0; k < 4; k++) {
    const n = (k + 1) % 4;
    const face = [a[k], a[n], b[n], b[k]];
    const centre = face.reduce<Triple>(
      (s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4, s[2] + p[2] / 4],
      [0, 0, 0],
    );
    parts.quad(material, face, [centre[0] - mid[0], centre[1] - mid[1], centre[2] - mid[2]]);
  }
}

export function grandstand(parts: Parts, frame: ItemFrame, item: SceneryItem) {
  const W = item.width,
    D = item.depth,
    H = item.height;
  const place = itemPlace(frame);
  const overhang = D / 2 - 0.2;
  const front = overhang - 1.5;
  const rows = Math.max(2, Math.floor((front + D / 2 - 0.8) / TREAD));
  const back = front - rows * TREAD;
  const rise = Math.max(0.28, (0.6 * H - FIRST) / (rows - 1));
  const rowTop = (k: number) => FIRST + k * rise;
  const rowFront = (k: number) => front - k * TREAD;

  // Rows, and aisles every 12 m or so, with steps halfway up each riser.
  for (let k = 0; k < rows; k++)
    parts.box(
      'stone',
      place,
      span(-W / 2, W / 2),
      span(rowFront(k) - TREAD, rowFront(k)),
      span(-FOUNDATION, rowTop(k)),
    );
  const aisles = Math.max(1, Math.round(W / 12));
  const aisleAt = Array.from({ length: aisles }, (_, i) => -W / 2 + (W * (i + 0.5)) / aisles);
  for (const x of aisleAt) {
    for (let k = 1; k < rows; k++)
      parts.box(
        'stone',
        place,
        span(x - AISLE / 2, x + AISLE / 2),
        span(rowFront(k), rowFront(k) + TREAD / 2),
        span(-FOUNDATION, rowTop(k) - rise / 2),
      );
    for (const side of [-1, 1]) {
      const xr = x + side * (AISLE / 2 + 0.05);
      parts.tube(
        'galvanised',
        place,
        [xr, front, rowTop(0) + 1],
        [xr, back + TREAD / 2, rowTop(rows - 1) + 1],
        0.03,
        0.03,
        6,
      );
      for (let k = 0; k < rows; k += 2) {
        const y = rowFront(k) - TREAD / 2;
        parts.tube(
          'galvanised',
          place,
          [xr, y, rowTop(k)],
          [xr, y, rowTop(k) + 1],
          0.025,
          0.025,
          6,
        );
      }
    }
  }
  // Seats: the pan and the back, clear of the aisles.
  for (let k = 0; k < rows; k++) {
    const y1 = rowFront(k),
      z = rowTop(k);
    for (let x = -W / 2 + 0.5; x < W / 2 - 0.4; x += PITCH) {
      if (aisleAt.some((a) => Math.abs(x - a) <= AISLE / 2 + 0.25)) continue;
      parts.box(
        'seat',
        place,
        span(x - 0.22, x + 0.22),
        span(y1 - 0.62, y1 - 0.2),
        span(z + 0.4, z + 0.46),
      );
      parts.box(
        'seat',
        place,
        span(x - 0.22, x + 0.22),
        span(y1 - 0.66, y1 - 0.61),
        span(z + 0.46, z + 0.86),
      );
    }
  }

  // Front wall with advertising boards, and a rail along its top.
  parts.box(
    'stone',
    place,
    span(-W / 2, W / 2),
    span(front, front + 0.25),
    span(-FOUNDATION, FIRST + 1),
  );
  const boards = Math.max(1, Math.round(W / 6));
  for (let i = 0; i < boards; i++) {
    const x0 = -W / 2 + (W * i) / boards + 0.1,
      x1 = -W / 2 + (W * (i + 1)) / boards - 0.1;
    const z0 = 0.35,
      z1 = FIRST + 0.8,
      y = front + 0.31;
    parts.box('galvanised', place, span(x0, x1), span(front + 0.25, front + 0.3), span(z0, z1));
    // Read from the track: its left end is towards +u.
    parts.quad(
      AD_MATERIALS[i % AD_MATERIALS.length],
      [
        place(x1 - 0.05, y, z0 + 0.05),
        place(x0 + 0.05, y, z0 + 0.05),
        place(x0 + 0.05, y, z1 - 0.05),
        place(x1 - 0.05, y, z1 - 0.05),
      ],
      undefined,
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    );
  }
  parts.tube(
    'galvanised',
    place,
    [-W / 2, front + 0.12, FIRST + 1.55],
    [W / 2, front + 0.12, FIRST + 1.55],
    0.04,
    0.04,
    6,
  );
  for (let i = 0; i <= Math.floor(W / 2); i++) {
    const x = -W / 2 + (i * W) / Math.floor(W / 2);
    parts.tube(
      'galvanised',
      place,
      [x, front + 0.12, FIRST + 1],
      [x, front + 0.12, FIRST + 1.55],
      0.025,
      0.025,
      6,
    );
  }

  // Back wall and ends: stepped concrete, clad screens under the back of the roof.
  const roofBack = H,
    roofFront = H + 0.9;
  parts.box(
    'cladding',
    place,
    span(-W / 2, W / 2),
    span(back - 0.15, back),
    span(-FOUNDATION, roofBack),
  );
  for (const side of [-1, 1]) {
    const x = span(
      Math.min((side * W) / 2, side * (W / 2 + 0.25)),
      Math.max((side * W) / 2, side * (W / 2 + 0.25)),
    );
    for (let k = 0; k < rows; k++)
      parts.box(
        'stone',
        place,
        x,
        span(rowFront(k) - TREAD, rowFront(k)),
        span(-FOUNDATION, rowTop(k) + 1.1),
      );
    const xe = side * (W / 2 + 0.12);
    const mid = back + (front - back) * 0.45;
    const screen = [
      place(xe, back, rowTop(rows - 1) + 1.1),
      place(xe, mid, rowTop(Math.floor(rows / 2)) + 1.1),
      place(xe, mid, roofBack + (roofFront - roofBack) * 0.45 - 0.2),
      place(xe, back, roofBack),
    ];
    // Seen from outside and from the stand alike.
    const out: Triple = [-frame.fz * side, 0, frame.fx * side];
    parts.quad('cladding', screen, out);
    parts.quad('cladding', screen, [-out[0], 0, -out[2]]);
  }

  // Columns behind the back wall, each carrying a raking cantilever beam.
  const frames = Math.max(2, Math.round(W / 8) + 1);
  for (let i = 0; i < frames; i++) {
    const x = -W / 2 + (W * i) / (frames - 1);
    parts.box(
      'steel',
      place,
      span(x - 0.2, x + 0.2),
      span(back - 0.6, back - 0.2),
      span(-FOUNDATION, roofBack + 0.3),
    );
    beam(
      parts,
      'steel',
      place,
      [x, back - 0.4, roofBack + 0.15],
      [x, overhang, roofFront - 0.15],
      0.25,
      0.55,
    );
    beam(
      parts,
      'steel',
      place,
      [x, back - 0.4, roofBack - 2.2],
      [x, back + (overhang - back) * 0.45, roofBack + 0.15],
      0.18,
      0.2,
    );
  }
  // Roof sheet, its edges and a fascia along the front.
  const corners: Triple[] = [
    [-W / 2 - 0.3, back - 0.7, roofBack + 0.45],
    [W / 2 + 0.3, back - 0.7, roofBack + 0.45],
    [W / 2 + 0.3, overhang + 0.2, roofFront + 0.15],
    [-W / 2 - 0.3, overhang + 0.2, roofFront + 0.15],
  ];
  const upper = corners.map(([x, y, z]) => place(x, y, z));
  const lower = corners.map(([x, y, z]) => place(x, y, z - 0.12));
  parts.quad('sheet', upper, [0, 1, 0]);
  parts.quad('sheet', lower, [0, -1, 0]);
  const centre = place(0, (back + overhang) / 2, roofBack + 0.5);
  for (let k = 0; k < 4; k++) {
    const n = (k + 1) % 4;
    const face = [lower[k], lower[n], upper[n], upper[k]];
    const mid = face.reduce<Triple>(
      (s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4, s[2] + p[2] / 4],
      [0, 0, 0],
    );
    parts.quad('steel', face, [mid[0] - centre[0], mid[1] - centre[1], mid[2] - centre[2]]);
  }
  const edge = overhang + 0.2;
  parts.box(
    'panelBack',
    place,
    span(-W / 2 - 0.3, W / 2 + 0.3),
    span(edge, edge + 0.12),
    span(roofFront - 0.7, roofFront + 0.2),
    { bottom: true },
  );
  parts.box(
    'kerbRed',
    place,
    span(-W / 2 - 0.3, W / 2 + 0.3),
    span(edge + 0.12, edge + 0.14),
    span(roofFront - 0.5, roofFront),
  );

  if (item.solid) parts.block(place, 0, 0, W, D);
}
