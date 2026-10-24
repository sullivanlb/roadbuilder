<script setup lang="ts">
import { useDevicePixelRatio, useElementSize } from '@vueuse/core';
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { buildScene } from '../../core/scene/scene';
import { previewInput } from '../../editor/previewInput';
import type { PreviewPointer } from '../../editor/previewInput';
import { t } from '../../i18n';
import { trackHitNear } from '../../rendering/preview/hitTest';
import { buildOverlay } from '../../rendering/preview/overlay';
import { PreviewRenderer } from '../../rendering/preview/PreviewRenderer';
import { useEditorStore } from '../../stores/editor';
import { useUiStore } from '../../stores/ui';
import { useProjectStore } from '../../stores/project';
import { useViewportStore } from '../../stores/viewport';

/** The 3D preview; loaded on demand with Three.js (see docs/adr/0004). */
const store = useProjectStore();
const viewport = useViewportStore();
const editor = useEditorStore();
const ui = useUiStore();
const host = useTemplateRef<HTMLDivElement>('host');
const canvas = useTemplateRef<HTMLCanvasElement>('canvas');
const { width, height } = useElementSize(host);
const { pixelRatio } = useDevicePixelRatio();
const failed = ref(false);
let renderer: PreviewRenderer | null = null;

const scene = computed(() => buildScene(store.project, store.samples));
const overlay = computed(() =>
  buildOverlay(store.project, store.samples, {
    editing: editor.editing,
    sceneryFloors: scene.value.sceneryFloors,
  }),
);
const pointer = previewInput({ project: store, editor, viewport, ui });

/** A pointer event, with what lies under it on the ground. */
function at(event: PointerEvent): PreviewPointer {
  const rect = canvas.value!.getBoundingClientRect();
  const x = event.clientX - rect.left,
    y = event.clientY - rect.top;
  const picked = renderer?.pick(x, y);
  return {
    x,
    y,
    button: event.button,
    shiftKey: event.shiftKey,
    hit: picked?.world
      ? trackHitNear(store.project, store.samples, picked.world, picked.pointId)
      : null,
  };
}

function onPointerDown(event: PointerEvent) {
  if (renderer && pointer.down(at(event))) canvas.value!.setPointerCapture(event.pointerId);
}
function onPointerUp(event: PointerEvent) {
  if (renderer) pointer.up(at(event));
}
function onPointerMove(event: PointerEvent) {
  if (renderer) pointer.move(at(event));
}

onMounted(() => {
  try {
    renderer = new PreviewRenderer(canvas.value!);
  } catch {
    // No WebGL on this device: the plan stays usable.
    failed.value = true;
    return;
  }
  watch(scene, (next) => renderer?.setScene(next, store.samples, store.issues.tightTurns), {
    immediate: true,
  });
  watch(
    [() => editor.layer, () => editor.hiddenLayers],
    ([layer, hidden]) => renderer?.setLayers(layer, hidden),
    { immediate: true },
  );
  watch(overlay, (next) => renderer?.setOverlay(next), { immediate: true });
  watch(
    () => editor.tool === 'sculpt',
    (on) => renderer?.setBrush(on),
    { immediate: true },
  );
  // The terrain shown bends as the stroke paints; the scene is rebuilt when it ends.
  watch(
    () => editor.relief,
    () => {
      if (editor.stroke) renderer?.bendTerrain(editor.stroke);
    },
  );
  watch(
    [width, height, pixelRatio],
    ([w, h, ratio]) => {
      if (w && h) renderer?.resize({ width: w, height: h }, Math.min(ratio || 1, 2));
    },
    { immediate: true },
  );
});
const { off } = viewport.onPreviewCommand((command) => {
  if (command.type === 'fit') renderer?.fit();
  else if (command.type === 'zoom') renderer?.zoom(command.factor);
  else if (command.type === 'focus') renderer?.framePlaces(command.points);
  else renderer?.centerOn(command.at);
});
onBeforeUnmount(() => {
  pointer.cancel();
  off();
  renderer?.dispose();
  renderer = null;
});
</script>

<template>
  <div ref="host" class="preview">
    <canvas
      id="preview-canvas"
      ref="canvas"
      :aria-label="t('editor.view3d')"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
      @pointermove="onPointerMove"
      @pointercancel="pointer.cancel()"
      @pointerleave="pointer.leave()"
    ></canvas>
    <p v-if="failed" id="preview-unavailable" class="unavailable">{{ t('preview.unavailable') }}</p>
    <div class="hint">
      {{ editor.tool === 'sculpt' ? t('canvas.hint3dSculpt') : t('canvas.hint3d') }}
    </div>
  </div>
</template>

<style scoped>
.preview {
  position: absolute;
  inset: 0;
}
canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
}
.unavailable {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
  color: var(--muted);
}
.hint {
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  color: #a0ae96;
  font-size: 9px;
  background: #17241de8;
  border: 1px solid #374733;
  border-radius: 4px;
  padding: 8px 12px;
  white-space: nowrap;
  pointer-events: none;
}
@media (max-width: 1200px) {
  .hint {
    bottom: 61px;
    font-size: 8px;
  }
}
</style>
