<script setup lang="ts">
import { computed } from 'vue';
import { updateEarthwork } from '../../core/project/edits';
import type { EarthworkPatch } from '../../core/project/edits';
import { EARTHWORK_TYPES } from '../../core/project/schema';
import type { Earthwork, EarthworkType } from '../../core/project/schema';
import {
  EARTHWORK_REACH,
  EARTHWORK_RULES,
  EARTHWORK_SETTING_NAMES,
  editableEarthwork,
} from '../../core/project/terrain';
import { t } from '../../i18n';
import type { MessageKey } from '../../i18n';
import { COLORS } from '../../rendering/theme';
import { useEditorStore } from '../../stores/editor';
import { useProjectStore } from '../../stores/project';
import AppButton from '../ui/AppButton.vue';
import AppIcon from '../ui/AppIcon.vue';
import RangeField from '../ui/RangeField.vue';
import SegmentedControl from '../ui/SegmentedControl.vue';
import SidebarSection from '../ui/SidebarSection.vue';
import TrackPositionField from './TrackPositionField.vue';
import { usePlaceLabel } from './usePlaceLabel';

/** The earthworks laid along the track, and the settings of the selected one. */
const store = useProjectStore();
const editor = useEditorStore();
const place = usePlaceLabel();

const earthworks = computed(() => store.project.earthworks);
const selected = computed(() => editor.selectedEarthwork);
const onTrack = computed(() => {
  const issue = store.issues.warnings.find((warning) => warning.code === 'earthwork-on-track');
  return issue?.code === 'earthwork-on-track' && !!selected.value
    ? issue.ids.includes(selected.value.id)
    : false;
});

const type = computed({
  get: () => selected.value?.type ?? 'embankment',
  set: (next: EarthworkType) => edit({ type: next }),
});
const types = EARTHWORK_TYPES.map((value) => ({
  value,
  label: t(`earthworks.${value}`),
  id: `earthwork-type-${value}`,
}));

/** Labels of the settings, as each type names them. */
const LABEL: Record<EarthworkType, Record<(typeof EARTHWORK_SETTING_NAMES)[number], MessageKey>> = {
  embankment: {
    offset: 'earthworks.offset',
    width: 'earthworks.slope',
    height: 'earthworks.height',
  },
  ditch: { offset: 'earthworks.offset', width: 'earthworks.width', height: 'earthworks.depth' },
  runoff: { offset: 'earthworks.offset', width: 'earthworks.width', height: 'earthworks.height' },
};
/** The settings the selected earthwork's type lets change; the width stops at the reach. */
const settings = computed(() => {
  const earthwork = selected.value;
  if (!earthwork) return [];
  return EARTHWORK_SETTING_NAMES.filter((setting) =>
    editableEarthwork(earthwork.type, setting),
  ).map((setting) => {
    const rule = EARTHWORK_RULES[earthwork.type][setting];
    return {
      setting,
      label: t(LABEL[earthwork.type][setting]),
      rule:
        setting === 'width'
          ? { ...rule, max: Math.min(rule.max, EARTHWORK_REACH - earthwork.offset) }
          : rule,
    };
  });
});

const rowLabel = (earthwork: Earthwork, index: number) =>
  t('earthworks.row', {
    index: String(index + 1).padStart(2, '0'),
    type: t(`earthworks.${earthwork.type}`),
    side: earthwork.side === 'right' ? t('barriers.sideRight') : t('barriers.sideLeft'),
    from: place(earthwork.from),
    to: place(earthwork.to),
  });

/** Changes the selected earthwork while a control is moved; the step closes on commit. */
function preview(patch: EarthworkPatch) {
  const earthwork = selected.value;
  if (earthwork)
    store.edit((draft) => updateEarthwork(draft, earthwork.id, patch), { commit: false });
}

function edit(patch: EarthworkPatch) {
  const earthwork = selected.value;
  if (earthwork) store.edit((draft) => updateEarthwork(draft, earthwork.id, patch));
}
</script>

<template>
  <SidebarSection :title="t('earthworks.title')">
    <template v-if="earthworks.length" #badge>
      <span id="earthwork-count">{{
        t(
          'earthworks.count',
          { count: String(earthworks.length).padStart(2, '0') },
          earthworks.length,
        )
      }}</span>
    </template>
    <div v-if="earthworks.length" class="rows">
      <button
        v-for="(earthwork, position) in earthworks"
        :id="`earthwork-row-${position}`"
        :key="earthwork.id"
        type="button"
        class="row"
        :class="{ active: earthwork.id === editor.selectedEarthworkId }"
        :title="rowLabel(earthwork, position)"
        @click="editor.selectEarthwork(earthwork.id)"
      >
        <span class="swatch" :style="{ background: COLORS.earthwork[earthwork.type] }"></span
        >{{ rowLabel(earthwork, position) }}
      </button>
    </div>
    <div v-if="selected" id="earthwork-editor" class="editor">
      <SegmentedControl v-model="type" :options="types" :label="t('earthworks.typeAria')" compact />
      <p id="earthwork-note" class="note">{{ t(`earthworks.${selected.type}Note`) }}</p>
      <RangeField
        v-for="field in settings"
        :id="`earthwork-${field.setting}`"
        :key="field.setting"
        :label="field.label"
        :value="selected[field.setting]"
        :rule="field.rule"
        @input="preview({ [field.setting]: $event })"
        @commit="store.commit()"
      />
      <TrackPositionField
        id="earthwork-from"
        :label="t('earthworks.from')"
        :position="selected.from"
        @input="preview({ from: $event })"
        @commit="store.commit()"
      />
      <TrackPositionField
        id="earthwork-to"
        :label="t('earthworks.to')"
        :position="selected.to"
        @input="preview({ to: $event })"
        @commit="store.commit()"
      />
      <p v-if="onTrack" id="earthwork-on-track" class="note warning" role="status">
        {{ t('earthworks.onTrack') }}
      </p>
      <div class="actions">
        <AppButton id="earthwork-swap" small @click="editor.swapSelectedEarthworkSide()">
          <AppIcon name="move" />{{ t('earthworks.swap') }}
        </AppButton>
        <AppButton
          id="earthwork-delete"
          class="delete"
          small
          @click="editor.deleteSelectedEarthwork()"
        >
          <AppIcon name="trash" />{{ t('earthworks.delete') }}
        </AppButton>
      </div>
    </div>
    <p v-else-if="!earthworks.length" id="earthwork-empty" class="note">
      {{ t('earthworks.empty') }}
    </p>
  </SidebarSection>
</template>

<style scoped>
.note {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.7;
  margin-top: 12px;
}
.warning {
  color: var(--red);
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
  background: var(--field);
  border: 1px solid #303d41;
  border-radius: 4px;
  color: #b9c4c2;
  font-size: 10px;
  padding: 6px 8px;
}
.row:hover {
  border-color: #3b4946;
  color: var(--text);
}
.row.active {
  border-color: var(--accent);
  color: var(--accent);
}
.swatch {
  flex: none;
  width: 14px;
  height: 4px;
  border-radius: 2px;
}
.editor {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.actions {
  display: flex;
  gap: 5px;
  margin-top: 12px;
}
.delete {
  margin-left: auto;
}
.delete:hover {
  color: var(--red);
}
</style>
