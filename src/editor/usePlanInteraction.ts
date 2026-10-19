import { useEventListener } from '@vueuse/core';
import { computed, ref } from 'vue';
import type { Ref } from 'vue';
import { t } from '../i18n';
import { useEditorStore } from '../stores/editor';
import { useProjectStore } from '../stores/project';
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
  };
  const editor = context.editor;
  const tool = computed(() => TOOLS[editor.tool]);
  const spaceHeld = ref(false);
  const gesture = ref<Gesture | null>(null);

  const cursor = computed(() =>
    gesture.value ? 'grabbing' : spaceHeld.value ? 'grab' : tool.value.cursor(context),
  );
  const hint = computed(() => t(tool.value.hint(context)));

  function input(event: MouseEvent): PointerInput {
    const rect = canvas.value!.getBoundingClientRect();
    return {
      at: { x: event.clientX - rect.left, y: event.clientY - rect.top },
      shiftKey: event.shiftKey,
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
      gesture.value = panGesture(context, at);
    } else gesture.value = tool.value.press?.(context, at) ?? null;
  }

  function onPointerMove(event: PointerEvent) {
    if (gesture.value) gesture.value.move(input(event));
    else tool.value.hover?.(context, input(event));
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
    context.viewport.zoom(Math.exp(-delta * 0.002), input(event).at);
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
