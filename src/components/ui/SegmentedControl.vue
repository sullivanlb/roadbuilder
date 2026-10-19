<script setup lang="ts" generic="T extends string">
import AppIcon from './AppIcon.vue';
import type { IconName } from './icons';

export interface SegmentOption<V extends string> {
  value: V;
  label: string;
  icon?: IconName;
  id?: string;
}

defineProps<{ options: readonly SegmentOption<T>[]; label: string; compact?: boolean }>();
const model = defineModel<T>({ required: true });
</script>

<template>
  <div class="segmented" :class="{ compact }" role="group" :aria-label="label">
    <button
      v-for="option in options"
      :id="option.id"
      :key="option.value"
      type="button"
      :aria-pressed="model === option.value"
      @click="model = option.value"
    >
      <AppIcon v-if="option.icon" :name="option.icon" />{{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.segmented {
  display: flex;
  background: var(--sunken);
  padding: 4px;
  border-radius: var(--radius);
  gap: 3px;
  --icon-size: 14px;
}
button {
  flex: 1;
  padding: 9px 2px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 10px;
  color: var(--muted);
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}
button[aria-pressed='true'] {
  background: var(--pressed);
  color: var(--accent);
  border-color: #3b4946;
}
.compact button {
  font-size: 9px;
  padding: 8px 2px;
}
@media (max-width: 950px) {
  button {
    font-size: 9px;
  }
}
</style>
