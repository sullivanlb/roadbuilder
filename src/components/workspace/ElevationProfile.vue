<script setup lang="ts">
import { useDevicePixelRatio, useElementSize } from '@vueuse/core';
import { computed, useTemplateRef, watch } from 'vue';
import { formatNumber, t } from '../../i18n';
import { drawProfile, pointAtProfile } from '../../rendering/profile';
import { useEditorStore } from '../../stores/editor';
import { useProjectStore } from '../../stores/project';

const store = useProjectStore();
const editor = useEditorStore();
const canvas = useTemplateRef<HTMLCanvasElement>('canvas');
const { width, height } = useElementSize(canvas);
const { pixelRatio } = useDevicePixelRatio();
const dpr = computed(() => Math.min(pixelRatio.value || 1, 2));

let frame: number | null = null;
function draw() {
  frame = null;
  const context = canvas.value?.getContext('2d');
  if (!context || !width.value || !height.value) return;
  drawProfile(
    context,
    { width: width.value, height: height.value },
    dpr.value,
    store.samples,
    editor.selectedIndex,
  );
}
watch([() => store.samples, () => editor.selectedIndex, width, height, dpr], () => {
  if (canvas.value) {
    canvas.value.width = Math.round(width.value * dpr.value);
    canvas.value.height = Math.round(height.value * dpr.value);
  }
  frame ??= requestAnimationFrame(draw);
});

function onClick(event: MouseEvent) {
  const rect = canvas.value!.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  if (store.samples.length)
    editor.selectPointAt(pointAtProfile(store.samples, store.project.points.length, ratio));
}
</script>

<template>
  <div class="profile">
    <div class="heading">
      <span>{{ t('profile.title') }}</span
      ><span id="elevation-range"
        >{{ formatNumber(store.stats.min) }} → {{ formatNumber(store.stats.max) }} m</span
      >
    </div>
    <canvas
      id="elevation-canvas"
      ref="canvas"
      :aria-label="t('profile.aria')"
      @click="onClick"
    ></canvas>
    <div class="axis">
      <span>{{ t('profile.start') }}</span
      ><span id="elevation-end"
        >{{ store.project.road.closed ? t('profile.closedEnd') : t('profile.openEnd') }} ·
        {{ formatNumber(store.stats.length / 1000, 2) }} KM</span
      >
    </div>
  </div>
</template>

<style scoped>
.profile {
  margin: 0 24px;
  padding: 13px 17px 9px;
  border: 1px solid #2b383a;
  border-radius: var(--radius);
  background: #172023;
  height: 128px;
  flex-shrink: 0;
}
.heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 8px;
  letter-spacing: 1.3px;
  color: #92a1a0;
}
.heading > span:last-child {
  letter-spacing: 0;
  font-family: monospace;
  font-size: 9px;
  color: #b6c697;
}
canvas {
  width: 100%;
  height: 69px;
  display: block;
  margin-top: 3px;
}
.axis {
  display: flex;
  justify-content: space-between;
  color: #657c7b;
  font-size: 7px;
  letter-spacing: 1px;
  margin-top: 3px;
}
@media (min-width: 1500px) {
  .profile {
    margin: 0 32px;
    height: 145px;
  }
  canvas {
    height: 87px;
  }
}
@media (max-width: 950px) {
  .profile {
    margin: 0 16px;
  }
}
@media (max-width: 650px) {
  .profile {
    margin: 0 12px;
    height: 107px;
  }
  canvas {
    height: 49px;
  }
}
</style>
