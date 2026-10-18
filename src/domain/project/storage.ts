import { createProject } from './factory';
import { validateProject } from './validation';
import type { Project } from '../types';

export const STORAGE_KEY = 'roadbuilder.project.v1';
export type ProjectStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Why the last save could not be read back; the interface localises it. */
export type RestoreNotice = 'storage-unreadable';

export function restoreProject(storage: ProjectStorage | null) {
  let project = createProject();
  let raw: string | null = null;
  let recoveryPending = false;
  let notice: RestoreNotice | null = null;
  try {
    if (!storage) throw new Error('Storage unavailable');
    raw = storage.getItem(STORAGE_KEY);
    if (raw !== null) project = validateProject(JSON.parse(raw));
  } catch {
    notice = 'storage-unreadable';
    if (raw !== null) {
      try {
        storage!.setItem(`${STORAGE_KEY}.recovery.${Date.now()}`, raw);
      } catch {
        recoveryPending = true;
      }
    }
  }
  return { project, recoveryPending, notice };
}

export function persistProject(
  storage: ProjectStorage | null,
  project: Project,
  recoveryPending: boolean,
) {
  if (recoveryPending) return 'recovery' as const;
  try {
    if (!storage) throw new Error('Storage unavailable');
    storage.setItem(STORAGE_KEY, JSON.stringify(project));
    return 'saved' as const;
  } catch {
    return 'unavailable' as const;
  }
}
