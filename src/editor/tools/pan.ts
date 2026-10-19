import type { Gesture, PointerInput, Tool, ToolContext } from './tool';

/** Moves the plan with the pointer; also used temporarily with Space or the middle button. */
export function panGesture({ viewport }: ToolContext, start: PointerInput): Gesture {
  const camera = viewport.camera;
  return {
    move: ({ at }) => viewport.pan(camera, at.x - start.at.x, at.y - start.at.y),
    end: () => {},
  };
}

export const panTool: Tool = {
  cursor: () => 'grab',
  hint: () => 'canvas.hintPan',
  press: panGesture,
};
