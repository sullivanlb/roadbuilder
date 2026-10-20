/**
 * The layers the editor works on (docs/adr/0009). Drawings dim the layers that
 * are not active and leave out the hidden ones.
 */
export type LayerId = 'track' | 'road' | 'edges' | 'pits' | 'terrain' | 'decor';

/** Opacity of what belongs to a layer other than the active one. */
export const INACTIVE_LAYER_ALPHA = 0.3;
