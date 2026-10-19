<script setup lang="ts">
import { ICONS } from './icons';
import type { IconName } from './icons';

defineProps<{ name: IconName }>();
</script>

<template>
  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="ICONS[name]" /></svg>
</template>

<style scoped>
.icon {
  width: var(--icon-size, 19px);
  height: var(--icon-size, 19px);
  stroke: currentColor;
  stroke-width: 1.65;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  flex-shrink: 0;
}
</style>
