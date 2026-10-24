import type { Draft } from 'immer';
import type { Id } from '../../core/ids';
import type { PlanPoint } from '../../core/math';
import { updateHill, updatePoint, updateScenery } from '../../core/project/edits';
import type { Project } from '../../core/project/schema';
import { sampleAt } from '../../core/track/centerline';
import { selectedIds } from '../../rendering/editing';
import type { ScreenPoint } from '../../rendering/plan/projection';
import { pickInLayer } from '../layers';
import { onGrid } from './tool';
import type { Gesture, Tool, ToolContext } from './tool';

/** What can be dragged on the plan, and how one of them moves. */
const MOVE: Record<
  'points' | 'scenery' | 'hill',
  {
    items: (project: Project) => readonly { id: Id; x: number; z: number }[];
    move: (draft: Draft<Project>, id: Id, at: PlanPoint) => void;
  }
> = {
  points: {
    items: (project) => project.points,
    move: (draft, id, at) => updatePoint(draft, id, at),
  },
  scenery: {
    items: (project) => project.scenery,
    move: (draft, id, at) => updateScenery(draft, id, at),
  },
  hill: { items: (project) => project.hills, move: (draft, id, at) => updateHill(draft, id, at) },
};

/**
 * Drags the items `ids` of a kind together, from where the pointer grabbed one
 * of them; with Shift, the grabbed one snaps to the grid and the others follow.
 */
function drag(
  { project }: ToolContext,
  kind: keyof typeof MOVE,
  ids: readonly Id[],
  grabbed: Id,
  grab: PlanPoint,
): Gesture {
  const { items, move } = MOVE[kind];
  const origins = items(project.project)
    .filter((item) => ids.includes(item.id))
    .map((item) => ({ id: item.id, x: item.x, z: item.z }));
  const origin = origins.find((item) => item.id === grabbed)!;
  return {
    move({ hit, shiftKey }) {
      let x = origin.x + hit.ground.x - grab.x,
        z = origin.z + hit.ground.z - grab.z;
      if (shiftKey) {
        x = onGrid(x);
        z = onGrid(z);
      }
      const dx = x - origin.x,
        dz = z - origin.z;
      project.edit(
        (draft) => {
          for (const item of origins) move(draft, item.id, { x: item.x + dx, z: item.z + dz });
        },
        { commit: false },
      );
    },
    end: () => project.commit(),
  };
}

/**
 * Drags a rectangle over the plan; the control points inside it get selected,
 * or on the scenery layer, the scenery items whose centre it holds.
 */
function marquee(
  { project, editor, viewport }: ToolContext,
  at: ScreenPoint,
  add: boolean,
): Gesture {
  const onScenery = editor.layer === 'scenery';
  const before = add ? (onScenery ? editor.selectedSceneryIds : editor.selectedPointIds) : [];
  editor.marquee = { x0: at.x, y0: at.y, x1: at.x, y1: at.y };
  return {
    move({ screen: now }) {
      if (now) editor.marquee = { x0: at.x, y0: at.y, x1: now.x, y1: now.y };
    },
    end() {
      const box = editor.marquee!;
      editor.marquee = null;
      const [left, right] = [Math.min(box.x0, box.x1), Math.max(box.x0, box.x1)];
      const [top, bottom] = [Math.min(box.y0, box.y1), Math.max(box.y0, box.y1)];
      if (right - left < 4 && bottom - top < 4)
        return void editor.select(add ? editor.selection : null);
      const inside = (onScenery ? project.project.scenery : project.project.points)
        .filter((item) => {
          const p = viewport.projection.toScreen(item);
          return p.x >= left && p.x <= right && p.y >= top && p.y <= bottom;
        })
        .map((item) => item.id);
      const ids = [...new Set([...before, ...inside])];
      editor.select(ids.length ? { kind: onScenery ? 'scenery' : 'points', ids } : null);
    },
  };
}

/**
 * Selects what the active layer offers under the pointer (docs/adr/0009). On the
 * track and scenery layers, Shift + click adds or removes one, a press drags the
 * whole selection on the plan, and dragging over empty space selects what a
 * rectangle holds; hills are dragged on the terrain layer. A double click on the
 * road inserts a control point there.
 */
export const selectTool: Tool = {
  cursor: ({ editor }) => (editor.hoveredPointId || editor.hoveredSceneryId ? 'grab' : 'default'),
  hint: ({ editor }) =>
    editor.layer === 'track'
      ? 'canvas.hintSelect'
      : editor.layer === 'scenery'
        ? 'canvas.hintSelectScenery'
        : 'canvas.hintSelectLayer',
  press(context, { hit, shiftKey, screen }) {
    const { project, editor } = context;
    // An empty track has nothing to select: the first click starts it.
    if (!project.project.points.length)
      return void editor.addPoint({ x: hit.ground.x, z: hit.ground.z });
    const picked = pickInLayer(
      editor.layer,
      hit,
      project.project,
      project.samples,
      editor.selection,
    );
    // Points and scenery are selected and dragged several at a time.
    const many =
      editor.layer === 'track' ? 'points' : editor.layer === 'scenery' ? 'scenery' : null;
    if (!many) {
      editor.select(picked);
      if (picked?.kind === 'hill') return drag(context, 'hill', [picked.id], picked.id, hit.ground);
      return;
    }
    const id = picked && 'ids' in picked ? picked.ids[0] : null;
    if (!id) {
      if (screen) return marquee(context, screen, shiftKey);
      return void editor.select(shiftKey ? editor.selection : null);
    }
    if (shiftKey)
      return void (many === 'points' ? editor.togglePoint(id) : editor.toggleScenery(id));
    if (!selectedIds(editor.selection, many).includes(id)) editor.select(picked);
    return drag(context, many, selectedIds(editor.selection, many), id, hit.ground);
  },
  hover({ editor }, { hit }) {
    editor.hoveredPointId = editor.layer === 'track' ? hit.pointId : null;
    editor.hoveredSceneryId = editor.layer === 'scenery' ? hit.sceneryId : null;
  },
  doubleClick({ project, editor }, { hit }) {
    if (editor.layer !== 'track' || hit.pointId || !hit.road) return;
    const sample = sampleAt(project.samples, hit.road.s)!;
    editor.addPoint(sample, sample.segment);
  },
  leave({ editor }) {
    editor.hoveredPointId = null;
    editor.hoveredSceneryId = null;
  },
};
