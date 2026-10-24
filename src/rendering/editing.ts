import type { Id } from '../core/ids';
import type { EarthworkType, Side } from '../core/project/schema';
import type { LaidKind, TrackRange } from '../core/track/ranges';
import type { LayerId } from './layers';

/** What one editor selection holds; a single kind at a time. */
export type Selection =
  | { kind: 'points'; ids: readonly Id[] }
  | { kind: 'barrier'; id: Id }
  | { kind: 'widthZone'; id: Id }
  | { kind: 'bankZone'; id: Id }
  | { kind: 'pitLane' }
  | { kind: 'scenery'; ids: readonly Id[] }
  | { kind: 'earthwork'; id: Id }
  | { kind: 'hill'; id: Id }
  | null;

export type SelectionKind = NonNullable<Selection>['kind'];

/** The IDs a selection holds of a kind: none when it holds another kind, or the pit lane. */
export function selectedIds(selection: Selection, kind: SelectionKind): readonly Id[] {
  if (selection?.kind !== kind) return [];
  if ('ids' in selection) return selection.ids;
  return 'id' in selection ? [selection.id] : [];
}

/** What is being laid along the track, from its first click to the pointer (docs/adr/0008). */
export interface LayingView {
  kind: LaidKind;
  /** The first click, and the side of the road it pointed at. */
  from: { s: number; side: Side };
  /** The stretch from the first click to the pointer, while the pointer is on the road. */
  range: TrackRange | null;
  /** The type of the earthwork being laid. */
  earthworkType: EarthworkType;
}

/**
 * The editing under way, as the plan, the band and the 3D preview all show it:
 * the editor resolves it once, the views only draw it.
 */
export interface Editing {
  /** The layer being edited; the others are dimmed, the hidden ones left out. */
  layer: LayerId;
  hiddenLayers: readonly LayerId[];
  selection: Selection;
  laying: LayingView | null;
  /** The stretch picked in the band. */
  range: TrackRange | null;
  /** Track distance under the pointer, in any view. */
  hoverS: number | null;
  /** The brush on the ground under the pointer, while the brush tool is on; its height is known in 3D. */
  brush: { x: number; z: number; y?: number; radius: number } | null;
}
