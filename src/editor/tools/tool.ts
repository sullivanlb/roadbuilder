import type { MessageKey } from '../../i18n';
import type { ScreenPoint } from '../../rendering/plan/projection';
import type { useEditorStore } from '../../stores/editor';
import type { useProjectStore } from '../../stores/project';
import type { useViewportStore } from '../../stores/viewport';

/** Grid the plan snaps to while Shift is held, in metres. */
export const SNAP_GRID = 5;

/** A coordinate on the plan, moved to the nearest grid line. */
export const onGrid = (value: number) => Math.round(value / SNAP_GRID) * SNAP_GRID;

/** The stores a tool works with. */
export interface ToolContext {
  project: ReturnType<typeof useProjectStore>;
  editor: ReturnType<typeof useEditorStore>;
  viewport: ReturnType<typeof useViewportStore>;
}

/** A pointer event on the plan, in canvas pixels. */
export interface PointerInput {
  at: ScreenPoint;
  shiftKey: boolean;
}

/** What a press starts: it follows the pointer until the button is released. */
export interface Gesture {
  move(input: PointerInput): void;
  end(): void;
}

/** One way of interacting with the plan, chosen in the tool palette. */
export interface Tool {
  cursor(context: ToolContext): string;
  hint(context: ToolContext): MessageKey;
  press?(context: ToolContext, input: PointerInput): Gesture | void;
  hover?(context: ToolContext, input: PointerInput): void;
  doubleClick?(context: ToolContext, input: PointerInput): void;
  /** The pointer left the plan or the tool was switched. */
  leave?(context: ToolContext): void;
}
