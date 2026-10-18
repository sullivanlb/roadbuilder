<script setup lang="ts">
import { useEditor } from '../../composables/useEditor';
import { formatNumber, t } from '../../i18n';
import { computed } from 'vue';
import NumericInput from '../ui/NumericInput.vue';
import type { Barrier, BarrierType } from '../../domain/types';

const e = useEditor();
const swatches: Record<BarrierType, string> = {
  guardrail: '#c8d3d7',
  tires: '#98a2a9',
  tecpro: '#d0664a',
  wall: '#e7e6da',
};
const typeLabel = (type: BarrierType) => t(`barriers.${type}`);
const typeNoteOf = (type: BarrierType) => t(`barriers.${type}Note`);
// The project is a shallowRef refreshed through triggerRef: return a fresh array so
// the template re-renders after every edit, even when the stored array itself is unchanged.
const barriers = computed(() => [...(e.project.barriers ?? [])]);
const selectedBarrier = computed(() => barriers.value[e.selectedBarrier] ?? null);
const activeType = computed(() => selectedBarrier.value?.type ?? e.barrierType);
const typeNote = computed(
  () =>
    (selectedBarrier.value ? t('barriers.selectedNote') : t('barriers.nextNote')) +
    typeNoteOf(activeType.value),
);
const barrierSummary = computed(() => {
  const counts = new Map<BarrierType, number>();
  for (const barrier of barriers.value)
    counts.set(barrier.type, (counts.get(barrier.type) ?? 0) + 1);
  return [...counts].map(([type, count]) => `${count} × ${typeLabel(type)}`).join(' · ');
});
const barrierStatus = computed(() => {
  const draft = e.barrierDraft;
  if (draft)
    return t('barriers.statusDraft', {
      point: String(draft.from + 1).padStart(2, '0'),
      side: draft.side === 'right' ? t('barriers.sideRightShort') : t('barriers.sideLeftShort'),
    });
  if (e.tool === 'barrier') return t('barriers.statusTool');
  if (selectedBarrier.value) return t('barriers.statusSelected');
  return barriers.value.length ? t('barriers.statusChoose') : t('barriers.statusEmpty');
});
const rowLabel = (barrier: Barrier, index: number) =>
  t('barriers.row', {
    index: String(index + 1).padStart(2, '0'),
    type: typeLabel(barrier.type),
    side: barrier.side === 'right' ? t('barriers.sideRight') : t('barriers.sideLeft'),
    from: barrier.from + 1,
    to: barrier.to + 1,
  });
</script>
<template>
  <section class="panel-section barrier-section">
    <h2>
      <span class="section-index">04</span> {{ t('barriers.title') }}
      <span v-if="barriers.length" id="barrier-count" class="point-badge">{{
        barriers.length > 1
          ? t('barriers.countMany', { count: String(barriers.length).padStart(2, '0') })
          : t('barriers.countOne', { count: String(barriers.length).padStart(2, '0') })
      }}</span>
    </h2>
    <div class="segmented" :aria-label="t('barriers.typeAria')">
      <button
        id="barrier-type-guardrail"
        :aria-pressed="activeType === 'guardrail'"
        @click="e.setBarrierType('guardrail')"
      >
        {{ t('barriers.guardrail') }}
      </button>
      <button
        id="barrier-type-tires"
        :aria-pressed="activeType === 'tires'"
        @click="e.setBarrierType('tires')"
      >
        {{ t('barriers.tires') }}
      </button>
      <button
        id="barrier-type-tecpro"
        :aria-pressed="activeType === 'tecpro'"
        @click="e.setBarrierType('tecpro')"
      >
        {{ t('barriers.tecpro') }}
      </button>
      <button
        id="barrier-type-wall"
        :aria-pressed="activeType === 'wall'"
        @click="e.setBarrierType('wall')"
      >
        {{ t('barriers.wall') }}
      </button>
    </div>
    <p id="barrier-type-note" class="field-note">{{ typeNote }}</p>
    <button
      id="barrier-draw"
      class="button secondary small barrier-draw"
      :class="{ active: e.tool === 'barrier' }"
      @click="e.setTool('barrier')"
    >
      <svg class="icon"><use href="#i-wall" /></svg>{{ t('barriers.draw') }} <kbd>B</kbd>
    </button>
    <p id="barrier-status" class="field-note">{{ barrierStatus }}</p>
    <div v-if="barriers.length" id="barrier-frame" class="barrier-frame">
      <button
        v-for="(barrier, index) in barriers"
        :id="`barrier-row-${index}`"
        :key="index"
        class="barrier-row"
        :class="{ active: index === e.selectedBarrier }"
        :title="rowLabel(barrier, index)"
        @click="e.selectBarrier(index)"
      >
        <span class="barrier-swatch" :style="{ background: swatches[barrier.type] }"></span
        >{{ rowLabel(barrier, index) }}
      </button>
    </div>
    <div v-if="selectedBarrier" id="barrier-editor" class="barrier-editor">
      <label class="range-label" for="barrier-offset"
        >{{ t('barriers.offset') }}
        <output id="barrier-offset-value"
          >{{ formatNumber(selectedBarrier.offset, 1) }} m</output
        ></label
      >
      <NumericInput
        id="barrier-offset"
        type="range"
        :min="0"
        :max="10"
        :step="0.5"
        field="barrierOffset"
        :value="selectedBarrier.offset"
      />
      <div class="range-ticks">
        <span>{{ t('barriers.offsetMin') }}</span
        ><span>10 m</span>
      </div>
      <div class="barrier-actions">
        <button id="barrier-swap" class="button quiet small" @click="e.swapBarrierSide()">
          <svg class="icon"><use href="#i-move" /></svg>{{ t('barriers.swap') }}
        </button>
        <button
          id="barrier-delete"
          class="button quiet small delete-point"
          @click="e.deleteBarrier()"
        >
          <svg class="icon"><use href="#i-trash" /></svg>{{ t('barriers.delete') }}
        </button>
      </div>
    </div>
    <p v-else-if="barriers.length" id="barrier-summary" class="field-note">
      {{ barrierSummary }}
    </p>
    <p v-else id="barrier-empty" class="field-note">
      {{ t('barriers.empty') }}
    </p>
  </section>
</template>
