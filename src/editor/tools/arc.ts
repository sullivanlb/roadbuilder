import type { Tool } from './tool';

/** Draws an arc on from the selected point, tangent to the track, ending at each click; Shift rounds it. */
export const arcTool: Tool = {
  cursor: () => 'crosshair',
  hint: () => 'canvas.hintArc',
  press({ editor, viewport }, { at, shiftKey }) {
    editor.drawArc(viewport.projection.toWorld(at), shiftKey);
  },
  hover({ editor, viewport }, { at, shiftKey }) {
    editor.drawPointer = { at: viewport.projection.toWorld(at), snap: shiftKey };
  },
  leave({ editor }) {
    editor.drawPointer = null;
  },
};
