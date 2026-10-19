<script setup lang="ts">
import type { Template } from '../../core/project/templates';
import { t } from '../../i18n';
import type { MessageKey } from '../../i18n';
import { useFilesStore } from '../../stores/files';
import { useUiStore } from '../../stores/ui';
import BaseDialog from '../ui/BaseDialog.vue';

const files = useFilesStore();
const ui = useUiStore();

/** Each template with its thumbnail outline. */
const templates: { id: Template; outline: string; tag: MessageKey }[] = [
  {
    id: 'club',
    outline: 'M30 74h102q43 0 39-35t-40-12l-24 13-20-17q-60-16-66 19t9 32z',
    tag: 'new.closedTag',
  },
  {
    id: 'kart',
    outline: 'M30 75h115q35-3 22-33t-37-16q-9 1-10 25t-23 3q-7-38-40-28T30 75z',
    tag: 'new.closedTag',
  },
  {
    id: 'mountain',
    outline: 'M20 83h110q54-2 28-24L63 55q-45-13-5-26l80-2q36-17-43-17H32',
    tag: 'new.openTag',
  },
  { id: 'blank', outline: 'M100 30v40M80 50h40', tag: 'new.blankTag' },
];
</script>

<template>
  <BaseDialog
    id="new-dialog"
    :open="ui.dialog === 'new'"
    :eyebrow="t('new.eyebrow')"
    :title="t('new.title')"
    @close="ui.closeDialog()"
  >
    <p class="intro">{{ t('new.intro') }}</p>
    <div class="templates">
      <button
        v-for="template in templates"
        :key="template.id"
        type="button"
        class="template"
        :data-template="template.id"
        @click="files.newProject(template.id)"
      >
        <svg viewBox="0 0 200 100">
          <path :d="template.outline" :class="{ blank: template.id === 'blank' }" />
        </svg>
        <strong>{{ t(`new.${template.id}`) }}</strong>
        <span>{{ t(`new.${template.id}Note`) }}</span>
        <small>{{ t(template.tag) }} <b>↗</b></small>
      </button>
    </div>
    <p class="note">{{ t('new.note') }}</p>
  </BaseDialog>
</template>

<style scoped>
.intro {
  color: var(--muted);
  font-size: 12px;
  margin: 13px 0 24px;
}
.templates {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 13px;
}
.template {
  text-align: left;
  padding: 16px;
  border: 1px solid #37453e;
  border-radius: 8px;
  background: #202c27;
}
.template:hover {
  background: #2b392b;
  border-color: #98b968;
}
svg {
  width: 100%;
  height: 89px;
  fill: none;
  stroke: #a5bd8b;
  stroke-width: 4;
  stroke-linejoin: round;
  stroke-linecap: round;
  margin-bottom: 9px;
}
.blank {
  stroke-width: 2;
  stroke-dasharray: 3 5;
}
strong {
  display: block;
  font-weight: 500;
  font-size: 14px;
}
.template > span {
  display: block;
  font-size: 10px;
  color: #99ab9c;
  margin-top: 5px;
}
small {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18px;
  font-size: 8px;
  letter-spacing: 1px;
  color: #b4cb91;
}
b {
  font-size: 17px;
  font-weight: 400;
}
.note {
  color: #91a19c;
  font-size: 11px;
  line-height: 1.8;
  margin-top: 20px;
}
@media (max-width: 650px) {
  .templates {
    gap: 10px;
  }
  .template {
    padding: 12px;
  }
  svg {
    height: 60px;
  }
  strong {
    font-size: 12px;
  }
  .template > span {
    font-size: 9px;
  }
  small {
    font-size: 7px;
    letter-spacing: 0.5px;
  }
}
</style>
