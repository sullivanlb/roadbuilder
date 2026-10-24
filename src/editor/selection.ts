import type { Draft } from 'immer';
import type { Id } from '../core/ids';
import {
  removeBankZone,
  removeBarrier,
  removeEarthwork,
  removeHill,
  removePitLane,
  removePoint,
  removePoints,
  removeScenery,
  removeWidthZone,
} from '../core/project/edits';
import type { Project } from '../core/project/schema';
import { selectedIds } from '../rendering/editing';
import type { Selection, SelectionKind } from '../rendering/editing';
import type { LayerId } from '../rendering/layers';

export type { Selection, SelectionKind };

// Everything the editor needs to know about each kind of selection, in one
// place (docs/adr/0009): the layer it belongs to, where its items live in the
// project, and how it is deleted.

interface KindRules {
  layer: LayerId;
  /** The items of the project a selection of this kind picks from. */
  items(project: Project): readonly { id: Id }[];
  /** Removes the selected items. */
  remove(draft: Draft<Project>, ids: readonly Id[]): void;
  /** After a single one is deleted, the one now in its place in the list is selected. */
  selectsNext?: true;
}

const KINDS: Record<SelectionKind, KindRules> = {
  points: {
    layer: 'track',
    items: (project) => project.points,
    remove: (draft, ids) =>
      ids.length > 1 ? removePoints(draft, ids) : removePoint(draft, ids[0]),
    selectsNext: true,
  },
  widthZone: {
    layer: 'road',
    items: (project) => project.widthZones,
    remove: (draft, [id]) => removeWidthZone(draft, id),
    selectsNext: true,
  },
  bankZone: {
    layer: 'road',
    items: (project) => project.bankZones,
    remove: (draft, [id]) => removeBankZone(draft, id),
    selectsNext: true,
  },
  barrier: {
    layer: 'edges',
    items: (project) => project.barriers,
    remove: (draft, [id]) => removeBarrier(draft, id),
    selectsNext: true,
  },
  pitLane: {
    layer: 'pits',
    // The pit lane has no ID: it is the one of the track.
    items: (project) => (project.pitLane ? [{ id: 'pitLane' }] : []),
    remove: (draft) => removePitLane(draft),
  },
  scenery: {
    layer: 'scenery',
    items: (project) => project.scenery,
    remove: (draft, ids) => removeScenery(draft, ids),
  },
  earthwork: {
    layer: 'terrain',
    items: (project) => project.earthworks,
    remove: (draft, [id]) => removeEarthwork(draft, id),
    selectsNext: true,
  },
  hill: {
    layer: 'terrain',
    items: (project) => project.hills,
    remove: (draft, [id]) => removeHill(draft, id),
  },
};

/** The layer whose elements a selection holds. */
export const layerOfSelection = (selection: Selection): LayerId | null =>
  selection ? KINDS[selection.kind].layer : null;

/** The IDs a selection holds, the pit lane counting as one. */
const heldIds = (selection: NonNullable<Selection>) =>
  selection.kind === 'pitLane' ? ['pitLane'] : selectedIds(selection, selection.kind);

/** A selection of a kind holding `ids`: a list for points and scenery, a single ID otherwise. */
function selectionOf(kind: SelectionKind, ids: readonly Id[]): Selection {
  if (!ids.length) return null;
  if (kind === 'points' || kind === 'scenery') return { kind, ids };
  if (kind === 'pitLane') return { kind };
  return { kind, id: ids[0] };
}

/** What is left of a selection in a project, after an undo or another file opened: the same value when nothing went. */
export function stillSelected(project: Project, selection: Selection): Selection {
  if (!selection) return null;
  const held = heldIds(selection);
  const present = new Set(KINDS[selection.kind].items(project).map((item) => item.id));
  const left = held.filter((id) => present.has(id));
  return left.length === held.length ? selection : selectionOf(selection.kind, left);
}

/** The items of a kind a selection holds, in project order. */
export function selectedItems<T extends { id: Id }>(
  project: Project,
  selection: Selection,
  kind: SelectionKind,
): T[] {
  if (selection?.kind !== kind) return [];
  const held = new Set(heldIds(selection));
  return (KINDS[kind].items(project) as T[]).filter((item) => held.has(item.id));
}

/** Deleting a selection: how it changes the project, and what is selected afterwards. */
export interface Deletion {
  recipe: (draft: Draft<Project>) => void;
  next: (after: Project) => Selection;
}

/**
 * How to delete what is selected, or null when nothing is. After a single one of
 * a list laid in order (points, zones, barriers, earthworks), the one taking its
 * place is selected, or the last; otherwise nothing is.
 */
export function deletion(project: Project, selection: Selection): Deletion | null {
  if (!selection) return null;
  const rules = KINDS[selection.kind];
  const ids = heldIds(selection);
  const index = rules.items(project).findIndex((item) => item.id === ids[0]);
  if (index < 0) return null;
  return {
    recipe: (draft) => rules.remove(draft, ids),
    next(after) {
      if (!rules.selectsNext || ids.length > 1) return null;
      const items = rules.items(after);
      const next = items[Math.min(index, items.length - 1)];
      return next ? selectionOf(selection.kind, [next.id]) : null;
    },
  };
}
