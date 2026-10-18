import type {
  Barrier,
  BarrierSide,
  BarrierType,
  Mesh,
  Point,
  Project,
  Sample,
} from './types';
import { BARRIER_MATERIALS, newMesh, addQuad } from './mesh';

/**
 * Barrières : un tronçon suit la chaussée entre deux points de contrôle.
 * Le collider est un ruban vertical nommé 1WALL_*, invisible en jeu
 * (renderable = false), comme les murs de collision des circuits Kunos.
 * Les décors (glissière, pneus, blocs TecPro, mur) sont dessinés à part.
 */
const BARRIER_SIZES = {
  guardrail: { collider: 0.78, railBottom: 0.44, railTop: 0.78, postTop: 0.72, capWidth: 0.45 },
  tires: { collider: 0.85, stack: 0.27, courses: 3, spacing: 0.6, radius: 0.3, capWidth: 0.6 },
  tecpro: { collider: 0.85, block: 0.8, width: 0.4, blockLength: 1.6, capWidth: 0.4 },
  wall: { collider: 1.1, thickness: 0.25, capWidth: 0.25 },
} as const;
const DEFAULT_BARRIER_OFFSET = 1;
const BARRIER_TYPE_LABELS: Record<BarrierType, string> = {
  guardrail: 'Glissière',
  tires: 'Pneus',
  tecpro: 'TecPro',
  wall: 'Mur béton',
};
/** Position, base locale et courbure d'un point du ruban. */
type Frame = Pick<Sample, 'x' | 'y' | 'z' | 'nx' | 'nz' | 's' | 'curvature'>;
const frame = (sample: Sample): Frame => ({
  x: sample.x,
  y: sample.y,
  z: sample.z,
  nx: sample.nx,
  nz: sample.nz,
  s: sample.s,
  curvature: sample.curvature,
});
/** Repère translaté le long de la tangente locale, pour les poteaux. */
const along = (p: Frame, distance: number): Frame => ({
  ...p,
  x: p.x + p.nz * distance,
  z: p.z - p.nx * distance,
});
const offset = (p: Frame, lateral: number, height: number) => [
  p.x + p.nx * lateral,
  p.y + height,
  p.z + p.nz * lateral,
];
const edgeUvs = (a: number, b: number, low: number, high: number) => [
  [a / 4, low / 4],
  [a / 4, high / 4],
  [b / 4, high / 4],
  [b / 4, low / 4],
];

export function barrierSegments(project: Project, barrier: Barrier): number[] {
  const count = project.points.length,
    segments: number[] = [];
  if (project.closed && count > 2) {
    for (let i = barrier.from; i !== barrier.to; i = (i + 1) % count) segments.push(i);
    return segments;
  }
  for (let i = barrier.from; i < barrier.to; i++) segments.push(i);
  return segments;
}

/** Échantillons couvrant le tronçon, dans le sens du tracé, sans doublon. */
export function barrierSamples(project: Project, samples: Sample[], barrier: Barrier): Sample[] {
  if (samples.length < 2) return [];
  const path: Sample[] = [];
  const push = (sample: Sample) => {
    const previous = path.at(-1);
    if (previous && Math.hypot(sample.x - previous.x, sample.z - previous.z) < 0.0001) return;
    path.push(sample);
  };
  // Les segments sont parcourus dans l'ordre du tronçon : un circuit fermé
  // peut boucler (7 → 8 → 0 → 1) sans repartir du premier échantillon.
  for (const segment of barrierSegments(project, barrier))
    for (const sample of samples) if (sample.segment === segment) push(sample);
  const end = samples.find((sample) => sample.segment === barrier.to && sample.t === 0);
  if (end) push(end);
  return path;
}

/**
 * Position latérale du collider : un mètre au-delà du vibreur par défaut.
 * Le bridage reprend celui des accotements pour éviter que le ruban ne se
 * replie vers l'intérieur du virage (0,8 / courbure).
 */
export function barrierLateral(
  project: Project,
  point: Pick<Sample, 'curvature'>,
  side: BarrierSide,
  offsetValue: number,
): number {
  const half = project.width / 2,
    kerb = project.kerbs ? 0.65 : 0,
    sign = side === 'right' ? 1 : -1;
  const curvature = (point.curvature || 0) * sign;
  const limit = curvature > 0 ? Math.max(half + kerb + 0.05, 0.8 / curvature) : Infinity;
  return sign * Math.min(half + kerb + offsetValue, limit);
}

/** Ligne du collider au sol, pour l'affichage 2D, la carte et le cadrage. */
export function barrierPath(project: Project, samples: Sample[], barrier: Barrier): Point[] {
  return barrierSamples(project, samples, barrier).map((sample) => {
    const lateral = barrierLateral(project, sample, barrier.side, barrier.offset);
    return { x: sample.x + sample.nx * lateral, y: sample.y, z: sample.z + sample.nz * lateral };
  });
}

/** Promène un pas régulier le long du ruban (poteaux, pneus). */
function walk(path: Sample[], spacing: number, phase = 0) {
  const steps: { frame: Frame; s: number }[] = [];
  let distance = 0,
    next = spacing / 2 + phase;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length < 0.0001) continue;
    const start = distance;
    distance += length;
    while (next <= distance) {
      const t = (next - start) / length;
      steps.push({
        frame: {
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          z: a.z + (b.z - a.z) * t,
          nx: a.nx,
          nz: a.nz,
          s: next,
          curvature: a.curvature,
        },
        s: next,
      });
      next += spacing;
    }
  }
  return steps;
}

/**
 * Face verticale le long du ruban. Les sommets sont ordonnés pour que la
 * normale soit tournée vers la piste : c'est indispensable pour que les
 * voitures ne traversent pas le mur.
 */
function wallQuad(
  mesh: Mesh,
  a: Frame,
  b: Frame,
  lateralA: number,
  lateralB: number,
  low: number,
  high: number,
  sideSign: number,
) {
  const positions = [
      offset(a, lateralA, low),
      offset(a, lateralA, high),
      offset(b, lateralB, high),
      offset(b, lateralB, low),
    ],
    uvs = edgeUvs(a.s, b.s, low, high);
  if (sideSign < 0) {
    positions.reverse();
    uvs.reverse();
  }
  addQuad(mesh, positions, uvs);
}
/** Face horizontale (dessus), normale vers le haut quelle que soit la rive. */
function topQuad(
  mesh: Mesh,
  a: Frame,
  b: Frame,
  lateralA: number,
  lateralB: number,
  outerA: number,
  outerB: number,
  height: number,
) {
  const aLow = Math.min(lateralA, outerA),
    aHigh = Math.max(lateralA, outerA);
  const bLow = Math.min(lateralB, outerB),
    bHigh = Math.max(lateralB, outerB);
  addQuad(
    mesh,
    [
      offset(a, aLow, height),
      offset(a, aHigh, height),
      offset(b, bHigh, height),
      offset(b, bLow, height),
    ],
    edgeUvs(a.s, b.s, 0, 1),
  );
}
/** Retour d'extrémité, perpendiculaire à la piste. direction : 1 vers l'avant. */
function capQuad(
  mesh: Mesh,
  p: Frame,
  lateralA: number,
  lateralB: number,
  low: number,
  high: number,
  direction: number,
) {
  const a = Math.min(lateralA, lateralB),
    b = Math.max(lateralA, lateralB);
  const positions = [
      offset(p, a, low),
      offset(p, b, low),
      offset(p, b, high),
      offset(p, a, high),
    ],
    uvs = edgeUvs(0, b - a, low, high);
  if (direction > 0) {
    positions.reverse();
    uvs.reverse();
  }
  addQuad(mesh, positions, uvs);
}
/** Anneau de pneu : cylindre ouvert d'axe vertical, 6 facettes. */
function tireRing(
  mesh: Mesh,
  base: Frame,
  centerLateral: number,
  bottom: number,
  height: number,
  radius: number,
) {
  const segments = 6,
    cx = base.x + base.nx * centerLateral,
    cz = base.z + base.nz * centerLateral,
    tx = base.nz,
    tz = -base.nx,
    y0 = base.y + bottom,
    y1 = y0 + height;
  const point = (angle: number, y: number) => [
    cx + (base.nx * Math.cos(angle) + tx * Math.sin(angle)) * radius,
    y,
    cz + (base.nz * Math.cos(angle) + tz * Math.sin(angle)) * radius,
  ];
  for (let k = 0; k < segments; k++) {
    const a0 = (k / segments) * Math.PI * 2,
      a1 = ((k + 1) / segments) * Math.PI * 2;
    addQuad(
      mesh,
      [point(a0, y0), point(a1, y0), point(a1, y1), point(a0, y1)],
      [
        [(k / segments) * 2, 0],
        [((k + 1) / segments) * 2, 0],
        [((k + 1) / segments) * 2, 1],
        [(k / segments) * 2, 1],
      ],
    );
  }
}

function buildBarrierMeshes(project: Project, samples: Sample[]): Mesh[] {
  const barriers = project.barriers ?? [];
  if (!barriers.length || samples.length < 2) return [];
  const meshes: Mesh[] = [];
  const collider = (name: string, material: number) => {
    const mesh = newMesh(name, material);
    mesh.barrier = true;
    mesh.renderable = false;
    return mesh;
  };
  const decor = (name: string, material: number) => {
    const mesh = newMesh(name, material);
    mesh.barrier = true;
    return mesh;
  };
  barriers.forEach((barrier, index) => {
    const path = barrierSamples(project, samples, barrier);
    if (path.length < 2) return;
    const sign = barrier.side === 'right' ? 1 : -1;
    const lateral = (p: Frame) => barrierLateral(project, p, barrier.side, barrier.offset);
    const first = frame(path[0]),
      last = frame(path[path.length - 1]),
      latFirst = lateral(first),
      latLast = lateral(last);
    const caps = (mesh: Mesh, low: number, high: number, width: number) => {
      capQuad(mesh, first, latFirst, latFirst + sign * width, low, high, -1);
      capQuad(mesh, last, latLast, latLast + sign * width, low, high, 1);
    };
    const faces = () =>
      path.slice(1).map((b, i) => [path[i], b] as [Sample, Sample]);
    switch (barrier.type) {
      case 'guardrail': {
        const sizes = BARRIER_SIZES.guardrail;
        const wall = collider(`1WALL_guardrail_${index}`, BARRIER_MATERIALS.metal);
        const deco = decor(`guardrail_decor_${index}`, BARRIER_MATERIALS.metal);
        for (const [a, b] of faces()) {
          wallQuad(wall, frame(a), frame(b), lateral(a), lateral(b), -0.4, sizes.collider, sign);
          wallQuad(
            deco,
            frame(a),
            frame(b),
            lateral(a),
            lateral(b),
            sizes.railBottom,
            sizes.railTop,
            sign,
          );
        }
        for (const post of walk(path, 4)) {
          const back = lateral(post.frame) + sign * 0.12;
          const a = along(post.frame, -0.06),
            b = along(post.frame, 0.06);
          wallQuad(deco, a, b, back, back, -0.3, sizes.postTop, sign);
          capQuad(deco, post.frame, back - 0.05, back + 0.07, -0.3, sizes.postTop, -1);
        }
        caps(wall, -0.4, sizes.collider, sizes.capWidth);
        caps(deco, sizes.railBottom, sizes.railTop, sizes.capWidth);
        meshes.push(wall, deco);
        break;
      }
      case 'tires': {
        const sizes = BARRIER_SIZES.tires;
        const wall = collider(`1WALL_tires_${index}`, BARRIER_MATERIALS.tire);
        const deco = decor(`tires_decor_${index}`, BARRIER_MATERIALS.tire);
        for (const [a, b] of faces())
          wallQuad(wall, frame(a), frame(b), lateral(a), lateral(b), -0.4, sizes.collider, sign);
        for (let course = 0; course < sizes.courses; course++)
          for (const step of walk(path, sizes.spacing, (course % 2) * (sizes.spacing / 2)))
            tireRing(
              deco,
              step.frame,
              lateral(step.frame) + sign * (sizes.radius + 0.06),
              -0.02 + course * sizes.stack,
              sizes.stack,
              sizes.radius,
            );
        caps(wall, -0.4, sizes.collider, sizes.capWidth);
        caps(
          deco,
          -0.02,
          -0.02 + sizes.courses * sizes.stack,
          sizes.capWidth,
        );
        meshes.push(wall, deco);
        break;
      }
      case 'tecpro': {
        const sizes = BARRIER_SIZES.tecpro;
        const wall = collider(`1WALL_tecpro_${index}`, BARRIER_MATERIALS.tecproRed);
        const red = decor(`tecpro_red_${index}`, BARRIER_MATERIALS.tecproRed);
        const white = decor(`tecpro_white_${index}`, BARRIER_MATERIALS.tecproWhite);
        for (const [a, b] of faces()) {
          const latA = lateral(a),
            latB = lateral(b);
          wallQuad(wall, frame(a), frame(b), latA, latB, -0.4, sizes.collider, sign);
          const block = Math.floor(a.s / sizes.blockLength) % 2 ? white : red;
          wallQuad(block, frame(a), frame(b), latA, latB, 0, sizes.block, sign);
          topQuad(block, frame(a), frame(b), latA, latB, latA + sign * sizes.width, latB + sign * sizes.width, sizes.block);
        }
        const firstBlock = Math.floor(first.s / sizes.blockLength) % 2 ? white : red;
        const lastBlock = Math.floor(last.s / sizes.blockLength) % 2 ? white : red;
        capQuad(firstBlock, first, latFirst, latFirst + sign * sizes.capWidth, 0, sizes.block, -1);
        capQuad(lastBlock, last, latLast, latLast + sign * sizes.capWidth, 0, sizes.block, 1);
        caps(wall, -0.4, sizes.collider, sizes.capWidth);
        meshes.push(wall, red, white);
        break;
      }
      case 'wall': {
        const sizes = BARRIER_SIZES.wall;
        const mesh = decor(`1WALL_beton_${index}`, BARRIER_MATERIALS.concrete);
        for (const [a, b] of faces()) {
          const fa = frame(a),
            fb = frame(b),
            latA = lateral(a),
            latB = lateral(b),
            backA = latA + sign * sizes.thickness,
            backB = latB + sign * sizes.thickness;
          wallQuad(mesh, fa, fb, latA, latB, -0.4, sizes.collider, sign);
          topQuad(mesh, fa, fb, latA, latB, backA, backB, sizes.collider);
          wallQuad(mesh, fa, fb, backA, backB, -0.4, sizes.collider, -sign);
        }
        capQuad(
          mesh,
          first,
          latFirst,
          latFirst + sign * sizes.thickness,
          -0.4,
          sizes.collider,
          -1,
        );
        capQuad(mesh, last, latLast, latLast + sign * sizes.thickness, -0.4, sizes.collider, 1);
        meshes.push(mesh);
        break;
      }
    }
  });
  return meshes;
}

// --- Entretien des tronçons quand les points changent ------------------------

/** Insertion d'un point à l'indice k : les ancres glissent après lui. */
export function insertBarrierPoint(barriers: Barrier[], index: number): Barrier[] {
  return barriers.map((barrier) => ({
    ...barrier,
    from: barrier.from >= index ? barrier.from + 1 : barrier.from,
    to: barrier.to >= index ? barrier.to + 1 : barrier.to,
  }));
}

/** Suppression d'un point : un tronçon qui perd une ancre disparaît. */
export function removeBarrierPoint(
  barriers: Barrier[],
  index: number,
  closed: boolean,
): Barrier[] {
  return barriers.flatMap((barrier): Barrier[] => {
    if (barrier.from === index || barrier.to === index) return [];
    const from = barrier.from > index ? barrier.from - 1 : barrier.from;
    const to = barrier.to > index ? barrier.to - 1 : barrier.to;
    if (from === to) return [];
    if (!closed && from > to) return [];
    return [{ ...barrier, from, to }];
  });
}

/** Sens inversé : le tronçon se rejoue de l'arrivée vers le départ. */
export function reverseBarriers(barriers: Barrier[], count: number, closed: boolean): Barrier[] {
  const map = (i: number) => (closed ? (i === 0 ? 0 : count - i) : count - 1 - i);
  return barriers.map((barrier) => ({
    ...barrier,
    side: barrier.side === 'right' ? 'left' : 'right',
    from: map(barrier.to),
    to: map(barrier.from),
  }));
}

/** Passage en route ouverte : un tronçon qui bouclait devient deux tronçons. */
export function splitWrappingBarriers(barriers: Barrier[], count: number): Barrier[] {
  return barriers.flatMap((barrier): Barrier[] => {
    if (barrier.from < barrier.to) return [barrier];
    const parts: Barrier[] = [];
    if (barrier.from < count - 1) parts.push({ ...barrier, to: count - 1 });
    if (barrier.to > 0) parts.push({ ...barrier, from: 0 });
    return parts;
  });
}

export {
  BARRIER_SIZES,
  BARRIER_TYPE_LABELS,
  DEFAULT_BARRIER_OFFSET,
  buildBarrierMeshes,
};
