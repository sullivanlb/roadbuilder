<script setup lang="ts">
import { computed } from 'vue';
import { RULES } from '../../core/project/rules';
import { formatNumber, formatTrackIssue, t } from '../../i18n';
import { useExportStore } from '../../stores/export';
import { useProjectStore } from '../../stores/project';
import { useUiStore } from '../../stores/ui';
import { useViewportStore } from '../../stores/viewport';
import AppButton from '../ui/AppButton.vue';
import AppIcon from '../ui/AppIcon.vue';
import BaseDialog from '../ui/BaseDialog.vue';

const store = useProjectStore();
const exporter = useExportStore();
const viewport = useViewportStore();
const ui = useUiStore();

const errors = computed(() =>
  store.issues.errors.map((issue) => ({
    text: formatTrackIssue(issue),
    segment: store.issues.tightTurns.find((turn) => turn.issue === issue)?.segment,
  })),
);
const summary = computed(() =>
  t('export.summary', {
    length: formatNumber(store.stats.length / 1000, 2),
    mode: store.project.road.closed ? t('sidebar.closed') : t('sidebar.open'),
  }),
);
</script>

<template>
  <BaseDialog
    id="export-dialog"
    :open="ui.dialog === 'export'"
    :eyebrow="t('export.eyebrow')"
    :title="t('export.title')"
    @close="ui.closeDialog()"
  >
    <label class="field-label" for="export-author"
      >{{ t('export.author') }} <span>{{ t('export.authorOptional') }}</span></label
    ><input
      id="export-author"
      v-model="exporter.author"
      class="text-input"
      :maxlength="RULES.author.max"
      :placeholder="t('export.authorPlaceholder')"
    />
    <fieldset class="formats">
      <legend>{{ t('export.formatLegend') }}</legend>
      <label
        ><input v-model="exporter.format" type="radio" name="export-format" value="assetto" /><span
          ><strong
            >{{ t('export.ac') }} <small>{{ t('export.acTag') }}</small></strong
          ><span>{{ t('export.acNote') }}</span></span
        ></label
      ><label
        ><input v-model="exporter.format" type="radio" name="export-format" value="obj" /><span
          ><strong>{{ t('export.obj') }}</strong
          ><span>{{ t('export.objNote') }}</span></span
        ></label
      >
    </fieldset>
    <div id="export-issues" class="issues">
      <p v-for="(error, index) in errors" :key="index" class="error">
        {{ error.text }}
        <AppButton
          v-if="error.segment !== undefined"
          class="locate"
          variant="secondary"
          small
          :data-tight-turn="error.segment"
          @click="viewport.focusTightTurn(error.segment)"
        >
          {{ t('editor.locateTurn') }}
        </AppButton>
      </p>
      <p v-for="(warning, index) in store.issues.warnings" :key="index" class="warning">
        {{ formatTrackIssue(warning) }}
      </p>
    </div>
    <div class="notice">
      <AppIcon name="help" />
      <p>
        <strong>{{ t('export.noticeLead') }}</strong
        >{{
          store.project.barriers.length
            ? t('export.noticeWithBarriers')
            : t('export.noticeNoBarriers')
        }}
      </p>
    </div>
    <div class="install">
      <span>01</span>
      <p>
        {{ t('export.installBefore') }} <code>assettocorsa/content/tracks/</code
        >{{ t('export.installAfter') }}
      </p>
    </div>
    <template #footer>
      <span id="export-summary" class="summary">{{ summary }}</span>
      <AppButton
        id="download-export"
        variant="primary"
        :disabled="exporter.exporting || store.issues.errors.length > 0"
        @click="exporter.run()"
      >
        <AppIcon name="export" />{{
          exporter.exporting ? t('export.building') : t('export.download')
        }}
      </AppButton>
    </template>
  </BaseDialog>
</template>

<style scoped>
.field-label {
  display: flex;
  gap: 8px;
  font-size: 11px;
  margin: 25px 0 9px;
}
.field-label > span {
  color: var(--faint);
}
.text-input {
  width: 100%;
  padding: 11px 12px;
  background: #111b1e;
  border: 1px solid #394a48;
  border-radius: 5px;
  font-size: 12px;
  color: var(--text);
}
.formats {
  padding: 0;
  border: 0;
  margin: 22px 0 18px;
}
legend {
  font-size: 11px;
  margin-bottom: 10px;
}
.formats > label {
  padding: 15px;
  margin: 9px 0;
  border: 1px solid #3b4a41;
  border-radius: 7px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}
.formats > label:has(input:checked) {
  border-color: #879e61;
  background: #252f25;
}
.formats input {
  accent-color: var(--accent);
}
.formats strong {
  display: block;
  font-size: 13px;
  font-weight: 500;
}
.formats strong small {
  font-family: monospace;
  font-size: 8px;
  font-weight: 400;
  color: #c5d4a3;
  border: 1px solid #6a7752;
  border-radius: 3px;
  padding: 3px 5px;
  margin-left: 7px;
}
.formats label > span > span {
  display: block;
  color: #97a69d;
  font-size: 11px;
  margin-top: 7px;
  line-height: 1.6;
}
.issues p {
  font-size: 11px;
  padding: 10px 12px;
  border-radius: 5px;
  background: var(--danger-bg);
  color: var(--danger-text);
  margin-bottom: 10px;
  line-height: 1.6;
}
.issues p.warning {
  background: var(--warning-bg);
  color: var(--warning-text);
}
.locate {
  display: flex;
  margin-top: 8px;
}
.notice {
  display: flex;
  gap: 12px;
  background: #302f25;
  border: 1px solid #514c34;
  padding: 15px;
  border-radius: 7px;
  color: #cfc28d;
}
.notice p {
  font-size: 11px;
  line-height: 1.8;
  color: #b9b297;
}
.notice strong {
  display: block;
  font-weight: 500;
  color: #ddd3ac;
  margin-bottom: 3px;
}
.install {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 19px;
}
.install > span {
  font-family: monospace;
  color: #a2b18a;
  border: 1px solid #3b4937;
  border-radius: 50%;
  font-size: 9px;
  padding: 8px;
}
.install p {
  font-size: 11px;
  color: #99a9a0;
  line-height: 1.8;
}
code {
  color: #c8d6bc;
  font-size: 10px;
}
.summary {
  font-size: 11px;
  color: #a2b09b;
}
@media (max-width: 650px) {
  .formats strong small {
    font-size: 6px;
  }
  #download-export {
    margin-left: auto;
  }
}
</style>
