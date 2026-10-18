<script setup lang="ts">
import { useEditor } from '../composables/useEditor';
import { formatNumber, t } from '../i18n';

const e = useEditor();
</script>
<template>
  <div class="telemetry">
    <div class="metric">
      <span>{{ t('telemetry.length') }}</span
      ><strong id="stat-length"
        >{{ formatNumber(e.stats.length / 1000, 2) }} <small>km</small></strong
      >
    </div>
    <div class="metric">
      <span>{{ t('telemetry.climb') }}</span
      ><strong id="stat-climb">{{ formatNumber(e.stats.climb) }} <small>m</small></strong>
    </div>
    <div class="metric">
      <span>{{ t('telemetry.grade') }}</span
      ><strong id="stat-grade">{{ formatNumber(e.stats.grade, 1) }} <small>%</small></strong>
    </div>
    <div class="metric metric-status">
      <span>{{ t('telemetry.session') }}</span
      ><strong><i></i>{{ t('telemetry.freePractice') }} <small>SOLO</small></strong>
    </div>
  </div>
</template>
