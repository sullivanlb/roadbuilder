<script setup lang="ts">
import { useEditor } from '../composables/useEditor';
import NumericInput from './NumericInput.vue';
import { formatTrackIssue, t } from '../i18n';

const e = useEditor();
</script>
<template>
  <section class="panel-section point-section">
    <h2>
      <span class="section-index">05</span> {{ t('point.title') }}
      <span v-if="e.point" id="point-badge" class="point-badge">{{
        t('point.badge', { index: String(e.selected + 1).padStart(2, '0') })
      }}</span>
    </h2>
    <div v-if="e.point" id="point-editor">
      <div v-if="e.selectedTightTurns.length" id="point-issues" class="point-issues" role="status">
        <p v-for="turn in e.selectedTightTurns" :key="turn.segment">
          {{ formatTrackIssue(turn.issue) }}
        </p>
      </div>
      <div class="range-label">
        <label for="point-altitude">{{ t('point.altitude') }}</label
        ><span class="unit-input"
          ><NumericInput
            id="point-altitude"
            type="number"
            :min="-100"
            :max="1000"
            :step="0.5"
            field="y"
            :value="Number(e.point.y.toFixed(2))"
          /><span>m</span></span
        >
      </div>
      <NumericInput
        id="point-height"
        type="range"
        :min="-100"
        :max="1000"
        :step="0.5"
        :aria-label="t('point.altitudeAria')"
        field="y"
        :value="e.point.y"
      />
      <div class="coordinates">
        <label
          >X
          <NumericInput
            id="point-x"
            type="number"
            :min="-10000"
            :max="10000"
            :step="1"
            field="x"
            :value="Number(e.point.x.toFixed(1))" /></label
        ><label
          >Z
          <NumericInput
            id="point-z"
            type="number"
            :min="-10000"
            :max="10000"
            :step="1"
            field="z"
            :value="Number(e.point.z.toFixed(1))"
        /></label>
      </div>
      <div class="point-actions">
        <button
          id="point-previous"
          :disabled="e.selected <= 0"
          class="button quiet small"
          :aria-label="t('point.previous')"
          @click="e.selectPoint(Math.max(0, e.selected - 1))"
        >
          ←</button
        ><button
          id="point-next"
          :disabled="e.selected >= e.project.points.length - 1"
          class="button quiet small"
          :aria-label="t('point.next')"
          @click="e.selectPoint(Math.min(e.project.points.length - 1, e.selected + 1))"
        >
          →</button
        ><button id="delete-point" class="button quiet small delete-point" @click="e.deletePoint()">
          <svg class="icon"><use href="#i-trash" /></svg>{{ t('point.delete') }}
        </button>
      </div>
    </div>
    <p v-else id="point-empty" class="field-note">
      {{ t('point.empty') }}
    </p>
  </section>
</template>
