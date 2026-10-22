import type { Tool } from './tool';

/**
 * Paints relief with the brush while the button is held (docs/adr/0016): the
 * matter piles up under the pointer, even when it stays still. Shift swaps
 * raising and lowering.
 */
export const sculptTool: Tool = {
  cursor: () => 'crosshair',
  hint: () => 'canvas.hintSculpt',
  press({ editor, viewport }, { at, shiftKey }) {
    const world = viewport.projection.toWorld(at);
    editor.brushPointer = world;
    editor.beginStroke(world, shiftKey);
    return {
      move({ at: now }) {
        const next = viewport.projection.toWorld(now);
        editor.brushPointer = next;
        editor.strokeTo(next);
      },
      end: () => editor.endStroke(),
    };
  },
  hover({ editor, viewport }, { at }) {
    editor.brushPointer = viewport.projection.toWorld(at);
  },
  leave({ editor }) {
    editor.brushPointer = null;
  },
};
