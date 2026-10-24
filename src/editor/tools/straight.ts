import { t } from '../../i18n';
import type { Tool } from './tool';

/** Draws a straight from the selected point to each click on the plan; Shift keeps it on the track heading. */
export const straightTool: Tool = {
  cursor: () => 'crosshair',
  hint: () => 'canvas.hintStraight',
  press({ editor, ui }, { hit, shiftKey, screen }) {
    if (!screen) return ui.notify(t('preview.drawOnPlan'), true);
    editor.drawStraight(hit.ground, shiftKey);
  },
  hover({ editor }, { hit, shiftKey }) {
    editor.drawPointer = { at: hit.ground, snap: shiftKey };
  },
  leave({ editor }) {
    editor.drawPointer = null;
  },
};
