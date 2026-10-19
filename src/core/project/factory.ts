import { createId } from '../ids';
import { DEFAULTS } from './rules';
import { PROJECT_FORMAT, PROJECT_VERSION } from './schema';
import type { Project } from './schema';
import { TEMPLATE_DEFINITIONS } from './templates';
import type { Template } from './templates';

/** Builds a fresh project from one of the built-in templates. */
export function createProject(template: Template, name: string): Project {
  const definition = TEMPLATE_DEFINITIONS[template];
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    id: createId(),
    name,
    author: '',
    road: { ...definition.road, shoulder: DEFAULTS.shoulder },
    terrain: { margin: DEFAULTS.terrainMargin },
    points: definition.points.map(([x, y, z]) => ({ id: createId(), x, y, z })),
    barriers: [],
  };
}

/** Turns a project name into the short, folder-friendly slug used in file names and exports. */
export function slugify(name: string): string {
  return (
    'rb_' +
    (name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'circuit')
  );
}
