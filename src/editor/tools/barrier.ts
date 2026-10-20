import { findRoadPosition } from '../../rendering/plan/hitTest';
import type { Tool } from './tool';

/** Lays a barrier in two clicks on the road, on the clicked side: one end, then the other. */
export const barrierTool: Tool = {
  cursor: () => 'crosshair',
  hint: ({ editor }) => (editor.barrierDraft ? 'canvas.hintBarrierDraft' : 'canvas.hintBarrier'),
  press({ project, editor, viewport }, { at }) {
    const spot = findRoadPosition(viewport.projection, project.project, project.samples, at);
    if (!spot) return;
    if (editor.barrierDraft) editor.completeBarrier(spot.s);
    else editor.beginBarrier(spot);
  },
  hover({ project, editor, viewport }, { at }) {
    if (!editor.barrierDraft) return;
    editor.barrierTarget =
      findRoadPosition(viewport.projection, project.project, project.samples, at)?.s ?? null;
  },
  leave({ editor }) {
    editor.barrierTarget = null;
  },
};
