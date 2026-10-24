import type { ScreenPoint } from '../../rendering/plan/projection';
import type { Gesture, Tool, ToolContext } from './tool';

/** Moves the plan with the pointer; also used temporarily with Space or the middle button. */
export function panGesture({ viewport }: ToolContext, start: ScreenPoint): Gesture {
  const camera = viewport.camera;
  return {
    move: ({ screen }) => {
      if (screen) viewport.pan(camera, screen.x - start.x, screen.y - start.y);
    },
    end: () => {},
  };
}

/** Moves the plan; the 3D preview turns and moves its own camera instead. */
export const panTool: Tool = {
  cursor: () => 'grab',
  hint: () => 'canvas.hintPan',
  press: (context, { screen }) => (screen ? panGesture(context, screen) : undefined),
};
