<script setup lang="ts">
import { computed } from 'vue';
import { useEditor } from '../composables/useEditor';
import { useModalDialog } from '../composables/useModalDialog';
import { formatNumber, formatTrackIssue, t } from '../i18n';

const props = defineProps<{ open: boolean }>();
const e = useEditor();
const dialog = useModalDialog(() => props.open);
const errors = computed(() =>
  e.issues.errors.map((issue) => ({
    text: formatTrackIssue(issue),
    segment: e.issues.tightTurns.find((turn) => turn.issue === issue)?.segment,
  })),
);
const summary = computed(() =>
  t('export.summary', {
    length: formatNumber(e.stats.length / 1000, 2),
    mode: e.project.closed ? t('sidebar.closed') : t('sidebar.open'),
  }),
);
</script>
<template>
  <dialog
    id="export-dialog"
    ref="dialog"
    aria-labelledby="export-title"
    @cancel.prevent="e.openDialog(null)"
  >
    <div class="dialog-heading">
      <div>
        <span class="eyebrow">{{ t('export.eyebrow') }}</span>
        <h2 id="export-title">{{ t('export.title') }}</h2>
      </div>
      <button
        class="tool"
        data-close="export-dialog"
        :aria-label="t('dialog.close')"
        @click="e.openDialog(null)"
      >
        <svg class="icon"><use href="#i-close" /></svg>
      </button>
    </div>
    <label class="field-label" for="export-author"
      >{{ t('export.author') }} <span>{{ t('export.authorOptional') }}</span></label
    ><input
      id="export-author"
      v-model="e.exportAuthor"
      class="text-input"
      maxlength="80"
      :placeholder="t('export.authorPlaceholder')"
    />
    <fieldset class="export-formats">
      <legend>{{ t('export.formatLegend') }}</legend>
      <label
        ><input v-model="e.exportFormat" type="radio" name="export-format" value="ac" /><span
          ><strong
            >{{ t('export.ac') }} <small>{{ t('export.acTag') }}</small></strong
          ><span>{{ t('export.acNote') }}</span></span
        ></label
      ><label
        ><input v-model="e.exportFormat" type="radio" name="export-format" value="obj" /><span
          ><strong>{{ t('export.obj') }}</strong
          ><span>{{ t('export.objNote') }}</span></span
        ></label
      >
    </fieldset>
    <div id="export-issues" class="export-issues">
      <p v-for="(error, index) in errors" :key="index" class="error">
        {{ error.text }}
        <button
          v-if="error.segment !== undefined"
          class="button secondary small locate-turn"
          :data-tight-turn="error.segment"
          @click="e.focusTightTurn(error.segment)"
        >
          {{ t('editor.locateTurn') }}
        </button>
      </p>
      <p v-for="(warning, index) in e.issues.warnings" :key="index" class="warning">
        {{ formatTrackIssue(warning) }}
      </p>
    </div>
    <div class="export-notice">
      <svg class="icon"><use href="#i-help" /></svg>
      <p v-if="e.project.barriers?.length">
        <strong>{{ t('export.noticeLead') }}</strong
        >{{ t('export.noticeWithBarriers') }}
      </p>
      <p v-else>
        <strong>{{ t('export.noticeLead') }}</strong
        >{{ t('export.noticeNoBarriers') }}
      </p>
    </div>
    <div class="export-install">
      <span>01</span>
      <p>
        {{ t('export.installBefore') }} <code>assettocorsa/content/tracks/</code
        >{{ t('export.installAfter') }}
      </p>
    </div>
    <div class="dialog-footer">
      <span id="export-summary">{{ summary }}</span
      ><button
        id="download-export"
        :disabled="e.exporting || e.issues.errors.length > 0"
        class="button primary"
        @click="e.exportProject"
      >
        <svg class="icon"><use href="#i-export" /></svg
        >{{ e.exporting ? t('export.building') : t('export.download') }}
      </button>
    </div>
  </dialog>
</template>
