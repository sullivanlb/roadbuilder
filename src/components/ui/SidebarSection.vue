<script setup lang="ts">
/** A numbered section of the sidebar, with an optional badge beside its title. */
defineProps<{ index: number; title: string; last?: boolean }>();
</script>

<template>
  <section class="section" :class="{ last }">
    <h2>
      <span class="index">{{ String(index).padStart(2, '0') }}</span> {{ title }}
      <span v-if="$slots.badge" class="badge"><slot name="badge" /></span>
    </h2>
    <slot />
  </section>
</template>

<style scoped>
.section {
  padding: 24px 0;
  border-bottom: 1px solid var(--line);
}
.last {
  border-bottom: 0;
  padding-bottom: 20px;
}
h2 {
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0 0 17px;
}
.index {
  font-family: monospace;
  font-size: 10px;
  color: var(--faint);
  font-weight: 400;
}
.badge {
  font-family: monospace;
  font-size: 8px;
  color: var(--accent);
  background: #2b3726;
  border: 1px solid #3c4932;
  border-radius: 4px;
  padding: 4px 6px;
  margin-left: auto;
  letter-spacing: 0.5px;
}
@media (max-width: 650px) {
  .section {
    padding: 23px 0;
  }
}
</style>
