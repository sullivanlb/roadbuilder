import { t } from '../../i18n';
import type { Tool } from './tool';

/** Draws an arc on from the selected point, tangent to the track, ending at each click on the plan; Shift rounds it. */
export const arcTool: Tool = {
  cursor: () => 'crosshair',
  hint: () => 'canvas.hintArc',
  press({ editor, ui }, { hit, shiftKey, screen }) {
    if (!screen) return ui.notify(t('preview.drawOnPlan'), true);
    editor.drawArc(hit.ground, shiftKey);
  },
  hover({ editor }, { hit, shiftKey }) {
    editor.drawPointer = { at: hit.ground, snap: shiftKey };
  },
  leave({ editor }) {
    editor.drawPointer = null;
  },
};
