<script setup lang="ts">
import { computed } from 'vue';
import { updateWidthZone } from '../../core/project/edits';
import { RULES } from '../../core/project/rules';
import type { WidthZone } from '../../core/project/schema';
import { formatNumber, t } from '../../i18n';
import { useEditorStore } from '../../stores/editor';
import { useProjectStore } from '../../stores/project';
import AppButton from '../ui/AppButton.vue';
import AppIcon from '../ui/AppIcon.vue';
import RangeField from '../ui/RangeField.vue';
import SidebarSection from '../ui/SidebarSection.vue';
import TrackPositionField from './TrackPositionField.vue';
import { usePlaceLabel } from './usePlaceLabel';

const store = useProjectStore();
const editor = useEditorStore();

const zones = computed(() => store.project.widthZones);
const selected = computed(() => editor.selectedWidthZone);
const place = usePlaceLabel();

const status = computed(() => {
  if (editor.widthDraft !== null) return t('widths.statusDraft');
  if (editor.tool === 'width') return t('widths.statusTool');
  return zones.value.length ? t('widths.statusChoose') : t('widths.empty');
});
const rowLabel = (zone: WidthZone, index: number) =>
  t('widths.row', {
    index: String(index + 1).padStart(2, '0'),
    width: formatNumber(zone.width, zone.width % 1 ? 1 : 0),
    from: place(zone.from),
    to: place(zone.to),
  });

const preview = (patch: Parameters<typeof updateWidthZone>[2]) => {
  const zone = selected.value;
  if (zone) store.edit((draft) => updateWidthZone(draft, zone.id, patch), { commit: false });
};
</script>

<template>
  <SidebarSection :title="t('widths.title')">
    <template v-if="zones.length" #badge>
      <span id="width-count">{{
        t('widths.count', { count: String(zones.length).padStart(2, '0') }, zones.length)
      }}</span>
    </template>
    <AppButton
      id="width-draw"
      class="draw"
      :class="{ active: editor.tool === 'width' }"
      variant="secondary"
      small
      @click="editor.setTool('width')"
    >
      <AppIcon name="width" />{{ t('widths.draw') }} <kbd>L</kbd>
    </AppButton>
    <p id="width-status" class="note">{{ status }}</p>
    <div v-if="zones.length" class="rows">
      <button
        v-for="(zone, position) in zones"
        :id="`width-row-${position}`"
        :key="zone.id"
        type="button"
        class="row"
        :class="{ active: zone.id === editor.selectedWidthZoneId }"
        @click="editor.selectWidthZone(zone.id)"
      >
        {{ rowLabel(zone, position) }}
      </button>
    </div>
    <div v-if="selected" id="width-editor" class="editor">
      <RangeField
        id="width-zone-width"
        :label="t('widths.width')"
        :value="selected.width"
        :rule="RULES.width"
        @input="preview({ width: $event })"
        @commit="store.commit()"
      />
      <TrackPositionField
        id="width-from"
        :label="t('widths.from')"
        :position="selected.from"
        @input="preview({ from: $event })"
        @commit="store.commit()"
      />
      <TrackPositionField
        id="width-to"
        :label="t('widths.to')"
        :position="selected.to"
        @input="preview({ to: $event })"
        @commit="store.commit()"
      />
      <div class="actions">
        <AppButton id="width-delete" class="delete" small @click="editor.deleteSelectedWidthZone()">
          <AppIcon name="trash" />{{ t('widths.delete') }}
        </AppButton>
      </div>
    </div>
  </SidebarSection>
</template>

<style scoped>
.note {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.7;
  margin-top: 12px;
}
.draw {
  width: 100%;
  margin-top: 4px;
}
.draw.active {
  border-color: var(--accent);
  color: var(--accent);
}
.draw kbd {
  font-size: 9px;
  color: var(--muted);
  background: none;
  border: 1px solid var(--line-strong);
  padding: 1px 4px;
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 12px;
}
.row {
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
.editor {
  margin-top: 16px;
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
