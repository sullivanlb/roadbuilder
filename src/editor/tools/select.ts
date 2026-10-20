import { updatePoint } from '../../core/project/edits';
import { findPoint, findRoad, trackHitAt } from '../../rendering/plan/hitTest';
import { pickInLayer } from '../layers';
import type { Gesture, Tool, ToolContext } from './tool';
import type { ScreenPoint } from '../../rendering/plan/projection';

/** Grid used while Shift is held during a drag, in metres. */
const SNAP = 5;

/** Drags the selected control points together, the grabbed one snapping to the grid with Shift. */
function dragPoints(
  { project, editor, viewport }: ToolContext,
  grabbed: string,
  at: ScreenPoint,
): Gesture {
  const view = viewport.projection;
  const ids = editor.selectedPointIds;
  const origins = project.project.points
    .filter((point) => ids.includes(point.id))
    .map((point) => ({ id: point.id, x: point.x, z: point.z }));
  const origin = origins.find((point) => point.id === grabbed)!;
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
      const dx = x - origin.x,
        dz = z - origin.z;
      project.edit(
        (draft) => {
          for (const point of origins)
            updatePoint(draft, point.id, { x: point.x + dx, z: point.z + dz });
        },
        { commit: false },
      );
    },
    end: () => project.commit(),
  };
}

/** Drags a rectangle over the plan; the control points inside it get selected. */
function marquee(
  { project, editor, viewport }: ToolContext,
  at: ScreenPoint,
  add: boolean,
): Gesture {
  const before = add ? editor.selectedPointIds : [];
  editor.marquee = { x0: at.x, y0: at.y, x1: at.x, y1: at.y };
  return {
    move({ at: now }) {
      editor.marquee = { x0: at.x, y0: at.y, x1: now.x, y1: now.y };
    },
    end() {
      const box = editor.marquee!;
      editor.marquee = null;
      const [left, right] = [Math.min(box.x0, box.x1), Math.max(box.x0, box.x1)];
      const [top, bottom] = [Math.min(box.y0, box.y1), Math.max(box.y0, box.y1)];
      if (right - left < 4 && bottom - top < 4)
        return void editor.select(add ? editor.selection : null);
      const inside = project.project.points
        .filter((point) => {
          const p = viewport.projection.toScreen(point);
          return p.x >= left && p.x <= right && p.y >= top && p.y <= bottom;
        })
        .map((point) => point.id);
      const ids = [...new Set([...before, ...inside])];
      editor.select(ids.length ? { kind: 'points', ids } : null);
    },
  };
}

/**
 * Selects what the active layer offers under the cursor. On the track layer,
 * control points are dragged (the whole selection together), Shift + click adds
 * or removes one, and dragging over empty space selects the points in a
 * rectangle; a double click on the road inserts a point there.
 */
export const selectTool: Tool = {
  cursor: ({ editor }) => (editor.hoveredPointId ? 'grab' : 'default'),
  hint: ({ editor }) => (editor.layer === 'track' ? 'canvas.hintSelect' : 'canvas.hintSelectLayer'),
  press(context, { at, shiftKey }) {
    const { project, editor, viewport } = context;
    const view = viewport.projection;
    // An empty track has nothing to select: the first click starts it.
    if (!project.project.points.length) return void editor.addPoint(view.toWorld(at));
    if (editor.layer === 'track') {
      const id = findPoint(view, project.project, at);
      if (!id) return marquee(context, at, shiftKey);
      if (shiftKey) return void editor.togglePoint(id);
      if (!editor.selectedPointIds.includes(id)) editor.selectPoint(id);
      return dragPoints(context, id, at);
    }
    const hit = trackHitAt(view, project.project, project.samples, at);
    editor.select(
      pickInLayer(editor.layer, hit, project.project, project.samples, editor.selection),
    );
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
