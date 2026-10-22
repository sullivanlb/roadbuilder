import type { PlanPoint } from '../../core/math';
import type { PlanProjection, ScreenPoint } from '../../rendering/plan/projection';
import { onGrid } from './tool';
import type { Tool } from './tool';

function placeAt(view: PlanProjection, at: ScreenPoint, snap: boolean): PlanPoint {
  const world = view.toWorld(at);
  return snap ? { x: onGrid(world.x), z: onGrid(world.z) } : world;
}

/** Raises a hill at each click, on a 5 m grid with Shift. The tool stays on to raise the next one. */
export const hillTool: Tool = {
  cursor: () => 'crosshair',
  hint: () => 'canvas.hintHill',
  press({ editor, viewport }, { at, shiftKey }) {
    editor.placeHill(placeAt(viewport.projection, at, shiftKey));
  },
  hover({ editor, viewport }, { at, shiftKey }) {
    editor.hillPointer = placeAt(viewport.projection, at, shiftKey);
  },
  leave({ editor }) {
    editor.hillPointer = null;
  },
};
