import type { PlanPoint } from '../../core/math';
import type { SceneryKind } from '../../core/project/schema';
import type { PlanProjection, ScreenPoint } from '../../rendering/plan/projection';
import { onGrid } from './tool';
import type { Tool } from './tool';

function placeAt(view: PlanProjection, at: ScreenPoint, snap: boolean): PlanPoint {
  const world = view.toWorld(at);
  return snap ? { x: onGrid(world.x), z: onGrid(world.z) } : world;
}

/**
 * Places a scenery item of one kind at each click, facing the nearest part of
 * the track, on a 5 m grid with Shift. The tool stays on to place the next one.
 */
export const placeTool = (kind: SceneryKind): Tool => ({
  cursor: () => 'crosshair',
  hint: () => 'canvas.hintScenery',
  press({ editor, viewport }, { at, shiftKey }) {
    editor.placeScenery(kind, placeAt(viewport.projection, at, shiftKey));
  },
  hover({ editor, viewport }, { at, shiftKey }) {
    editor.sceneryPointer = placeAt(viewport.projection, at, shiftKey);
  },
  leave({ editor }) {
    editor.sceneryPointer = null;
  },
});
