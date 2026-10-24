import type { TrackHit } from '../rendering/hits';
import { TOOLS } from './tools';
import type { Gesture, PointerInput, ToolContext } from './tools';

/** A pointer event in the 3D preview: where it is on the canvas, and what lies under it. */
export interface PreviewPointer {
  x: number;
  y: number;
  button: number;
  shiftKey: boolean;
  /** What lies under the pointer, or null where it misses the ground. */
  hit: TrackHit | null;
}

/** How far a press may move, in pixels, and still be a click rather than a turn of the camera. */
const CLICK = 4;

/**
 * Routes the pointer of the 3D preview to the active tool, which acts on what
 * lies under it as it would on the plan (docs/adr/0009). A press that barely
 * moves is a click, made when the button is released; one that moves turns the
 * camera instead. A tool that holds acts as soon as the left button goes down,
 * and the camera stays still while it does.
 */
export function previewInput(context: ToolContext) {
  const { editor } = context;
  const tool = () => TOOLS[editor.tool];
  const input = (event: PreviewPointer, hit: TrackHit): PointerInput => ({
    hit,
    shiftKey: event.shiftKey,
  });
  let gesture: Gesture | null = null;
  let press: { x: number; y: number } | null = null;
  /** The press was cancelled, or released: what it started ends. */
  function cancel() {
    gesture?.end();
    gesture = null;
    press = null;
  }

  return {
    /** A button went down; true when the tool takes the press, so the camera must not turn. */
    down(event: PreviewPointer): boolean {
      press = null;
      if (event.button !== 0) return false;
      if (!tool().holds) {
        press = { x: event.x, y: event.y };
        return false;
      }
      if (!event.hit) return false;
      gesture = tool().press?.(context, input(event, event.hit)) ?? null;
      return gesture !== null;
    },
    move(event: PreviewPointer) {
      if (gesture) {
        if (event.hit) gesture.move(input(event, event.hit));
        return;
      }
      // A press under way turns the camera.
      if (press) return;
      // The band follows the pointer along the road.
      editor.hoverS = event.hit?.road?.s ?? null;
      if (event.hit) tool().hover?.(context, input(event, event.hit));
      else tool().leave?.(context);
    },
    up(event: PreviewPointer) {
      if (gesture) return cancel();
      const start = press;
      press = null;
      if (!start || !event.hit || Math.hypot(event.x - start.x, event.y - start.y) > CLICK) return;
      tool().press?.(context, input(event, event.hit))?.end();
    },
    cancel,
    /** The pointer left the preview. */
    leave() {
      editor.hoverS = null;
      if (!gesture) tool().leave?.(context);
    },
  };
}
