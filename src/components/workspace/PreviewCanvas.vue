<script setup lang="ts">
import { useDevicePixelRatio, useElementSize } from '@vueuse/core';
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { buildScene } from '../../core/scene/scene';
import { rangeBetween } from '../../core/track/ranges';
import type { TrackRange } from '../../core/track/ranges';
import { previewClick, previewHover } from '../../editor/previewInput';
import { t } from '../../i18n';
import { trackHitNear } from '../../rendering/plan/hitTest';
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

/** The stretch being laid with a two-click tool, from its first click to the pointer. */
const draft = computed<TrackRange | null>(() => {
  const from =
    editor.barrierDraft?.s ??
    editor.earthworkDraft?.s ??
    editor.widthDraft ??
    editor.bankDraft ??
    editor.pitDraft?.s ??
    null;
  const to =
    editor.barrierTarget ??
    editor.earthworkTarget ??
    editor.widthTarget ??
    editor.bankTarget ??
    editor.pitTarget?.s ??
    null;
  return from !== null && to !== null ? rangeBetween(store.project, store.samples, from, to) : null;
});
const overlay = computed(() =>
  buildOverlay(store.project, store.samples, {
    layer: editor.layer,
    selection: editor.selection,
    range: editor.range,
    draft: draft.value,
    hoverS: editor.hoverS,
    sceneryFloors: scene.value.sceneryFloors,
    brush:
      editor.tool === 'sculpt' && editor.brushPointer?.y !== undefined
        ? { ...editor.brushPointer, y: editor.brushPointer.y, radius: editor.brushRadius }
        : null,
  }),
);

/** What lies under the pointer, as a track hit. */
function hitAt(event: PointerEvent) {
  const rect = canvas.value!.getBoundingClientRect();
  const picked = renderer!.pick(event.clientX - rect.left, event.clientY - rect.top);
  if (!picked.world) return null;
  return trackHitNear(store.project, store.samples, picked.world, picked.pointId);
}

/** The place on the ground under the pointer, as the brush paints it. */
function groundAt(event: PointerEvent) {
  const rect = canvas.value!.getBoundingClientRect();
  return renderer!.pick(event.clientX - rect.left, event.clientY - rect.top).world;
}

// With the brush, the left button paints for as long as it is held (docs/adr/0016).
let painting = false;
function paintFrom(event: PointerEvent) {
  const at = groundAt(event);
  if (!at) return false;
  canvas.value!.setPointerCapture(event.pointerId);
  painting = true;
  editor.brushPointer = at;
  editor.beginStroke(at, event.shiftKey);
  return true;
}
function stopPainting() {
  if (!painting) return;
  painting = false;
  editor.endStroke();
}

// A press that barely moves is a click; a longer one turns the camera.
let press: { x: number; y: number } | null = null;
function onPointerDown(event: PointerEvent) {
  if (renderer && editor.tool === 'sculpt' && event.button === 0 && paintFrom(event)) return;
  press = event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
}
function onPointerUp(event: PointerEvent) {
  if (painting) return stopPainting();
  const start = press;
  press = null;
  if (!renderer || !start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4)
    return;
  const hit = hitAt(event);
  if (hit) previewClick({ project: store, editor, ui }, hit, event.shiftKey);
}
function onPointerMove(event: PointerEvent) {
  if (!renderer) return;
  if (editor.tool === 'sculpt') {
    const at = groundAt(event);
    editor.brushPointer = at;
    if (painting && at) editor.strokeTo(at);
    if (painting) return;
  }
  if (press) return;
  const hit = hitAt(event);
  previewHover({ editor }, hit ?? { road: null });
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
    () => editor.strokeVersion,
    () => {
      const stroke = editor.stroke;
      if (stroke)
        renderer?.bendTerrain(
          (p) => stroke.field.at(p) - stroke.before.at(p),
          stroke.ground.clearance,
          stroke.covered,
        );
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
  stopPainting();
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
      @pointercancel="stopPainting"
      @pointerleave="
        editor.hoverS = null;
        if (!painting) editor.brushPointer = null;
      "
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
