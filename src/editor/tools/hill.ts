import { placeAt } from './tool';
import type { Tool } from './tool';

/** Raises a hill at each click, on a 5 m grid with Shift. The tool stays on to raise the next one. */
export const hillTool: Tool = {
  cursor: () => 'crosshair',
  hint: () => 'canvas.hintHill',
  press({ editor }, input) {
    editor.placeHill(placeAt(input));
  },
  hover({ editor }, input) {
    editor.hillPointer = placeAt(input);
  },
  leave({ editor }) {
    editor.hillPointer = null;
  },
};
