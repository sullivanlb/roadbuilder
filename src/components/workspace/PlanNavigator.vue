<script setup lang="ts">
import { useDevicePixelRatio } from '@vueuse/core';
import { computed, useTemplateRef, watch } from 'vue';
import { bounds } from '../../core/math';
import { formatTrackIssue, t } from '../../i18n';
import { COLORS } from '../../rendering/theme';
import { useProjectStore } from '../../stores/project';
import { useViewportStore } from '../../stores/viewport';

/** A map of the whole track with the visible area, and a list of places to jump to. */
const store = useProjectStore();
const viewport = useViewportStore();
const canvas = useTemplateRef<HTMLCanvasElement>('canvas');
const { pixelRatio } = useDevicePixelRatio();
const SIZE = { width: 168, height: 112 };
const MARGIN = 10;

const frame = computed(() => {
  const area = bounds(store.samples.length ? store.samples : store.project.points, 0);
  const scale = Math.min(
    (SIZE.width - 2 * MARGIN) / Math.max(1, area.maxX - area.minX),
    (SIZE.height - 2 * MARGIN) / Math.max(1, area.maxZ - area.minZ),
  );
  const x0 = (SIZE.width - (area.maxX - area.minX) * scale) / 2 - area.minX * scale;
  const z0 = (SIZE.height - (area.maxZ - area.minZ) * scale) / 2 - area.minZ * scale;
  return { scale, x0, z0 };
});
const toMap = (p: { x: number; z: number }) => ({
  x: frame.value.x0 + p.x * frame.value.scale,
  y: frame.value.z0 + p.z * frame.value.scale,
});

function draw() {
  const context = canvas.value?.getContext('2d');
  if (!context) return;
  const ratio = Math.min(pixelRatio.value || 1, 2);
  canvas.value!.width = SIZE.width * ratio;
  canvas.value!.height = SIZE.height * ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, SIZE.width, SIZE.height);
  if (store.samples.length > 1) {
    context.beginPath();
    store.samples.forEach((sample, i) => {
      const p = toMap(sample);
      if (i) context.lineTo(p.x, p.y);
      else context.moveTo(p.x, p.y);
    });
    context.strokeStyle = COLORS.road.edge;
    context.lineWidth = 2;
    context.stroke();
  }
  const { width, height } = viewport.projection.size;
  const a = toMap(viewport.projection.toWorld({ x: 0, y: 0 }));
  const b = toMap(viewport.projection.toWorld({ x: width, y: height }));
  context.strokeStyle = COLORS.accent;
  context.lineWidth = 1;
  context.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
}
watch([() => store.samples, () => viewport.projection, canvas, pixelRatio], draw, {
  immediate: true,
});

function onClick(event: MouseEvent) {
  const rect = canvas.value!.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * SIZE.width;
  const y = ((event.clientY - rect.top) / rect.height) * SIZE.height;
  viewport.centerOn({
    x: (x - frame.value.x0) / frame.value.scale,
    z: (y - frame.value.z0) / frame.value.scale,
  });
}

function go(event: Event) {
  const select = event.target as HTMLSelectElement;
  const [kind, index] = select.value.split(':');
  const corner = kind === 'corner' ? store.corners[Number(index)] : undefined;
  const issue = kind === 'issue' ? store.issues.locations[Number(index)] : undefined;
  if (corner) viewport.focusRange(corner);
  if (issue) viewport.focusIssue(issue);
  select.value = '';
}
</script>

<template>
  <div class="navigator">
    <canvas
      id="mini-map"
      ref="canvas"
      :aria-label="t('navigator.map')"
      :title="t('navigator.map')"
      @click="onClick"
    ></canvas>
    <select id="goto" :aria-label="t('navigator.goto')" @change="go">
      <option value="">{{ t('navigator.goto') }}</option>
      <optgroup v-if="store.corners.length" :label="t('navigator.corners')">
        <option v-for="(corner, i) in store.corners" :key="i" :value="`corner:${i}`">
          {{
            t(corner.direction === 'right' ? 'corner.right' : 'corner.left', {
              number: corner.number,
              angle: Math.round(corner.angle),
            })
          }}
        </option>
      </optgroup>
      <optgroup v-if="store.issues.locations.length" :label="t('navigator.issues')">
        <option v-for="(location, i) in store.issues.locations" :key="i" :value="`issue:${i}`">
          {{ formatTrackIssue(location.issue) }}
        </option>
      </optgroup>
    </select>
  </div>
</template>

<style scoped>
.navigator {
  position: absolute;
  top: 56px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 168px;
}
canvas {
  width: 168px;
  height: 112px;
  display: block;
  border: 1px solid #3c4942;
  border-radius: var(--radius);
  background: #17211fef;
  cursor: pointer;
}
select {
  width: 100%;
  background: #17211fef;
  border: 1px solid #3c4942;
  border-radius: var(--radius);
  color: var(--text);
  padding: 5px 6px;
  font-size: 11px;
}
@media (max-width: 860px) {
  .navigator {
    display: none;
  }
}
</style>
