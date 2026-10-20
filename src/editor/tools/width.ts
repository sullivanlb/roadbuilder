import { findRoadPosition } from '../../rendering/plan/hitTest';
import type { Tool } from './tool';

/** Lays a width zone in two clicks on the road: one end, then the other. */
export const widthTool: Tool = {
  cursor: () => 'crosshair',
  hint: ({ editor }) => (editor.widthDraft !== null ? 'canvas.hintWidthDraft' : 'canvas.hintWidth'),
  press({ project, editor, viewport }, { at }) {
    const spot = findRoadPosition(viewport.projection, project.project, project.samples, at);
    if (!spot) return;
    if (editor.widthDraft !== null) editor.completeWidthZone(spot.s);
    else editor.beginWidthZone(spot.s);
  },
  hover({ project, editor, viewport }, { at }) {
    if (editor.widthDraft === null) return;
    editor.widthTarget =
      findRoadPosition(viewport.projection, project.project, project.samples, at)?.s ?? null;
  },
  leave({ editor }) {
    editor.widthTarget = null;
  },
};
