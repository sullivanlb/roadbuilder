import { findRoadSide } from '../../rendering/plan/hitTest';
import type { Tool } from './tool';

/** Lays a barrier in two clicks on the road: its first control point, then its last. */
export const barrierTool: Tool = {
  cursor: () => 'crosshair',
  hint: ({ editor }) => (editor.barrierDraft ? 'canvas.hintBarrierDraft' : 'canvas.hintBarrier'),
  press({ project, editor, viewport }, { at }) {
    const target = findRoadSide(viewport.projection, project.project, project.samples, at);
    if (!target) return;
    if (editor.barrierDraft) editor.completeBarrier(target.pointId);
    else editor.beginBarrier(target);
  },
  hover({ project, editor, viewport }, { at }) {
    const target = findRoadSide(viewport.projection, project.project, project.samples, at);
    const current = editor.roadTarget;
    if (target?.pointId !== current?.pointId || target?.side !== current?.side)
      editor.roadTarget = target;
  },
  leave({ editor }) {
    editor.roadTarget = null;
  },
};
