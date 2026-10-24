<script setup lang="ts">
import { computed } from 'vue';
import { updateBankZone } from '../../core/project/edits';
import { RULES } from '../../core/project/rules';
import { SIDES } from '../../core/project/schema';
import type { BankZone, Side } from '../../core/project/schema';
import { formatNumber, t } from '../../i18n';
import { useEditorStore } from '../../stores/editor';
import { useProjectStore } from '../../stores/project';
import AppButton from '../ui/AppButton.vue';
import AppIcon from '../ui/AppIcon.vue';
import RangeField from '../ui/RangeField.vue';
import SegmentedControl from '../ui/SegmentedControl.vue';
import SidebarSection from '../ui/SidebarSection.vue';
import TrackPositionField from './TrackPositionField.vue';
import { usePlaceLabel } from './usePlaceLabel';

const store = useProjectStore();
const editor = useEditorStore();

const zones = computed(() => store.project.bankZones);
const selected = computed(() => editor.selectedBankZone);
const place = usePlaceLabel();

const status = computed(() => {
  if (editor.laying?.kind === 'bankZone') return t('banks.statusDraft');
  if (editor.tool === 'bank') return t('banks.statusTool');
  return zones.value.length ? t('banks.statusChoose') : t('banks.empty');
});
const rowLabel = (zone: BankZone, index: number) =>
  t('banks.row', {
    index: String(index + 1).padStart(2, '0'),
    angle: formatNumber(zone.angle, zone.angle % 1 ? 1 : 0),
    high: zone.high === 'right' ? t('barriers.sideRight') : t('barriers.sideLeft'),
    from: place(zone.from),
    to: place(zone.to),
  });

const sides = computed(() =>
  SIDES.map((value) => ({
    value,
    label: value === 'right' ? t('banks.highRight') : t('banks.highLeft'),
    id: `bank-high-${value}`,
  })),
);
const high = computed({
  get: () => selected.value?.high ?? 'right',
  set: (next: Side) => {
    const zone = selected.value;
    if (zone && zone.high !== next)
      store.edit((draft) => updateBankZone(draft, zone.id, { high: next }));
  },
});

const preview = (patch: Parameters<typeof updateBankZone>[2]) => {
  const zone = selected.value;
  if (zone) store.edit((draft) => updateBankZone(draft, zone.id, patch), { commit: false });
};
</script>

<template>
  <SidebarSection :title="t('banks.title')">
    <template v-if="zones.length" #badge>
      <span id="bank-count">{{
        t('banks.count', { count: String(zones.length).padStart(2, '0') }, zones.length)
      }}</span>
    </template>
    <AppButton
      id="bank-draw"
      class="draw"
      :class="{ active: editor.tool === 'bank' }"
      variant="secondary"
      small
      @click="editor.setTool('bank')"
    >
      <AppIcon name="banking" />{{ t('banks.draw') }} <kbd>D</kbd>
    </AppButton>
    <p id="bank-status" class="note">{{ status }}</p>
    <div v-if="zones.length" class="rows">
      <button
        v-for="(zone, position) in zones"
        :id="`bank-row-${position}`"
        :key="zone.id"
        type="button"
        class="row"
        :class="{ active: zone.id === selected?.id }"
        @click="editor.select({ kind: 'bankZone', id: zone.id })"
      >
        {{ rowLabel(zone, position) }}
      </button>
    </div>
    <div v-if="selected" id="bank-editor" class="editor">
      <RangeField
        id="bank-angle"
        :label="t('banks.angle')"
        :value="selected.angle"
        :rule="RULES.bankAngle"
        unit="°"
        @input="preview({ angle: $event })"
        @commit="store.commit()"
      />
      <RangeField
        id="bank-transition"
        :label="t('banks.transition')"
        :value="selected.transition"
        :rule="RULES.bankTransition"
        @input="preview({ transition: $event })"
        @commit="store.commit()"
      />
      <SegmentedControl v-model="high" :options="sides" :label="t('banks.high')" compact />
      <TrackPositionField
        id="bank-from"
        :label="t('banks.from')"
        :position="selected.from"
        @input="preview({ from: $event })"
        @commit="store.commit()"
      />
      <TrackPositionField
        id="bank-to"
        :label="t('banks.to')"
        :position="selected.to"
        @input="preview({ to: $event })"
        @commit="store.commit()"
      />
      <div class="actions">
        <AppButton id="bank-delete" class="delete" small @click="editor.deleteSelection()">
          <AppIcon name="trash" />{{ t('banks.delete') }}
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
