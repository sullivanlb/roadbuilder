import type { Tool } from './tool';

/** Adds a control point after the selected one at each click. */
export const addTool: Tool = {
  cursor: () => 'crosshair',
  hint: () => 'canvas.hintAdd',
  press({ editor, viewport }, { at }) {
    editor.addPoint(viewport.projection.toWorld(at));
  },
};
