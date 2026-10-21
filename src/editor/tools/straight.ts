import type { Tool } from './tool';

/** Draws a straight from the selected point to each click; Shift keeps it on the track heading. */
export const straightTool: Tool = {
  cursor: () => 'crosshair',
  hint: () => 'canvas.hintStraight',
  press({ editor, viewport }, { at, shiftKey }) {
    editor.drawStraight(viewport.projection.toWorld(at), shiftKey);
  },
  hover({ editor, viewport }, { at, shiftKey }) {
    editor.drawPointer = { at: viewport.projection.toWorld(at), snap: shiftKey };
  },
  leave({ editor }) {
    editor.drawPointer = null;
  },
};
