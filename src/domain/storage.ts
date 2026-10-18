import { createProject, validateProject } from './project';
import type { Project } from './types';

export const STORAGE_KEY = 'roadbuilder.project.v1';
export type ProjectStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function restoreProject(storage: ProjectStorage | null) {
  let project = createProject();
  let raw: string | null = null;
  let recoveryPending = false;
  let message = '';
  try {
    if (!storage) throw new Error('Stockage indisponible');
    raw = storage.getItem(STORAGE_KEY);
    if (raw !== null) project = validateProject(JSON.parse(raw));
  } catch {
    message =
      'La sauvegarde locale n’a pas pu être relue. Le circuit de démonstration est ouvert ; votre fichier projet reste importable.';
    if (raw !== null) {
      try {
        storage!.setItem(`${STORAGE_KEY}.recovery.${Date.now()}`, raw);
      } catch {
        recoveryPending = true;
      }
    }
  }
  return { project, recoveryPending, message };
}

export function persistProject(
  storage: ProjectStorage | null,
  project: Project,
  recoveryPending: boolean,
) {
  if (recoveryPending) return 'recovery' as const;
  try {
    if (!storage) throw new Error('Stockage indisponible');
    storage.setItem(STORAGE_KEY, JSON.stringify(project));
    return 'saved' as const;
  } catch {
    return 'unavailable' as const;
  }
}
