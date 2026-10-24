import type { Tool } from './tool';

/**
 * Paints relief with the brush while the button is held (docs/adr/0016): the
 * matter piles up under the pointer, even when it stays still. Shift swaps
 * raising and lowering.
 */
export const sculptTool: Tool = {
  cursor: () => 'crosshair',
  hint: () => 'canvas.hintSculpt',
  holds: true,
  press({ editor }, { hit, shiftKey }) {
    editor.brushPointer = hit.ground;
    editor.beginStroke(hit.ground, shiftKey);
    return {
      move({ hit: now }) {
        editor.brushPointer = now.ground;
        editor.strokeTo(now.ground);
      },
      end: () => editor.endStroke(),
    };
  },
  hover({ editor }, { hit }) {
    editor.brushPointer = hit.ground;
  },
  leave({ editor }) {
    editor.brushPointer = null;
  },
};
