<script setup lang="ts">
import { computed } from 'vue';
import { trackLength } from '../../core/track/centerline';
import { pointDistance } from '../../core/track/positions';
import { rangeContains } from '../../core/track/ranges';
import { formatNumber, t } from '../../i18n';
import { useEditorStore } from '../../stores/editor';
import { useProjectStore } from '../../stores/project';
import AppButton from '../ui/AppButton.vue';

/** What can be laid on the stretch picked in the band, on the active layer. */
const store = useProjectStore();
const editor = useEditorStore();

const range = computed(() => editor.range!);
const total = computed(() => trackLength(store.samples));
const end = computed(() => (range.value.start + range.value.length) % (total.value || 1));
const pointCount = computed(
  () =>
    store.project.points.filter((_, i) =>
      rangeContains(range.value, total.value, pointDistance(store.samples, i)),
    ).length,
);
const barrierName = computed(() => t(`barriers.${editor.barrierType}`));
</script>

<template>
  <section id="range-inspector" class="range">
    <h2>{{ t('range.title', { length: formatNumber(range.length) }) }}</h2>
    <p class="where">
      {{ t('range.where', { from: formatNumber(range.start), to: formatNumber(end) }) }}
    </p>
    <div class="actions">
      <AppButton
        v-if="editor.layer === 'track'"
        id="range-select-points"
        variant="primary"
        small
        :disabled="!pointCount"
        @click="editor.selectPointsInRange()"
        >{{ t('range.selectPoints', { count: pointCount }, pointCount) }}</AppButton
      >
      <AppButton
        v-else-if="editor.layer === 'road'"
        id="range-width-zone"
        variant="primary"
        small
        @click="editor.widthZoneOnRange()"
        >{{ t('range.widthZone') }}</AppButton
      >
      <template v-else-if="editor.layer === 'edges'">
        <AppButton
          id="range-barrier-left"
          variant="primary"
          small
          @click="editor.barriersOnRange(['left'])"
          >{{ t('range.barrierLeft', { type: barrierName }) }}</AppButton
        >
        <AppButton
          id="range-barrier-right"
          variant="primary"
          small
          @click="editor.barriersOnRange(['right'])"
          >{{ t('range.barrierRight', { type: barrierName }) }}</AppButton
        >
        <AppButton
          id="range-barrier-both"
          small
          @click="editor.barriersOnRange(['left', 'right'])"
          >{{ t('range.barrierBoth') }}</AppButton
        >
      </template>
      <AppButton
        v-else-if="editor.layer === 'pits'"
        id="range-pit-lane"
        variant="primary"
        small
        @click="editor.pitLaneOnRange()"
        >{{ t('range.pitLane') }}</AppButton
      >
      <p v-else class="note">{{ t('range.planned') }}</p>
      <AppButton id="range-cancel" small @click="editor.setRange(null)">{{
        t('range.cancel')
      }}</AppButton>
    </div>
    <p class="note">{{ t('range.note') }}</p>
  </section>
</template>

<style scoped>
.range {
  margin-top: 16px;
  padding: 14px;
  border: 1px solid var(--accent);
  border-radius: 8px;
  background: #1f2a22;
}
h2 {
  font-size: 13px;
  font-weight: 600;
}
.where {
  margin-top: 3px;
  font-size: 11px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}
.note {
  margin-top: 10px;
  font-size: 11px;
  line-height: 1.6;
  color: var(--muted);
}
</style>
