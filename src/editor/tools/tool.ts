import type { PlanPoint } from '../../core/math';
import type { MessageKey } from '../../i18n';
import type { TrackHit } from '../../rendering/hits';
import type { ScreenPoint } from '../../rendering/plan/projection';
import type { useEditorStore } from '../../stores/editor';
import type { useProjectStore } from '../../stores/project';
import type { useUiStore } from '../../stores/ui';
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
  ui: ReturnType<typeof useUiStore>;
}

/**
 * The pointer in a view, resolved into what lies under it (docs/adr/0009). The
 * plan and the 3D preview resolve it each with its own reach; tools act on it
 * the same way in both.
 */
export interface PointerInput {
  hit: TrackHit;
  shiftKey: boolean;
  /** Where the pointer is on the plan canvas, in pixels; the 3D preview has none. */
  screen?: ScreenPoint;
}

/** The place under the pointer, on a 5 m grid with Shift. */
export const placeAt = ({ hit, shiftKey }: PointerInput): PlanPoint =>
  shiftKey
    ? { x: onGrid(hit.ground.x), z: onGrid(hit.ground.z) }
    : { x: hit.ground.x, z: hit.ground.z };

/** What a press starts: it follows the pointer until the button is released. */
export interface Gesture {
  move(input: PointerInput): void;
  end(): void;
}

/**
 * One way of interacting with the track, chosen in the tool palette. In the 3D
 * preview a press is made on release, so a press that moves turns the camera.
 */
export interface Tool {
  cursor(context: ToolContext): string;
  hint(context: ToolContext): MessageKey;
  press?(context: ToolContext, input: PointerInput): Gesture | void;
  /**
   * A press acts as soon as the button goes down and follows the pointer while
   * it is held, in every view: the 3D camera stays still meanwhile.
   */
  holds?: true;
  hover?(context: ToolContext, input: PointerInput): void;
  doubleClick?(context: ToolContext, input: PointerInput): void;
  /** The pointer left the view, or the ground under it, or the tool was switched. */
  leave?(context: ToolContext): void;
}
