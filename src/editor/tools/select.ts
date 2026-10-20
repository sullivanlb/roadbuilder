import { updatePoint } from '../../core/project/edits';
import { findPoint, findRoad, trackHitAt } from '../../rendering/plan/hitTest';
import { pickInLayer } from '../layers';
import type { Tool } from './tool';

/** Grid used while Shift is held during a drag, in metres. */
const SNAP = 5;

/**
 * Selects what the active layer offers under the cursor: control points (which
 * can be dragged) on the track layer, width zones, barriers or the pit lane on
 * the others. A double click on the road inserts a point on the track layer.
 */
export const selectTool: Tool = {
  cursor: ({ editor }) => (editor.hoveredPointId ? 'grab' : 'default'),
  hint: ({ editor }) => (editor.layer === 'track' ? 'canvas.hintSelect' : 'canvas.hintSelectLayer'),
  press({ project, editor, viewport }, { at }) {
    const view = viewport.projection;
    // An empty track has nothing to select: the first click starts it.
    if (!project.project.points.length) return void editor.addPoint(view.toWorld(at));
    const hit = trackHitAt(view, project.project, project.samples, at);
    const selection = pickInLayer(editor.layer, hit, project.project, project.samples);
    editor.select(selection);
    if (selection?.kind !== 'points') return;
    const id = selection.ids[0];
    const origin = project.project.points.find((point) => point.id === id)!;
    const grab = view.toWorld(at);
    return {
      move({ at: now, shiftKey }) {
        const pointer = view.toWorld(now);
        let x = origin.x + pointer.x - grab.x,
          z = origin.z + pointer.z - grab.z;
        if (shiftKey) {
          x = Math.round(x / SNAP) * SNAP;
          z = Math.round(z / SNAP) * SNAP;
        }
        project.edit((draft) => updatePoint(draft, id, { x, z }), { commit: false });
      },
      end: () => project.commit(),
    };
  },
  hover({ project, editor, viewport }, { at }) {
    editor.hoveredPointId =
      editor.layer === 'track' ? findPoint(viewport.projection, project.project, at) : null;
  },
  doubleClick({ project, editor, viewport }, { at }) {
    if (editor.layer !== 'track') return;
    const view = viewport.projection;
    if (findPoint(view, project.project, at)) return;
    const road = findRoad(view, project.project, project.samples, at);
    if (road) editor.addPoint(road, road.segment);
  },
  leave({ editor }) {
    editor.hoveredPointId = null;
  },
};
