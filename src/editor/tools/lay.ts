import type { MessageKey } from '../../i18n';
import type { Tool } from './tool';

/**
 * Lays something along the track in two clicks on the road, in any view
 * (docs/adr/0008): one end on the clicked side, then the other. What it lays is
 * the active tool's; another tool laying the same kind carries on with it.
 */
export const layTool = (hint: MessageKey, secondHint: MessageKey): Tool => ({
  cursor: () => 'crosshair',
  hint: ({ editor }) => (editor.laying ? secondHint : hint),
  press({ editor }, { hit }) {
    if (!hit.road) return;
    if (editor.laying) editor.completeLaying(hit.road.s);
    else editor.beginLaying(hit.road);
  },
  hover({ editor }, { hit }) {
    editor.aimLaying(hit.road);
  },
  leave({ editor }) {
    editor.aimLaying(null);
  },
});
