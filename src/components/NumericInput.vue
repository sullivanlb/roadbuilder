<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useEditor } from '../composables/useEditor';
import type { NumericField } from '../composables/useEditor';
const props = withDefaults(
  defineProps<{
    field: NumericField;
    value: number;
    min: number;
    max: number;
    step?: number;
    type?: 'number' | 'range';
  }>(),
  { step: 1, type: 'number' },
);
const e = useEditor();
const editing = ref(false);
const draft = ref(String(props.value));
watch(
  () => props.value,
  (value) => {
    if (!editing.value) draft.value = String(value);
  },
);
const style = computed(() => {
  if (props.type !== 'range') return undefined;
  const percent = ((props.value - props.min) / (props.max - props.min)) * 100;
  return { background: `linear-gradient(to right, #b9d878 ${percent}%, #3a4644 ${percent}%)` };
});
function begin() {
  editing.value = true;
  e.beginEdit();
}
function input(event: Event) {
  begin();
  const target = event.target as HTMLInputElement;
  draft.value = target.value;
  if (target.value.trim()) e.setNumeric(props.field, target.valueAsNumber);
}
function finish() {
  editing.value = false;
  draft.value = String(props.value);
  e.flushEdit();
}
</script>
<template>
  <input
    :type="type"
    :value="draft"
    :min="min"
    :max="max"
    :step="step"
    :style="style"
    @focus="begin"
    @pointerdown="begin"
    @input="input"
    @change="finish"
    @blur="finish"
  />
</template>
