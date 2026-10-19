<script setup lang="ts">
import { useDevicePixelRatio, useElementSize } from '@vueuse/core';
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { buildScene } from '../../core/scene/scene';
import { t } from '../../i18n';
import { PreviewRenderer } from '../../rendering/preview/PreviewRenderer';
import { useProjectStore } from '../../stores/project';
import { useViewportStore } from '../../stores/viewport';

/** The 3D preview; loaded on demand with Three.js (see docs/adr/0004). */
const store = useProjectStore();
const viewport = useViewportStore();
const host = useTemplateRef<HTMLDivElement>('host');
const canvas = useTemplateRef<HTMLCanvasElement>('canvas');
const { width, height } = useElementSize(host);
const { pixelRatio } = useDevicePixelRatio();
const failed = ref(false);
let renderer: PreviewRenderer | null = null;

const scene = computed(() => buildScene(store.project, store.samples));

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
    [width, height, pixelRatio],
    ([w, h, ratio]) => {
      if (w && h) renderer?.resize({ width: w, height: h }, Math.min(ratio || 1, 2));
    },
    { immediate: true },
  );
});
const { off } = viewport.onPreviewCommand((command) => {
  if (command.type === 'fit') renderer?.fit();
  else renderer?.zoom(command.factor);
});
onBeforeUnmount(() => {
  off();
  renderer?.dispose();
  renderer = null;
});
</script>

<template>
  <div ref="host" class="preview">
    <canvas id="preview-canvas" ref="canvas" :aria-label="t('editor.view3d')"></canvas>
    <p v-if="failed" id="preview-unavailable" class="unavailable">{{ t('preview.unavailable') }}</p>
    <div class="hint">{{ t('canvas.hint3d') }}</div>
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
