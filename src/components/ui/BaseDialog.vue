<script setup lang="ts">
import { onBeforeUnmount, useId, useTemplateRef, watch } from 'vue';
import { t } from '../../i18n';
import ToolButton from './ToolButton.vue';

/** A modal built on the native <dialog>: focus trap, Escape and backdrop come for free. */
const props = defineProps<{ open: boolean; eyebrow: string; title: string }>();
const emit = defineEmits<{ close: [] }>();
const dialog = useTemplateRef<HTMLDialogElement>('dialog');
const titleId = useId();

watch(
  () => props.open,
  (open) => {
    const element = dialog.value;
    if (!element) return;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  },
  { flush: 'post' },
);
onBeforeUnmount(() => dialog.value?.close());
</script>

<template>
  <dialog ref="dialog" :aria-labelledby="titleId" @cancel.prevent="emit('close')">
    <div class="heading">
      <div>
        <span class="eyebrow">{{ eyebrow }}</span>
        <h2 :id="titleId">{{ title }}</h2>
      </div>
      <ToolButton class="close" icon="close" :label="t('dialog.close')" @click="emit('close')" />
    </div>
    <slot />
    <div v-if="$slots.footer" class="footer"><slot name="footer" /></div>
  </dialog>
</template>

<style scoped>
dialog {
  width: min(680px, calc(100vw - 32px));
  max-height: calc(100dvh - 40px);
  padding: 30px;
  border: 1px solid #43534e;
  border-radius: 13px;
  color: var(--text);
  background: #192225;
  box-shadow: 0 30px 100px #0008;
}
dialog::backdrop {
  background: #080f12b8;
  backdrop-filter: blur(5px);
}
.heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}
.eyebrow {
  font-size: 9px;
  letter-spacing: 1.8px;
  font-weight: 650;
  color: var(--muted);
}
h2 {
  font-size: 25px;
  letter-spacing: -0.8px;
  font-weight: 500;
  margin-top: 9px;
}
.close {
  margin: -10px -10px 0 0;
}
.footer {
  margin-top: 25px;
  border-top: 1px solid #344239;
  padding-top: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
}
@media (max-width: 650px) {
  dialog {
    padding: 22px;
  }
  h2 {
    font-size: 21px;
  }
  .footer {
    flex-wrap: wrap;
  }
}
</style>
