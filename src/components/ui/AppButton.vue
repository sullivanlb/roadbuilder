<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'primary' | 'secondary' | 'quiet'; small?: boolean }>(), {
  variant: 'quiet',
});
</script>

<template>
  <button type="button" class="button" :class="[variant, { small }]"><slot /></button>
</template>

<style scoped>
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 15px;
  min-height: 40px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: var(--radius);
  font-weight: 550;
  font-size: 12px;
  white-space: nowrap;
}
.primary {
  background: var(--accent);
  color: var(--accent-text);
  border-color: var(--accent);
}
.primary:hover:not(:disabled) {
  background: var(--accent-hover);
}
.secondary {
  border-color: #3b484b;
  background: #232c30;
}
.quiet {
  color: #b7c2c1;
}
.secondary:hover,
.quiet:hover {
  background: var(--hover);
}
.small {
  padding: 5px 10px;
  min-height: 28px;
  font-size: 10px;
  --icon-size: 13px;
}
</style>
