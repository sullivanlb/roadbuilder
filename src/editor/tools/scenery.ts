import type { SceneryKind } from '../../core/project/schema';
import { placeAt } from './tool';
import type { Tool } from './tool';

/**
 * Places a scenery item of one kind at each click, facing the nearest part of
 * the track, on a 5 m grid with Shift. The tool stays on to place the next one.
 */
export const placeTool = (kind: SceneryKind): Tool => ({
  cursor: () => 'crosshair',
  hint: () => 'canvas.hintScenery',
  press({ editor }, input) {
    editor.placeScenery(kind, placeAt(input));
  },
  hover({ editor }, input) {
    editor.sceneryPointer = placeAt(input);
  },
  leave({ editor }) {
    editor.sceneryPointer = null;
  },
});
