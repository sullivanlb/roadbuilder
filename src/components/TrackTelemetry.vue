<script setup lang="ts">
import { useEditor, number } from '../composables/useEditor';

const e = useEditor();
</script>
<template>
  <div class="telemetry">
    <div class="metric">
      <span>LONGUEUR TOTALE</span
      ><strong id="stat-length">{{ number(e.stats.length / 1000, 2) }} <small>km</small></strong>
    </div>
    <div class="metric">
      <span>DÉNIVELÉ POSITIF</span
      ><strong id="stat-climb">{{ number(e.stats.climb) }} <small>m</small></strong>
    </div>
    <div class="metric">
      <span>PENTE MAX.</span
      ><strong id="stat-grade">{{ number(e.stats.grade, 1) }} <small>%</small></strong>
    </div>
    <div class="metric metric-status">
      <span>SESSION CIBLE</span><strong><i></i>Essais libres <small>SOLO</small></strong>
    </div>
  </div>
</template>
