import type { Barrier, BarrierSide, BarrierType, Point, Project, Template } from './types';
const LIMITS = {
  points: 160,
  coordinate: 10000,
  minAltitude: -100,
  maxAltitude: 1000,
  barriers: 120,
};
export const BARRIER_TYPES: readonly BarrierType[] = ['guardrail', 'tires', 'tecpro', 'wall'];
export const BARRIER_SIDES: readonly BarrierSide[] = ['left', 'right'];
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const number = (v: unknown, min: number, max: number, label: string): number => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max)
    throw new Error(`${label} : valeur attendue entre ${min} et ${max}.`);
  return v;
};
const DEFAULT_TERRAIN_MARGIN = 150;

function createProject(template: Template = 'club'): Project {
  const definitions = {
    club: {
      name: 'Circuit des Collines',
      closed: true,
      width: 12,
      points: [
        [-280, 0, 180],
        [80, 0, 180],
        [270, 4, 120],
        [310, 8, -80],
        [190, 12, -180],
        [50, 10, -100],
        [-50, 5, -180],
        [-260, 1, -140],
        [-340, 0, 0],
      ],
    },
    kart: {
      name: 'Karting des Pins',
      closed: true,
      width: 7,
      points: [
        [-130, 0, 70],
        [80, 0, 70],
        [140, 0, 20],
        [100, 0, -55],
        [35, 0, -70],
        [20, 0, 0],
        [-30, 0, 15],
        [-55, 0, -65],
        [-135, 0, -60],
      ],
    },
    mountain: {
      name: 'Col de la Lumière',
      closed: false,
      width: 8,
      points: [
        [-300, 0, 300],
        [-80, 12, 300],
        [180, 25, 220],
        [210, 38, 110],
        [-150, 56, 90],
        [-210, 70, -20],
        [130, 90, -65],
        [190, 106, -160],
        [-80, 130, -240],
        [-280, 145, -310],
      ],
    },
    blank: { name: 'Mon nouveau tracé', closed: false, width: 10, points: [] },
  };
  const d = definitions[template] || definitions.club;
  return {
    format: 'assetto-roadbuilder',
    version: 1,
    name: d.name,
    author: '',
    closed: d.closed,
    width: d.width,
    shoulder: 6,
    kerbs: template !== 'mountain',
    terrainMargin: DEFAULT_TERRAIN_MARGIN,
    points: d.points.map(([x, y, z]) => ({ x, y, z })),
  };
}

function validateProject(input: unknown): Project {
  if (!input || typeof input !== 'object')
    throw new Error('Ce fichier n’est pas un projet Roadbuilder version 1.');
  const value = input as Record<string, unknown>;
  if (value.format !== 'assetto-roadbuilder' || value.version !== 1)
    throw new Error('Ce fichier n’est pas un projet Roadbuilder version 1.');
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 80)
    throw new Error('Le nom doit contenir de 1 à 80 caractères.');
  if (typeof value.author !== 'string' || value.author.length > 80)
    throw new Error('Auteur invalide (80 caractères maximum).');
  if (typeof value.closed !== 'boolean' || typeof value.kerbs !== 'boolean')
    throw new Error('Options du tracé invalides.');
  if (!Array.isArray(value.points) || value.points.length > LIMITS.points)
    throw new Error(`Maximum ${LIMITS.points} points.`);
  const points = value.points.map((input: unknown): Point => {
    if (!input || typeof input !== 'object') throw new Error('Point invalide.');
    const p = input as Record<string, unknown>;
    return {
      x: number(p.x, -LIMITS.coordinate, LIMITS.coordinate, 'Position X'),
      y: number(p.y, LIMITS.minAltitude, LIMITS.maxAltitude, 'Altitude'),
      z: number(p.z, -LIMITS.coordinate, LIMITS.coordinate, 'Position Z'),
    };
  });
  // Barriers stay an optional field: an old project receives none.
  const barriers = validateBarriers(value.barriers, points.length, value.closed === true);
  return {
    format: 'assetto-roadbuilder',
    version: 1,
    name: value.name.trim(),
    author: value.author.trim(),
    closed: value.closed,
    width: number(value.width, 4, 24, 'Largeur'),
    shoulder: number(value.shoulder, 2, 20, 'Accotement'),
    kerbs: value.kerbs,
    terrainMargin:
      value.terrainMargin === undefined
        ? DEFAULT_TERRAIN_MARGIN
        : number(value.terrainMargin, 50, 500, 'Marge du terrain'),
    ...(barriers === undefined ? {} : { barriers }),
    points,
  };
}

function validateBarriers(
  input: unknown,
  pointCount: number,
  closed: boolean,
): Barrier[] | undefined {
  if (input === undefined) return undefined;
  if (!Array.isArray(input) || input.length > LIMITS.barriers)
    throw new Error(`Maximum ${LIMITS.barriers} tronçons de barrière.`);
  if (input.length && pointCount < 2)
    throw new Error('Les barrières nécessitent au moins deux points de tracé.');
  // A span can only wrap when the circuit is actually closed.
  const wrapping = closed && pointCount > 2;
  return input.map((raw): Barrier => {
    if (!raw || typeof raw !== 'object') throw new Error('Barrière invalide.');
    const item = raw as Record<string, unknown>;
    const type = item.type;
    if (typeof type !== 'string' || !BARRIER_TYPES.includes(type as BarrierType))
      throw new Error('Type de barrière inconnu.');
    const side = item.side;
    if (typeof side !== 'string' || !BARRIER_SIDES.includes(side as BarrierSide))
      throw new Error('Côté de barrière invalide.');
    const index = (v: unknown, label: string): number => {
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= pointCount)
        throw new Error(`${label} : indice de point hors du tracé.`);
      return v;
    };
    const from = index(item.from, 'Début de barrière');
    const to = index(item.to, 'Fin de barrière');
    if (from === to) throw new Error('Une barrière doit couvrir au moins deux points.');
    if (!wrapping && from > to)
      throw new Error('Sur une route ouverte, une barrière doit suivre le sens du tracé.');
    if (typeof item.offset !== 'number')
      throw new Error('Décalage de barrière : valeur attendue entre 0 et 10.');
    return {
      type: type as BarrierType,
      side: side as BarrierSide,
      from,
      to,
      offset: number(item.offset, 0, 10, 'Décalage de barrière'),
    };
  });
}

function slugify(name: string) {
  return (
    'rb_' +
    (name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'circuit')
  );
}
export {
  LIMITS,
  DEFAULT_TERRAIN_MARGIN,
  clamp,
  clone,
  distance,
  createProject,
  validateProject,
  slugify,
};
