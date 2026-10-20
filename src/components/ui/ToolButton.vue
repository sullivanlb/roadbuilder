<script setup lang="ts">
import AppIcon from './AppIcon.vue';
import type { IconName } from './icons';

/**
 * Square icon button of the canvas toolbars; `active` marks the current tool,
 * `soon` a tool planned but not built yet.
 */
defineProps<{ icon: IconName; label: string; active?: boolean; soon?: boolean }>();
</script>

<template>
  <button type="button" class="tool" :class="{ active, soon }" :aria-label="label" :title="label">
    <AppIcon :name="icon" />
  </button>
</template>

<style scoped>
.tool {
  width: 32px;
  height: 32px;
  padding: 7px;
  border-radius: 4px;
  background: none;
  border: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a1b0a6;
  --icon-size: 17px;
}
.tool:hover {
  background: var(--hover);
}
.soon {
  color: var(--faint);
  outline: 1px dashed var(--line-strong);
  outline-offset: -3px;
}
.active {
  color: var(--accent-text);
  background: var(--accent);
}
.active:hover {
  background: #e3ffa8;
}
</style>
