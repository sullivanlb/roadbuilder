<script setup lang="ts">
import { useEditor, number } from '../composables/useEditor';
import { ref } from 'vue';

const e = useEditor();
const canvas = ref<HTMLCanvasElement | null>(null);
defineEmits<{ select: [event: MouseEvent] }>();
defineExpose({ canvas });
</script>
<template>
  <div class="elevation-panel">
    <div class="elevation-heading">
      <span>PROFIL D’ALTITUDE</span
      ><span id="elevation-range">{{ number(e.stats.min) }} → {{ number(e.stats.max) }} m</span>
    </div>
    <canvas
      id="elevation-canvas"
      ref="canvas"
      @click="$emit('select', $event)"
      aria-label="Profil d’altitude du tracé"
    ></canvas>
    <div class="elevation-axis">
      <span>DÉPART</span
      ><span id="elevation-end"
        >{{ e.project.closed ? 'RETOUR AU DÉPART' : 'ARRIVÉE' }} ·
        {{ number(e.stats.length / 1000, 2) }} KM</span
      >
    </div>
  </div>
</template>
