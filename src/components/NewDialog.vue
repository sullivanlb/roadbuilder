<script setup lang="ts">
import { useEditor } from '../composables/useEditor';
import { useModalDialog } from '../composables/useModalDialog';
import { t } from '../i18n';

const props = defineProps<{ open: boolean }>();
const e = useEditor();
const dialog = useModalDialog(() => props.open);
</script>
<template>
  <dialog
    id="new-dialog"
    ref="dialog"
    aria-labelledby="new-title"
    @cancel.prevent="e.openDialog(null)"
  >
    <div class="dialog-heading">
      <div>
        <span class="eyebrow">{{ t('new.eyebrow') }}</span>
        <h2 id="new-title">{{ t('new.title') }}</h2>
      </div>
      <button
        class="tool"
        data-close="new-dialog"
        :aria-label="t('dialog.close')"
        @click="e.openDialog(null)"
      >
        <svg class="icon"><use href="#i-close" /></svg>
      </button>
    </div>
    <p class="dialog-intro">{{ t('new.intro') }}</p>
    <div class="templates">
      <button class="template" data-template="club" @click="e.newProject('club')">
        <svg viewBox="0 0 200 100">
          <path d="M30 74h102q43 0 39-35t-40-12l-24 13-20-17q-60-16-66 19t9 32z" /></svg
        ><strong>{{ t('new.club') }}</strong
        ><span>{{ t('new.clubNote') }}</span
        ><small>{{ t('new.closedTag') }} <b>↗</b></small>
      </button>
      <button class="template" data-template="kart" @click="e.newProject('kart')">
        <svg viewBox="0 0 200 100">
          <path d="M30 75h115q35-3 22-33t-37-16q-9 1-10 25t-23 3q-7-38-40-28T30 75z" /></svg
        ><strong>{{ t('new.kart') }}</strong
        ><span>{{ t('new.kartNote') }}</span
        ><small>{{ t('new.closedTag') }} <b>↗</b></small>
      </button>
      <button class="template" data-template="mountain" @click="e.newProject('mountain')">
        <svg viewBox="0 0 200 100">
          <path d="M20 83h110q54-2 28-24L63 55q-45-13-5-26l80-2q36-17-43-17H32" /></svg
        ><strong>{{ t('new.mountain') }}</strong
        ><span>{{ t('new.mountainNote') }}</span
        ><small>{{ t('new.openTag') }} <b>↗</b></small>
      </button>
      <button class="template" data-template="blank" @click="e.newProject('blank')">
        <svg viewBox="0 0 200 100"><path d="M100 30v40M80 50h40" class="blank-template" /></svg
        ><strong>{{ t('new.blank') }}</strong
        ><span>{{ t('new.blankNote') }}</span
        ><small>{{ t('new.blankTag') }} <b>↗</b></small>
      </button>
    </div>
    <p class="dialog-note">{{ t('new.note') }}</p>
  </dialog>
</template>
