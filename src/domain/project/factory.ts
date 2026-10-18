import type { Project, Template } from '../types';
import { DEFAULT_TERRAIN_MARGIN } from './limits';
import { TEMPLATES } from './templates';

/** Builds a fresh project from one of the built-in templates. */
export function createProject(template: Template = 'club'): Project {
  const definition = TEMPLATES[template] ?? TEMPLATES.club;
  return {
    format: 'assetto-roadbuilder',
    version: 1,
    name: definition.name,
    author: '',
    closed: definition.closed,
    width: definition.width,
    shoulder: 6,
    kerbs: template !== 'mountain',
    terrainMargin: DEFAULT_TERRAIN_MARGIN,
    points: definition.points.map(([x, y, z]) => ({ x, y, z })),
  };
}

/** Turns a project name into the short, folder-friendly slug used in exports. */
export function slugify(name: string): string {
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
