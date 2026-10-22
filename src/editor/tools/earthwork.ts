import type { EarthworkType } from '../../core/project/schema';
import type { MessageKey } from '../../i18n';
import { findRoadPosition } from '../../rendering/plan/hitTest';
import type { Tool } from './tool';

const HINT: Record<EarthworkType, MessageKey> = {
  embankment: 'canvas.hintEmbankment',
  ditch: 'canvas.hintDitch',
  runoff: 'canvas.hintRunoff',
};

/**
 * Lays an earthwork of one type in two clicks on the road, on the clicked side:
 * one end, then the other. Picking another type between the clicks lays that one.
 */
export const earthworkTool = (type: EarthworkType): Tool => ({
  cursor: () => 'crosshair',
  hint: ({ editor }) => (editor.earthworkDraft ? 'canvas.hintEarthworkDraft' : HINT[type]),
  press({ project, editor, viewport }, { at }) {
    const spot = findRoadPosition(viewport.projection, project.project, project.samples, at);
    if (!spot) return;
    if (editor.earthworkDraft) editor.completeEarthwork(spot.s);
    else editor.beginEarthwork(spot);
  },
  hover({ project, editor, viewport }, { at }) {
    if (!editor.earthworkDraft) return;
    editor.earthworkTarget =
      findRoadPosition(viewport.projection, project.project, project.samples, at)?.s ?? null;
  },
  leave({ editor }) {
    editor.earthworkTarget = null;
  },
});
