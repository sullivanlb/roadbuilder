<script setup lang="ts">
import { useUiStore } from '../../stores/ui';

const ui = useUiStore();
</script>

<template>
  <div
    id="toast"
    class="toast"
    role="status"
    aria-live="polite"
    :hidden="!ui.notification"
    :class="{ error: ui.notification?.error }"
  >
    {{ ui.notification?.message }}
  </div>
</template>

<style scoped>
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  border: 1px solid #7a935d;
  background: #273328;
  color: #e2efcf;
  border-radius: 7px;
  padding: 14px 22px;
  font-size: 12px;
  box-shadow: 0 8px 30px #0004;
  max-width: min(560px, 90vw);
  line-height: 1.6;
  white-space: pre-line;
}
.error {
  border-color: #956655;
  background: #392a25;
  color: #f3c4b5;
}
</style>
