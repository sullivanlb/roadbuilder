<script setup lang="ts">
import { computed } from 'vue';
import type { NumericRule } from '../../core/project/rules';
import { formatNumber } from '../../i18n';
import NumberInput from './NumberInput.vue';

/** A labelled slider showing its value and its bounds, in metres. */
const props = defineProps<{
  id: string;
  label: string;
  value: number;
  rule: NumericRule;
  minLabel?: string;
  /** Unit shown after the value; metres by default. */
  unit?: string;
}>();
defineEmits<{ input: [value: number]; commit: [] }>();

const metres = (value: number) => `${formatNumber(value, value % 1 ? 1 : 0)} ${props.unit ?? 'm'}`;
const fill = computed(
  () => ((props.value - props.rule.min) / (props.rule.max - props.rule.min)) * 100,
);
</script>

<template>
  <div>
    <label class="range-label" :for="id">
      {{ label }} <output :id="`${id}-value`">{{ metres(value) }}</output>
    </label>
    <NumberInput
      :id="id"
      type="range"
      :value="value"
      :rule="rule"
      :style="{ '--fill': `${fill}%` }"
      @input="$emit('input', $event)"
      @commit="$emit('commit')"
    />
    <div class="range-ticks">
      <span>{{ minLabel ?? metres(rule.min) }}</span
      ><span>{{ metres(rule.max) }}</span>
    </div>
  </div>
</template>

<style scoped>
.range-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  margin-bottom: 14px;
}
output {
  font-family: var(--mono);
  color: var(--text);
  font-size: 13px;
}
.range-ticks {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: var(--faint);
  margin: 7px 0 23px;
  font-family: monospace;
}
input {
  display: block;
  appearance: none;
  width: 100%;
  height: 4px;
  background: linear-gradient(to right, #b9d878 var(--fill), #3a4644 var(--fill));
  border-radius: 4px;
  accent-color: var(--accent);
  cursor: pointer;
  margin: 4px 0;
}
input::-webkit-slider-thumb {
  appearance: none;
  width: 12px;
  height: 12px;
  background: var(--accent);
  border: 3px solid var(--panel);
  box-shadow: 0 0 0 1px var(--accent);
  border-radius: 50%;
}
input::-moz-range-thumb {
  width: 7px;
  height: 7px;
  background: var(--accent);
  border: 3px solid var(--panel);
  box-shadow: 0 0 0 1px var(--accent);
  border-radius: 50%;
}
</style>
