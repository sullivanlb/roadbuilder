<script setup lang="ts">
import { useEditor } from '../../composables/useEditor';
import { formatNumber, t } from '../../i18n';
import { ref } from 'vue';

const e = useEditor();
const canvas = ref<HTMLCanvasElement | null>(null);
defineEmits<{ select: [event: MouseEvent] }>();
defineExpose({ canvas });
</script>
<template>
  <div class="elevation-panel">
    <div class="elevation-heading">
      <span>{{ t('profile.title') }}</span
      ><span id="elevation-range"
        >{{ formatNumber(e.stats.min) }} → {{ formatNumber(e.stats.max) }} m</span
      >
    </div>
    <canvas
      id="elevation-canvas"
      ref="canvas"
      :aria-label="t('profile.aria')"
      @click="$emit('select', $event)"
    ></canvas>
    <div class="elevation-axis">
      <span>{{ t('profile.start') }}</span
      ><span id="elevation-end"
        >{{ e.project.closed ? t('profile.closedEnd') : t('profile.openEnd') }} ·
        {{ formatNumber(e.stats.length / 1000, 2) }} KM</span
      >
    </div>
  </div>
</template>
