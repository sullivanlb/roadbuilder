<script setup lang="ts">
import { computed } from 'vue';
import { RULES } from '../../core/project/rules';
import type { TrackPosition } from '../../core/project/schema';
import { t } from '../../i18n';
import { useProjectStore } from '../../stores/project';
import NumberInput from '../ui/NumberInput.vue';

/** Edits a track position as a control point number plus a distance after it. */
const props = defineProps<{ id: string; label: string; position: TrackPosition }>();
const emit = defineEmits<{ input: [position: TrackPosition]; commit: [] }>();
const store = useProjectStore();

const number = computed(() => (store.pointIndex.get(props.position.point) ?? 0) + 1);
const pointRule = computed(() => ({ min: 1, max: store.project.points.length, step: 1 }));

function setPoint(value: number) {
  const point = store.project.points[Math.round(value) - 1];
  if (point) emit('input', { ...props.position, point: point.id });
}
</script>

<template>
  <div class="position">
    <span class="label">{{ label }}</span>
    <label
      >{{ t('position.point') }}
      <NumberInput
        :id="`${id}-point`"
        :value="number"
        :rule="pointRule"
        @input="setPoint"
        @commit="emit('commit')"
    /></label>
    <label
      >+
      <NumberInput
        :id="`${id}-distance`"
        :value="position.distance"
        :rule="RULES.positionDistance"
        :precision="0"
        @input="emit('input', { ...position, distance: $event })"
        @commit="emit('commit')"
      />{{ t('position.distance') }}</label
    >
  </div>
</template>

<style scoped>
.position {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 10px;
  color: var(--faint);
}
.label {
  min-width: 52px;
  color: var(--muted);
  font-size: 11px;
}
label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: monospace;
}
input {
  width: 52px;
  background: var(--field);
  border: 1px solid #303d41;
  color: #b9c4c2;
  border-radius: 4px;
  padding: 5px;
  font-size: 10px;
  font-family: monospace;
}
</style>
