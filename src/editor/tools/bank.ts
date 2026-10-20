import { findRoadPosition } from '../../rendering/plan/hitTest';
import type { Tool } from './tool';

/** Lays a bank zone in two clicks on the road: one end, then the other. */
export const bankTool: Tool = {
  cursor: () => 'crosshair',
  hint: ({ editor }) => (editor.bankDraft !== null ? 'canvas.hintBankDraft' : 'canvas.hintBank'),
  press({ project, editor, viewport }, { at }) {
    const spot = findRoadPosition(viewport.projection, project.project, project.samples, at);
    if (!spot) return;
    if (editor.bankDraft !== null) editor.completeBankZone(spot.s);
    else editor.beginBankZone(spot.s);
  },
  hover({ project, editor, viewport }, { at }) {
    if (editor.bankDraft === null) return;
    editor.bankTarget =
      findRoadPosition(viewport.projection, project.project, project.samples, at)?.s ?? null;
  },
  leave({ editor }) {
    editor.bankTarget = null;
  },
};
