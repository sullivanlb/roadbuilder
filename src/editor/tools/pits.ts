import { findRoadPosition } from '../../rendering/plan/hitTest';
import type { Tool } from './tool';

/** Lays the pit lane in two clicks on the road: its entry, then its exit, on the clicked side. */
export const pitsTool: Tool = {
  cursor: () => 'crosshair',
  hint: ({ editor }) => (editor.pitDraft ? 'canvas.hintPitsDraft' : 'canvas.hintPits'),
  press({ project, editor, viewport }, { at }) {
    const spot = findRoadPosition(viewport.projection, project.project, project.samples, at);
    if (!spot) return;
    if (editor.pitDraft) editor.completePitLane(spot.s);
    else editor.beginPitLane(spot);
  },
  hover({ project, editor, viewport }, { at }) {
    if (!editor.pitDraft) return;
    editor.pitTarget = findRoadPosition(viewport.projection, project.project, project.samples, at);
  },
  leave({ editor }) {
    editor.pitTarget = null;
  },
};
