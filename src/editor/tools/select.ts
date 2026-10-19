import { updatePoint } from '../../core/project/edits';
import { findBarrier, findPoint, findRoad } from '../../rendering/plan/hitTest';
import type { Tool } from './tool';

/** Grid used while Shift is held during a drag, in metres. */
const SNAP = 5;

/** Selects and drags control points, selects barriers, inserts a point with a double click. */
export const selectTool: Tool = {
  cursor: ({ editor }) => (editor.hoveredPointId ? 'grab' : 'default'),
  hint: () => 'canvas.hintSelect',
  press({ project, editor, viewport }, { at }) {
    const view = viewport.projection;
    // An empty track has nothing to select: the first click starts it.
    if (!project.project.points.length) return void editor.addPoint(view.toWorld(at));
    const id = findPoint(view, project.project, at);
    if (id) {
      editor.selectPoint(id);
      editor.selectBarrier(null);
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
    }
    const barrier = findBarrier(view, project.project, project.samples, at);
    editor.selectBarrier(barrier);
    if (!barrier) editor.selectPoint(null);
  },
  hover({ project, editor, viewport }, { at }) {
    editor.hoveredPointId = findPoint(viewport.projection, project.project, at);
  },
  doubleClick({ project, editor, viewport }, { at }) {
    const view = viewport.projection;
    if (findPoint(view, project.project, at)) return;
    const road = findRoad(view, project.project, project.samples, at);
    if (road) editor.addPoint(road, road.segment);
  },
  leave({ editor }) {
    editor.hoveredPointId = null;
  },
};
