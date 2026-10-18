import type { Barrier, BarrierSide, BarrierType, Point, Project } from '../types';
import { DEFAULT_TERRAIN_MARGIN, LIMITS } from './limits';

export const BARRIER_TYPES: readonly BarrierType[] = ['guardrail', 'tires', 'tecpro', 'wall'];
export const BARRIER_SIDES: readonly BarrierSide[] = ['left', 'right'];

function readNumber(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    throw new Error(`${label} : valeur attendue entre ${min} et ${max}.`);
  return value;
}

/** Validates a parsed payload and rebuilds a clean project, or throws a French message. */
export function validateProject(input: unknown): Project {
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
      x: readNumber(p.x, -LIMITS.coordinate, LIMITS.coordinate, 'Position X'),
      y: readNumber(p.y, LIMITS.minAltitude, LIMITS.maxAltitude, 'Altitude'),
      z: readNumber(p.z, -LIMITS.coordinate, LIMITS.coordinate, 'Position Z'),
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
    width: readNumber(value.width, 4, 24, 'Largeur'),
    shoulder: readNumber(value.shoulder, 2, 20, 'Accotement'),
    kerbs: value.kerbs,
    terrainMargin:
      value.terrainMargin === undefined
        ? DEFAULT_TERRAIN_MARGIN
        : readNumber(value.terrainMargin, 50, 500, 'Marge du terrain'),
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
      offset: readNumber(item.offset, 0, 10, 'Décalage de barrière'),
    };
  });
}
