<script setup lang="ts">
import { formatNumber, t } from '../../i18n';
import { useProjectStore } from '../../stores/project';

const store = useProjectStore();
</script>

<template>
  <div class="telemetry">
    <div class="metric">
      <span>{{ t('telemetry.length') }}</span
      ><strong id="stat-length"
        >{{ formatNumber(store.stats.length / 1000, 2) }} <small>km</small></strong
      >
    </div>
    <div class="metric">
      <span>{{ t('telemetry.climb') }}</span
      ><strong id="stat-climb">{{ formatNumber(store.stats.climb) }} <small>m</small></strong>
    </div>
    <div class="metric">
      <span>{{ t('telemetry.grade') }}</span
      ><strong id="stat-grade">{{ formatNumber(store.stats.grade, 1) }} <small>%</small></strong>
    </div>
    <div class="metric session">
      <span>{{ t('telemetry.session') }}</span
      ><strong><i></i>{{ t('telemetry.freePractice') }} <small>SOLO</small></strong>
    </div>
  </div>
</template>

<style scoped>
.telemetry {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1.1fr;
  padding: 23px 30px 20px;
  gap: 20px;
}
.metric {
  border-right: 1px solid var(--line);
}
.metric:last-child {
  border: 0;
}
.metric > span {
  display: block;
  font-size: 8px;
  color: #819193;
  letter-spacing: 1.3px;
  margin-bottom: 8px;
}
.metric > strong {
  font-family: var(--mono);
  font-size: 25px;
  font-weight: 400;
  letter-spacing: -0.8px;
}
.metric strong small {
  font-family: 'Segoe UI', sans-serif;
  font-size: 11px;
  color: var(--muted);
  margin-left: 4px;
  letter-spacing: 0;
}
.session strong {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-family: inherit;
  padding-top: 6px;
  letter-spacing: 0;
}
.session strong i {
  width: 6px;
  height: 6px;
  border-radius: 100%;
  background: var(--accent);
}
.session strong small {
  font-size: 8px;
  padding: 3px 5px;
  border-radius: 3px;
  border: 1px solid #3b4636;
  color: #acbd8a;
  margin-left: 3px;
}
@media (min-width: 1500px) {
  .telemetry {
    padding-left: 38px;
    padding-right: 38px;
  }
}
@media (max-width: 1200px) {
  .telemetry {
    gap: 12px;
  }
  .session strong small {
    display: none;
  }
}
@media (max-width: 950px) {
  .telemetry {
    padding: 18px 21px;
    grid-template-columns: repeat(3, 1fr);
  }
  .metric:nth-child(3) {
    border: 0;
  }
  .session {
    display: none;
  }
  .metric > span {
    font-size: 7px;
    letter-spacing: 0.7px;
  }
  .metric > strong {
    font-size: 22px;
  }
}
@media (max-width: 650px) {
  .telemetry {
    padding: 17px 18px;
  }
}
</style>
