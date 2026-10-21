<script setup lang="ts">
import { useDevicePixelRatio, useElementSize } from '@vueuse/core';
import { computed, onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue';
import { usePlanInteraction } from '../../editor/usePlanInteraction';
import { formatNumber, t } from '../../i18n';
import { drawPlan } from '../../rendering/plan/draw';
import type { PlanScene } from '../../rendering/plan/draw';
import { useEditorStore } from '../../stores/editor';
import { useProjectStore } from '../../stores/project';
import { useViewportStore } from '../../stores/viewport';

const store = useProjectStore();
const editor = useEditorStore();
const viewport = useViewportStore();

const host = useTemplateRef<HTMLDivElement>('host');
const canvas = useTemplateRef<HTMLCanvasElement>('canvas');
const { width, height } = useElementSize(host);
const { pixelRatio } = useDevicePixelRatio();
const dpr = computed(() => Math.min(pixelRatio.value || 1, 2));
const { cursor, hint, listeners, end } = usePlanInteraction(canvas);

const scene = computed<PlanScene>(() => ({
  project: store.project,
  samples: store.samples,
  layer: editor.layer,
  hiddenLayers: editor.hiddenLayers,
  pitLaneSelected: editor.selection?.kind === 'pitLane',
  tightTurns: store.issues.tightTurns,
  selectedPointIds: editor.selectedPointIds,
  marquee: editor.marquee,
  hoveredPointId: editor.hoveredPointId,
  selectedBarrierId: editor.selectedBarrierId,
  barrierDraft: editor.barrierDraft,
  barrierTarget: editor.barrierDraft ? editor.barrierTarget : null,
  pitDraft: editor.pitDraft && { entry: editor.pitDraft.s, side: editor.pitDraft.side },
  pitTarget: editor.pitDraft ? editor.pitTarget : null,
  selectedWidthZoneId: editor.selectedWidthZoneId,
  widthDraft: editor.widthDraft,
  widthTarget: editor.widthDraft !== null ? editor.widthTarget : null,
  selectedBankZoneId: editor.selectedBankZoneId,
  bankDraft: editor.bankDraft,
  bankTarget: editor.bankDraft !== null ? editor.bankTarget : null,
  drawDraft: editor.drawDraft,
  selectedSceneryIds: editor.selectedSceneryIds,
  hoveredSceneryId: editor.hoveredSceneryId,
  sceneryGhost: editor.sceneryGhost,
  range: editor.range,
  hoverS: editor.hoverS,
  labels: {
    start: t('canvas.start'),
    finish: t('canvas.finish'),
    distance: (metres: number) => `${formatNumber(metres)} m`,
    straight: (length: number, turn: number) =>
      t('canvas.straightLabel', { length: formatNumber(length, 1), turn }),
    arc: (radius: number, angle: number) =>
      t('canvas.arcLabel', { radius: formatNumber(radius), angle }),
    radius: (radius: number) => t('canvas.radius', { radius: formatNumber(radius) }),
  },
}));

let frame: number | null = null;
function draw() {
  frame = null;
  const context = canvas.value?.getContext('2d');
  if (context) drawPlan(context, viewport.projection, scene.value, dpr.value);
}
function requestDraw() {
  frame ??= requestAnimationFrame(draw);
}

watch([width, height, dpr], ([w, h, ratio]) => {
  if (!canvas.value || !w || !h) return;
  canvas.value.width = Math.round(w * ratio);
  canvas.value.height = Math.round(h * ratio);
  viewport.resize({ width: w, height: h });
  requestDraw();
});
watch([scene, () => viewport.projection], requestDraw);
watch(
  () => viewport.focusRequest,
  () => canvas.value?.focus({ preventScroll: true }),
);
onMounted(requestDraw);
onBeforeUnmount(() => {
  end();
  if (frame !== null) cancelAnimationFrame(frame);
});

/** Scale bar: the round length (1, 2 or 5 × 10ⁿ m) closest to 70 px. */
const scaleBar = computed(() => {
  const ideal = 70 / viewport.camera.scale,
    magnitude = 10 ** Math.floor(Math.log10(ideal));
  const metres = [1, 2, 5, 10]
    .map((n) => n * magnitude)
    .reduce((best, n) => (Math.abs(n - ideal) < Math.abs(best - ideal) ? n : best));
  return {
    width: metres * viewport.camera.scale,
    label: metres >= 1000 ? `${formatNumber(metres / 1000)} km` : `${formatNumber(metres)} m`,
  };
});
</script>

<template>
  <div ref="host" class="plan">
    <canvas
      id="track-canvas"
      ref="canvas"
      :style="{ cursor }"
      tabindex="0"
      :aria-label="t('editor.canvasAria')"
      v-on="listeners"
    ></canvas>
    <div id="canvas-hint" class="hint">{{ hint }}</div>
    <div id="map-scale" class="scale">
      <span :style="{ width: `${scaleBar.width}px` }"></span><output>{{ scaleBar.label }}</output>
    </div>
    <div class="compass" aria-hidden="true">
      <span>N</span>
      <svg viewBox="0 0 40 40">
        <path d="m20 5 8 28-8-5-8 5z" fill="#d3f47d" />
        <path d="m20 5 0 23-8 5z" fill="#769164" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.plan {
  position: absolute;
  inset: 0;
}
canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
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
.scale {
  position: absolute;
  bottom: 21px;
  left: 20px;
  color: #a7b59b;
  text-align: center;
  font-family: monospace;
  font-size: 8px;
  pointer-events: none;
}
.scale > span {
  display: block;
  height: 5px;
  border: 1px solid #a7b59b;
  border-top: 0;
  margin-bottom: 5px;
}
.compass {
  position: absolute;
  bottom: 70px;
  right: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
}
.compass span {
  font-family: monospace;
  font-size: 9px;
  color: #b6c6a6;
}
.compass svg {
  width: 31px;
  height: 31px;
}
@media (max-width: 1200px) {
  .hint {
    bottom: 61px;
    font-size: 8px;
  }
}
@media (max-width: 950px) {
  .hint {
    max-width: 80%;
    text-align: center;
    white-space: normal;
    line-height: 1.5;
  }
}
</style>
