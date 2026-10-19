<script setup lang="ts">
import { ref, watch } from 'vue';
import type { NumericRule } from '../../core/project/rules';

/**
 * A numeric field that keeps what the user types while editing (an empty or
 * partial value) and only reports valid numbers. `input` fires while editing;
 * `commit` fires once the edit is done, to close the undo step.
 */
const props = defineProps<{
  value: number;
  rule: NumericRule;
  type?: 'number' | 'range';
  precision?: number;
}>();
const emit = defineEmits<{ input: [value: number]; commit: [] }>();

const shown = () =>
  String(
    props.precision === undefined ? props.value : Number(props.value.toFixed(props.precision)),
  );
const editing = ref(false);
const draft = ref(shown());
watch(
  () => props.value,
  () => {
    if (!editing.value) draft.value = shown();
  },
);

function onInput(event: Event) {
  editing.value = true;
  const target = event.target as HTMLInputElement;
  draft.value = target.value;
  if (target.value.trim() && Number.isFinite(target.valueAsNumber))
    emit('input', target.valueAsNumber);
}

function finish() {
  if (!editing.value) return;
  editing.value = false;
  draft.value = shown();
  emit('commit');
}
</script>

<template>
  <input
    :type="type ?? 'number'"
    :value="draft"
    :min="rule.min"
    :max="rule.max"
    :step="rule.step"
    @input="onInput"
    @change="finish"
    @blur="finish"
  />
</template>
