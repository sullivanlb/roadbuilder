import { useEventListener } from '@vueuse/core';
import { computed, ref } from 'vue';
import type { Ref } from 'vue';
import { t } from '../i18n';
import { trackHitAt } from '../rendering/plan/hitTest';
import type { ScreenPoint } from '../rendering/plan/projection';
import { useEditorStore } from '../stores/editor';
import { useProjectStore } from '../stores/project';
import { useUiStore } from '../stores/ui';
import { useViewportStore } from '../stores/viewport';
import { isTyping } from './focus';
import { panGesture, TOOLS } from './tools';
import type { Gesture, PointerInput, ToolContext } from './tools';

/** Wheel delta beyond which a notch no longer zooms further. */
const WHEEL_LIMIT = 150;

/**
 * Routes the pointer events of the plan canvas to the active tool. Space and
 * the middle button pan the plan whatever the tool.
 */
export function usePlanInteraction(canvas: Ref<HTMLCanvasElement | null>) {
  const context: ToolContext = {
    project: useProjectStore(),
    editor: useEditorStore(),
    viewport: useViewportStore(),
    ui: useUiStore(),
  };
  const editor = context.editor;
  const tool = computed(() => TOOLS[editor.tool]);
  const spaceHeld = ref(false);
  const gesture = ref<Gesture | null>(null);

  const cursor = computed(() =>
    gesture.value ? 'grabbing' : spaceHeld.value ? 'grab' : tool.value.cursor(context),
  );
  const hint = computed(() => t(tool.value.hint(context)));

  /** The pointer on the plan, resolved into what lies under it with the plan's reach in pixels. */
  function input(event: MouseEvent): PointerInput & { screen: ScreenPoint } {
    const rect = canvas.value!.getBoundingClientRect();
    const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const { project, viewport } = context;
    return {
      hit: trackHitAt(viewport.projection, project.project, project.samples, screen),
      shiftKey: event.shiftKey,
      screen,
    };
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0 && event.button !== 1) return;
    canvas.value!.focus({ preventScroll: true });
    canvas.value!.setPointerCapture(event.pointerId);
    context.project.commit();
    const at = input(event);
    if (spaceHeld.value || event.button === 1) {
      event.preventDefault();
      gesture.value = panGesture(context, at.screen);
    } else gesture.value = tool.value.press?.(context, at) ?? null;
  }

  function onPointerMove(event: PointerEvent) {
    const at = input(event);
    if (gesture.value) gesture.value.move(at);
    else tool.value.hover?.(context, at);
    // The band follows the pointer along the road.
    editor.hoverS = at.hit.road?.s ?? null;
  }

  function end() {
    gesture.value?.end();
    gesture.value = null;
  }

  function onDoubleClick(event: MouseEvent) {
    if (!spaceHeld.value) tool.value.doubleClick?.(context, input(event));
  }

  function onWheel(event: WheelEvent) {
    event.preventDefault();
    const delta = Math.max(-WHEEL_LIMIT, Math.min(WHEEL_LIMIT, event.deltaY));
    const rect = canvas.value!.getBoundingClientRect();
    context.viewport.zoom(Math.exp(-delta * 0.002), {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }

  function onLeave() {
    if (!gesture.value) tool.value.leave?.(context);
  }

  useEventListener(document, 'keydown', (event: KeyboardEvent) => {
    if (event.code !== 'Space' || isTyping() || document.querySelector('dialog[open]')) return;
    event.preventDefault();
    spaceHeld.value = true;
  });
  useEventListener(document, 'keyup', (event: KeyboardEvent) => {
    if (event.code === 'Space') spaceHeld.value = false;
  });
  // Losing the window mid-drag must not leave a gesture half done.
  useEventListener(window, 'blur', () => {
    spaceHeld.value = false;
    end();
  });

  return {
    cursor,
    hint,
    listeners: {
      pointerdown: onPointerDown,
      pointermove: onPointerMove,
      pointerup: end,
      pointercancel: end,
      lostpointercapture: end,
      pointerleave: onLeave,
      dblclick: onDoubleClick,
      wheel: onWheel,
    },
    end,
  };
}
